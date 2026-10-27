-- Planos, assinaturas e pagamentos do FormaCerta.
-- Por enquanto nenhuma cobrança é feita de verdade: o pedido fica registrado e
-- o administrador confirma o pagamento à mão. Quando o Ney tiver CNPJ e conta
-- num gateway (Asaas, Mercado Pago...), uma função do Supabase recebe o aviso
-- do gateway e marca o pagamento como pago sozinha.

-- Planos: o administrador muda preços, nomes e recursos pelo app.
create table public.planos (
  id text primary key,
  publico text not null check (publico in ('aluno', 'profissional')),
  nome text not null check (char_length(nome) between 1 and 40),
  descricao text not null default '' check (char_length(descricao) <= 200),
  preco_mensal numeric(10, 2) not null default 0 check (preco_mensal >= 0),
  preco_anual numeric(10, 2) not null default 0 check (preco_anual >= 0),
  -- Quantos alunos o personal pode ter. Vazio = ilimitado.
  limite_alunos integer check (limite_alunos is null or limite_alunos >= 0),
  -- Quantos profissionais usam a mesma conta (plano de estúdio).
  profissionais integer not null default 1 check (profissionais >= 1),
  recursos text[] not null default '{}',
  destaque boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0
);

-- Regras gerais de cobrança (uma linha só).
create table public.config_cobranca (
  id boolean primary key default true check (id),
  -- Parte do FormaCerta em cada avaliação que o personal vende pelo app.
  comissao_pct numeric(5, 2) not null default 10 check (comissao_pct between 0 and 50),
  -- Dias grátis na primeira assinatura de um plano pago. 0 = sem teste grátis.
  dias_gratis integer not null default 30 check (dias_gratis between 0 and 90),
  -- Gateway ligado. 'nenhum' = pagamentos confirmados à mão pelo administrador.
  gateway text not null default 'nenhum' check (gateway in ('nenhum', 'asaas', 'mercadopago', 'stripe')),
  atualizado_em timestamptz not null default now()
);

insert into public.config_cobranca default values;

insert into public.planos (id, publico, nome, descricao, preco_mensal, preco_anual, limite_alunos, profissionais, recursos, destaque, ordem) values
  ('aluno-gratis', 'aluno', 'Grátis', 'Para conhecer o app.', 0, 0, null, 1,
    array['Avaliação de postura com IA', 'Histórico no seu celular', 'Testes de flexibilidade e coluna'], false, 1),
  ('aluno-pro', 'aluno', 'Aluno Pro', 'Tudo liberado para treinar certo.', 24.90, 249.00, null, 1,
    array['Todos os testes: corrida, exercício em vídeo, idoso', 'Resultados guardados na nuvem', 'Evolução em gráficos', 'Relatório em PDF', 'Seu personal acompanha de longe'], true, 2),
  ('personal-gratis', 'profissional', 'Grátis', 'Para testar com os primeiros alunos.', 0, 0, 2, 1,
    array['Até 2 alunos', 'Avaliação de postura e testes', 'Histórico dos alunos'], false, 1),
  ('personal-essencial', 'profissional', 'Essencial', 'Para quem está começando a atender.', 49.90, 499.00, 15, 1,
    array['Até 15 alunos', 'Todos os testes e avaliações', 'Relatório com a sua logo e CREF', 'Venda de avaliações pelo app'], false, 2),
  ('personal-pro', 'profissional', 'Pro', 'O mais escolhido: sem limite de alunos.', 89.90, 899.00, null, 1,
    array['Alunos ilimitados', 'Tudo do Essencial', 'Modo estúdio com vários celulares', 'Vídeos de referência para os alunos', 'Suporte prioritário'], true, 3),
  ('personal-estudio', 'profissional', 'Estúdio', 'Para estúdios e equipes.', 249.00, 2490.00, null, 5,
    array['Até 5 profissionais', 'Alunos ilimitados', 'Tudo do Pro', 'Painel da equipe'], false, 4);

-- Plano escolhido por cada pessoa. A última linha vale.
create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  plano_id text not null references public.planos (id),
  ciclo text not null check (ciclo in ('mensal', 'anual')),
  -- teste = dias grátis; aguardando = esperando o pagamento; ativa = paga.
  situacao text not null check (situacao in ('teste', 'aguardando', 'ativa', 'cancelada')),
  valor numeric(10, 2) not null,
  -- Até quando vale (fim do teste grátis ou do período pago).
  valido_ate timestamptz,
  criado_em timestamptz not null default now(),
  cancelado_em timestamptz
);

create index assinaturas_usuario_idx on public.assinaturas (usuario_id, criado_em desc);

-- Avaliações que o personal vende para os alunos dele pelo app.
create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  descricao text not null default '' check (char_length(descricao) <= 200),
  preco numeric(10, 2) not null check (preco >= 5 and preco <= 5000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index servicos_profissional_idx on public.servicos (profissional_id);

-- Cada cobrança: assinatura de plano (vai para o FormaCerta) ou avaliação
-- (vai para o personal, menos a comissão do FormaCerta).
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  pagador_id uuid not null references public.perfis (id) on delete cascade,
  -- Personal que recebe. Vazio = o FormaCerta recebe tudo (assinatura).
  recebedor_id uuid references public.perfis (id) on delete set null,
  tipo text not null check (tipo in ('assinatura', 'avaliacao')),
  assinatura_id uuid references public.assinaturas (id) on delete set null,
  servico_id uuid references public.servicos (id) on delete set null,
  descricao text not null,
  valor numeric(10, 2) not null check (valor >= 0),
  -- Parte do FormaCerta.
  comissao numeric(10, 2) not null default 0,
  forma text not null check (forma in ('pix', 'cartao', 'boleto')),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'pago', 'cancelado')),
  -- Código da cobrança no gateway, quando ele estiver ligado.
  gateway_id text,
  criado_em timestamptz not null default now(),
  pago_em timestamptz
);

create index pagamentos_pagador_idx on public.pagamentos (pagador_id, criado_em desc);
create index pagamentos_recebedor_idx on public.pagamentos (recebedor_id, criado_em desc);
create index pagamentos_situacao_idx on public.pagamentos (situacao, criado_em desc);

-- Profissional do aluno que está usando o app.
create function public.meu_profissional() returns uuid
language sql stable security definer set search_path = '' as $$
  select profissional_id from public.perfis where id = (select auth.uid())
$$;

create function public.eh_profissional() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'profissional' and situacao = 'liberado'
  )
$$;

revoke execute on function public.meu_profissional, public.eh_profissional from public, anon;
grant execute on function public.meu_profissional, public.eh_profissional to authenticated;

-- Regras de acesso.
alter table public.planos enable row level security;
alter table public.config_cobranca enable row level security;
alter table public.assinaturas enable row level security;
alter table public.servicos enable row level security;
alter table public.pagamentos enable row level security;

-- Planos e regras de cobrança: todo mundo vê, só o administrador muda.
create policy "ver planos" on public.planos for select to anon, authenticated using (true);
create policy "admin muda planos" on public.planos for all to authenticated
using (public.eh_admin()) with check (public.eh_admin());

create policy "ver regras de cobrança" on public.config_cobranca for select to anon, authenticated using (true);
create policy "admin muda regras de cobrança" on public.config_cobranca for update to authenticated
using (public.eh_admin()) with check (public.eh_admin());

-- Assinaturas e pagamentos: cada um vê os seus; o personal vê o que recebe;
-- o administrador vê tudo. Mudanças só pelas funções abaixo.
create policy "ver assinaturas" on public.assinaturas for select to authenticated
using (usuario_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.assinaturas from authenticated, anon;

create policy "ver pagamentos" on public.pagamentos for select to authenticated
using (pagador_id = (select auth.uid()) or recebedor_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.pagamentos from authenticated, anon;

-- Serviços: o personal cuida dos seus; o aluno vê os ativos do personal dele.
create policy "ver serviços" on public.servicos for select to authenticated
using (
  profissional_id = (select auth.uid())
  or (ativo and profissional_id = public.meu_profissional())
  or public.eh_admin()
);
create policy "criar serviço" on public.servicos for insert to authenticated
with check (profissional_id = (select auth.uid()) and public.eh_profissional());
create policy "mudar serviço" on public.servicos for update to authenticated
using (profissional_id = (select auth.uid())) with check (profissional_id = (select auth.uid()));
create policy "apagar serviço" on public.servicos for delete to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());

-- Escolher um plano. O primeiro plano pago ganha os dias grátis; depois disso
-- fica aguardando o pagamento. O plano grátis vale na hora.
create function public.escolher_plano(plano text, ciclo text, forma text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  p public.planos;
  cfg public.config_cobranca;
  meu_papel public.papel;
  preco numeric(10, 2);
  ja_testou boolean;
  fim_teste timestamptz;
  nova_situacao text;
  ate timestamptz;
  id_assinatura uuid;
begin
  if not public.eh_liberado() then raise exception 'Sua conta ainda não foi liberada'; end if;
  if ciclo not in ('mensal', 'anual') then raise exception 'Escolha mensal ou anual'; end if;
  if forma not in ('pix', 'cartao', 'boleto') then raise exception 'Forma de pagamento inválida'; end if;

  select * into p from public.planos where id = plano and ativo;
  if p.id is null then raise exception 'Plano não encontrado'; end if;
  select papel into meu_papel from public.perfis where id = eu;
  if meu_papel::text <> p.publico then raise exception 'Este plano não é para o seu tipo de conta'; end if;
  select * into cfg from public.config_cobranca;

  preco := case when ciclo = 'anual' then p.preco_anual else p.preco_mensal end;
  -- Os dias grátis valem uma vez só: no primeiro plano pago.
  select exists (select 1 from public.assinaturas where usuario_id = eu and valor > 0) into ja_testou;
  -- Trocar de plano durante o teste grátis mantém os dias que faltam.
  select valido_ate into fim_teste from public.assinaturas
  where usuario_id = eu and situacao = 'teste' and valido_ate > now()
  order by criado_em desc limit 1;

  if preco = 0 then
    nova_situacao := 'ativa';
  elsif fim_teste is not null then
    nova_situacao := 'teste';
    ate := fim_teste;
  elsif cfg.dias_gratis > 0 and not ja_testou then
    nova_situacao := 'teste';
    ate := now() + make_interval(days => cfg.dias_gratis);
  else
    nova_situacao := 'aguardando';
  end if;

  -- A assinatura anterior deixa de valer.
  update public.assinaturas set situacao = 'cancelada', cancelado_em = now()
  where usuario_id = eu and situacao <> 'cancelada';
  update public.pagamentos set situacao = 'cancelado'
  where pagador_id = eu and tipo = 'assinatura' and situacao = 'pendente';

  insert into public.assinaturas (usuario_id, plano_id, ciclo, situacao, valor, valido_ate)
  values (eu, p.id, ciclo, nova_situacao, preco, ate)
  returning id into id_assinatura;

  -- No teste grátis a cobrança só começa quando os dias acabam.
  if nova_situacao = 'aguardando' then
    insert into public.pagamentos (pagador_id, tipo, assinatura_id, descricao, valor, comissao, forma)
    values (eu, 'assinatura', id_assinatura, 'Plano ' || p.nome || ' (' || ciclo || ')', preco, preco, forma);
  end if;

  return id_assinatura;
end
$$;

create function public.cancelar_assinatura() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.assinaturas set situacao = 'cancelada', cancelado_em = now()
  where usuario_id = (select auth.uid()) and situacao <> 'cancelada';
  update public.pagamentos set situacao = 'cancelado'
  where pagador_id = (select auth.uid()) and tipo = 'assinatura' and situacao = 'pendente';
end
$$;

-- O aluno compra uma avaliação do personal dele. A comissão sai da regra atual.
create function public.comprar_avaliacao(servico uuid, forma text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.servicos;
  pct numeric;
  id_pagamento uuid;
begin
  if not public.eh_liberado() then raise exception 'Sua conta ainda não foi liberada'; end if;
  if forma not in ('pix', 'cartao', 'boleto') then raise exception 'Forma de pagamento inválida'; end if;
  select * into s from public.servicos where id = servico and ativo;
  if s.id is null or s.profissional_id is distinct from public.meu_profissional() then
    raise exception 'Esta avaliação não é do seu personal';
  end if;
  select comissao_pct into pct from public.config_cobranca;

  insert into public.pagamentos (pagador_id, recebedor_id, tipo, servico_id, descricao, valor, comissao, forma)
  values ((select auth.uid()), s.profissional_id, 'avaliacao', s.id, s.nome, s.preco, round(s.preco * pct / 100, 2), forma)
  returning id into id_pagamento;
  return id_pagamento;
end
$$;

-- Administrador: confirma que o pagamento caiu (enquanto não há gateway) ou cancela.
create function public.admin_definir_pagamento(pagamento uuid, nova text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pg public.pagamentos;
  a public.assinaturas;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  if nova not in ('pago', 'cancelado', 'pendente') then raise exception 'Situação inválida'; end if;
  update public.pagamentos set situacao = nova, pago_em = case when nova = 'pago' then now() end
  where id = pagamento returning * into pg;
  if pg.assinatura_id is null then return; end if;

  select * into a from public.assinaturas where id = pg.assinatura_id;
  if nova = 'pago' and a.situacao <> 'cancelada' then
    update public.assinaturas
    set situacao = 'ativa',
        valido_ate = greatest(coalesce(valido_ate, now()), now()) + case when ciclo = 'anual' then interval '1 year' else interval '1 month' end
    where id = a.id;
  elsif nova = 'pendente' and a.situacao = 'ativa' then
    update public.assinaturas set situacao = 'aguardando' where id = a.id;
  end if;
end
$$;

revoke execute on function public.escolher_plano, public.cancelar_assinatura, public.comprar_avaliacao, public.admin_definir_pagamento from public, anon;
grant execute on function public.escolher_plano, public.cancelar_assinatura, public.comprar_avaliacao, public.admin_definir_pagamento to authenticated;
