-- Biblioteca de treinos do profissional (pedido do personal Romildo, 02/11/2026).
-- O profissional guarda treinos prontos (modelos) organizados em pastas e, com
-- um toque, cria a rotina de um ou de vários alunos a partir do modelo.
-- O modelo é só do profissional que o criou: aluno não vê a biblioteca.
-- Mudar um modelo não mexe nas rotinas que já foram criadas a partir dele.

create table if not exists public.pastas_treino (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 40),
  criado_em timestamptz not null default now()
);

create index if not exists pastas_treino_dono_idx on public.pastas_treino (profissional_id, nome);

create table if not exists public.modelos_treino (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  -- Apagar a pasta não apaga o modelo: ele fica em "Sem pasta".
  pasta_id uuid references public.pastas_treino (id) on delete set null,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  objetivo text not null default '' check (char_length(objetivo) <= 40),
  nivel text not null default '' check (nivel in ('', 'iniciante', 'intermediario', 'avancado')),
  icone text not null default '' check (char_length(icone) <= 20),
  -- Duração sugerida: vira a validade da rotina do aluno.
  semanas smallint check (semanas between 1 and 52),
  -- Treinos A, B, C... no mesmo formato da tabela treinos: [{letra, nome, exercicios}].
  treinos jsonb not null default '[]' check (jsonb_typeof(treinos) = 'array' and pg_column_size(treinos) <= 200000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists modelos_treino_dono_idx on public.modelos_treino (profissional_id, atualizado_em desc);

alter table public.pastas_treino enable row level security;
alter table public.modelos_treino enable row level security;

drop policy if exists "pastas: dono" on public.pastas_treino;
create policy "pastas: dono" on public.pastas_treino for all to authenticated
using (profissional_id = (select auth.uid()))
with check (profissional_id = (select auth.uid()) and public.eh_profissional_ou_admin());

-- Só dá para pôr o modelo numa pasta que é do mesmo profissional.
drop policy if exists "modelos: dono" on public.modelos_treino;
create policy "modelos: dono" on public.modelos_treino for all to authenticated
using (profissional_id = (select auth.uid()))
with check (
  profissional_id = (select auth.uid())
  and public.eh_profissional_ou_admin()
  and (pasta_id is null or exists (select 1 from public.pastas_treino p where p.id = pasta_id and p.profissional_id = (select auth.uid())))
);
