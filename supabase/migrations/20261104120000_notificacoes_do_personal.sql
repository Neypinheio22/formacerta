-- Notificações do personal para os alunos (04/11/2026, pedido do Romildo):
-- enviar na hora, agendar para um dia e hora, e mensagens recorrentes
-- (todo dia, dias da semana, a cada 2 semanas ou uma vez por mês).
-- O aluno recebe no celular (notificação da função enviar-push) e na tela
-- "Avisos do personal" dentro do app; se o personal marcar, vai também no chat.
-- Quem envia no horário é o cron "disparar-notificacoes", a cada minuto.
-- Pode rodar mais de uma vez.

-- ---------- Tabelas ----------

-- O que o personal criou (uma linha por envio na hora, agendamento ou recorrência).
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('agora', 'agendada', 'recorrente')),
  categoria text not null default '' check (categoria in ('', 'financeiro', 'treino')),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 80),
  texto text not null check (char_length(btrim(texto)) between 1 and 1000),
  -- Todos os alunos com conta no app (na hora de cada envio) ou só as fichas escolhidas.
  todos boolean not null default false,
  fichas uuid[] not null default '{}',
  -- Também escreve no chat com o aluno.
  no_chat boolean not null default false,
  -- Agendada: quando sai.
  enviar_em timestamptz,
  -- Recorrente (hora de Brasília).
  frequencia text check (frequencia in ('diaria', 'semanal', 'quinzenal', 'mensal')),
  dias_semana smallint[] not null default '{}',
  dia_mes smallint check (dia_mes between 1 and 31),
  hora time,
  inicio date,
  fim date,
  situacao text not null default 'ativa' check (situacao in ('ativa', 'pausada', 'enviada', 'cancelada', 'encerrada')),
  proximo_envio timestamptz,
  ultimo_envio timestamptz,
  envios integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or inicio is null or fim >= inicio),
  check (cardinality(fichas) <= 500)
);
create index if not exists notificacoes_fila_idx on public.notificacoes (proximo_envio) where situacao = 'ativa';
create index if not exists notificacoes_prof_idx on public.notificacoes (profissional_id, criado_em desc);
alter table public.notificacoes enable row level security;
drop policy if exists "ver minhas notificações" on public.notificacoes;
create policy "ver minhas notificações" on public.notificacoes for select to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.notificacoes from anon, authenticated;

-- O que cada aluno recebeu (caixa "Avisos do personal").
create table if not exists public.notificacoes_recebidas (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid references public.notificacoes (id) on delete set null,
  profissional_id uuid references public.perfis (id) on delete cascade,
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  categoria text not null default '',
  titulo text not null,
  texto text not null,
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);
create index if not exists notificacoes_recebidas_aluno_idx on public.notificacoes_recebidas (aluno_id, criado_em desc);
create index if not exists notificacoes_recebidas_notif_idx on public.notificacoes_recebidas (notificacao_id);
alter table public.notificacoes_recebidas enable row level security;
drop policy if exists "ver avisos" on public.notificacoes_recebidas;
create policy "ver avisos" on public.notificacoes_recebidas for select to authenticated
using (aluno_id = (select auth.uid()) or profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.notificacoes_recebidas from anon, authenticated;

-- ---------- Regras ----------

-- Próximo envio de uma recorrência depois de "depois" (null: acabou).
create or replace function public.proximo_envio_notificacao(n public.notificacoes, depois timestamptz) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  hoje date := (depois at time zone 'America/Sao_Paulo')::date;
  d date;
  base date;
  ultimo_dia integer;
  t timestamptz;
  vale boolean;
  i integer;
begin
  if n.tipo <> 'recorrente' or n.hora is null or n.frequencia is null then return null; end if;
  d := greatest(hoje, coalesce(n.inicio, hoje));
  -- A cada 2 semanas: conta a partir da semana do primeiro dia escolhido desde o início.
  base := coalesce(n.inicio, d);
  if n.frequencia = 'quinzenal' then
    i := 0;
    while not (extract(dow from base + i)::smallint = any (n.dias_semana)) loop
      i := i + 1;
      if i > 6 then return null; end if;
    end loop;
    base := date_trunc('week', (base + i)::timestamp)::date;
  end if;
  for i in 0..400 loop
    if n.fim is not null and d > n.fim then return null; end if;
    ultimo_dia := extract(day from (date_trunc('month', d::timestamp) + interval '1 month - 1 day'))::integer;
    vale := case n.frequencia
      when 'diaria' then true
      when 'semanal' then extract(dow from d)::smallint = any (n.dias_semana)
      when 'quinzenal' then extract(dow from d)::smallint = any (n.dias_semana) and ((d - base) / 7) % 2 = 0
      when 'mensal' then extract(day from d)::integer = least(coalesce(n.dia_mes, 1), ultimo_dia)
      else false
    end;
    if vale then
      t := (d + n.hora) at time zone 'America/Sao_Paulo';
      if t > depois then return t; end if;
    end if;
    d := d + 1;
  end loop;
  return null;
end
$$;

-- Alunos que recebem: fichas do personal com conta no app.
create or replace function public.destinatarios_notificacao(n public.notificacoes)
returns table (aluno_id uuid, nome text)
language sql stable security definer set search_path = '' as $$
  select distinct on (f.aluno_id) f.aluno_id, f.nome
  from public.fichas f
  where f.profissional_id = n.profissional_id and f.aluno_id is not null
    and (n.todos or f.id = any (n.fichas))
  order by f.aluno_id
$$;

-- Entrega agora para cada aluno: caixa de avisos + notificação no celular (ou chat).
create or replace function public.entregar_notificacao(notificacao uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n public.notificacoes;
  r record;
  texto text;
  recebida uuid;
  qtd integer := 0;
begin
  select * into n from public.notificacoes where id = notificacao;
  if n.id is null then return 0; end if;
  for r in select * from public.destinatarios_notificacao(n) loop
    -- {nome} vira o primeiro nome do aluno.
    texto := replace(n.texto, '{nome}', split_part(btrim(r.nome), ' ', 1));
    insert into public.notificacoes_recebidas (notificacao_id, profissional_id, aluno_id, categoria, titulo, texto)
    values (n.id, n.profissional_id, r.aluno_id, n.categoria, n.titulo, texto)
    returning id into recebida;
    if n.no_chat then
      -- A mensagem do chat já manda a notificação no celular.
      perform public.avisar_no_chat(r.aluno_id, n.profissional_id, n.profissional_id, left('🔔 ' || n.titulo || E'\n' || texto, 1000));
    else
      perform public.mandar_push('aviso', recebida);
    end if;
    qtd := qtd + 1;
  end loop;
  update public.notificacoes set envios = envios + 1, ultimo_envio = now() where id = n.id;
  return qtd;
end
$$;

-- Cron: manda o que chegou a hora (agendadas e recorrentes).
create or replace function public.disparar_notificacoes() returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.notificacoes;
begin
  for n in
    select * from public.notificacoes
    where situacao = 'ativa' and proximo_envio <= now()
    order by proximo_envio
    limit 200
    for update skip locked
  loop
    perform public.entregar_notificacao(n.id);
    if n.tipo = 'recorrente' then
      update public.notificacoes set proximo_envio = public.proximo_envio_notificacao(n, now()),
        situacao = case when public.proximo_envio_notificacao(n, now()) is null then 'encerrada' else 'ativa' end
      where id = n.id;
    else
      update public.notificacoes set situacao = 'enviada', proximo_envio = null where id = n.id;
    end if;
  end loop;
end
$$;

-- ---------- Funções do app ----------

-- Cria ou edita. dados: {id?, tipo, categoria, titulo, texto, todos, fichas[], no_chat,
-- data, hora (agendada, Brasília), frequencia, dias_semana[], dia_mes, hora, inicio, fim (recorrente)}.
-- Devolve {id, enviados}.
create or replace function public.salvar_notificacao(dados jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  n public.notificacoes;
  antiga public.notificacoes;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  qtd integer;
  enviados integer := 0;
begin
  if not (public.eh_profissional() or public.eh_admin()) then raise exception 'Só o personal manda notificações'; end if;

  if nullif(dados ->> 'id', '') is not null then
    select * into antiga from public.notificacoes where id = (dados ->> 'id')::uuid and profissional_id = eu;
    if antiga.id is null then raise exception 'Notificação não encontrada'; end if;
    if antiga.situacao not in ('ativa', 'pausada') then raise exception 'Esta notificação já foi enviada e não muda mais'; end if;
    n := antiga;
  else
    n.id := gen_random_uuid();
    n.profissional_id := eu;
    n.tipo := dados ->> 'tipo';
    n.situacao := 'ativa';
    n.envios := 0;
    n.criado_em := now();
  end if;
  if n.tipo not in ('agora', 'agendada', 'recorrente') then raise exception 'Escolha como enviar'; end if;

  n.categoria := coalesce(dados ->> 'categoria', '');
  if n.categoria not in ('', 'financeiro', 'treino') then n.categoria := ''; end if;
  n.titulo := left(btrim(coalesce(dados ->> 'titulo', '')), 80);
  n.texto := left(btrim(coalesce(dados ->> 'texto', '')), 1000);
  if n.titulo = '' then raise exception 'Escreva o título'; end if;
  if n.texto = '' then raise exception 'Escreva a mensagem'; end if;
  n.todos := coalesce((dados ->> 'todos')::boolean, false);
  n.fichas := case when n.todos then '{}' else coalesce(array(select jsonb_array_elements_text(coalesce(dados -> 'fichas', '[]'))::uuid), '{}') end;
  n.no_chat := coalesce((dados ->> 'no_chat')::boolean, false);
  n.dias_semana := coalesce(n.dias_semana, '{}');
  n.atualizado_em := now();

  if not n.todos then
    if cardinality(n.fichas) = 0 then raise exception 'Escolha pelo menos um aluno'; end if;
    if exists (select 1 from unnest(n.fichas) x where not exists (select 1 from public.fichas f where f.id = x and f.profissional_id = eu)) then
      raise exception 'Aluno não encontrado';
    end if;
  end if;
  select count(*) into qtd from public.destinatarios_notificacao(n);
  if qtd = 0 then
    raise exception '%', case when n.todos then 'Nenhum aluno seu tem conta no app ainda. Convide pelo WhatsApp em Meus alunos'
      else 'Os alunos escolhidos ainda não têm conta no app. Convide pelo WhatsApp em Meus alunos' end;
  end if;

  if n.tipo = 'agendada' then
    begin
      n.enviar_em := ((dados ->> 'data') || ' ' || (dados ->> 'hora'))::timestamp at time zone 'America/Sao_Paulo';
    exception when others then
      raise exception 'Escolha a data e o horário';
    end;
    if n.enviar_em is null then raise exception 'Escolha a data e o horário'; end if;
    if n.enviar_em < now() - interval '1 minute' then raise exception 'Esse horário já passou. Escolha outro'; end if;
    if n.enviar_em > now() + interval '1 year' then raise exception 'Agende para no máximo 1 ano'; end if;
    n.proximo_envio := n.enviar_em;
  elsif n.tipo = 'recorrente' then
    n.frequencia := dados ->> 'frequencia';
    if n.frequencia is null or n.frequencia not in ('diaria', 'semanal', 'quinzenal', 'mensal') then raise exception 'Escolha a frequência'; end if;
    n.dias_semana := coalesce(array(select distinct x::smallint from jsonb_array_elements_text(coalesce(dados -> 'dias_semana', '[]')) x where x::integer between 0 and 6 order by 1), '{}');
    if n.frequencia in ('semanal', 'quinzenal') and cardinality(n.dias_semana) = 0 then raise exception 'Escolha os dias da semana'; end if;
    n.dia_mes := nullif(dados ->> 'dia_mes', '')::smallint;
    if n.frequencia = 'mensal' and (n.dia_mes is null or n.dia_mes not between 1 and 31) then raise exception 'Escolha o dia do mês'; end if;
    begin
      n.hora := (dados ->> 'hora')::time;
      n.inicio := coalesce(nullif(dados ->> 'inicio', '')::date, hoje);
      n.fim := nullif(dados ->> 'fim', '')::date;
    exception when others then
      raise exception 'Confira o horário e as datas';
    end;
    if n.hora is null then raise exception 'Escolha o horário'; end if;
    if n.fim is not null and n.fim < n.inicio then raise exception 'A data de encerramento vem antes do início'; end if;
    n.proximo_envio := public.proximo_envio_notificacao(n, now());
    if n.proximo_envio is null then raise exception 'Com esses dias e datas não sobra nenhum envio. Confira o encerramento'; end if;
  else
    n.situacao := 'enviada';
    n.proximo_envio := null;
  end if;

  if antiga.id is null then
    insert into public.notificacoes select (n).*;
  else
    update public.notificacoes set categoria = n.categoria, titulo = n.titulo, texto = n.texto, todos = n.todos, fichas = n.fichas,
      no_chat = n.no_chat, enviar_em = n.enviar_em, frequencia = n.frequencia, dias_semana = n.dias_semana, dia_mes = n.dia_mes,
      hora = n.hora, inicio = n.inicio, fim = n.fim, proximo_envio = n.proximo_envio, atualizado_em = now()
    where id = n.id;
  end if;

  if n.tipo = 'agora' then enviados := public.entregar_notificacao(n.id); end if;
  return jsonb_build_object('id', n.id, 'enviados', enviados, 'alunos', qtd);
end
$$;

-- pausar, retomar, cancelar, excluir ou enviar_agora.
create or replace function public.mudar_notificacao(notificacao uuid, acao text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  n public.notificacoes;
  prox timestamptz;
begin
  select * into n from public.notificacoes where id = notificacao and (profissional_id = eu or public.eh_admin()) for update;
  if n.id is null then raise exception 'Notificação não encontrada'; end if;
  if acao = 'excluir' then
    delete from public.notificacoes where id = n.id;
  elsif acao = 'pausar' then
    if n.situacao <> 'ativa' or n.tipo = 'agora' then raise exception 'Esta notificação não está programada'; end if;
    update public.notificacoes set situacao = 'pausada', atualizado_em = now() where id = n.id;
  elsif acao = 'retomar' then
    if n.situacao <> 'pausada' then raise exception 'Esta notificação não está pausada'; end if;
    if n.tipo = 'agendada' then
      if n.enviar_em < now() then raise exception 'O horário agendado já passou. Toque em Editar e escolha outro'; end if;
      prox := n.enviar_em;
    else
      prox := public.proximo_envio_notificacao(n, now());
      if prox is null then raise exception 'A recorrência já terminou. Toque em Editar e mude o encerramento'; end if;
    end if;
    update public.notificacoes set situacao = 'ativa', proximo_envio = prox, atualizado_em = now() where id = n.id;
  elsif acao = 'cancelar' then
    if n.situacao not in ('ativa', 'pausada') then raise exception 'Esta notificação não está programada'; end if;
    update public.notificacoes set situacao = case when n.tipo = 'recorrente' then 'encerrada' else 'cancelada' end, proximo_envio = null, atualizado_em = now() where id = n.id;
  elsif acao = 'enviar_agora' then
    if n.situacao not in ('ativa', 'pausada') then raise exception 'Esta notificação não está programada'; end if;
    perform public.entregar_notificacao(n.id);
    if n.tipo = 'agendada' then
      update public.notificacoes set situacao = 'enviada', proximo_envio = null, atualizado_em = now() where id = n.id;
    end if;
  else
    raise exception 'Ação inválida';
  end if;
end
$$;

-- Lista do personal com quantos receberam e leram.
create or replace function public.minhas_notificacoes()
returns table (id uuid, tipo text, categoria text, titulo text, texto text, todos boolean, fichas uuid[], no_chat boolean,
  enviar_em timestamptz, frequencia text, dias_semana smallint[], dia_mes smallint, hora time, inicio date, fim date,
  situacao text, proximo_envio timestamptz, ultimo_envio timestamptz, envios integer, criado_em timestamptz,
  entregues bigint, lidas bigint, alunos bigint)
language sql stable security definer set search_path = '' as $$
  select n.id, n.tipo, n.categoria, n.titulo, n.texto, n.todos, n.fichas, n.no_chat,
    n.enviar_em, n.frequencia, n.dias_semana, n.dia_mes, n.hora, n.inicio, n.fim,
    n.situacao, n.proximo_envio, n.ultimo_envio, n.envios, n.criado_em,
    (select count(*) from public.notificacoes_recebidas r where r.notificacao_id = n.id),
    (select count(*) from public.notificacoes_recebidas r where r.notificacao_id = n.id and r.lida_em is not null),
    (select count(*) from public.destinatarios_notificacao(n))
  from public.notificacoes n
  where n.profissional_id = (select auth.uid())
  order by (n.situacao in ('ativa', 'pausada')) desc, coalesce(n.proximo_envio, n.ultimo_envio, n.criado_em) desc
  limit 300
$$;

-- Caixa do aluno.
create or replace function public.meus_avisos()
returns table (id uuid, categoria text, titulo text, texto text, criado_em timestamptz, lida_em timestamptz, profissional_nome text, profissional_foto text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.categoria, r.titulo, r.texto, r.criado_em, r.lida_em,
    coalesce(nullif(p.nome, ''), split_part(p.email, '@', 1)), p.foto_url
  from public.notificacoes_recebidas r
  left join public.perfis p on p.id = r.profissional_id
  where r.aluno_id = (select auth.uid())
  order by r.criado_em desc
  limit 200
$$;

create or replace function public.marcar_avisos_lidos() returns void
language sql security definer set search_path = '' as $$
  update public.notificacoes_recebidas set lida_em = now() where aluno_id = (select auth.uid()) and lida_em is null
$$;

-- ---------- Cron ----------
select cron.unschedule(jobid) from cron.job where jobname = 'disparar-notificacoes';
select cron.schedule('disparar-notificacoes', '* * * * *', $$select public.disparar_notificacoes()$$);

-- ---------- Permissões ----------
revoke execute on function public.salvar_notificacao(jsonb), public.mudar_notificacao(uuid, text), public.minhas_notificacoes(),
  public.meus_avisos(), public.marcar_avisos_lidos()
  from public, anon;
grant execute on function public.salvar_notificacao(jsonb), public.mudar_notificacao(uuid, text), public.minhas_notificacoes(),
  public.meus_avisos(), public.marcar_avisos_lidos()
  to authenticated;
revoke execute on function public.proximo_envio_notificacao(public.notificacoes, timestamptz), public.destinatarios_notificacao(public.notificacoes),
  public.entregar_notificacao(uuid), public.disparar_notificacoes()
  from public, anon, authenticated;
