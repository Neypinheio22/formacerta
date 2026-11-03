-- Itens 11 a 14 da auditoria (03/11/2026):
-- 11. Notificação no celular: mensagem nova no chat, aluno chamando por vídeo e
--     lembrete do treino agendado (função enviar-push, Web Push sem custo).
-- 13. Créditos de vídeo com validade (60 dias, o administrador muda).
-- 14. Agenda: o personal marca os horários da semana e o aluno agenda a chamada.
-- Pode rodar mais de uma vez.

create extension if not exists pg_net with schema extensions;

-- ---------- 11. Notificações ----------

-- Chaves do Web Push (geradas pela própria função na primeira vez). Ninguém do app lê.
create table if not exists public.push_chaves (
  id boolean primary key default true check (id),
  publica text not null,
  privada jsonb not null,
  criado_em timestamptz not null default now()
);
alter table public.push_chaves enable row level security;
revoke all on public.push_chaves from anon, authenticated;

-- Cada celular/navegador que aceitou receber notificações.
create table if not exists public.push_inscricoes (
  endpoint text primary key,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);
create index if not exists push_inscricoes_usuario_idx on public.push_inscricoes (usuario_id);
alter table public.push_inscricoes enable row level security;
revoke all on public.push_inscricoes from anon, authenticated;

-- O que já foi avisado (a função não repete a mesma notificação).
create table if not exists public.push_enviados (
  chave text primary key,
  em timestamptz not null default now()
);
alter table public.push_enviados enable row level security;
revoke all on public.push_enviados from anon, authenticated;

-- O celular de quem está usando o app passa a receber notificações.
create or replace function public.salvar_inscricao_push(endpoint text, p256dh text, auth text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Entre na sua conta'; end if;
  if endpoint !~ '^https://' or length(endpoint) > 1000 or length(p256dh) > 200 or length(auth) > 100 then
    raise exception 'Inscrição inválida';
  end if;
  insert into public.push_inscricoes (endpoint, usuario_id, p256dh, auth)
  values (salvar_inscricao_push.endpoint, (select auth.uid()), salvar_inscricao_push.p256dh, salvar_inscricao_push.auth)
  on conflict on constraint push_inscricoes_pkey do update set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, criado_em = now();
end
$$;

create or replace function public.apagar_inscricao_push(endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_inscricoes where push_inscricoes.endpoint = apagar_inscricao_push.endpoint and usuario_id = (select auth.uid())
$$;

-- Pede à função enviar-push para avisar. Nunca trava o que chamou.
create or replace function public.mandar_push(tipo text, id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/enviar-push',
    body := jsonb_build_object('tipo', tipo, 'id', id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  raise warning 'mandar_push: %', sqlerrm;
end
$$;

create or replace function public.push_mensagem() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.mandar_push('mensagem', new.id);
  return new;
end
$$;

drop trigger if exists push_mensagem on public.mensagens;
create trigger push_mensagem after insert on public.mensagens
for each row execute function public.push_mensagem();

create or replace function public.push_chamada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.situacao = 'chamando' and old.situacao is distinct from 'chamando' then
    perform public.mandar_push('chamada', new.id);
  end if;
  return new;
end
$$;

drop trigger if exists push_chamada on public.chamadas_video;
create trigger push_chamada after update of situacao on public.chamadas_video
for each row execute function public.push_chamada();

-- ---------- 13. Validade dos créditos de vídeo ----------

alter table public.config_cobranca add column if not exists validade_video_dias integer not null default 60;
alter table public.config_cobranca drop constraint if exists config_cobranca_validade_video_check;
alter table public.config_cobranca add constraint config_cobranca_validade_video_check check (validade_video_dias between 7 and 365);

alter table public.chamadas_video add column if not exists vence_em timestamptz;
alter table public.chamadas_video drop constraint if exists chamadas_video_situacao_check;
alter table public.chamadas_video add constraint chamadas_video_situacao_check
  check (situacao in ('credito', 'chamando', 'em_andamento', 'feita', 'cancelada', 'vencida'));
-- Créditos que já existiam: 60 dias a partir da compra.
update public.chamadas_video set vence_em = criado_em + interval '60 days' where vence_em is null and situacao = 'credito';

create or replace function public.creditos_de_video() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.catalogo_servicos;
  n integer;
  dias integer;
begin
  if new.situacao <> 'pago' or old.situacao = 'pago' or new.servico_id is null or new.recebedor_id is null then return new; end if;
  select cat.* into c from public.servicos s join public.catalogo_servicos cat on cat.id = s.catalogo_id
  where s.id = new.servico_id and cat.grupo = 'video';
  if c.id is null then return new; end if;
  if exists (select 1 from public.chamadas_video where pagamento_id = new.id) then return new; end if;
  select coalesce(validade_video_dias, 60) into dias from public.config_cobranca;
  n := greatest(coalesce(c.video_chamadas, 1), 1);
  insert into public.chamadas_video (pagamento_id, aluno_id, profissional_id, minutos, valor, comissao, vence_em)
  select new.id, new.pagador_id, new.recebedor_id, coalesce(c.video_minutos, 30), round(new.valor / n, 2), round(new.comissao / n, 2),
    now() + make_interval(days => coalesce(dias, 60))
  from generate_series(1, n);
  return new;
end
$$;

-- ---------- 14. Agenda ----------

-- Horários da semana em que o personal aceita agendamento (hora de Brasília).
create table if not exists public.horarios_video (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  check (fim > inicio)
);
create index if not exists horarios_video_prof_idx on public.horarios_video (profissional_id);
alter table public.horarios_video enable row level security;
drop policy if exists "ver meus horários" on public.horarios_video;
create policy "ver meus horários" on public.horarios_video for select to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.horarios_video from anon, authenticated;

-- Cada treino agendado usa um crédito do aluno (o crédito só é gasto quando o personal atende).
create table if not exists public.agendamentos_video (
  id uuid primary key default gen_random_uuid(),
  chamada_id uuid not null references public.chamadas_video (id) on delete cascade,
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  inicio timestamptz not null,
  minutos integer not null,
  situacao text not null default 'marcado' check (situacao in ('marcado', 'cancelado')),
  cancelado_por uuid references public.perfis (id) on delete set null,
  lembrete_em timestamptz,
  criado_em timestamptz not null default now()
);
create unique index if not exists agendamentos_video_credito_idx on public.agendamentos_video (chamada_id) where situacao = 'marcado';
create index if not exists agendamentos_video_prof_idx on public.agendamentos_video (profissional_id, inicio);
alter table public.agendamentos_video enable row level security;
drop policy if exists "ver agendamentos" on public.agendamentos_video;
create policy "ver agendamentos" on public.agendamentos_video for select to authenticated
using (aluno_id = (select auth.uid()) or profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.agendamentos_video from anon, authenticated;

-- Vence créditos parados (menos os que estão agendados), além do que já fazia.
create or replace function public.arrumar_chamadas_video() returns void
language sql security definer set search_path = '' as $$
  update public.chamadas_video set situacao = 'credito', chamando_em = null
  where situacao = 'chamando' and chamando_em < now() - interval '2 minutes';
  update public.chamadas_video set situacao = 'feita', fim_em = inicio_em + make_interval(mins => minutos)
  where situacao = 'em_andamento' and inicio_em + make_interval(mins => minutos + 5) < now();
  update public.chamadas_video ch set situacao = 'vencida'
  where ch.situacao = 'credito' and ch.vence_em < now()
    and not exists (select 1 from public.agendamentos_video a where a.chamada_id = ch.id and a.situacao = 'marcado' and a.inicio + make_interval(mins => a.minutos) > now());
$$;

-- O personal troca os horários da semana de uma vez: [{dia_semana, inicio, fim}].
create or replace function public.salvar_horarios_video(horarios jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
begin
  if not (public.eh_profissional() or public.eh_admin()) then raise exception 'Só o personal marca horários'; end if;
  if jsonb_typeof(horarios) <> 'array' or jsonb_array_length(horarios) > 40 then raise exception 'Horários inválidos'; end if;
  delete from public.horarios_video where profissional_id = eu;
  insert into public.horarios_video (profissional_id, dia_semana, inicio, fim)
  select eu, h.dia_semana, h.inicio, h.fim
  from jsonb_to_recordset(horarios) as h(dia_semana smallint, inicio time, fim time)
  where h.dia_semana between 0 and 6 and h.fim > h.inicio;
end
$$;

-- Horários livres do personal nos próximos 14 dias para uma chamada de tantos minutos.
-- Começam de 30 em 30 minutos, com pelo menos 1 hora de antecedência.
create or replace function public.horarios_livres_video(profissional uuid, minutos integer default 30)
returns table (inicio timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  d integer;
  dia date;
  h public.horarios_video;
  t timestamptz;
  fim_janela timestamptz;
  dur interval := make_interval(mins => least(greatest(coalesce(horarios_livres_video.minutos, 30), 5), 120));
begin
  for d in 0..13 loop
    dia := hoje + d;
    for h in select * from public.horarios_video hv where hv.profissional_id = profissional and hv.dia_semana = extract(dow from dia) order by hv.inicio loop
      t := (dia + h.inicio) at time zone 'America/Sao_Paulo';
      fim_janela := (dia + h.fim) at time zone 'America/Sao_Paulo';
      while t + dur <= fim_janela loop
        if t > now() + interval '1 hour' and not exists (
          select 1 from public.agendamentos_video a
          where a.profissional_id = profissional and a.situacao = 'marcado'
            and a.inicio < t + dur and a.inicio + make_interval(mins => a.minutos) > t
        ) then
          inicio := t;
          return next;
        end if;
        t := t + interval '30 minutes';
      end loop;
    end loop;
  end loop;
end
$$;

-- Escreve no chat dos dois (o aviso no celular sai pela notificação da mensagem).
create or replace function public.avisar_no_chat(aluno uuid, profissional uuid, autor uuid, texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  conversa uuid;
begin
  insert into public.conversas (aluno_id, profissional_id) values (aluno, profissional)
  on conflict (aluno_id, profissional_id) do nothing;
  select id into conversa from public.conversas where aluno_id = aluno and profissional_id = profissional;
  insert into public.mensagens (conversa_id, autor_id, texto) values (conversa, autor, left(texto, 1000));
  update public.conversas set ultima_em = now(), ultima_previa = left(texto, 120),
    lida_aluno_em = case when autor = aluno then now() else lida_aluno_em end,
    lida_profissional_em = case when autor = profissional then now() else lida_profissional_em end
  where id = conversa;
end
$$;

create or replace function public.data_hora_br(t timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(t at time zone 'America/Sao_Paulo', 'DD/MM') || ' às ' || to_char(t at time zone 'America/Sao_Paulo', 'HH24:MI')
$$;

-- Aluno agenda um horário usando um crédito livre com este personal.
create or replace function public.agendar_video(profissional uuid, inicio timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  ch public.chamadas_video;
  novo uuid;
begin
  perform public.arrumar_chamadas_video();
  select c.* into ch from public.chamadas_video c
  where c.aluno_id = eu and c.profissional_id = profissional and c.situacao = 'credito'
    and not exists (select 1 from public.agendamentos_video a where a.chamada_id = c.id and a.situacao = 'marcado')
  order by c.vence_em nulls last, c.criado_em
  limit 1 for update skip locked;
  if ch.id is null then raise exception 'Você não tem chamada de vídeo livre com este personal. Compre uma no chat'; end if;
  if not exists (select 1 from public.horarios_livres_video(profissional, ch.minutos) l where l.inicio = agendar_video.inicio) then
    raise exception 'Este horário não está mais livre. Escolha outro';
  end if;
  insert into public.agendamentos_video (chamada_id, aluno_id, profissional_id, inicio, minutos)
  values (ch.id, eu, profissional, agendar_video.inicio, ch.minutos)
  returning id into novo;
  -- O crédito não vence antes do treino agendado.
  update public.chamadas_video set vence_em = agendar_video.inicio + interval '1 day'
  where id = ch.id and (vence_em is null or vence_em < agendar_video.inicio + interval '1 day');
  perform public.avisar_no_chat(eu, profissional, eu,
    '📅 Treino por vídeo agendado: ' || public.data_hora_br(agendar_video.inicio) || ' (' || ch.minutos || ' min).');
  return novo;
end
$$;

-- Aluno (até 2 horas antes) ou personal (a qualquer hora) desmarca. O crédito continua do aluno.
create or replace function public.cancelar_agendamento_video(agendamento uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  a public.agendamentos_video;
begin
  select * into a from public.agendamentos_video where id = agendamento and situacao = 'marcado' and eu in (aluno_id, profissional_id);
  if a.id is null then raise exception 'Agendamento não encontrado'; end if;
  if eu = a.aluno_id and a.inicio < now() + interval '2 hours' then
    raise exception 'Faltam menos de 2 horas. Combine com o personal pelo chat';
  end if;
  update public.agendamentos_video set situacao = 'cancelado', cancelado_por = eu where id = a.id;
  perform public.avisar_no_chat(a.aluno_id, a.profissional_id, eu,
    '❌ Treino por vídeo de ' || public.data_hora_br(a.inicio) || ' desmarcado.' ||
    case when eu = a.profissional_id then ' A chamada continua guardada para agendar outro horário.' else '' end);
end
$$;

-- Próximos treinos agendados de quem está usando o app.
create or replace function public.meus_agendamentos_video()
returns table (id uuid, aluno_id uuid, profissional_id uuid, aluno_nome text, profissional_nome text, inicio timestamptz, minutos integer, chamada_situacao text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.aluno_id, a.profissional_id,
    coalesce(nullif(al.nome, ''), split_part(al.email, '@', 1)),
    coalesce(nullif(p.nome, ''), split_part(p.email, '@', 1)),
    a.inicio, a.minutos, ch.situacao
  from public.agendamentos_video a
  join public.perfis al on al.id = a.aluno_id
  join public.perfis p on p.id = a.profissional_id
  join public.chamadas_video ch on ch.id = a.chamada_id
  where a.situacao = 'marcado' and (select auth.uid()) in (a.aluno_id, a.profissional_id)
    and a.inicio + make_interval(mins => a.minutos) > now()
    and ch.situacao in ('credito', 'chamando', 'em_andamento')
  order by a.inicio
  limit 100
$$;

-- No horário agendado (10 min antes até o fim) o aluno chama mesmo sem o "Disponível agora".
create or replace function public.chamar_video(profissional uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  id_chamada uuid;
  limite integer;
  agendada uuid;
begin
  perform public.arrumar_chamadas_video();
  select a.chamada_id into agendada from public.agendamentos_video a
  join public.chamadas_video c on c.id = a.chamada_id
  where a.aluno_id = eu and a.profissional_id = profissional and a.situacao = 'marcado'
    and now() between a.inicio - interval '10 minutes' and a.inicio + make_interval(mins => a.minutos)
    and c.situacao in ('credito', 'chamando', 'em_andamento')
  order by a.inicio limit 1;

  select d.vagas into limite from public.disponibilidade_video d where d.profissional_id = profissional and d.ate > now();
  if limite is null and agendada is null then
    raise exception 'O personal não está disponível para vídeo agora';
  end if;
  -- Já está chamando ou na sala: devolve a mesma.
  select id into id_chamada from public.chamadas_video
  where aluno_id = eu and profissional_id = profissional and situacao in ('chamando', 'em_andamento') limit 1;
  if id_chamada is not null then return id_chamada; end if;

  if agendada is not null then
    id_chamada := agendada;
  else
    if (select count(*) from public.chamadas_video where profissional_id = profissional and situacao in ('chamando', 'em_andamento')) >= limite then
      raise exception 'A sala do personal está cheia agora. Tente de novo daqui a pouco';
    end if;
    -- Crédito livre (não agendado para outro dia), o que vence primeiro.
    select c.id into id_chamada from public.chamadas_video c
    where c.aluno_id = eu and c.profissional_id = profissional and c.situacao = 'credito'
      and not exists (select 1 from public.agendamentos_video a where a.chamada_id = c.id and a.situacao = 'marcado')
    order by c.vence_em nulls last, c.criado_em limit 1 for update skip locked;
    if id_chamada is null then raise exception 'Você não tem chamada de vídeo livre com este personal. Compre uma no chat'; end if;
  end if;

  update public.chamadas_video set situacao = 'chamando', chamando_em = now() where id = id_chamada;
  return id_chamada;
end
$$;

-- Agora devolve também a validade do crédito.
drop function if exists public.minhas_chamadas_video();
create or replace function public.minhas_chamadas_video()
returns table (id uuid, aluno_id uuid, profissional_id uuid, aluno_nome text, profissional_nome text, profissional_foto text, minutos integer, valor numeric, comissao numeric, taxa numeric, situacao text, chamando_em timestamptz, inicio_em timestamptz, fim_em timestamptz, nota smallint, repassado_em timestamptz, criado_em timestamptz, vence_em timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.arrumar_chamadas_video();
  return query
  select ch.id, ch.aluno_id, ch.profissional_id,
    coalesce(nullif(a.nome, ''), split_part(a.email, '@', 1)),
    coalesce(nullif(p.nome, ''), split_part(p.email, '@', 1)),
    p.foto_url, ch.minutos, ch.valor, ch.comissao, ch.taxa, ch.situacao, ch.chamando_em, ch.inicio_em, ch.fim_em, ch.nota, ch.repassado_em, ch.criado_em, ch.vence_em
  from public.chamadas_video ch
  join public.perfis a on a.id = ch.aluno_id
  join public.perfis p on p.id = ch.profissional_id
  where ch.aluno_id = (select auth.uid()) or ch.profissional_id = (select auth.uid()) or public.eh_admin()
  order by ch.criado_em desc
  limit 500;
end
$$;

-- Lembrete 15 minutos antes do treino agendado (notificação para os dois).
create or replace function public.lembrar_agendamentos_video() returns void
language plpgsql security definer set search_path = '' as $$
declare
  a record;
begin
  for a in
    update public.agendamentos_video set lembrete_em = now()
    where situacao = 'marcado' and lembrete_em is null and inicio between now() and now() + interval '16 minutes'
    returning id
  loop
    perform public.mandar_push('lembrete', a.id);
  end loop;
  delete from public.push_enviados where em < now() - interval '7 days';
end
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'lembrar-agenda-video';
select cron.schedule('lembrar-agenda-video', '*/5 * * * *', $$select public.lembrar_agendamentos_video()$$);

-- ---------- Permissões ----------
revoke execute on function public.salvar_inscricao_push(text, text, text), public.apagar_inscricao_push(text),
  public.salvar_horarios_video(jsonb), public.horarios_livres_video(uuid, integer), public.agendar_video(uuid, timestamptz),
  public.cancelar_agendamento_video(uuid), public.meus_agendamentos_video(), public.chamar_video(uuid), public.minhas_chamadas_video()
  from public, anon;
grant execute on function public.salvar_inscricao_push(text, text, text), public.apagar_inscricao_push(text),
  public.salvar_horarios_video(jsonb), public.horarios_livres_video(uuid, integer), public.agendar_video(uuid, timestamptz),
  public.cancelar_agendamento_video(uuid), public.meus_agendamentos_video(), public.chamar_video(uuid), public.minhas_chamadas_video()
  to authenticated;
revoke execute on function public.mandar_push(text, uuid), public.push_mensagem(), public.push_chamada(), public.avisar_no_chat(uuid, uuid, uuid, text),
  public.lembrar_agendamentos_video(), public.creditos_de_video()
  from public, anon, authenticated;
