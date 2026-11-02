-- Cortesia vale só para quem ganhou (pedido do Ney em 02/11/2026): o personal com
-- plano de cortesia usa tudo, mas os alunos dele assinam o Aluno Pro normalmente.
-- O Aluno Pro de presente continua só para alunos de personal que paga o plano.
-- As vendas do personal com cortesia pagam a comissão normal (comprar_avaliacao
-- sempre calcula a comissão, não muda nada aqui). Pode rodar de novo.

-- Personal com plano pago de verdade (pagou ou está no teste grátis), sem contar cortesia.
create or replace function public.paga_plano(usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assinaturas a join public.planos p on p.id = a.plano_id
    where a.usuario_id = usuario and a.situacao in ('ativa', 'teste')
      and (a.valido_ate is null or a.valido_ate > now())
      and p.preco_mensal > 0 and not a.cortesia
  )
$$;

revoke execute on function public.paga_plano from public, anon, authenticated;

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
