-- Liberação do aluno e aviso de cadastro (16/11/2026).
--
-- Desde 03/11 (planos_valem) todo aluno que se cadastrava sozinho já entrava
-- "liberado". O gatilho do e-mail só avisava perfis "pendentes", então o
-- administrador parou de receber o aviso de aluno novo.
--
-- Agora: o administrador escolhe se o aluno que se cadastra sozinho espera
-- liberação (padrão: espera) e recebe e-mail a CADA cadastro novo, liberado ou não.
-- Aluno cadastrado pelo personal continua entrando liberado (cadastrar-aluno).

alter table public.config_cobranca
  add column if not exists aluno_aguarda_liberacao boolean not null default true;

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  p public.papel := case when dados->>'papel' = 'profissional' then 'profissional'::public.papel else 'aluno'::public.papel end;
  aguarda boolean := coalesce((select c.aluno_aguarda_liberacao from public.config_cobranca c where c.id), true);
begin
  -- O personal sempre espera o administrador conferir o registro (CREF).
  -- O aluno espera só se o administrador quiser (Administração → Aguardando).
  insert into public.perfis (id, email, nome, papel, registro, situacao)
  values (new.id, lower(new.email), left(coalesce(dados->>'nome', ''), 120), p, left(coalesce(dados->>'registro', ''), 40),
    case when p = 'aluno' and not aguarda then 'liberado'::public.situacao else 'pendente'::public.situacao end);
  return new;
end
$$;

-- E-mail ao administrador a cada perfil novo, não só aos pendentes.
create or replace function public.avisar_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.papel <> 'admin' then
    perform net.http_post(
      url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/avisar-cadastro',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end
$$;
