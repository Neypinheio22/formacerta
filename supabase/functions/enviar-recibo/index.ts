// Manda o recibo por e-mail para quem pagou, quando o pagamento é confirmado.
// Chamada pelo banco (gatilho recibo_por_email). Confere tudo no banco e só
// manda uma vez por pagamento (pagamentos.recibo_em), então chamar de novo não
// repete o e-mail. Publicada sem login (verify_jwt false).
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'
const SUPORTE = 'ney.comercial@gmail.com'
const FORMA: Record<string, string> = { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto' }

const ok = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ erro: 'Método não permitido' }, 405)
  let id = ''
  try {
    id = String((await req.json()).pagamento ?? '')
  } catch {
    return ok({ erro: 'Dados inválidos' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return ok({ erro: 'Dados inválidos' }, 400)

  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return ok({ enviado: false, motivo: 'RESEND_API_KEY não configurada' })
  const remetente = Deno.env.get('EMAIL_REMETENTE') || 'FormaCerta <lembrete@belezudis.com.br>'
  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // Marca antes de mandar: duas chamadas ao mesmo tempo não mandam dois e-mails.
  const { data: pg } = await banco
    .from('pagamentos')
    .update({ recibo_em: new Date().toISOString() })
    .eq('id', id)
    .eq('situacao', 'pago')
    .is('recibo_em', null)
    .select('id, pagador_id, recebedor_id, descricao, valor, forma, pago_em, gateway_id')
    .maybeSingle()
  if (!pg) return ok({ enviado: false })

  const [{ data: pagador }, { data: recebedor }] = await Promise.all([
    banco.from('perfis').select('email, nome').eq('id', pg.pagador_id).maybeSingle(),
    pg.recebedor_id ? banco.from('perfis').select('nome, email').eq('id', pg.recebedor_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  if (!pagador?.email) return ok({ enviado: false, motivo: 'sem e-mail' })

  const numero = `FC-${String(pg.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
  const nome = escapar((pagador.nome as string) || (pagador.email as string))
  const personal = recebedor ? escapar(((recebedor.nome as string) || (recebedor.email as string)).trim()) : ''
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:6px 0;color:#555">${rotulo}</td><td style="padding:6px 0;text-align:right"><strong>${valor}</strong></td></tr>`
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111;max-width:520px">
      <div style="background:#020b16;padding:16px 20px;border-radius:12px 12px 0 0;border-bottom:3px solid #36f294">
        <img src="${APP}icon-192.png" width="32" height="32" alt="" style="vertical-align:middle">
        <span style="font-size:20px;font-weight:bold;color:#fff;vertical-align:middle;margin-left:8px">Forma<span style="color:#36f294">Certa</span></span>
      </div>
      <div style="border:1px solid #e3e7ea;border-top:0;border-radius:0 0 12px 12px;padding:20px">
        <h2 style="margin:0 0 4px">Recibo de pagamento</h2>
        <p style="margin:0 0 16px;color:#555">Nº ${numero}</p>
        <p>Olá, ${escapar(nome.split(' ')[0])}! Recebemos o seu pagamento. Obrigado!</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #e3e7ea">
          ${linha('Referente a', escapar(pg.descricao as string))}
          ${personal ? linha('Personal', personal) : ''}
          ${linha('Forma', FORMA[pg.forma as string] ?? String(pg.forma))}
          ${linha('Data', pg.pago_em ? dataBr(pg.pago_em as string) : '')}
          ${pg.gateway_id ? linha('Código Mercado Pago', escapar(String(pg.gateway_id))) : ''}
          <tr><td style="padding:10px 0;border-top:1px solid #e3e7ea">Valor pago</td><td style="padding:10px 0;border-top:1px solid #e3e7ea;text-align:right;font-size:20px;color:#12965a"><strong>${real.format(Number(pg.valor))}</strong></td></tr>
        </table>
        <p style="margin-top:16px">O recibo em PDF fica no app, em <strong>Planos → Meus pagamentos</strong>.</p>
        <p><a href="${APP}" style="background:#36f294;color:#020b16;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir o FormaCerta</a></p>
        <p style="color:#777;font-size:12px">Pagamento processado pelo Mercado Pago. Este recibo não substitui nota fiscal. Dúvidas: ${SUPORTE}.</p>
      </div>
    </div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [pagador.email],
      reply_to: SUPORTE,
      subject: `Recibo ${numero}: ${pg.descricao} (${real.format(Number(pg.valor))})`,
      html,
    }),
  })
  if (!r.ok) {
    // Libera para tentar de novo numa próxima chamada.
    await banco.from('pagamentos').update({ recibo_em: null }).eq('id', id)
    return ok({ enviado: false, motivo: `Resend respondeu ${r.status}` }, 502)
  }
  return ok({ enviado: true })
})
