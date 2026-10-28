-- Exercícios com foto ou vídeo de como fazer. O profissional cadastra os dele
-- (quando o app não tem o exercício, ou para usar o próprio vídeo) e eles
-- aparecem na hora de montar as fichas. Os que o administrador marca como "do
-- app" valem para todos os profissionais e alunos.

create table public.exercicios_proprios (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  grupo text not null default '' check (char_length(grupo) <= 30),
  -- Como fazer, em poucas linhas.
  descricao text not null default '' check (char_length(descricao) <= 500),
  tipo text check (tipo in ('imagem', 'video', 'link')),
  -- Caminho na pasta "exercicios" (foto ou vídeo enviado) ou endereço https (YouTube).
  arquivo text,
  link text check (link is null or link ~* '^https://'),
  do_app boolean not null default false,
  criado_em timestamptz not null default now(),
  check (arquivo is null or link is null),
  check ((tipo is null) = (arquivo is null and link is null))
);

create unique index exercicios_proprios_nome_idx on public.exercicios_proprios (profissional_id, lower(btrim(nome)));

-- Quem vê o exercício: o dono, o administrador, todos (se for do app) e os
-- alunos do profissional que o cadastrou.
create function public.vejo_exercicio(profissional uuid, app boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select app
    or profissional = (select auth.uid())
    or public.eh_admin()
    or exists (select 1 from public.perfis p where p.id = (select auth.uid()) and p.profissional_id = profissional)
    or exists (select 1 from public.fichas f where f.aluno_id = (select auth.uid()) and f.profissional_id = profissional)
$$;

revoke execute on function public.vejo_exercicio from public, anon;
grant execute on function public.vejo_exercicio to authenticated;

alter table public.exercicios_proprios enable row level security;

create policy "ver exercicios" on public.exercicios_proprios for select to authenticated
using (public.vejo_exercicio(profissional_id, do_app));

create policy "criar exercicios" on public.exercicios_proprios for insert to authenticated
with check (
  profissional_id = (select auth.uid())
  and public.eh_profissional_ou_admin()
  and (not do_app or public.eh_admin())
);

create policy "editar exercicios" on public.exercicios_proprios for update to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin())
with check ((profissional_id = (select auth.uid()) or public.eh_admin()) and (not do_app or public.eh_admin()));

create policy "apagar exercicios" on public.exercicios_proprios for delete to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());

-- Pasta das fotos e vídeos. Privada: cada arquivo só abre para quem vê o exercício.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercicios', 'exercicios', false, 52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create function public.pode_ver_arquivo_exercicio(caminho text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(caminho, '/', 1) = (select auth.uid())::text
    or public.eh_admin()
    or exists (
      select 1 from public.exercicios_proprios e
      where e.arquivo = caminho and public.vejo_exercicio(e.profissional_id, e.do_app)
    )
$$;

revoke execute on function public.pode_ver_arquivo_exercicio from public, anon;
grant execute on function public.pode_ver_arquivo_exercicio to authenticated;

create policy "exercicios: ver arquivos" on storage.objects for select to authenticated
using (bucket_id = 'exercicios' and public.pode_ver_arquivo_exercicio(name));

create policy "exercicios: enviar arquivos" on storage.objects for insert to authenticated
with check (bucket_id = 'exercicios' and split_part(name, '/', 1) = (select auth.uid())::text and public.eh_profissional_ou_admin());

create policy "exercicios: apagar arquivos" on storage.objects for delete to authenticated
using (bucket_id = 'exercicios' and (split_part(name, '/', 1) = (select auth.uid())::text or public.eh_admin()));
