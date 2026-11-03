-- Melhorias 6 a 9 da auditoria (02/11/2026):
-- 6. O personal fica sabendo da venda: mensagem automática no chat e e-mail
--    (função avisar-venda, chamada pelo banco quando o pagamento é confirmado).
-- 7. Quem paga um serviço e ainda não tem personal passa a ser aluno dele.
-- 8. Serviço mensal (acompanhamento, pacote): o aluno vê quando vence e renova com um toque.
-- 9. Cancelar o plano não corta na hora: vale até o fim do período pago e não renova.
-- Pode rodar de novo.

create extension if not exists pg_net with schema extensions;

alter table public.pagamentos add column if not exists avisado_em timestamptz;

-- ---------- 6 e 7. Depois que um serviço é pago ----------

create or replace function public.apos_pagar_servico() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  conversa uuid;
  texto text;
begin
  if new.situacao <> 'pago' or old.situacao = 'pago' or new.tipo <> 'avaliacao' or new.recebedor_id is null then return new; end if;
  -- Nada aqui pode impedir a confirmação do pagamento: qualquer erro só vira aviso no registro.
  begin
    -- 7. Sem personal ainda: quem contratou passa a ser o personal dele.
    update public.perfis set profissional_id = new.recebedor_id
    where id = new.pagador_id and papel = 'aluno' and profissional_id is null;

    -- 6. Mensagem no chat dos dois, para o personal ver na hora e combinar o atendimento.
    insert into public.conversas (aluno_id, profissional_id) values (new.pagador_id, new.recebedor_id)
    on conflict (aluno_id, profissional_id) do nothing;
    select id into conversa from public.conversas where aluno_id = new.pagador_id and profissional_id = new.recebedor_id;
    texto := '✅ Pagamento confirmado: ' || new.descricao || ' (R$ ' || replace(to_char(new.valor, 'FM999G990D00'), '.', ',') || '). Vamos combinar o atendimento?';
    insert into public.mensagens (conversa_id, autor_id, texto) values (conversa, new.pagador_id, left(texto, 1000));
    update public.conversas set ultima_em = now(), ultima_previa = left(texto, 120), lida_aluno_em = now() where id = conversa;

    -- 6. E-mail ao personal (a função confere tudo de novo e só manda uma vez).
    perform net.http_post(
      url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/avisar-venda',
      body := jsonb_build_object('pagamento', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    raise warning 'apos_pagar_servico: %', sqlerrm;
  end;
  return new;
end
$$;

drop trigger if exists apos_pagar_servico on public.pagamentos;
create trigger apos_pagar_servico after update of situacao on public.pagamentos
for each row execute function public.apos_pagar_servico();

revoke execute on function public.apos_pagar_servico from public, anon, authenticated;

-- ---------- 8. Serviços mensais: quando vence e renovar ----------

-- Para o aluno: cada serviço mensal que ele pagou, com a data em que vence
-- (30 dias depois do último pagamento). Só aparece a partir de 5 dias antes
-- e some 30 dias depois de vencido.
create or replace function public.mensalidades_para_renovar()
returns table (servico_id uuid, nome text, descricao text, preco numeric, ativo boolean, profissional_id uuid, profissional_nome text, pago_em timestamptz, vence_em timestamptz)
language sql stable security definer set search_path = '' as $$
  with ultimos as (
    select distinct on (pg.servico_id) pg.servico_id, pg.pago_em
    from public.pagamentos pg
    where pg.pagador_id = (select auth.uid()) and pg.tipo = 'avaliacao' and pg.situacao = 'pago' and pg.servico_id is not null
    order by pg.servico_id, pg.pago_em desc
  )
  select s.id, s.nome, s.descricao, s.preco, s.ativo, s.profissional_id, coalesce(nullif(p.nome, ''), 'seu personal'), u.pago_em, u.pago_em + interval '30 days'
  from ultimos u
  join public.servicos s on s.id = u.servico_id and s.mensal
  join public.perfis p on p.id = s.profissional_id
  where u.pago_em + interval '30 days' <= now() + interval '5 days'
    and u.pago_em + interval '30 days' >= now() - interval '30 days'
  order by u.pago_em
$$;

revoke execute on function public.mensalidades_para_renovar from public, anon;
grant execute on function public.mensalidades_para_renovar to authenticated;

-- ---------- 9. Cancelar sem perder o que pagou ----------

-- Plano pago e ainda valendo: marca o cancelamento e continua até o fim (não renova).
-- Teste grátis ou plano sem data: cancela na hora, como antes.
create or replace function public.cancelar_assinatura() returns void
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
begin
  update public.pagamentos set situacao = 'cancelado'
  where pagador_id = eu and tipo = 'assinatura' and situacao = 'pendente';
  update public.assinaturas set cancelado_em = now()
  where usuario_id = eu and situacao = 'ativa' and valor > 0 and not cortesia and valido_ate > now() and cancelado_em is null;
  update public.assinaturas set situacao = 'cancelada', cancelado_em = now()
  where usuario_id = eu and situacao not in ('cancelada', 'vencida')
    and not (situacao = 'ativa' and valor > 0 and not cortesia and valido_ate > now());
end
$$;

-- Desistiu de cancelar: o plano volta a ser renovável.
create or replace function public.reativar_assinatura() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.assinaturas set cancelado_em = null
  where usuario_id = (select auth.uid()) and situacao = 'ativa' and valido_ate > now();
end
$$;

revoke execute on function public.cancelar_assinatura, public.reativar_assinatura from public, anon;
grant execute on function public.cancelar_assinatura, public.reativar_assinatura to authenticated;

-- Pagou a renovação: o plano deixa de estar cancelado.
create or replace function public.confirmar_pagamento(pagamento uuid, id_gateway text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pg public.pagamentos;
begin
  update public.pagamentos
  set situacao = 'pago', pago_em = now(), gateway_id = coalesce(id_gateway, gateway_id)
  where id = pagamento and situacao <> 'pago'
  returning * into pg;
  if pg.id is null or pg.assinatura_id is null then return; end if;

  update public.assinaturas
  set situacao = 'ativa',
      cancelado_em = null,
      valido_ate = greatest(coalesce(valido_ate, now()), now()) + case when ciclo = 'anual' then interval '1 year' else interval '1 month' end
  where id = pg.assinatura_id and situacao <> 'cancelada';
end
$$;

revoke execute on function public.confirmar_pagamento from public, anon, authenticated;
grant execute on function public.confirmar_pagamento to service_role;

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
    -- O aluno de um personal que PAGA o plano (ou do administrador) ganha o Aluno Pro.
    -- Cortesia não conta: vale só para o personal usar o sistema; o aluno dele assina o Aluno Pro.
    if eu.profissional_id is not null then
      select exists (select 1 from public.perfis x where x.id = eu.profissional_id and x.papel = 'admin') or public.paga_plano(eu.profissional_id)
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
    -- Cancelou: o plano vale até o fim do período, mas não renova.
    'cancelado', valida.cancelado_em is not null,
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
