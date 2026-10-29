-- Chat dentro do app entre aluno e personal. O aluno tira dúvidas e contrata
-- pelo app (avaliação, treino...), sem ver o WhatsApp do personal. Telefone,
-- e-mail e links digitados no chat ficam ocultos enquanto o administrador quiser.

-- Regra do bloqueio de contato no chat:
--   ate_contratar = oculta até o aluno ter um pagamento pago para esse personal
--   sempre        = oculta sempre
--   nunca         = não oculta
alter table public.config_cobranca
  add column if not exists chat_bloqueio text not null default 'ate_contratar' check (chat_bloqueio in ('ate_contratar', 'sempre', 'nunca'));

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  ultima_previa text not null default '',
  -- Até quando cada lado já leu.
  lida_aluno_em timestamptz not null default now(),
  lida_profissional_em timestamptz not null default '-infinity',
  unique (aluno_id, profissional_id),
  check (aluno_id <> profissional_id)
);

create index conversas_profissional_idx on public.conversas (profissional_id, ultima_em desc);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  autor_id uuid not null references public.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) <= 1000),
  -- Proposta do personal: o serviço que o aluno pode pagar pelo app.
  servico_id uuid references public.servicos (id) on delete set null,
  -- Algum contato foi escondido nesta mensagem.
  oculto boolean not null default false,
  criado_em timestamptz not null default now()
);

create index mensagens_conversa_idx on public.mensagens (conversa_id, criado_em);

alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;

-- Cada um vê as suas conversas; o administrador vê todas (denúncia).
-- Criar e mandar mensagem só pelas funções abaixo.
create policy "ver conversas" on public.conversas for select to authenticated
using (aluno_id = (select auth.uid()) or profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.conversas from authenticated, anon;

create policy "ver mensagens" on public.mensagens for select to authenticated
using (exists (
  select 1 from public.conversas c
  where c.id = conversa_id and (c.aluno_id = (select auth.uid()) or c.profissional_id = (select auth.uid()) or public.eh_admin())
));
revoke insert, update, delete on public.mensagens from authenticated, anon;

-- O aluno também vê os serviços à venda do personal com quem conversa.
create policy "ver serviços da conversa" on public.servicos for select to authenticated
using (ativo and exists (
  select 1 from public.conversas c where c.aluno_id = (select auth.uid()) and c.profissional_id = servicos.profissional_id
));

-- Esconde telefone, e-mail, links e pedidos de "me chama no zap".
create function public.ocultar_contato(t text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  r text := t;
begin
  r := regexp_replace(r, '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[contato oculto]', 'g');
  r := regexp_replace(r, '(https?://|www\.)[^[:space:]]+', '[contato oculto]', 'gi');
  r := regexp_replace(r, '\m(wa\.me|chat\.whatsapp\.com|instagram\.com|t\.me)[^[:space:]]*', '[contato oculto]', 'gi');
  -- 8 ou mais dígitos seguidos, com ou sem espaço, ponto, traço ou parênteses.
  r := regexp_replace(r, '\+?\(?\d([[:space:]().-]*\d){7,}', '[contato oculto]', 'g');
  r := regexp_replace(r, '\m(whats[[:alpha:]]*|zap(zap)?|wpp|zapp|telegram|insta(gram)?)\M', '[contato oculto]', 'gi');
  return r;
end
$$;

-- O aluno abre (ou reabre) a conversa com um personal da lista.
create function public.abrir_conversa(profissional uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  id_conversa uuid;
begin
  if not public.eh_liberado() then raise exception 'Sua conta ainda não foi liberada'; end if;
  if profissional = eu then raise exception 'Não dá para conversar com você mesmo'; end if;
  if not exists (
    select 1 from public.perfis p
    where p.id = profissional and p.papel in ('profissional', 'admin') and p.situacao = 'liberado'
      and (p.aparecer_na_lista or p.id = public.meu_profissional())
  ) then
    raise exception 'Este profissional não está disponível para conversa';
  end if;

  insert into public.conversas (aluno_id, profissional_id) values (eu, profissional)
  on conflict (aluno_id, profissional_id) do update set aluno_id = excluded.aluno_id
  returning id into id_conversa;
  return id_conversa;
end
$$;

-- Manda uma mensagem. O personal pode anexar uma proposta (serviço dele).
create function public.enviar_mensagem(conversa uuid, texto text, servico uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  c public.conversas;
  modo text;
  limpo text := btrim(coalesce(texto, ''));
  final text;
  id_mensagem uuid;
begin
  select * into c from public.conversas where id = conversa;
  if c.id is null or eu not in (c.aluno_id, c.profissional_id) then raise exception 'Conversa não encontrada'; end if;
  if limpo = '' and servico is null then raise exception 'Escreva a mensagem'; end if;
  if char_length(limpo) > 1000 then raise exception 'Mensagem muito longa (até 1000 letras)'; end if;
  if servico is not null and (eu <> c.profissional_id or not exists (
    select 1 from public.servicos s where s.id = servico and s.profissional_id = eu and s.ativo
  )) then
    raise exception 'Proposta inválida';
  end if;

  select chat_bloqueio into modo from public.config_cobranca;
  if modo = 'sempre' or (coalesce(modo, 'ate_contratar') = 'ate_contratar' and not exists (
    select 1 from public.pagamentos pg
    where pg.pagador_id = c.aluno_id and pg.recebedor_id = c.profissional_id and pg.situacao = 'pago'
  )) then
    final := public.ocultar_contato(limpo);
  else
    final := limpo;
  end if;

  insert into public.mensagens (conversa_id, autor_id, texto, servico_id, oculto)
  values (c.id, eu, final, servico, final <> limpo)
  returning id into id_mensagem;

  update public.conversas
  set ultima_em = now(),
      ultima_previa = left(case when final = '' then 'Proposta enviada' else final end, 120),
      lida_aluno_em = case when eu = c.aluno_id then now() else lida_aluno_em end,
      lida_profissional_em = case when eu = c.profissional_id then now() else lida_profissional_em end
  where id = c.id;
  return id_mensagem;
end
$$;

create function public.marcar_conversa_lida(conversa uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversas
  set lida_aluno_em = case when aluno_id = (select auth.uid()) then now() else lida_aluno_em end,
      lida_profissional_em = case when profissional_id = (select auth.uid()) then now() else lida_profissional_em end
  where id = conversa
$$;

-- Lista de conversas com o nome e a foto da outra pessoa e quantas não foram lidas.
-- todas = true: o administrador vê as conversas de todo mundo.
create function public.minhas_conversas(todas boolean default false)
returns table (id uuid, aluno_id uuid, profissional_id uuid, aluno_nome text, profissional_nome text, profissional_foto text, ultima_em timestamptz, ultima_previa text, nao_lidas integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.aluno_id, c.profissional_id,
    coalesce(nullif(a.nome, ''), split_part(a.email, '@', 1)),
    coalesce(nullif(p.nome, ''), split_part(p.email, '@', 1)),
    p.foto_url, c.ultima_em, c.ultima_previa,
    (select count(*)::int from public.mensagens m
     where m.conversa_id = c.id and m.autor_id <> (select auth.uid())
       and m.criado_em > case when c.aluno_id = (select auth.uid()) then c.lida_aluno_em else c.lida_profissional_em end)
  from public.conversas c
  join public.perfis a on a.id = c.aluno_id
  join public.perfis p on p.id = c.profissional_id
  where c.aluno_id = (select auth.uid()) or c.profissional_id = (select auth.uid()) or (todas and public.eh_admin())
  order by c.ultima_em desc
  limit 200
$$;

-- O aluno agora também compra do personal com quem conversa no chat.
create or replace function public.comprar_avaliacao(servico uuid, forma text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.servicos;
  pct numeric;
  id_pagamento uuid;
begin
  if not public.eh_liberado() then raise exception 'Sua conta ainda não foi liberada'; end if;
  if forma not in ('pix', 'cartao', 'boleto') then raise exception 'Forma de pagamento inválida'; end if;
  select * into s from public.servicos where id = servico and ativo;
  if s.id is null or (
    s.profissional_id is distinct from public.meu_profissional()
    and not exists (select 1 from public.conversas c where c.aluno_id = (select auth.uid()) and c.profissional_id = s.profissional_id)
  ) then
    raise exception 'Este serviço não é do seu personal';
  end if;
  select comissao_pct into pct from public.config_cobranca;

  insert into public.pagamentos (pagador_id, recebedor_id, tipo, servico_id, descricao, valor, comissao, forma)
  values ((select auth.uid()), s.profissional_id, 'avaliacao', s.id, s.nome, s.preco, round(s.preco * pct / 100, 2), forma)
  returning id into id_pagamento;
  return id_pagamento;
end
$$;

-- A lista "Encontrar personal" não entrega mais o WhatsApp: o aluno fala pelo chat.
create or replace function public.profissionais_habilitados()
returns table (id uuid, nome text, registro text, cidade text, especialidade text, bio text, whatsapp text, foto_url text, liberado_desde timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.registro, p.cidade, p.especialidade, p.bio, ''::text, p.foto_url, p.criado_em
  from public.perfis p
  where p.papel in ('profissional', 'admin')
    and p.situacao = 'liberado'
    and p.aparecer_na_lista
    and btrim(p.registro) <> ''
    and public.eh_liberado()
  order by p.nome
$$;

revoke execute on function public.abrir_conversa, public.enviar_mensagem, public.marcar_conversa_lida, public.minhas_conversas from public, anon;
grant execute on function public.abrir_conversa, public.enviar_mensagem, public.marcar_conversa_lida, public.minhas_conversas to authenticated;
revoke execute on function public.profissionais_habilitados, public.comprar_avaliacao from public, anon;
grant execute on function public.profissionais_habilitados, public.comprar_avaliacao to authenticated;
