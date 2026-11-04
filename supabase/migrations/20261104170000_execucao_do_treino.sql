-- Execução do treino pelo aluno (pedido do Romildo, 04/11/2026).
-- O aluno aperta INICIAR TREINO, marca os exercícios, anota carga e
-- repetições e, ao finalizar, escolhe a percepção subjetiva de esforço (PSE)
-- numa escala de 8 níveis:
--   1 Muito leve · 2 Leve · 3 Moderada · 4 Pouco intensa · 5 Intensa ·
--   6 Muito intensa · 7 Muito, muito intensa · 8 Exaustão máxima
-- Os exercícios marcados vão dentro de "cargas" (jsonb, já existe) e os
-- exercícios combinados (bi-set) ficam dentro de "exercicios" do treino
-- (jsonb, já existe). Só a PSE precisa de coluna nova.

alter table public.treinos_feitos add column if not exists pse smallint
  check (pse between 1 and 8);

-- Só o aluno que fez o treino muda a PSE (igual às cargas e ao feedback).
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
    new.pse := old.pse;
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

-- Avisa a API do Supabase que a tabela mudou.
notify pgrst, 'reload schema';
