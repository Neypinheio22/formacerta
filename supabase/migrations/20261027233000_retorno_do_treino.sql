-- Retorno do aluno ao terminar o treino: início, fim, intensidade sentida e um
-- comentário. O personal vê na ficha se o treino está longo e se a intensidade
-- está boa. Os exercícios ganharam linhas (série/rep, carga, intervalo,
-- cadência...), mas eles ficam dentro de "exercicios" (jsonb) e não precisam
-- de coluna nova.

alter table public.treinos_feitos add column if not exists inicio timestamptz;
alter table public.treinos_feitos add column if not exists fim timestamptz;
alter table public.treinos_feitos add column if not exists intensidade text
  check (intensidade is null or intensidade in ('Muito leve', 'Leve', 'Moderada', 'Intensa', 'Muito intensa'));
alter table public.treinos_feitos add column if not exists comentario text not null default ''
  check (char_length(comentario) <= 500);

alter table public.treinos_feitos drop constraint if exists treinos_feitos_inicio_antes_do_fim;
alter table public.treinos_feitos add constraint treinos_feitos_inicio_antes_do_fim
  check (inicio is null or fim is null or inicio <= fim);

-- Avisa a API do Supabase que a tabela mudou.
notify pgrst, 'reload schema';
