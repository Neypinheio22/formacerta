-- Ficha de treino (A, B, C...) montada pelo profissional, treinos feitos pelo
-- aluno (meta da semana e "próximo treino") e materiais extras (PDF, vídeo ou
-- link) que o profissional manda para um aluno ou para todos os alunos dele.

-- Meta de treinos por semana, escolhida pelo profissional. Vazia: o app usa o
-- número de treinos da ficha.
alter table public.fichas add column if not exists treinos_semana smallint check (treinos_semana between 1 and 7);

-- Quem monta o treino e manda materiais: o profissional dono da ficha e o administrador.
create function public.cuido_da_ficha(ficha uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin() or exists (
    select 1 from public.fichas f
    where f.id = ficha and f.profissional_id = (select auth.uid()) and public.eh_profissional_ou_admin()
  )
$$;

revoke execute on function public.cuido_da_ficha from public, anon;
grant execute on function public.cuido_da_ficha to authenticated;

-- Treinos da ficha. Cada exercício: {"nome", "series", "reps", "obs"}.
create table public.treinos (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  letra text not null check (letra ~ '^[A-J]$'),
  nome text not null default '' check (char_length(nome) <= 60),
  exercicios jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exercicios) = 'array' and jsonb_array_length(exercicios) <= 30),
  atualizado_em timestamptz not null default now(),
  unique (ficha_id, letra)
);

alter table public.treinos enable row level security;

create policy "ver treinos" on public.treinos for select to authenticated
using (public.posso_na_ficha(ficha_id));

create policy "criar treinos" on public.treinos for insert to authenticated
with check (public.cuido_da_ficha(ficha_id));

create policy "editar treinos" on public.treinos for update to authenticated
using (public.cuido_da_ficha(ficha_id)) with check (public.cuido_da_ficha(ficha_id));

create policy "apagar treinos" on public.treinos for delete to authenticated
using (public.cuido_da_ficha(ficha_id));

-- Cada vez que o aluno conclui um treino.
create table public.treinos_feitos (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  treino_id uuid references public.treinos (id) on delete set null,
  letra text not null default '' check (char_length(letra) <= 1),
  feito_por uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  feito_em timestamptz not null default now()
);

create index treinos_feitos_ficha_idx on public.treinos_feitos (ficha_id, feito_em desc);

alter table public.treinos_feitos enable row level security;

create policy "ver treinos feitos" on public.treinos_feitos for select to authenticated
using (public.posso_na_ficha(ficha_id));

create policy "marcar treino feito" on public.treinos_feitos for insert to authenticated
with check (feito_por = (select auth.uid()) and public.posso_na_ficha(ficha_id));

create policy "apagar treino feito" on public.treinos_feitos for delete to authenticated
using (feito_por = (select auth.uid()) or public.cuido_da_ficha(ficha_id));

-- Materiais extras. ficha_id vazio: vale para todos os alunos do profissional.
create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  ficha_id uuid references public.fichas (id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 80),
  descricao text not null default '' check (char_length(descricao) <= 300),
  tipo text not null check (tipo in ('pdf', 'video', 'imagem', 'link')),
  -- Caminho na pasta "materiais" (arquivo enviado) ou endereço https (link).
  arquivo text,
  link text check (link is null or link ~* '^https://'),
  criado_em timestamptz not null default now(),
  check ((arquivo is null) <> (link is null))
);

create index materiais_profissional_idx on public.materiais (profissional_id);
create index materiais_ficha_idx on public.materiais (ficha_id);

create function public.vejo_material(profissional uuid, ficha uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select profissional = (select auth.uid())
    or public.eh_admin()
    or (ficha is not null and public.posso_na_ficha(ficha))
    or (ficha is null and exists (
      select 1 from public.perfis p where p.id = (select auth.uid()) and p.profissional_id = profissional
    ))
$$;

revoke execute on function public.vejo_material from public, anon;
grant execute on function public.vejo_material to authenticated;

alter table public.materiais enable row level security;

create policy "ver materiais" on public.materiais for select to authenticated
using (public.vejo_material(profissional_id, ficha_id));

create policy "enviar materiais" on public.materiais for insert to authenticated
with check (
  profissional_id = (select auth.uid())
  and public.eh_profissional_ou_admin()
  and (ficha_id is null or public.cuido_da_ficha(ficha_id))
);

create policy "apagar materiais" on public.materiais for delete to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());

-- Pasta dos arquivos. Privada: cada arquivo só abre para quem pode ver o material.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 52428800,
  array['application/pdf', 'video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function public.pode_ver_arquivo_material(caminho text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(caminho, '/', 1) = (select auth.uid())::text
    or public.eh_admin()
    or exists (
      select 1 from public.materiais m
      where m.arquivo = caminho and public.vejo_material(m.profissional_id, m.ficha_id)
    )
$$;

revoke execute on function public.pode_ver_arquivo_material from public, anon;
grant execute on function public.pode_ver_arquivo_material to authenticated;

create policy "materiais: ver arquivos" on storage.objects for select to authenticated
using (bucket_id = 'materiais' and public.pode_ver_arquivo_material(name));

create policy "materiais: enviar arquivos" on storage.objects for insert to authenticated
with check (bucket_id = 'materiais' and split_part(name, '/', 1) = (select auth.uid())::text and public.eh_profissional_ou_admin());

create policy "materiais: apagar arquivos" on storage.objects for delete to authenticated
using (bucket_id = 'materiais' and (split_part(name, '/', 1) = (select auth.uid())::text or public.eh_admin()));
