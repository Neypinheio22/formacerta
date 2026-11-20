-- WhatsApp, parte 4: organizar o atendimento (ideias do AtendeNex, sem vários atendentes).
--
-- 1) Etiquetas: cada conversa ganha uma etiqueta AUTOMÁTICA pela situação da
--    conta (Lead, Testando, Assinante, Vencido...) e quantas etiquetas MANUAIS o
--    administrador quiser (Anúncio, Personal, Retornar depois...), com cor.
-- 2) Funil (quadro em colunas): cada conversa fica numa etapa
--    (Novo, Em conversa, Fazer follow-up, Aguardando resposta, Fechou, Perdido).
-- 3) Mensagens agendadas: texto (e anexo, se quiser) para mandar num dia e hora.
--    O pg_cron que já roda a cada 5 minutos (whatsapp-lembretes) chama a função
--    whatsapp-agente, que manda as que chegaram na hora.

-- ---- 1) Etiquetas manuais ----
create table if not exists public.whatsapp_etiquetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(trim(nome)) between 1 and 30),
  cor text not null default '#36f294' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.whatsapp_etiquetas enable row level security;
drop policy if exists "admin cuida das etiquetas do whatsapp" on public.whatsapp_etiquetas;
create policy "admin cuida das etiquetas do whatsapp" on public.whatsapp_etiquetas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.whatsapp_etiquetas from anon;
grant select, insert, update, delete on public.whatsapp_etiquetas to authenticated;

insert into public.whatsapp_etiquetas (nome, cor, ordem) values
  ('Veio do anúncio', '#3b82f6', 1),
  ('Personal', '#a855f7', 2),
  ('Aluno', '#14b8a6', 3),
  ('Interessado', '#36f294', 4),
  ('Retornar depois', '#fb8d1a', 5),
  ('Achou caro', '#ff5a5f', 6)
on conflict (nome) do nothing;

-- ---- Conversa: etiquetas, etapa do funil e anotação ----
alter table public.whatsapp_conversas
  add column if not exists etiquetas uuid[] not null default '{}',
  add column if not exists etapa text not null default 'novo',
  add column if not exists etapa_em timestamptz not null default now(),
  add column if not exists anotacao text not null default '';

do $$ begin
  alter table public.whatsapp_conversas add constraint whatsapp_conversas_etapa
    check (etapa in ('novo', 'conversando', 'follow_up', 'aguardando', 'fechado', 'perdido'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.whatsapp_conversas add constraint whatsapp_conversas_anotacao
    check (char_length(anotacao) <= 1000);
exception when duplicate_object then null; end $$;

grant update (etiquetas, etapa, etapa_em, anotacao) on public.whatsapp_conversas to authenticated;

-- ---- 3) Mensagens agendadas ----
create table if not exists public.whatsapp_agendadas (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.whatsapp_conversas (id) on delete cascade,
  texto text not null default '' check (char_length(texto) <= 4000),
  -- Anexo opcional: link público (pasta whatsapp-anexos) e tipo.
  anexo_url text check (anexo_url is null or (anexo_url ~ '^https://' and char_length(anexo_url) <= 500)),
  anexo_tipo text check (anexo_tipo is null or anexo_tipo in ('imagem', 'documento')),
  anexo_nome text not null default '' check (char_length(anexo_nome) <= 120),
  enviar_em timestamptz not null,
  -- agendada → enviando → enviada | modelo (janela fechada, foi o modelo da Meta) | falhou; ou cancelada.
  situacao text not null default 'agendada' check (situacao in ('agendada', 'enviando', 'enviada', 'modelo', 'falhou', 'cancelada')),
  observacao text not null default '' check (char_length(observacao) <= 500),
  enviada_em timestamptz,
  criado_em timestamptz not null default now(),
  check (texto <> '' or anexo_url is not null)
);

create index if not exists whatsapp_agendadas_fila on public.whatsapp_agendadas (enviar_em) where situacao = 'agendada';
create index if not exists whatsapp_agendadas_conversa on public.whatsapp_agendadas (conversa_id, enviar_em desc);

alter table public.whatsapp_agendadas enable row level security;
drop policy if exists "admin lê agendadas do whatsapp" on public.whatsapp_agendadas;
create policy "admin lê agendadas do whatsapp" on public.whatsapp_agendadas
  for select to authenticated using (public.eh_admin());
drop policy if exists "admin agenda no whatsapp" on public.whatsapp_agendadas;
create policy "admin agenda no whatsapp" on public.whatsapp_agendadas
  for insert to authenticated with check (public.eh_admin() and situacao = 'agendada');
drop policy if exists "admin cancela agendadas do whatsapp" on public.whatsapp_agendadas;
create policy "admin cancela agendadas do whatsapp" on public.whatsapp_agendadas
  for update to authenticated using (public.eh_admin() and situacao = 'agendada') with check (public.eh_admin() and situacao in ('agendada', 'cancelada'));
revoke all on public.whatsapp_agendadas from anon;
grant select on public.whatsapp_agendadas to authenticated;
grant insert (conversa_id, texto, anexo_url, anexo_tipo, anexo_nome, enviar_em) on public.whatsapp_agendadas to authenticated;
grant update (situacao, texto, enviar_em) on public.whatsapp_agendadas to authenticated;

-- Pasta pública dos anexos (o WhatsApp baixa pelo link). Foto JPEG/PNG ou PDF, até 15 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('whatsapp-anexos', 'whatsapp-anexos', true, 15728640, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "whatsapp-anexos: admin lista" on storage.objects;
create policy "whatsapp-anexos: admin lista" on storage.objects for select to authenticated
using (bucket_id = 'whatsapp-anexos' and public.eh_admin());
drop policy if exists "whatsapp-anexos: admin envia" on storage.objects;
create policy "whatsapp-anexos: admin envia" on storage.objects for insert to authenticated
with check (bucket_id = 'whatsapp-anexos' and public.eh_admin());
drop policy if exists "whatsapp-anexos: admin apaga" on storage.objects;
create policy "whatsapp-anexos: admin apaga" on storage.objects for delete to authenticated
using (bucket_id = 'whatsapp-anexos' and public.eh_admin());

-- ---- Painel: conversas com a etiqueta automática ----
-- DDD + 8 últimos números: casa o número do WhatsApp (5511 + 8 dígitos, às vezes
-- sem o 9) com o WhatsApp que a pessoa pôs no cadastro (11 9 + 8 dígitos).
create or replace function public.whatsapp_chave_telefone(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d is null or length(d) < 10 then null
    else substr(d, 1, 2) || right(d, 8)
  end
  from (select case
      when length(x) >= 12 and left(x, 2) = '55' then substr(x, 3)
      when length(x) >= 10 and left(x, 1) = '0' then substr(x, 2)
      else x end as d
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) a) b
$$;

create or replace function public.whatsapp_painel() returns table (
  id uuid,
  telefone text,
  nome text,
  atendimento text,
  humano_ate timestamptz,
  motivo_humano text,
  ultima_mensagem_em timestamptz,
  ultima_entrada_em timestamptz,
  etiquetas uuid[],
  etapa text,
  etapa_em timestamptz,
  anotacao text,
  situacao text,
  conta_nome text,
  conta_tipo text,
  conta_ligada boolean,
  plano text,
  valido_ate timestamptz,
  ultimo_autor text,
  agendadas integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador'; end if;
  return query
  select
    c.id, c.telefone, c.nome, c.atendimento, c.humano_ate, c.motivo_humano, c.ultima_mensagem_em, c.ultima_entrada_em,
    c.etiquetas, c.etapa, c.etapa_em, c.anotacao,
    -- Etiqueta automática pela situação da conta.
    case
      when p.id is null then 'lead'
      when p.papel = 'admin' then 'equipe'
      when a.id is null then 'cadastrado'
      when a.cortesia then 'cortesia'
      when a.situacao = 'aguardando' then 'aguardando_pagamento'
      when a.situacao = 'teste' and coalesce(a.valido_ate, now()) > now() then 'testando'
      when a.situacao = 'ativa' and a.valor > 0 and coalesce(a.valido_ate, now() + interval '1 day') > now() then 'assinante'
      when a.situacao in ('vencida', 'teste', 'ativa') and a.valido_ate is not null and a.valido_ate <= now() then 'vencido'
      else 'cadastrado'
    end,
    p.nome,
    case when p.papel = 'profissional' then 'personal' else p.papel::text end,
    c.usuario_id is not null,
    pl.nome,
    a.valido_ate,
    (select m.autor from public.whatsapp_mensagens m where m.conversa_id = c.id order by m.id desc limit 1),
    (select count(*)::int from public.whatsapp_agendadas g where g.conversa_id = c.id and g.situacao = 'agendada')
  from public.whatsapp_conversas c
  left join lateral (
    select x.* from public.perfis x
    where x.id = c.usuario_id
       or (c.usuario_id is null and x.whatsapp <> '' and public.whatsapp_chave_telefone(x.whatsapp) = public.whatsapp_chave_telefone(c.telefone))
    order by (x.id = c.usuario_id) desc nulls last, x.criado_em desc
    limit 1
  ) p on true
  left join lateral (
    select s.* from public.assinaturas s
    where s.usuario_id = p.id and s.situacao <> 'cancelada'
    order by s.criado_em desc limit 1
  ) a on true
  left join public.planos pl on pl.id = a.plano_id
  order by c.ultima_mensagem_em desc
  limit 300;
end
$$;

revoke execute on function public.whatsapp_painel() from public, anon;
grant execute on function public.whatsapp_painel() to authenticated;
