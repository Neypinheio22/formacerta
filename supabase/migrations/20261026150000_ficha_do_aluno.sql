-- Ficha de cada aluno: dados pessoais guardados pelo profissional e todas as
-- avaliações ligadas a ela, para mostrar a evolução entre uma avaliação e outra.
-- O aluno pode ter conta no app (aluno_id) ou não (só a ficha).

create table public.fichas (
  id uuid primary key default gen_random_uuid(),
  -- Profissional dono da ficha.
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  -- Conta do aluno no app, quando ele tem. Apagar a conta apaga a ficha.
  aluno_id uuid references public.perfis (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  nascimento date,
  sexo text check (sexo in ('feminino', 'masculino', 'outro')),
  altura_cm smallint check (altura_cm between 50 and 250),
  telefone text not null default '' check (char_length(telefone) <= 30),
  objetivo text not null default '' check (objetivo in ('', 'emagrecer', 'massa', 'saude', 'desempenho', 'reabilitacao')),
  -- Doenças, dores, remédios e restrições.
  saude text not null default '' check (char_length(saude) <= 2000),
  observacoes text not null default '' check (char_length(observacoes) <= 2000),
  -- Quando o aluno autorizou guardar os dados (LGPD, art. 11: dado de saúde).
  consentimento_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index fichas_profissional_idx on public.fichas (profissional_id);
-- Uma ficha por conta de aluno.
create unique index fichas_aluno_idx on public.fichas (aluno_id) where aluno_id is not null;

alter table public.resultados add column ficha_id uuid references public.fichas (id) on delete cascade;
create index resultados_ficha_idx on public.resultados (ficha_id, feito_em);

-- Novo tipo: medidas do corpo anotadas pelo profissional (peso, gordura, perimetria...).
alter table public.resultados drop constraint if exists resultados_tipo_check;
alter table public.resultados add constraint resultados_tipo_check
  check (tipo in ('postura', 'corrida', 'exercicio', 'flexibilidade', 'adams', 'idoso', 'medidas'));

-- Profissional (ou administrador) liberado.
create function public.eh_profissional_ou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel in ('profissional', 'admin') and situacao = 'liberado'
  )
$$;

-- Quem pode ver e guardar avaliações nesta ficha: o dono, o aluno dela e o administrador.
create function public.posso_na_ficha(ficha uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin() or exists (
    select 1 from public.fichas f
    where f.id = ficha
      and ((f.profissional_id = (select auth.uid()) and public.eh_profissional_ou_admin()) or f.aluno_id = (select auth.uid()))
  )
$$;

alter table public.fichas enable row level security;

create policy "ver fichas" on public.fichas for select to authenticated
using (profissional_id = (select auth.uid()) or aluno_id = (select auth.uid()) or public.eh_admin());

create policy "criar fichas" on public.fichas for insert to authenticated
with check (
  profissional_id = (select auth.uid())
  and public.eh_profissional_ou_admin()
  and (aluno_id is null or public.meu_aluno(aluno_id) or public.eh_admin())
);

create policy "editar fichas" on public.fichas for update to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin())
with check (
  (profissional_id = (select auth.uid()) and public.eh_profissional_ou_admin() and (aluno_id is null or public.meu_aluno(aluno_id)))
  or public.eh_admin()
);

create policy "apagar fichas" on public.fichas for delete to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());

-- Resultados: quem cuida da ficha também vê, guarda e apaga.
drop policy "ver resultados" on public.resultados;
create policy "ver resultados" on public.resultados for select to authenticated
using (
  enviado_por = (select auth.uid())
  or aluno_id = (select auth.uid())
  or public.eh_admin()
  or (aluno_id is not null and public.meu_aluno(aluno_id))
  or (ficha_id is not null and public.posso_na_ficha(ficha_id))
);

drop policy "enviar resultados" on public.resultados;
create policy "enviar resultados" on public.resultados for insert to authenticated
with check (
  enviado_por = (select auth.uid())
  and public.eh_liberado()
  and (aluno_id is null or aluno_id = (select auth.uid()) or public.meu_aluno(aluno_id) or public.eh_admin())
  and (ficha_id is null or public.posso_na_ficha(ficha_id))
);

drop policy "apagar resultados" on public.resultados;
create policy "apagar resultados" on public.resultados for delete to authenticated
using (
  enviado_por = (select auth.uid())
  or aluno_id = (select auth.uid())
  or public.eh_admin()
  or (ficha_id is not null and public.posso_na_ficha(ficha_id))
);

-- Liga cada resultado novo à ficha certa: pela conta do aluno, ou o contrário
-- (resultado guardado na ficha de um aluno com conta aparece para ele também).
create function public.ligar_resultado_a_ficha() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ficha_id is null and new.aluno_id is not null then
    select id into new.ficha_id from public.fichas where aluno_id = new.aluno_id;
  elsif new.ficha_id is not null and new.aluno_id is null then
    select aluno_id into new.aluno_id from public.fichas where id = new.ficha_id;
  end if;
  return new;
end
$$;

create trigger ao_guardar_resultado before insert on public.resultados
for each row execute function public.ligar_resultado_a_ficha();

-- Quando o profissional cria a conta de um aluno, liga à ficha de mesmo nome
-- (se já existir) ou cria a ficha, e junta os resultados que já tinham ido.
create function public.ficha_do_novo_aluno() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  f uuid;
begin
  if new.papel <> 'aluno' or new.profissional_id is null then return new; end if;
  if exists (select 1 from public.fichas where aluno_id = new.id) then return new; end if;
  select id into f from public.fichas
  where profissional_id = new.profissional_id and aluno_id is null
    and lower(btrim(nome)) = lower(btrim(new.nome)) and btrim(new.nome) <> ''
  order by criado_em desc limit 1;
  if f is null then
    insert into public.fichas (profissional_id, aluno_id, nome)
    values (new.profissional_id, new.id, coalesce(nullif(btrim(new.nome), ''), new.email))
    returning id into f;
  else
    update public.fichas set aluno_id = new.id, atualizado_em = now() where id = f;
    update public.resultados set aluno_id = new.id where ficha_id = f and aluno_id is null;
  end if;
  update public.resultados set ficha_id = f where aluno_id = new.id and ficha_id is null;
  return new;
end
$$;

create trigger ao_ligar_aluno after insert or update of profissional_id on public.perfis
for each row execute function public.ficha_do_novo_aluno();

revoke execute on function public.ligar_resultado_a_ficha, public.ficha_do_novo_aluno from public, anon, authenticated;

-- Fichas para o que já existe: alunos com conta ligados a um profissional...
insert into public.fichas (profissional_id, aluno_id, nome)
select p.profissional_id, p.id, coalesce(nullif(btrim(p.nome), ''), p.email)
from public.perfis p
where p.papel = 'aluno' and p.profissional_id is not null
  and not exists (select 1 from public.fichas f where f.aluno_id = p.id);

update public.resultados r set ficha_id = f.id
from public.fichas f
where f.aluno_id = r.aluno_id and r.ficha_id is null;

-- ...e pessoas sem conta, pelo apelido usado em cada resultado guardado por um profissional.
insert into public.fichas (profissional_id, nome, sexo, altura_cm, consentimento_em)
select r.enviado_por, min(btrim(r.apelido)), max(r.sexo), max(r.altura_cm), min(r.consentimento_em)
from public.resultados r
join public.perfis p on p.id = r.enviado_por and p.papel in ('profissional', 'admin')
where r.aluno_id is null and r.ficha_id is null and btrim(r.apelido) <> ''
group by r.enviado_por, lower(btrim(r.apelido));

update public.resultados r set ficha_id = f.id
from public.fichas f
where r.ficha_id is null and r.aluno_id is null and f.aluno_id is null
  and f.profissional_id = r.enviado_por and lower(btrim(f.nome)) = lower(btrim(r.apelido));
