-- Avisa o administrador por e-mail quando alguém se cadastra e fica aguardando
-- liberação. O gatilho chama a função `avisar-cadastro`, que confere no banco
-- se o perfil existe, está pendente e ainda não foi avisado, e manda o e-mail.

create extension if not exists pg_net with schema extensions;

alter table public.perfis add column avisado_em timestamptz;

create function public.avisar_cadastro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.situacao = 'pendente' then
    perform net.http_post(
      url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/avisar-cadastro',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end
$$;

create trigger ao_criar_perfil after insert on public.perfis
for each row execute function public.avisar_cadastro();

revoke execute on function public.avisar_cadastro from public, anon, authenticated;

-- As funções de apoio das regras de acesso não precisam ser chamadas por quem não entrou.
revoke execute on function public.eh_admin, public.eh_liberado, public.meu_aluno from public, anon;
grant execute on function public.eh_admin, public.eh_liberado, public.meu_aluno to authenticated;
