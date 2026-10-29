-- Serviços do personal: a plataforma oferece uma lista de trabalhos (de
-- avaliações até acompanhamento) e cada profissional liga os que faz e põe o
-- próprio preço. Aparecem no perfil de "Encontrar personal" e no Contratar do chat.

create table public.catalogo_servicos (
  id text primary key,
  grupo text not null check (grupo in ('avaliacao', 'treino')),
  nome text not null,
  descricao text not null default '',
  -- Faixa de preço de mercado, mostrada como sugestão.
  preco_min numeric(10, 2) not null,
  preco_max numeric(10, 2) not null,
  mensal boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true
);

alter table public.catalogo_servicos enable row level security;
create policy "ver catálogo" on public.catalogo_servicos for select to authenticated using (true);
create policy "admin muda catálogo" on public.catalogo_servicos for all to authenticated
using (public.eh_admin()) with check (public.eh_admin());

insert into public.catalogo_servicos (id, grupo, nome, descricao, preco_min, preco_max, mensal, ordem) values
  ('avaliacao-postural', 'avaliacao', 'Avaliação postural', 'Postura nas 4 vistas com relatório em PDF.', 80, 150, false, 1),
  ('avaliacao-completa', 'avaliacao', 'Avaliação completa', 'Postura, corrida, flexibilidade e coluna, com relatório.', 150, 250, false, 2),
  ('avaliacao-idoso', 'avaliacao', 'Avaliação funcional do idoso', 'Anamnese, Berg, Senior Fitness Test e relatório.', 150, 300, false, 3),
  ('analise-corrida', 'avaliacao', 'Análise de corrida', 'Pisada, cadência e joelhos em vídeo.', 80, 150, false, 4),
  ('reavaliacao', 'avaliacao', 'Reavaliação', 'Compara com a avaliação anterior.', 60, 100, false, 5),
  ('ficha-treino', 'treino', 'Montagem de ficha de treino', 'Ficha A/B/C no app, valor único.', 80, 150, false, 6),
  ('acompanhamento-online', 'treino', 'Acompanhamento online', 'Treino no app e ajustes durante o mês.', 80, 200, true, 7),
  ('aula-presencial', 'treino', 'Aula presencial avulsa', 'Uma aula com o personal.', 60, 150, false, 8),
  ('pacote-presencial', 'treino', 'Pacote presencial', 'Aulas presenciais durante o mês.', 400, 1200, true, 9),
  ('correcao-postural', 'treino', 'Plano de correção postural (4 semanas)', 'Exercícios de correção com acompanhamento.', 80, 180, false, 10)
on conflict (id) do nothing;

-- Cada serviço do personal pode vir do catálogo (um de cada) ou ser próprio.
alter table public.servicos add column if not exists catalogo_id text references public.catalogo_servicos (id) on delete set null;
alter table public.servicos add column if not exists mensal boolean not null default false;
create unique index if not exists servicos_um_por_catalogo on public.servicos (profissional_id, catalogo_id) where catalogo_id is not null;

-- O personal coloca preço mesmo com os planos escondidos; pagar continua
-- bloqueado (o bloqueio de pagamentos e assinaturas fica como está).
drop trigger if exists planos_liberados_servico on public.servicos;

-- O aluno vê os serviços ligados dos profissionais que aparecem na lista.
create function public.aparece_na_lista(profissional uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p
    where p.id = profissional and p.papel in ('profissional', 'admin') and p.situacao = 'liberado'
      and p.aparecer_na_lista and btrim(p.registro) <> ''
  )
$$;

revoke execute on function public.aparece_na_lista from public, anon;
grant execute on function public.aparece_na_lista to authenticated;

create policy "ver serviços da lista" on public.servicos for select to authenticated
using (ativo and public.eh_liberado() and public.aparece_na_lista(profissional_id));

-- Comprar também vale para quem aparece na lista (o aluno escolhe e paga pelo app).
create or replace function public.comprar_avaliacao(servico uuid, forma text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.servicos;
  pct numeric;
  id_pagamento uuid;
begin
  if not public.eh_liberado() then raise exception 'Sua conta ainda não foi liberada'; end if;
  if forma not in ('pix', 'cartao', 'boleto') then raise exception 'Forma de pagamento inválida'; end if;
  select * into s from public.servicos where id = servico and ativo;
  if s.id is null or s.profissional_id = (select auth.uid()) or (
    s.profissional_id is distinct from public.meu_profissional()
    and not public.aparece_na_lista(s.profissional_id)
    and not exists (select 1 from public.conversas c where c.aluno_id = (select auth.uid()) and c.profissional_id = s.profissional_id)
  ) then
    raise exception 'Este serviço não está disponível para você';
  end if;
  select comissao_pct into pct from public.config_cobranca;

  insert into public.pagamentos (pagador_id, recebedor_id, tipo, servico_id, descricao, valor, comissao, forma)
  values ((select auth.uid()), s.profissional_id, 'avaliacao', s.id, s.nome, s.preco, round(s.preco * pct / 100, 2), forma)
  returning id into id_pagamento;
  return id_pagamento;
end
$$;

revoke execute on function public.comprar_avaliacao from public, anon;
grant execute on function public.comprar_avaliacao to authenticated;

-- O administrador que atende como personal também cadastra os serviços dele.
drop policy if exists "criar serviço" on public.servicos;
create policy "criar serviço" on public.servicos for insert to authenticated
with check (profissional_id = (select auth.uid()) and (public.eh_profissional() or public.eh_admin()));
