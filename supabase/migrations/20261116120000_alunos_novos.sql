-- Administração → Alunos novos: o que cada aluno fez no app desde o cadastro.
-- Só leitura. Só o administrador consegue chamar.

create or replace function public.admin_alunos_novos(dias int default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode ver os alunos novos'; end if;

  with alunos as (
    select p.*, u.last_sign_in_at, u.email_confirmed_at,
      array(select f.id from public.fichas f where f.aluno_id = p.id) as fichas
    from public.perfis p
    left join auth.users u on u.id = p.id
    where p.papel = 'aluno' and p.criado_em >= now() - make_interval(days => greatest(coalesce(dias, 60), 1))
  )
  select coalesce(jsonb_agg(x order by x.criado_em desc), '[]'::jsonb) into r from (
    select
      a.id, a.nome, a.email, a.situacao,
      coalesce(nullif(a.whatsapp, ''), (select f.telefone from public.fichas f where f.id = any(a.fichas) and coalesce(f.telefone, '') <> '' limit 1), '') as whatsapp,
      a.criado_em,
      a.last_sign_in_at as ultimo_acesso,
      a.email_confirmed_at is not null as email_confirmado,
      (select pp.nome from public.perfis pp where pp.id = a.profissional_id) as personal,
      a.termos_aceitos_em is not null as termos,
      exists (select 1 from public.fichas f where f.id = any(a.fichas) and (f.aluno_atualizou_em is not null or f.nascimento is not null)) as dados,
      (select count(*) from public.resultados rs where rs.aluno_id = a.id or rs.enviado_por = a.id or rs.ficha_id = any(a.fichas)) as avaliacoes,
      (select max(rs.feito_em) from public.resultados rs where rs.aluno_id = a.id or rs.enviado_por = a.id or rs.ficha_id = any(a.fichas)) as ultima_avaliacao,
      (select count(*) from public.treinos t where t.ficha_id = any(a.fichas)) as treinos,
      (select count(*) from public.treinos_feitos tf where tf.feito_por = a.id or tf.ficha_id = any(a.fichas)) as treinos_feitos,
      (select max(tf.feito_em) from public.treinos_feitos tf where tf.feito_por = a.id or tf.ficha_id = any(a.fichas)) as ultimo_treino,
      (select count(*) from public.mensagens m where m.autor_id = a.id) as mensagens,
      exists (select 1 from public.pagamentos pg where pg.pagador_id = a.id and pg.situacao = 'pago') as comprou,
      exists (select 1 from public.push_inscricoes s where s.usuario_id = a.id) as notificacoes
    from alunos a
  ) x;

  return r;
end $$;

revoke execute on function public.admin_alunos_novos(int) from public, anon;
grant execute on function public.admin_alunos_novos(int) to authenticated;
