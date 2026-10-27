// Recebe o aviso do Mercado Pago quando um pagamento muda. Não confia no que
// chega: busca o pagamento direto na API do Mercado Pago com o nosso token e só
// confirma se estiver aprovado e com o valor certo. Publicada sem login
// (verify_jwt false), porque quem chama é o Mercado Pago.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ok = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  const tokenMp = Deno.env.get('MP_ACCESS_TOKEN')
  if (!tokenMp) return ok({ recebido: false, motivo: 'MP_ACCESS_TOKEN não configurado' })

  // O Mercado Pago manda o id no endereço (?data.id= ou ?id=) ou no corpo.
  const endereco = new URL(req.url)
  let corpo: { type?: string; topic?: string; data?: { id?: string | number } } = {}
  try {
    corpo = await req.json()
  } catch {
    /* aviso só pelo endereço */
  }
  const tipo = corpo.type ?? corpo.topic ?? endereco.searchParams.get('type') ?? endereco.searchParams.get('topic')
  const id = String(corpo.data?.id ?? endereco.searchParams.get('data.id') ?? endereco.searchParams.get('id') ?? '')
  // Outros avisos (pedido do checkout etc.): responde 200 para o Mercado Pago não repetir.
  if (tipo !== 'payment' || !/^\d+$/.test(id)) return ok({ recebido: true })

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${tokenMp}` } })
  if (!r.ok) return ok({ recebido: false }, 502)
  const mp = await r.json()
  if (mp.status !== 'approved' || !/^[0-9a-f-]{36}$/i.test(mp.external_reference ?? '')) return ok({ recebido: true, situacao: mp.status })

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: pg } = await banco.from('pagamentos').select('id, valor, situacao').eq('id', mp.external_reference).maybeSingle()
  if (!pg) return ok({ recebido: true, motivo: 'pagamento não encontrado' })
  if (Number(mp.transaction_amount) + 0.001 < Number(pg.valor)) return ok({ recebido: true, motivo: 'valor menor que o pedido' })

  const { error } = await banco.rpc('confirmar_pagamento', { pagamento: pg.id, id_gateway: String(mp.id) })
  if (error) return ok({ recebido: false }, 500)
  return ok({ recebido: true, confirmado: true })
})
