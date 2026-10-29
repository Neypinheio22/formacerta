-- Mais objetivos para o aluno escolher: os mais procurados por quem começa a treinar.
alter table public.fichas drop constraint if exists fichas_objetivo_check;
alter table public.fichas add constraint fichas_objetivo_check check (objetivo in (
  '', 'emagrecer', 'massa', 'definir', 'saude', 'condicionamento', 'forca', 'postura', 'mobilidade', 'desempenho', 'reabilitacao'
));
