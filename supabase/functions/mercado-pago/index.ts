// Cria a cobrança no Mercado Pago para um pagamento pendente de quem está usando
// o app: Pix (QR Code e copia e cola) ou a página do Mercado Pago para cartão e
// boleto. O token do Mercado Pago fica só aqui, no segredo MP_ACCESS_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'
const MP = 'https://api.mercadopago.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido' }, 405)

  const tokenMp = Deno.env.get('MP_ACCESS_TOKEN')
  if (!tokenMp) return resposta({ erro: 'O pagamento pelo app ainda não foi ligado.' }, 503)

  const url = Deno.env.get('SUPABASE_URL')!
  const banco = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: quem, error: erroQuem } = await banco.auth.getUser(token)
  if (erroQuem || !quem.user) return resposta({ erro: 'Entre na sua conta de novo.' }, 401)

  let dados: { pagamento?: string; forma?: string }
  try {
    dados = await req.json()
  } catch {
    return resposta({ erro: 'Dados inválidos' }, 400)
  }
  const forma = dados.forma
  if (!/^[0-9a-f-]{36}$/i.test(dados.pagamento ?? '') || (forma !== 'pix' && forma !== 'cartao' && forma !== 'boleto'))
    return resposta({ erro: 'Dados inválidos' }, 400)

  // Só quem deve o pagamento gera a cobrança, e só enquanto ele está pendente.
  const { data: pg } = await banco.from('pagamentos').select('*').eq('id', dados.pagamento).eq('pagador_id', quem.user.id).maybeSingle()
  if (!pg) return resposta({ erro: 'Pagamento não encontrado.' }, 404)
  if (pg.situacao !== 'pendente') return resposta({ erro: pg.situacao === 'pago' ? 'Este pagamento já foi confirmado.' : 'Este pedido foi cancelado.' }, 409)

  const aviso = `${url}/functions/v1/mercado-pago-aviso`
  const valor = Number(pg.valor)
  const cabecalho = { Authorization: `Bearer ${tokenMp}`, 'Content-Type': 'application/json' }

  if (forma === 'pix') {
    const r = await fetch(`${MP}/v1/payments`, {
      method: 'POST',
      // Mesma chave para o mesmo pedido: tocar duas vezes não cria dois Pix.
      headers: { ...cabecalho, 'X-Idempotency-Key': `pix-${pg.id}` },
      body: JSON.stringify({
        transaction_amount: valor,
        description: `FormaCerta: ${pg.descricao}`,
        payment_method_id: 'pix',
        payer: { email: quem.user.email },
        external_reference: pg.id,
        notification_url: aviso,
      }),
    })
    const mp = await r.json().catch(() => null)
    const pix = mp?.point_of_interaction?.transaction_data
    if (!r.ok || !pix?.qr_code) return resposta({ erro: 'O Mercado Pago não gerou o Pix. Tente de novo em instantes.' }, 502)

    await banco
      .from('pagamentos')
      .update({ forma, gateway_id: String(mp.id), pix_copia_cola: pix.qr_code, pix_qr: pix.qr_code_base64 ?? null, link_pagamento: pix.ticket_url ?? null })
      .eq('id', pg.id)
    return resposta({ pix_copia_cola: pix.qr_code, pix_qr: pix.qr_code_base64 ?? null, link: pix.ticket_url ?? null })
  }

  // Cartão ou boleto: página segura do Mercado Pago (o app nunca vê o número do cartão).
  const fora = forma === 'cartao' ? ['ticket', 'bank_transfer', 'atm'] : ['credit_card', 'debit_card', 'prepaid_card', 'bank_transfer']
  const r = await fetch(`${MP}/checkout/preferences`, {
    method: 'POST',
    headers: cabecalho,
    body: JSON.stringify({
      items: [{ id: pg.id, title: `FormaCerta: ${pg.descricao}`, quantity: 1, unit_price: valor, currency_id: 'BRL' }],
      payer: { email: quem.user.email },
      external_reference: pg.id,
      notification_url: aviso,
      payment_methods: { excluded_payment_types: fora.map((id) => ({ id })), installments: forma === 'cartao' ? 12 : 1 },
      back_urls: { success: APP, pending: APP, failure: APP },
      auto_return: 'approved',
      statement_descriptor: 'FORMACERTA',
    }),
  })
  const mp = await r.json().catch(() => null)
  // Com o token de teste o Mercado Pago devolve a página de testes (sandbox).
  const link = tokenMp.startsWith('TEST-') ? (mp?.sandbox_init_point ?? mp?.init_point) : mp?.init_point
  if (!r.ok || !link) return resposta({ erro: 'O Mercado Pago não abriu a página de pagamento. Tente de novo em instantes.' }, 502)

  await banco.from('pagamentos').update({ forma, link_pagamento: link }).eq('id', pg.id)
  return resposta({ link })
})
