-- Contas (administrador, profissional, aluno) e resultados dos testes.
-- Só vão para cá números e textos curtos: fotos e vídeos ficam no celular.

create type public.papel as enum ('admin', 'profissional', 'aluno');
create type public.situacao as enum ('pendente', 'liberado', 'bloqueado');

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nome text not null default '',
  papel public.papel not null default 'aluno',
  situacao public.situacao not null default 'pendente',
  -- Registro profissional (CREF etc.), só para profissionais.
  registro text not null default '',
  -- Profissional responsável pelo aluno.
  profissional_id uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index perfis_profissional_idx on public.perfis (profissional_id);

create table public.resultados (
  id uuid primary key default gen_random_uuid(),
  -- Quem enviou (profissional ou o próprio aluno).
  enviado_por uuid not null references public.perfis (id) on delete cascade,
  -- Aluno avaliado, quando tem conta. Senão vale o apelido.
  aluno_id uuid references public.perfis (id) on delete cascade,
  apelido text not null default '',
  tipo text not null check (tipo in ('postura', 'corrida', 'exercicio', 'flexibilidade', 'adams')),
  -- Data do teste (no celular) e números do resultado.
  feito_em timestamptz not null,
  dados jsonb not null,
  idade smallint check (idade between 3 and 120),
  sexo text check (sexo in ('feminino', 'masculino', 'outro')),
  altura_cm smallint check (altura_cm between 50 and 250),
  -- Quando o avaliado autorizou o envio (LGPD, art. 11: dado de saúde).
  consentimento_em timestamptz not null,
  criado_em timestamptz not null default now()
);

create index resultados_enviado_por_idx on public.resultados (enviado_por);
create index resultados_aluno_idx on public.resultados (aluno_id);
create index resultados_tipo_idx on public.resultados (tipo, feito_em desc);

-- Ajudantes usados pelas regras de acesso. security definer para não cair em
-- recursão nas regras da própria tabela de perfis.
create function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'admin' and situacao = 'liberado'
  )
$$;

create function public.eh_liberado() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis where id = (select auth.uid()) and situacao = 'liberado'
  )
$$;

create function public.meu_aluno(aluno uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p
    join public.perfis eu on eu.id = (select auth.uid())
    where p.id = aluno and p.profissional_id = eu.id
      and eu.papel = 'profissional' and eu.situacao = 'liberado'
  )
$$;

-- O e-mail do administrador. Só vira admin depois de confirmar o e-mail,
-- para ninguém se cadastrar com ele antes do dono.
create function public.email_admin() returns text
language sql immutable set search_path = '' as $$ select 'ney.comercial@gmail.com' $$;

-- Cria o perfil quando alguém se cadastra. O papel vem do cadastro
-- (profissional ou aluno), nunca admin.
create function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  p public.papel := case when dados->>'papel' = 'profissional' then 'profissional'::public.papel else 'aluno'::public.papel end;
begin
  insert into public.perfis (id, email, nome, papel, registro)
  values (new.id, lower(new.email), left(coalesce(dados->>'nome', ''), 120), p, left(coalesce(dados->>'registro', ''), 40));
  return new;
end
$$;

create trigger ao_cadastrar after insert on auth.users
for each row execute function public.novo_usuario();

create function public.confirmar_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) = public.email_admin() and new.email_confirmed_at is not null then
    update public.perfis set papel = 'admin', situacao = 'liberado' where id = new.id;
  end if;
  return new;
end
$$;

create trigger ao_confirmar_email after insert or update of email_confirmed_at on auth.users
for each row execute function public.confirmar_admin();

-- Regras de acesso.
alter table public.perfis enable row level security;
alter table public.resultados enable row level security;

create policy "ver perfis" on public.perfis for select to authenticated
using (id = (select auth.uid()) or public.eh_admin() or public.meu_aluno(id));

-- Cada um só muda o próprio nome e registro. Papel e situação mudam pelas
-- funções do administrador abaixo.
create policy "editar o meu perfil" on public.perfis for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.perfis from authenticated, anon;
grant update (nome, registro) on public.perfis to authenticated;
revoke insert, delete on public.perfis from authenticated, anon;

create policy "ver resultados" on public.resultados for select to authenticated
using (
  enviado_por = (select auth.uid())
  or aluno_id = (select auth.uid())
  or public.eh_admin()
  or (aluno_id is not null and public.meu_aluno(aluno_id))
);

create policy "enviar resultados" on public.resultados for insert to authenticated
with check (
  enviado_por = (select auth.uid())
  and public.eh_liberado()
  and (aluno_id is null or aluno_id = (select auth.uid()) or public.meu_aluno(aluno_id))
);

create policy "apagar resultados" on public.resultados for delete to authenticated
using (enviado_por = (select auth.uid()) or aluno_id = (select auth.uid()) or public.eh_admin());

revoke update on public.resultados from authenticated, anon;

-- Funções do administrador.
create function public.admin_definir_situacao(usuario uuid, nova public.situacao) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  if usuario = (select auth.uid()) then raise exception 'O administrador não muda a própria situação'; end if;
  update public.perfis set situacao = nova where id = usuario;
end
$$;

-- Apaga a conta e tudo dela (perfil e resultados caem em cascata).
create function public.admin_excluir(usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  if usuario = (select auth.uid()) then raise exception 'O administrador não exclui a própria conta'; end if;
  delete from auth.users where id = usuario;
end
$$;

-- O aluno (ou qualquer um) apaga a própria conta e os seus dados.
create function public.excluir_minha_conta() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.eh_admin() then raise exception 'O administrador não exclui a própria conta pelo app'; end if;
  delete from auth.users where id = (select auth.uid());
end
$$;

revoke execute on function public.admin_definir_situacao, public.admin_excluir, public.excluir_minha_conta from public, anon;
grant execute on function public.admin_definir_situacao, public.admin_excluir, public.excluir_minha_conta to authenticated;
revoke execute on function public.novo_usuario, public.confirmar_admin from public, anon, authenticated;
