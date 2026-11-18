-- Agente de WhatsApp, parte 2: fechar a venda na conversa (Pix) e lembretes.
--
-- Venda: a pessoa diz o e-mail da conta, recebe um código nesse e-mail e digita
-- o código no WhatsApp. Só então a conversa fica ligada à conta e o robô pode
-- pedir o plano e gerar o Pix (o código impede alguém de mexer no plano de outra
-- pessoa só sabendo o e-mail). Quando o Mercado Pago confirma, o plano ativa
-- sozinho (mercado-pago-aviso → confirmar_pagamento, igual ao app).
--
-- Lembretes: a cada 5 minutos o pg_cron chama a função whatsapp-agente, que
-- manda um lembrete para quem parou de responder perto de 24 horas (texto livre,
-- ainda dentro da janela do WhatsApp) e outro perto de 3 dias (modelo aprovado
-- na Meta, só se o segredo WHATSAPP_MODELO_LEMBRETE estiver preenchido). Também
-- avisa na conversa quando o Pix gerado ali é pago.

alter table public.whatsapp_conversas
  add column if not exists usuario_id uuid references public.perfis (id) on delete set null,
  add column if not exists codigo_hash text,
  add column if not exists codigo_email text,
  add column if not exists codigo_expira_em timestamptz,
  add column if not exists codigo_enviado_em timestamptz,
  add column if not exists codigo_tentativas integer not null default 0,
  add column if not exists pix_pagamento_id uuid references public.pagamentos (id) on delete set null,
  add column if not exists pix_avisado_em timestamptz,
  add column if not exists ultima_entrada_em timestamptz,
  add column if not exists lembrete_24h_em timestamptz,
  add column if not exists lembrete_3d_em timestamptz,
  add column if not exists sem_lembretes boolean not null default false;

-- Conversas antigas: a última mensagem da pessoa.
update public.whatsapp_conversas c
set ultima_entrada_em = (select max(m.criado_em) from public.whatsapp_mensagens m where m.conversa_id = c.id and m.autor = 'entrada')
where c.ultima_entrada_em is null;

create index if not exists whatsapp_conversas_entrada on public.whatsapp_conversas (ultima_entrada_em);

-- A conta de um e-mail, para mandar o código e ligar a conversa.
create or replace function public.whatsapp_conta_por_email(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
        'existe', true,
        'id', p.id,
        'email', p.email,
        'nome', p.nome,
        'tipo', case when p.papel = 'profissional' then 'personal' else p.papel::text end,
        'email_confirmado', u.email_confirmed_at is not null,
        'situacao', p.situacao::text)
     from public.perfis p
     left join auth.users u on u.id = p.id
     where lower(p.email) = lower(trim(p_email))
     limit 1),
    jsonb_build_object('existe', false))
$$;

-- Resumo da conta ligada à conversa: tipo, liberação e plano atual.
create or replace function public.whatsapp_resumo_conta(p_usuario uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  eu public.perfis;
  d jsonb;
begin
  select * into eu from public.perfis where id = p_usuario;
  if eu.id is null then return null; end if;
  d := public.direitos_de(p_usuario);
  return jsonb_build_object(
    'primeiro_nome', split_part(coalesce(eu.nome, ''), ' ', 1),
    'tipo', case when eu.papel = 'profissional' then 'personal' else eu.papel::text end,
    'liberado', eu.situacao = 'liberado',
    'plano', d->>'plano_nome',
    'plano_id', d->>'plano_id',
    'plano_pago', coalesce((d->>'pago')::boolean, false),
    'situacao_do_plano', d->>'situacao',
    'ciclo', d->>'ciclo',
    'valido_ate', d->>'valido_ate',
    'cortesia', coalesce((d->>'cortesia')::boolean, false),
    'aluno_pro_pelo_personal', coalesce((d->>'pro_pelo_personal')::boolean, false),
    'ja_usou_dias_gratis', exists (select 1 from public.assinaturas a where a.usuario_id = p_usuario and a.valor > 0)
  );
end
$$;

-- Pedido de plano feito pelo WhatsApp, para a conta ligada à conversa.
-- Mesmas regras do app (escolher_plano e renovar_plano), com duas travas:
-- não troca um plano pago que está valendo nem mexe em cortesia (isso fica
-- com o Ney). Devolve o que aconteceu:
--   acao = 'pagar'  → pagamento pendente criado (o robô gera o Pix);
--   acao = 'teste'  → dias grátis começaram, sem cobrança agora;
--   acao = 'gratis' → plano grátis ativado;
--   acao = 'ja_tem' → não precisa (o personal já paga o Aluno Pro).
create or replace function public.whatsapp_pedir_plano(p_usuario uuid, p_plano text, p_ciclo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  eu public.perfis;
  p public.planos;
  cfg public.config_cobranca;
  atual public.assinaturas;
  preco numeric(10, 2);
  ja_testou boolean;
  fim_teste timestamptz;
  nova_situacao text;
  ate timestamptz;
  id_assinatura uuid;
  id_pagamento uuid;
  v_descricao text;
begin
  select * into eu from public.perfis where id = p_usuario;
  if eu.id is null then raise exception 'Conta não encontrada'; end if;
  if eu.situacao <> 'liberado' then raise exception 'A conta ainda não foi liberada pela equipe'; end if;
  if p_ciclo not in ('mensal', 'anual') then raise exception 'Escolha mensal ou anual'; end if;
  select * into p from public.planos where id = p_plano and ativo;
  if p.id is null then raise exception 'Plano não encontrado'; end if;
  if eu.papel::text <> p.publico then raise exception 'Este plano não é para o tipo desta conta'; end if;
  select * into cfg from public.config_cobranca;
  if cfg.planos_para <> 'todos' then raise exception 'Os planos ainda não estão à venda'; end if;

  if p.id = 'aluno-pro' and coalesce((public.direitos_de(p_usuario)->>'pro_pelo_personal')::boolean, false) then
    return jsonb_build_object('acao', 'ja_tem', 'motivo', 'O personal desta pessoa já paga um plano: ela já tem o Aluno Pro sem pagar nada.');
  end if;

  preco := case when p_ciclo = 'anual' then p.preco_anual else p.preco_mensal end;

  select * into atual from public.assinaturas
  where usuario_id = p_usuario and situacao <> 'cancelada'
  order by criado_em desc limit 1;

  if atual.id is not null and atual.cortesia then
    raise exception 'Esta conta tem plano de cortesia: passe para humano';
  end if;

  -- Mesmo plano e ciclo, valendo, no teste ou vencido: renova (soma o período ao fim do atual).
  if atual.id is not null and atual.plano_id = p.id and atual.ciclo = p_ciclo and atual.situacao in ('ativa', 'teste', 'vencida') and preco > 0 then
    -- Já tem um pedido de renovação esperando: usa o mesmo (mesmo Pix).
    select pg.id, pg.descricao into id_pagamento, v_descricao from public.pagamentos pg
    where pg.pagador_id = p_usuario and assinatura_id = atual.id and situacao = 'pendente' and valor = preco
    order by criado_em desc limit 1;
    if id_pagamento is not null then
      return jsonb_build_object('acao', 'pagar', 'pagamento_id', id_pagamento, 'valor', preco, 'descricao', v_descricao, 'renovacao', true, 'valido_ate_hoje', atual.valido_ate);
    end if;
    update public.pagamentos set situacao = 'cancelado'
    where pagador_id = p_usuario and tipo = 'assinatura' and situacao = 'pendente';
    update public.assinaturas set valor = preco where id = atual.id;
    v_descricao := 'Renovação do plano ' || p.nome || ' (' || p_ciclo || ')';
    insert into public.pagamentos (pagador_id, tipo, assinatura_id, descricao, valor, comissao, forma)
    values (p_usuario, 'assinatura', atual.id, v_descricao, preco, preco, 'pix')
    returning id into id_pagamento;
    return jsonb_build_object('acao', 'pagar', 'pagamento_id', id_pagamento, 'valor', preco, 'descricao', v_descricao, 'renovacao', true, 'valido_ate_hoje', atual.valido_ate);
  end if;

  -- Já pediu este plano e está esperando pagar: usa o mesmo pedido.
  if atual.id is not null and atual.plano_id = p.id and atual.ciclo = p_ciclo and atual.situacao = 'aguardando' then
    select pg.id, pg.descricao into id_pagamento, v_descricao from public.pagamentos pg
    where pg.pagador_id = p_usuario and assinatura_id = atual.id and situacao = 'pendente'
    order by criado_em desc limit 1;
    if id_pagamento is not null then
      return jsonb_build_object('acao', 'pagar', 'pagamento_id', id_pagamento, 'valor', preco, 'descricao', v_descricao, 'renovacao', false);
    end if;
  end if;

  -- Plano pago valendo: trocar de plano fica com o Ney.
  if atual.id is not null and atual.situacao = 'ativa' and atual.valor > 0 and coalesce(atual.valido_ate, now()) > now() then
    raise exception 'Esta conta já tem um plano pago valendo (%): troca de plano é com a equipe, passe para humano', coalesce((select nome from public.planos where id = atual.plano_id), atual.plano_id);
  end if;

  select exists (select 1 from public.assinaturas where usuario_id = p_usuario and valor > 0) into ja_testou;
  select valido_ate into fim_teste from public.assinaturas
  where usuario_id = p_usuario and situacao = 'teste' and valido_ate > now()
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

  update public.assinaturas set situacao = 'cancelada', cancelado_em = now()
  where usuario_id = p_usuario and situacao <> 'cancelada';
  update public.pagamentos set situacao = 'cancelado'
  where pagador_id = p_usuario and tipo = 'assinatura' and situacao = 'pendente';

  insert into public.assinaturas (usuario_id, plano_id, ciclo, situacao, valor, valido_ate)
  values (p_usuario, p.id, p_ciclo, nova_situacao, preco, ate)
  returning id into id_assinatura;

  if nova_situacao = 'aguardando' then
    v_descricao := 'Plano ' || p.nome || ' (' || p_ciclo || ')';
    insert into public.pagamentos (pagador_id, tipo, assinatura_id, descricao, valor, comissao, forma)
    values (p_usuario, 'assinatura', id_assinatura, v_descricao, preco, preco, 'pix')
    returning id into id_pagamento;
    return jsonb_build_object('acao', 'pagar', 'pagamento_id', id_pagamento, 'valor', preco, 'descricao', v_descricao, 'renovacao', false);
  elsif nova_situacao = 'teste' then
    return jsonb_build_object('acao', 'teste', 'plano', p.nome, 'ciclo', p_ciclo, 'valor_depois', preco, 'gratis_ate', ate);
  end if;
  return jsonb_build_object('acao', 'gratis', 'plano', p.nome);
end
$$;

revoke execute on function public.whatsapp_conta_por_email(text), public.whatsapp_resumo_conta(uuid), public.whatsapp_pedir_plano(uuid, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_conta_por_email(text), public.whatsapp_resumo_conta(uuid), public.whatsapp_pedir_plano(uuid, text, text) to service_role;

-- A cada 5 minutos: lembretes e aviso de Pix pago (a função decide o que mandar).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname = 'whatsapp-lembretes';
select cron.schedule(
  'whatsapp-lembretes',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/whatsapp-agente',
       body := '{"tarefa": "lembretes"}'::jsonb,
       headers := '{"Content-Type": "application/json"}'::jsonb
     ) $$
);
