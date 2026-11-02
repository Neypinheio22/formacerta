-- Planos que valem de verdade (melhorias 1 a 5 da auditoria de 02/11/2026).
-- 1. O que é do plano pago fica travado para quem não pagou: Aluno Pro (corrida,
--    exercício em vídeo e Central de Inteligência), limite de alunos do personal
--    e venda de serviços a partir do Essencial. O administrador desliga tudo de
--    uma vez em Administração → Planos (config_cobranca.travar_recursos).
-- 2. O plano e o teste grátis vencem: passou de "vale até", vira 'vencida' e a
--    pessoa volta para o grátis até renovar.
-- 3. Aviso antes de vencer: o app mostra 3 dias antes, e o e-mail sai pela
--    função lembrar-reavaliacao (aviso_vencimento_em evita repetir).
-- 4. Aluno que se cadastra sozinho entra na hora; só o personal espera liberação.
-- 5. Repasse ao personal controlado em todos os serviços, não só no vídeo.
-- Pode rodar de novo sem problema.

-- ---------- Ajustes nas tabelas ----------

alter table public.config_cobranca add column if not exists travar_recursos boolean not null default true;

alter table public.planos add column if not exists vende_servicos boolean not null default false;
update public.planos set vende_servicos = true where id in ('personal-essencial', 'personal-pro', 'personal-estudio');

alter table public.assinaturas drop constraint if exists assinaturas_situacao_check;
alter table public.assinaturas add constraint assinaturas_situacao_check
  check (situacao in ('teste', 'aguardando', 'ativa', 'vencida', 'cancelada'));
-- Plano dado pelo administrador (cortesia), sem pagamento.
alter table public.assinaturas add column if not exists cortesia boolean not null default false;
-- Quando o e-mail de "seu plano vence em breve" foi mandado.
alter table public.assinaturas add column if not exists aviso_vencimento_em timestamptz;

alter table public.pagamentos add column if not exists repassado_em timestamptz;

-- O que o Aluno Pro libera, do jeito que o app trava agora (só se o texto ainda for o original).
update public.planos
set recursos = array['Análise da corrida com IA', 'Exercício em vídeo: conta as repetições e corrige', 'Central de Inteligência e evolução em gráficos', 'Tudo do plano grátis']
where id = 'aluno-pro'
  and recursos = array['Todos os testes: corrida, exercício em vídeo, idoso', 'Resultados guardados na nuvem', 'Evolução em gráficos', 'Relatório em PDF', 'Seu personal acompanha de longe'];

update public.planos
set recursos = array['Alunos ilimitados', 'Tudo do Essencial', 'Seus alunos ganham o Aluno Pro', 'Modo estúdio com vários celulares', 'Suporte prioritário']
where id = 'personal-pro'
  and recursos = array['Alunos ilimitados', 'Tudo do Essencial', 'Modo estúdio com vários celulares', 'Vídeos de referência para os alunos', 'Suporte prioritário'];

update public.planos
set recursos = array['Até 15 alunos', 'Todos os testes e avaliações', 'Venda de serviços pelo app', 'Seus alunos ganham o Aluno Pro']
where id = 'personal-essencial'
  and recursos = array['Até 15 alunos', 'Todos os testes e avaliações', 'Relatório com a sua logo e CREF', 'Venda de avaliações pelo app'];

-- ---------- 2. Vencimento ----------

-- Passou da data: vira 'vencida'. Roda todo dia pelo pg_cron e também quando a
-- pessoa abre o app (meus_direitos), então ninguém fica com plano vencido valendo.
create or replace function public.vencer_assinaturas(usuario uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.assinaturas set situacao = 'vencida'
  where situacao in ('ativa', 'teste') and valido_ate is not null and valido_ate <= now()
    and (usuario is null or usuario_id = usuario);
  get diagnostics n = row_count;
  return n;
end
$$;

revoke execute on function public.vencer_assinaturas from public, anon, authenticated;
grant execute on function public.vencer_assinaturas to service_role;

-- O plano que vale agora (ativa ou teste dentro da data). Vazio = grátis.
create or replace function public.assinatura_valida(usuario uuid) returns public.assinaturas
language sql stable security definer set search_path = '' as $$
  select a.* from public.assinaturas a
  where a.usuario_id = usuario and a.situacao in ('ativa', 'teste')
    and (a.valido_ate is null or a.valido_ate > now())
  order by a.criado_em desc limit 1
$$;

-- O plano que a pessoa usa agora: o da assinatura válida ou o grátis do tipo de conta dela.
create or replace function public.plano_de(usuario uuid) returns public.planos
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.planos;
begin
  select * into p from public.planos where id = (public.assinatura_valida(usuario)).plano_id;
  if p.id is null then
    select pl.* into p from public.planos pl
    join public.perfis eu on eu.id = usuario
    where pl.publico = case when eu.papel = 'aluno' then 'aluno' else 'profissional' end and pl.preco_mensal = 0
    order by pl.ordem limit 1;
  end if;
  return p;
end
$$;

-- Está num plano pago (pagou, está no teste grátis ou ganhou cortesia)?
create or replace function public.tem_plano_pago(usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assinaturas a join public.planos p on p.id = a.plano_id
    where a.usuario_id = usuario and a.situacao in ('ativa', 'teste')
      and (a.valido_ate is null or a.valido_ate > now())
      and (p.preco_mensal > 0 or a.cortesia)
  )
$$;

-- ---------- 1. O que cada pessoa pode usar ----------

create or replace function public.direitos_de(usuario uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  eu public.perfis;
  travar boolean;
  p public.planos;
  valida public.assinaturas;
  ultima public.assinaturas;
  ultimo_nome text;
  pago boolean;
  pro boolean := false;
  pelo_personal boolean := false;
  alunos integer := 0;
  limite integer;
  vende boolean := true;
  dias integer;
begin
  select * into eu from public.perfis where id = usuario;
  if eu.id is null then return null; end if;
  -- Só trava quando os planos estão à venda para todos (escondidos, ninguém consegue assinar).
  select coalesce(travar_recursos, true) and planos_para = 'todos' into travar from public.config_cobranca;
  travar := coalesce(travar, false);
  p := public.plano_de(usuario);
  valida := public.assinatura_valida(usuario);
  select * into ultima from public.assinaturas where usuario_id = usuario and situacao <> 'cancelada' order by criado_em desc limit 1;
  select nome into ultimo_nome from public.planos where id = ultima.plano_id;
  pago := public.tem_plano_pago(usuario);
  if valida.valido_ate is not null then
    dias := greatest(0, ceil(extract(epoch from (valida.valido_ate - now())) / 86400)::integer);
  end if;

  if eu.papel = 'aluno' then
    -- O aluno de um personal com plano pago (ou do administrador) ganha o Aluno Pro.
    if eu.profissional_id is not null then
      select exists (select 1 from public.perfis x where x.id = eu.profissional_id and x.papel = 'admin') or public.tem_plano_pago(eu.profissional_id)
      into pelo_personal;
    end if;
    pro := not travar or pago or pelo_personal;
  else
    select count(*) into alunos from public.fichas where profissional_id = usuario;
    if eu.papel = 'admin' or not travar then
      limite := null;
      vende := true;
    else
      limite := p.limite_alunos;
      vende := coalesce(p.vende_servicos, false);
    end if;
    pro := true;
  end if;

  return jsonb_build_object(
    'papel', eu.papel,
    'travado', travar,
    'plano_id', p.id,
    'plano_nome', p.nome,
    'pago', pago,
    'cortesia', coalesce(valida.cortesia, false),
    'situacao', valida.situacao,
    'ciclo', valida.ciclo,
    'valido_ate', valida.valido_ate,
    'dias_restantes', dias,
    'pro', pro,
    'pro_pelo_personal', pelo_personal and not pago,
    'alunos', alunos,
    'limite_alunos', limite,
    'vende_servicos', vende,
    -- Para o aviso de "venceu": o último plano pago que a pessoa teve.
    'ultima_situacao', ultima.situacao,
    'ultimo_plano_id', ultima.plano_id,
    'ultimo_plano_nome', ultimo_nome,
    'ultimo_ciclo', ultima.ciclo,
    'ultimo_valido_ate', ultima.valido_ate
  );
end
$$;

revoke execute on function public.direitos_de, public.assinatura_valida, public.plano_de, public.tem_plano_pago from public, anon, authenticated;

-- O app chama ao abrir: vence o que passou da data e devolve o que a pessoa pode usar.
create or replace function public.meus_direitos() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return null; end if;
  perform public.vencer_assinaturas((select auth.uid()));
  return public.direitos_de((select auth.uid()));
end
$$;

revoke execute on function public.meus_direitos from public, anon;
grant execute on function public.meus_direitos to authenticated;

-- Limite de alunos: o personal não cria ficha nova acima do limite do plano dele.
create or replace function public.limite_de_alunos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
begin
  if new.profissional_id is null or (select auth.uid()) is distinct from new.profissional_id then return new; end if;
  if tg_op = 'UPDATE' and old.profissional_id is not distinct from new.profissional_id then return new; end if;
  d := public.direitos_de(new.profissional_id);
  if d is not null and d->>'limite_alunos' is not null and (d->>'alunos')::integer >= (d->>'limite_alunos')::integer then
    raise exception 'Seu plano % permite até % alunos. Mude de plano para cadastrar mais.', d->>'plano_nome', d->>'limite_alunos';
  end if;
  return new;
end
$$;

drop trigger if exists limite_de_alunos on public.fichas;
create trigger limite_de_alunos before insert or update of profissional_id on public.fichas
for each row execute function public.limite_de_alunos();

-- Venda de serviços só a partir do Essencial: o personal não liga serviço sem o plano...
create or replace function public.plano_vende_servicos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.ativo or (tg_op = 'UPDATE' and old.ativo) then return new; end if;
  if (select auth.uid()) is distinct from new.profissional_id then return new; end if;
  if not coalesce((public.direitos_de(new.profissional_id)->>'vende_servicos')::boolean, true) then
    raise exception 'Vender serviços pelo app faz parte dos planos Essencial, Pro e Estúdio.';
  end if;
  return new;
end
$$;

drop trigger if exists zz_plano_vende_servicos on public.servicos;
create trigger zz_plano_vende_servicos before insert or update of ativo on public.servicos
for each row execute function public.plano_vende_servicos();

-- ...e o aluno não compra de quem está sem o plano (por exemplo, quando o plano venceu).
create or replace function public.recebedor_vende_servicos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo <> 'avaliacao' or new.recebedor_id is null or (select auth.uid()) is null then return new; end if;
  if not coalesce((public.direitos_de(new.recebedor_id)->>'vende_servicos')::boolean, true) then
    raise exception 'Este personal não está vendendo pelo app agora. Combine com ele pelo chat.';
  end if;
  return new;
end
$$;

drop trigger if exists recebedor_vende_servicos on public.pagamentos;
create trigger recebedor_vende_servicos before insert on public.pagamentos
for each row execute function public.recebedor_vende_servicos();

revoke execute on function public.limite_de_alunos, public.plano_vende_servicos, public.recebedor_vende_servicos from public, anon, authenticated;

-- Administrador: dá um plano de cortesia (parceiro, testador...) por tantos dias.
create or replace function public.admin_dar_plano(usuario uuid, plano text, dias integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.planos;
  papel_dele public.papel;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  if dias is null or dias < 1 or dias > 3650 then raise exception 'Escolha de 1 a 3650 dias'; end if;
  select * into p from public.planos where id = plano;
  if p.id is null then raise exception 'Plano não encontrado'; end if;
  select papel into papel_dele from public.perfis where id = usuario;
  if papel_dele is null then raise exception 'Conta não encontrada'; end if;
  if (case when papel_dele = 'aluno' then 'aluno' else 'profissional' end) <> p.publico then
    raise exception 'Este plano não é para esse tipo de conta';
  end if;
  update public.assinaturas set situacao = 'cancelada', cancelado_em = now() where usuario_id = usuario and situacao <> 'cancelada';
  update public.pagamentos set situacao = 'cancelado' where pagador_id = usuario and tipo = 'assinatura' and situacao = 'pendente';
  insert into public.assinaturas (usuario_id, plano_id, ciclo, situacao, valor, valido_ate, cortesia)
  values (usuario, p.id, 'mensal', 'ativa', 0, now() + make_interval(days => dias), true);
end
$$;

-- Administrador: o plano de cada pessoa (para a lista de cortesias).
create or replace function public.admin_planos_de_todos()
returns table (usuario_id uuid, plano_id text, situacao text, valido_ate timestamptz, cortesia boolean)
language sql stable security definer set search_path = '' as $$
  select distinct on (a.usuario_id) a.usuario_id, a.plano_id, a.situacao, a.valido_ate, a.cortesia
  from public.assinaturas a
  where public.eh_admin() and a.situacao in ('ativa', 'teste', 'aguardando', 'vencida')
  order by a.usuario_id, a.criado_em desc
$$;

revoke execute on function public.admin_dar_plano, public.admin_planos_de_todos from public, anon;
grant execute on function public.admin_dar_plano, public.admin_planos_de_todos to authenticated;

-- Renovar: cobra mais um período do mesmo plano sem tirar o acesso de quem
-- ainda está com o plano valendo. O pagamento fica ligado à assinatura atual e,
-- quando cai, confirmar_pagamento soma 1 mês (ou 1 ano) a partir do fim dela.
-- Serve também para quem está no teste grátis e para quem já venceu.
create or replace function public.renovar_plano(forma text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  a public.assinaturas;
  p public.planos;
  preco numeric(10, 2);
  id_pagamento uuid;
begin
  if not public.eh_liberado() then raise exception 'Sua conta ainda não foi liberada'; end if;
  if forma not in ('pix', 'cartao', 'boleto') then raise exception 'Forma de pagamento inválida'; end if;
  select * into a from public.assinaturas
  where usuario_id = eu and situacao in ('ativa', 'teste', 'vencida') and not cortesia
  order by criado_em desc limit 1;
  if a.id is null then raise exception 'Você não tem plano para renovar. Escolha um plano.'; end if;
  select * into p from public.planos where id = a.plano_id and ativo;
  if p.id is null then raise exception 'Este plano não está mais à venda. Escolha outro plano.'; end if;
  preco := case when a.ciclo = 'anual' then p.preco_anual else p.preco_mensal end;
  if preco <= 0 then raise exception 'O plano grátis não precisa renovar'; end if;

  -- Um pedido de renovação por vez.
  update public.pagamentos set situacao = 'cancelado'
  where pagador_id = eu and tipo = 'assinatura' and situacao = 'pendente';
  update public.assinaturas set valor = preco where id = a.id;

  insert into public.pagamentos (pagador_id, tipo, assinatura_id, descricao, valor, comissao, forma)
  values (eu, 'assinatura', a.id, 'Renovação do plano ' || p.nome || ' (' || a.ciclo || ')', preco, preco, forma)
  returning id into id_pagamento;
  return id_pagamento;
end
$$;

revoke execute on function public.renovar_plano from public, anon;
grant execute on function public.renovar_plano to authenticated;

-- Vence todo dia às 3h (Brasília), além de quando a pessoa abre o app.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'vencer-assinaturas';
select cron.schedule('vencer-assinaturas', '0 6 * * *', $$select public.vencer_assinaturas()$$);
select public.vencer_assinaturas();

-- ---------- 4. Aluno entra na hora ----------

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dados jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  p public.papel := case when dados->>'papel' = 'profissional' then 'profissional'::public.papel else 'aluno'::public.papel end;
begin
  -- O aluno já entra liberado. O personal continua esperando o administrador conferir o registro (CREF).
  insert into public.perfis (id, email, nome, papel, registro, situacao)
  values (new.id, lower(new.email), left(coalesce(dados->>'nome', ''), 120), p, left(coalesce(dados->>'registro', ''), 40),
    case when p = 'aluno' then 'liberado'::public.situacao else 'pendente'::public.situacao end);
  return new;
end
$$;

-- Quem já estava esperando como aluno entra agora.
update public.perfis set situacao = 'liberado' where papel = 'aluno' and situacao = 'pendente';

-- ---------- 5. Repasse ao personal ----------

-- O que falta repassar a cada personal: serviços pagos (avaliação, ficha,
-- acompanhamento...) e chamadas de vídeo feitas, já sem a comissão e as taxas.
create or replace function public.admin_repasses()
returns table (profissional_id uuid, nome text, servicos integer, servicos_valor numeric, chamadas integer, chamadas_valor numeric, repassado_total numeric)
language sql stable security definer set search_path = '' as $$
  with s as (
    select pg.recebedor_id as id,
      count(*) filter (where pg.repassado_em is null)::integer as n,
      coalesce(sum(pg.valor - pg.comissao) filter (where pg.repassado_em is null), 0) as v,
      coalesce(sum(pg.valor - pg.comissao) filter (where pg.repassado_em is not null), 0) as feito
    from public.pagamentos pg
    where pg.tipo = 'avaliacao' and pg.situacao = 'pago' and pg.recebedor_id is not null
      and not exists (select 1 from public.chamadas_video c where c.pagamento_id = pg.id)
    group by pg.recebedor_id
  ), v as (
    select c.profissional_id as id,
      count(*) filter (where c.repassado_em is null)::integer as n,
      coalesce(sum(c.valor - c.comissao - c.taxa) filter (where c.repassado_em is null), 0) as v,
      coalesce(sum(c.valor - c.comissao - c.taxa) filter (where c.repassado_em is not null), 0) as feito
    from public.chamadas_video c
    where c.situacao = 'feita'
    group by c.profissional_id
  )
  select p.id, coalesce(nullif(p.nome, ''), p.email), coalesce(s.n, 0), coalesce(s.v, 0), coalesce(v.n, 0), coalesce(v.v, 0), coalesce(s.feito, 0) + coalesce(v.feito, 0)
  from public.perfis p
  left join s on s.id = p.id
  left join v on v.id = p.id
  where public.eh_admin() and (s.id is not null or v.id is not null)
  order by coalesce(s.v, 0) + coalesce(v.v, 0) desc
$$;

-- Marca como repassado tudo o que estava em aberto para o personal. Devolve o valor.
create or replace function public.admin_marcar_repasse(profissional uuid) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  total numeric := 0;
  parte numeric;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  with feitos as (
    update public.pagamentos pg set repassado_em = now()
    where pg.recebedor_id = profissional and pg.tipo = 'avaliacao' and pg.situacao = 'pago' and pg.repassado_em is null
      and not exists (select 1 from public.chamadas_video c where c.pagamento_id = pg.id)
    returning pg.valor - pg.comissao as v
  ) select coalesce(sum(v), 0) into parte from feitos;
  total := total + parte;
  with feitos as (
    update public.chamadas_video c set repassado_em = now()
    where c.profissional_id = profissional and c.situacao = 'feita' and c.repassado_em is null
    returning c.valor - c.comissao - c.taxa as v
  ) select coalesce(sum(v), 0) into parte from feitos;
  return total + parte;
end
$$;

revoke execute on function public.admin_repasses, public.admin_marcar_repasse from public, anon;
grant execute on function public.admin_repasses, public.admin_marcar_repasse to authenticated;
