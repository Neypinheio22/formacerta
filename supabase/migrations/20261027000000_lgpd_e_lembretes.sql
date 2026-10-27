-- LGPD e lembrete de reavaliação.
-- 1) Guarda quem aceitou os Termos de uso e a Política de privacidade, e quando
--    autorizou o uso dos dados de saúde (LGPD, art. 8º e 11), com histórico.
-- 2) Guarda em cada resultado o dia de refazer o teste e manda um e-mail ao
--    aluno e ao profissional quando a data chega (todo dia às 8h de Brasília).

-- ---------- 1) Aceite dos termos ----------

alter table public.perfis
  add column if not exists termos_versao text,
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists saude_consentimento_em timestamptz,
  -- A pessoa pode desligar os e-mails de lembrete em "Minha conta".
  add column if not exists lembretes_email boolean not null default true;

grant update (lembretes_email) on public.perfis to authenticated;

-- Histórico de aceites: prova de quando cada pessoa aceitou cada versão.
create table if not exists public.aceites_termos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  versao text not null,
  saude boolean not null default true,
  aceito_em timestamptz not null default now()
);

create index if not exists aceites_termos_usuario_idx on public.aceites_termos (usuario_id, aceito_em);

alter table public.aceites_termos enable row level security;

drop policy if exists "ver os meus aceites" on public.aceites_termos;
create policy "ver os meus aceites" on public.aceites_termos for select to authenticated
using (usuario_id = (select auth.uid()) or public.eh_admin());

revoke insert, update, delete on public.aceites_termos from authenticated, anon;

-- Chamado pelo app quando a pessoa marca os dois aceites.
create or replace function public.aceitar_termos(versao text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Entre na sua conta primeiro'; end if;
  if char_length(aceitar_termos.versao) not between 1 and 20 then raise exception 'Versão inválida'; end if;
  update public.perfis
  set termos_versao = aceitar_termos.versao, termos_aceitos_em = now(), saude_consentimento_em = now()
  where id = (select auth.uid());
  insert into public.aceites_termos (usuario_id, versao, saude) values ((select auth.uid()), aceitar_termos.versao, true);
end
$$;

revoke execute on function public.aceitar_termos from public, anon;
grant execute on function public.aceitar_termos to authenticated;

-- Quem se cadastra sozinho já marca os aceites na tela de cadastro.
-- O gatilho roda depois de "ao_cadastrar" (ordem alfabética), com o perfil já criado.
create or replace function public.termos_do_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v text := left(dados->>'termos_versao', 20);
begin
  if v is not null and dados->>'consentimento_saude' = 'true' then
    update public.perfis set termos_versao = v, termos_aceitos_em = now(), saude_consentimento_em = now() where id = new.id;
    insert into public.aceites_termos (usuario_id, versao, saude) values (new.id, v, true);
  end if;
  return new;
end
$$;

drop trigger if exists ao_cadastrar_termos on auth.users;
create trigger ao_cadastrar_termos after insert on auth.users
for each row execute function public.termos_do_cadastro();

revoke execute on function public.termos_do_cadastro from public, anon, authenticated;

-- ---------- 2) Lembrete de reavaliação ----------

alter table public.resultados
  -- Dia de refazer o teste, calculado pelo app com o plano de ação.
  add column if not exists reavaliar_em date,
  -- Quando o lembrete já foi mandado (só manda uma vez).
  add column if not exists lembrete_em timestamptz;

create index if not exists resultados_lembrete_idx on public.resultados (reavaliar_em) where lembrete_em is null;

-- Resultados que já estavam no banco: mesma regra do app (🟢 volta depois, 🟡/🔴 antes).
update public.resultados r
set reavaliar_em = (r.feito_em at time zone 'America/Sao_Paulo')::date + case
  when r.tipo in ('postura', 'corrida') then case when (r.dados->>'score')::numeric >= 85 then 90 else 30 end
  when r.tipo = 'exercicio' then case when (r.dados->>'score')::numeric >= 85 then 30 else 14 end
  when r.tipo = 'flexibilidade' then case when r.dados->>'nivel' in ('Boa', 'Excelente') then 90 else 30 end
  when r.tipo = 'adams' then case when coalesce((r.dados->>'escoliometro')::numeric, (r.dados->>'atr')::numeric) < 5 then 180 else 90 end
  else 90
end
where r.reavaliar_em is null
  and r.tipo in ('postura', 'corrida', 'exercicio', 'flexibilidade', 'adams', 'idoso')
  and (r.tipo not in ('postura', 'corrida', 'exercicio') or jsonb_typeof(r.dados->'score') = 'number');

-- Todo dia às 8h (Brasília) a função `lembrar-reavaliacao` procura os testes
-- que chegaram na data e manda os e-mails.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'lembrete-reavaliacao';
select cron.schedule(
  'lembrete-reavaliacao',
  '0 11 * * *',
  $$ select net.http_post(
       url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/lembrar-reavaliacao',
       body := '{}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb
     ) $$
);
