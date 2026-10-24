-- Pagamento pelo Mercado Pago. A função `mercado-pago` cria a cobrança (Pix ou
-- página do Mercado Pago para cartão e boleto) e guarda aqui o que o app mostra.
-- A função `mercado-pago-aviso` recebe o aviso do Mercado Pago, confere o
-- pagamento direto na API dele e confirma aqui.

alter table public.pagamentos
  add column pix_copia_cola text,
  add column pix_qr text,
  add column link_pagamento text;

-- Confirma o pagamento e libera o plano. Usada pelo administrador (à mão) e
-- pelo aviso do Mercado Pago. Chamar de novo para o mesmo pagamento não faz nada.
create function public.confirmar_pagamento(pagamento uuid, id_gateway text default null) returns void
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
      valido_ate = greatest(coalesce(valido_ate, now()), now()) + case when ciclo = 'anual' then interval '1 year' else interval '1 month' end
  where id = pg.assinatura_id and situacao <> 'cancelada';
end
$$;

revoke execute on function public.confirmar_pagamento from public, anon, authenticated;
grant execute on function public.confirmar_pagamento to service_role;

create or replace function public.admin_definir_pagamento(pagamento uuid, nova text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pg public.pagamentos;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  if nova not in ('pago', 'cancelado', 'pendente') then raise exception 'Situação inválida'; end if;
  if nova = 'pago' then
    perform public.confirmar_pagamento(pagamento);
    return;
  end if;
  update public.pagamentos set situacao = nova, pago_em = null where id = pagamento returning * into pg;
  if nova = 'pendente' and pg.assinatura_id is not null then
    update public.assinaturas set situacao = 'aguardando' where id = pg.assinatura_id and situacao = 'ativa';
  end if;
end
$$;
