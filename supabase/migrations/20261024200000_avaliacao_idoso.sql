-- Avaliação funcional do idoso: novo tipo de resultado. A avaliação inteira
-- (anamnese, antropometria, testes e Escala de Berg) vai como números e textos
-- curtos no campo "dados", como os outros testes.

alter table public.resultados drop constraint if exists resultados_tipo_check;
alter table public.resultados add constraint resultados_tipo_check
  check (tipo in ('postura', 'corrida', 'exercicio', 'flexibilidade', 'adams', 'idoso'));
