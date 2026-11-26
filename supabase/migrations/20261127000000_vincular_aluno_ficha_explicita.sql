create function public.aluno_com_cadastro_pendente(p_email text, p_ficha uuid, p_profissional uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u
  join public.perfis p on p.id = u.id
  where lower(u.email) = lower(p_email)
    and u.raw_app_meta_data ->> 'ficha_cadastro' = p_ficha::text
    and u.raw_app_meta_data ->> 'profissional_cadastro' = p_profissional::text
    and p.papel = 'aluno' and p.profissional_id is null and p.situacao = 'pendente'
$$;

create function public.finalizar_cadastro_aluno(p_aluno uuid, p_ficha uuid, p_profissional uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.perfis p where p.id = p_profissional
      and p.situacao = 'liberado' and p.papel in ('profissional', 'admin')
    for share
  ) then raise exception 'Profissional sem acesso ao cadastro'; end if;

  if not exists (
    select 1 from auth.users u join public.perfis p on p.id = u.id
    where u.id = p_aluno and p.papel = 'aluno'
      and p.profissional_id is null and p.situacao = 'pendente'
      and u.raw_app_meta_data ->> 'ficha_cadastro' = p_ficha::text
      and u.raw_app_meta_data ->> 'profissional_cadastro' = p_profissional::text
    for update of p
  ) then raise exception 'Cadastro pendente não encontrado'; end if;

  update public.fichas set aluno_id = p_aluno, atualizado_em = now()
  where id = p_ficha and profissional_id = p_profissional and aluno_id is null;
  if not found then raise exception 'Ficha indisponível para este cadastro'; end if;

  update public.resultados set aluno_id = p_aluno
  where ficha_id = p_ficha and aluno_id is null;

  update public.resultados set ficha_id = p_ficha
  where aluno_id = p_aluno and ficha_id is null;

  update public.perfis set situacao = 'liberado', profissional_id = p_profissional
  where id = p_aluno;
end
$$;

revoke execute on function public.aluno_com_cadastro_pendente(text, uuid, uuid),
  public.finalizar_cadastro_aluno(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.aluno_com_cadastro_pendente(text, uuid, uuid),
  public.finalizar_cadastro_aluno(uuid, uuid, uuid) to service_role;
