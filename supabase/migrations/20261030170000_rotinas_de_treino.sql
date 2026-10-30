-- Rotinas de treino (pedido do personal Romildo). Cada aluno guarda o
-- histórico de rotinas: uma rotina nova não apaga as antigas. Cada rotina tem
-- nome, datas, objetivo, nível e a divisão dos treinos (A, B, C, D, E).
-- Arquivar e excluir só mudam a situação: nada some do banco, e a rotina
-- excluída pode ser recuperada. Junto vem a prescrição de aeróbico.

create table if not exists public.rotinas (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 60),
  inicio date,
  fim date,
  objetivo text not null default '' check (char_length(objetivo) <= 40),
  nivel text not null default '' check (nivel in ('', 'iniciante', 'intermediario', 'avancado')),
  icone text not null default '' check (char_length(icone) <= 20),
  situacao text not null default 'ativa' check (situacao in ('ativa', 'arquivada', 'excluida')),
  excluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or inicio is null or fim >= inicio)
);

create index if not exists rotinas_ficha_idx on public.rotinas (ficha_id, criado_em desc);

alter table public.rotinas enable row level security;

-- O aluno vê as rotinas dele (menos as excluídas); o profissional vê todas.
drop policy if exists "ver rotinas" on public.rotinas;
create policy "ver rotinas" on public.rotinas for select to authenticated
using (public.posso_na_ficha(ficha_id) and (situacao <> 'excluida' or public.cuido_da_ficha(ficha_id)));

drop policy if exists "criar rotinas" on public.rotinas;
create policy "criar rotinas" on public.rotinas for insert to authenticated
with check (public.cuido_da_ficha(ficha_id));

drop policy if exists "editar rotinas" on public.rotinas;
create policy "editar rotinas" on public.rotinas for update to authenticated
using (public.cuido_da_ficha(ficha_id)) with check (public.cuido_da_ficha(ficha_id));
-- Sem regra de apagar: excluir é só marcar como excluída.

-- Cada treino (A, B, C...) passa a pertencer a uma rotina.
alter table public.treinos add column if not exists rotina_id uuid references public.rotinas (id) on delete cascade;

-- Os treinos que já existem viram a primeira rotina de cada aluno.
insert into public.rotinas (ficha_id, nome, inicio)
select t.ficha_id, 'Ficha de treino', min(t.atualizado_em)::date
from public.treinos t
where t.rotina_id is null
group by t.ficha_id;

update public.treinos t
set rotina_id = (
  select r.id from public.rotinas r
  where r.ficha_id = t.ficha_id and r.situacao = 'ativa'
  order by r.criado_em desc limit 1
)
where t.rotina_id is null;

-- A letra agora se repete entre rotinas, mas não dentro da mesma.
alter table public.treinos drop constraint if exists treinos_ficha_id_letra_key;
alter table public.treinos drop constraint if exists treinos_rotina_letra_key;
alter table public.treinos add constraint treinos_rotina_letra_key unique (rotina_id, letra);
create index if not exists treinos_rotina_idx on public.treinos (rotina_id);

-- Treino guardado sem rotina (versão antiga do app ainda aberta no celular):
-- entra na rotina ativa mais nova do aluno, ou numa nova. Treino com rotina:
-- a ficha é sempre a da rotina.
create or replace function public.treino_na_rotina() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.rotina_id is null then
    select r.id into new.rotina_id from public.rotinas r
    where r.ficha_id = new.ficha_id and r.situacao = 'ativa'
    order by r.criado_em desc limit 1;
    if new.rotina_id is null then
      insert into public.rotinas (ficha_id, nome, inicio)
      values (new.ficha_id, 'Ficha de treino', current_date)
      returning id into new.rotina_id;
    end if;
  else
    select r.ficha_id into new.ficha_id from public.rotinas r where r.id = new.rotina_id;
  end if;
  return new;
end
$$;

revoke execute on function public.treino_na_rotina from public, anon, authenticated;

drop trigger if exists treino_na_rotina on public.treinos;
create trigger treino_na_rotina before insert or update of rotina_id on public.treinos
for each row execute function public.treino_na_rotina();

alter table public.treinos alter column rotina_id set not null;

-- Aeróbico prescrito pelo profissional.
create table if not exists public.aerobicos (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references public.fichas (id) on delete cascade,
  tipo text not null check (char_length(btrim(tipo)) between 1 and 40),
  duracao_min smallint check (duracao_min between 1 and 600),
  intensidade text not null default '' check (char_length(intensidade) <= 40),
  vezes_semana smallint check (vezes_semana between 1 and 14),
  observacoes text not null default '' check (char_length(observacoes) <= 300),
  situacao text not null default 'ativa' check (situacao in ('ativa', 'arquivada', 'excluida')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists aerobicos_ficha_idx on public.aerobicos (ficha_id, criado_em desc);

alter table public.aerobicos enable row level security;

drop policy if exists "ver aerobicos" on public.aerobicos;
create policy "ver aerobicos" on public.aerobicos for select to authenticated
using (public.posso_na_ficha(ficha_id) and (situacao <> 'excluida' or public.cuido_da_ficha(ficha_id)));

drop policy if exists "criar aerobicos" on public.aerobicos;
create policy "criar aerobicos" on public.aerobicos for insert to authenticated
with check (public.cuido_da_ficha(ficha_id));

drop policy if exists "editar aerobicos" on public.aerobicos;
create policy "editar aerobicos" on public.aerobicos for update to authenticated
using (public.cuido_da_ficha(ficha_id)) with check (public.cuido_da_ficha(ficha_id));
