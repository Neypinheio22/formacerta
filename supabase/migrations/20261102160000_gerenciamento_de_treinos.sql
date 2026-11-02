-- Gerenciamento de treinos do aluno (pedido do Ney, 02/11/2026, inspirado no
-- MFIT Personal):
--   1. Orientações gerais, recomendações e observações do personal para cada
--      aluno (podem ficar só para o personal ver).
--   2. Treinos com foco (grupo muscular ou objetivo) e ordem que o personal
--      muda sem perder o histórico.
--   3. Cargas e repetições que o aluno fez em cada treino (para a evolução).
--   4. Feedback do aluno (dificuldade, esforço, dores) e observação do personal.
-- Pode rodar mais de uma vez.

-- 1. Orientações ---------------------------------------------------------------
create table if not exists public.orientacoes (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  tipo text not null default 'orientacao' check (tipo in ('orientacao', 'recomendacao', 'observacao')),
  texto text not null check (char_length(btrim(texto)) between 1 and 1000),
  -- Só o personal vê (ex.: anotação sobre o comportamento do aluno).
  so_personal boolean not null default false,
  fixada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists orientacoes_ficha_idx on public.orientacoes (ficha_id, criado_em desc);

alter table public.orientacoes enable row level security;

drop policy if exists "ver orientacoes" on public.orientacoes;
create policy "ver orientacoes" on public.orientacoes for select to authenticated
using (public.cuido_da_ficha(ficha_id) or (public.posso_na_ficha(ficha_id) and not so_personal));

drop policy if exists "criar orientacoes" on public.orientacoes;
create policy "criar orientacoes" on public.orientacoes for insert to authenticated
with check (public.cuido_da_ficha(ficha_id));

drop policy if exists "editar orientacoes" on public.orientacoes;
create policy "editar orientacoes" on public.orientacoes for update to authenticated
using (public.cuido_da_ficha(ficha_id)) with check (public.cuido_da_ficha(ficha_id));

drop policy if exists "apagar orientacoes" on public.orientacoes;
create policy "apagar orientacoes" on public.orientacoes for delete to authenticated
using (public.cuido_da_ficha(ficha_id));

-- 2. Foco e ordem dos treinos ----------------------------------------------------
-- Foco do treino: grupos musculares ou objetivo ("Peito e tríceps", "Glúteo").
alter table public.treinos add column if not exists foco text not null default '';
alter table public.treinos drop constraint if exists treinos_foco_tamanho;
alter table public.treinos add constraint treinos_foco_tamanho check (char_length(foco) <= 80);

-- A letra (A, B, C...) é a ordem do treino. Para trocar a ordem, as letras
-- trocam de lugar dentro de uma só operação: a regra de letra única passa a
-- ser conferida no fim dela.
alter table public.treinos drop constraint if exists treinos_rotina_letra_key;
alter table public.treinos add constraint treinos_rotina_letra_key unique (rotina_id, letra) deferrable initially immediate;

-- Nova letra de cada treino de uma rotina (ids[i] fica com letras[i]).
-- O histórico de cada treino continua com ele, porque o treino não muda de id.
drop function if exists public.ordenar_treinos(uuid, uuid[], text[]);
create or replace function public.ordenar_treinos(rotina uuid, ids uuid[], letras text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ficha uuid;
  i int;
begin
  select r.ficha_id into ficha from public.rotinas r where r.id = rotina;
  if ficha is null or not public.cuido_da_ficha(ficha) then
    raise exception 'Sem permissão para mudar esta rotina';
  end if;
  if coalesce(array_length(ids, 1), 0) > 10 or coalesce(array_length(ids, 1), 0) <> coalesce(array_length(letras, 1), 0) then
    raise exception 'Lista de treinos inválida';
  end if;
  set constraints public.treinos_rotina_letra_key deferred;
  for i in 1 .. coalesce(array_length(ids, 1), 0) loop
    update public.treinos
    set letra = letras[i], atualizado_em = now()
    where id = ids[i] and rotina_id = rotina;
  end loop;
end
$$;

revoke execute on function public.ordenar_treinos from public, anon;
grant execute on function public.ordenar_treinos to authenticated;

-- 3 e 4. Cargas feitas e feedback ----------------------------------------------
-- Cargas: [{"nome": "Supino reto", "series": [{"kg": 40, "reps": 10}, ...]}, ...]
alter table public.treinos_feitos add column if not exists cargas jsonb not null default '[]'::jsonb;
alter table public.treinos_feitos drop constraint if exists treinos_feitos_cargas_lista;
alter table public.treinos_feitos add constraint treinos_feitos_cargas_lista
  check (jsonb_typeof(cargas) = 'array' and jsonb_array_length(cargas) <= 30);

-- Dificuldade de 1 (muito fácil) a 5 (muito difícil).
alter table public.treinos_feitos add column if not exists dificuldade smallint check (dificuldade between 1 and 5);
-- Percepção de esforço (escala de Borg, 0 a 10).
alter table public.treinos_feitos add column if not exists esforco smallint check (esforco between 0 and 10);
alter table public.treinos_feitos add column if not exists dor boolean;
alter table public.treinos_feitos add column if not exists dor_local text not null default '' check (char_length(dor_local) <= 120);
alter table public.treinos_feitos add column if not exists dor_nivel smallint check (dor_nivel between 0 and 10);
alter table public.treinos_feitos add column if not exists avaliado_em timestamptz;
-- O que o personal anotou sobre este treino (o aluno também vê).
alter table public.treinos_feitos add column if not exists obs_personal text not null default '' check (char_length(obs_personal) <= 500);
alter table public.treinos_feitos add column if not exists obs_personal_em timestamptz;

create index if not exists treinos_feitos_treino_idx on public.treinos_feitos (treino_id, feito_em desc);

-- O aluno avalia o treino depois (botão Avaliar) e o personal escreve a observação dele.
drop policy if exists "atualizar treino feito" on public.treinos_feitos;
create policy "atualizar treino feito" on public.treinos_feitos for update to authenticated
using (feito_por = (select auth.uid()) or public.cuido_da_ficha(ficha_id))
with check (feito_por = (select auth.uid()) or public.cuido_da_ficha(ficha_id));

-- Cada um mexe só no que é seu: o aluno no feedback e nas cargas, o personal
-- na observação dele. O resto do registro não muda.
create or replace function public.treino_feito_quem_muda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
begin
  if new.ficha_id <> old.ficha_id or new.feito_por <> old.feito_por or new.feito_em <> old.feito_em
     or new.treino_id is distinct from old.treino_id or new.letra <> old.letra then
    raise exception 'Este treino feito não pode mudar de aluno, data ou treino';
  end if;
  if old.feito_por is distinct from eu then
    new.cargas := old.cargas;
    new.dificuldade := old.dificuldade;
    new.esforco := old.esforco;
    new.dor := old.dor;
    new.dor_local := old.dor_local;
    new.dor_nivel := old.dor_nivel;
    new.avaliado_em := old.avaliado_em;
    new.intensidade := old.intensidade;
    new.comentario := old.comentario;
    new.inicio := old.inicio;
    new.fim := old.fim;
  end if;
  if not public.cuido_da_ficha(old.ficha_id) then
    new.obs_personal := old.obs_personal;
    new.obs_personal_em := old.obs_personal_em;
  end if;
  return new;
end
$$;

revoke execute on function public.treino_feito_quem_muda from public, anon, authenticated;

drop trigger if exists treino_feito_quem_muda on public.treinos_feitos;
create trigger treino_feito_quem_muda before update on public.treinos_feitos
for each row execute function public.treino_feito_quem_muda();
