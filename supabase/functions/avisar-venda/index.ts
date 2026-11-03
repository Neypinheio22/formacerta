// Avisa o personal por e-mail quando um aluno paga um serviço dele pelo app.
// Chamada pelo banco (gatilho apos_pagar_servico) quando o pagamento é confirmado.
// Confere tudo no banco e só manda uma vez por pagamento (pagamentos.avisado_em),
// então chamar de novo não repete o e-mail. Publicada sem login (verify_jwt false).
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'
const SUPORTE = 'ney.comercial@gmail.com'

const ok = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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
    .update({ avisado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('situacao', 'pago')
    .eq('tipo', 'avaliacao')
    .is('avisado_em', null)
    .select('pagador_id, recebedor_id, descricao, valor, comissao')
    .maybeSingle()
  if (!pg?.recebedor_id) return ok({ enviado: false })

  const [{ data: personal }, { data: aluno }] = await Promise.all([
    banco.from('perfis').select('email, nome').eq('id', pg.recebedor_id).maybeSingle(),
    banco.from('perfis').select('email, nome').eq('id', pg.pagador_id).maybeSingle(),
  ])
  if (!personal?.email) return ok({ enviado: false, motivo: 'personal sem e-mail' })

  const primeiro = escapar(((personal.nome as string) || '').trim().split(' ')[0] || 'Olá')
  const nomeAluno = escapar((aluno?.nome as string) || (aluno?.email as string) || 'Um aluno')
  const valor = Number(pg.valor)
  const parte = valor - Number(pg.comissao)
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111;max-width:520px">
      <p>Oi, ${primeiro}!</p>
      <p><strong>${nomeAluno}</strong> pagou <strong>${escapar(pg.descricao as string)}</strong> pelo FormaCerta.</p>
      <p>Valor: ${real.format(valor)}<br>Sua parte: <strong>${real.format(parte)}</strong> (já sem a comissão do FormaCerta)</p>
      <p>Abra o chat no app para combinar o atendimento. O repasse da sua parte é feito pelo FormaCerta.</p>
      <p><a href="${APP}" style="background:#36f294;color:#020b16;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir o FormaCerta</a></p>
      <p style="color:#777;font-size:12px">Dúvidas: ${SUPORTE}.</p>
    </div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [personal.email],
      reply_to: SUPORTE,
      subject: `Nova venda: ${(aluno?.nome as string) || 'um aluno'} pagou ${pg.descricao}`,
      html,
    }),
  })
  if (!r.ok) {
    // Libera para tentar de novo numa próxima chamada.
    await banco.from('pagamentos').update({ avisado_em: null }).eq('id', id)
    return ok({ enviado: false, motivo: `Resend respondeu ${r.status}` }, 502)
  }
  return ok({ enviado: true })
})
