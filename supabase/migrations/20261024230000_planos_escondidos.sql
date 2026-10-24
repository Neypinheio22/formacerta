-- Planos e pagamento escondidos enquanto o Ney configura: só o administrador e
-- as pessoas que ele escolher (testadores) veem. Quando estiver pronto, o
-- administrador libera para todos pela tela de Administração.

alter table public.config_cobranca
  add column planos_para text not null default 'testadores' check (planos_para in ('testadores', 'todos'));

create table public.testadores_planos (
  usuario_id uuid primary key references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.testadores_planos enable row level security;

create policy "ver testadores" on public.testadores_planos for select to authenticated
using (usuario_id = (select auth.uid()) or public.eh_admin());
create policy "admin escolhe testadores" on public.testadores_planos for insert to authenticated
with check (public.eh_admin());
create policy "admin tira testadores" on public.testadores_planos for delete to authenticated
using (public.eh_admin());
revoke update on public.testadores_planos from authenticated, anon;

-- Quem pode ver e usar os planos agora.
create function public.planos_liberados() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin()
    or (select planos_para = 'todos' from public.config_cobranca)
    or exists (select 1 from public.testadores_planos where usuario_id = (select auth.uid()))
$$;

revoke execute on function public.planos_liberados from public, anon;
grant execute on function public.planos_liberados to authenticated;

-- Enquanto escondido, ninguém fora da lista assina nem compra (mesmo chamando direto).
create or replace function public.checar_planos_liberados() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.planos_liberados() then
    raise exception 'Os planos ainda não estão disponíveis';
  end if;
  return new;
end
$$;

create trigger planos_liberados_assinatura before insert on public.assinaturas
for each row execute function public.checar_planos_liberados();
create trigger planos_liberados_pagamento before insert on public.pagamentos
for each row execute function public.checar_planos_liberados();
create trigger planos_liberados_servico before insert on public.servicos
for each row execute function public.checar_planos_liberados();

revoke execute on function public.checar_planos_liberados from public, anon, authenticated;
