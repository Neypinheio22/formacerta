-- Agente de WhatsApp do FormaCerta: guarda as conversas do número oficial.
-- Quem escreve nas tabelas é a função whatsapp-agente (chave de serviço).
-- Só o administrador lê pelo app (Administração → WhatsApp), responde (pela
-- própria função) e pausa ou devolve a conversa para o robô.

create table if not exists public.whatsapp_conversas (
  id uuid primary key default gen_random_uuid(),
  -- Número de quem escreveu, como o WhatsApp manda (ex.: 5511987654321).
  telefone text not null unique check (telefone ~ '^[0-9]{8,20}$'),
  nome text not null default '' check (char_length(nome) <= 120),
  -- Id do número do FormaCerta na Meta que recebeu a conversa (para responder depois).
  numero_id text not null default '',
  -- robo: o agente responde. humano: o Ney está atendendo e o robô fica quieto.
  atendimento text not null default 'robo' check (atendimento in ('robo', 'humano')),
  -- Até quando o robô fica quieto. Vazio com atendimento humano = até o Ney devolver.
  humano_ate timestamptz,
  motivo_humano text not null default '' check (char_length(motivo_humano) <= 500),
  ultimo_reenvio_em timestamptz,
  ultima_mensagem_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table if not exists public.whatsapp_mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.whatsapp_conversas (id) on delete cascade,
  -- Id da mensagem no WhatsApp: o mesmo aviso chegando duas vezes não responde duas vezes.
  wa_id text unique,
  -- entrada: a pessoa escreveu. robo: o agente respondeu. humano: o Ney respondeu pelo celular.
  autor text not null check (autor in ('entrada', 'robo', 'humano')),
  texto text not null default '' check (char_length(texto) <= 8000),
  criado_em timestamptz not null default now()
);

create index if not exists whatsapp_mensagens_conversa on public.whatsapp_mensagens (conversa_id, id desc);
create index if not exists whatsapp_conversas_recentes on public.whatsapp_conversas (ultima_mensagem_em desc);

alter table public.whatsapp_conversas enable row level security;
alter table public.whatsapp_mensagens enable row level security;

drop policy if exists "admin lê conversas do whatsapp" on public.whatsapp_conversas;
create policy "admin lê conversas do whatsapp" on public.whatsapp_conversas
  for select to authenticated using (public.eh_admin());

drop policy if exists "admin muda atendimento do whatsapp" on public.whatsapp_conversas;
create policy "admin muda atendimento do whatsapp" on public.whatsapp_conversas
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "admin lê mensagens do whatsapp" on public.whatsapp_mensagens;
create policy "admin lê mensagens do whatsapp" on public.whatsapp_mensagens
  for select to authenticated using (public.eh_admin());

revoke all on public.whatsapp_conversas, public.whatsapp_mensagens from anon;
grant select on public.whatsapp_conversas, public.whatsapp_mensagens to authenticated;
grant update (atendimento, humano_ate, motivo_humano) on public.whatsapp_conversas to authenticated;

-- O robô consulta a situação de um cadastro pelo e-mail que a pessoa digitou.
-- Devolve só o necessário para ajudar (sem nome, sem dados de saúde).
create or replace function public.whatsapp_situacao_cadastro(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
        'existe', true,
        'tipo', case when p.papel = 'profissional' then 'personal' else p.papel::text end,
        'email_confirmado', u.email_confirmed_at is not null,
        'situacao', p.situacao::text)
     from public.perfis p
     left join auth.users u on u.id = p.id
     where lower(p.email) = lower(trim(p_email))
     limit 1),
    jsonb_build_object('existe', false))
$$;

revoke execute on function public.whatsapp_situacao_cadastro(text) from public, anon, authenticated;
grant execute on function public.whatsapp_situacao_cadastro(text) to service_role;
