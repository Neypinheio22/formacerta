-- Biblioteca de exercícios (pedido do Ney, 02/11/2026, no modelo do MFIT).
-- 1) Categoria em cada exercício cadastrado (Musculação, Funcional, Mobilidade...).
--    O grupo muscular já existia na coluna "grupo".
-- 2) Favoritos do profissional: os exercícios que ele mais usa, para achar rápido
--    na hora de montar a ficha. Vale para os do app e para os dele, pelo nome
--    sem acento (o mesmo jeito que a ficha liga o exercício à foto ou ao vídeo).
-- Fotos, GIFs e vídeos continuam na pasta "exercicios", que já aceita image/gif.
-- Pode rodar de novo sem problema.

alter table public.exercicios_proprios
  add column if not exists categoria text not null default '' check (char_length(categoria) <= 30);

create table if not exists public.exercicios_favoritos (
  profissional_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  chave text not null check (char_length(chave) between 1 and 80),
  criado_em timestamptz not null default now(),
  primary key (profissional_id, chave)
);

alter table public.exercicios_favoritos enable row level security;

drop policy if exists "favoritos: dono" on public.exercicios_favoritos;
create policy "favoritos: dono" on public.exercicios_favoritos for all to authenticated
using (profissional_id = (select auth.uid()))
with check (profissional_id = (select auth.uid()));
