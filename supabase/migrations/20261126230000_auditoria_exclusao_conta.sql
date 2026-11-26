create table public.auditoria_exclusao_conta (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  autor_id uuid,
  origem text not null check (origem in ('propria_conta', 'administracao', 'servico')),
  excluido_em timestamptz not null default now()
);

alter table public.auditoria_exclusao_conta enable row level security;
revoke all on public.auditoria_exclusao_conta from public, anon, authenticated;

create function public.registrar_exclusao_conta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  autor uuid := auth.uid();
begin
  insert into public.auditoria_exclusao_conta (usuario_id, autor_id, origem)
  values (old.id, autor, case
    when autor = old.id then 'propria_conta'
    when autor is not null then 'administracao'
    else 'servico'
  end);
  return old;
end
$$;

revoke execute on function public.registrar_exclusao_conta() from public, anon, authenticated;

create trigger auditar_exclusao_conta
before delete on auth.users
for each row execute function public.registrar_exclusao_conta();
