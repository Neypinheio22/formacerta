// Manda um e-mail ao administrador a cada cadastro novo (aluno ou personal),
// dizendo se a pessoa está aguardando liberação ou já entrou. Chamada pelo
// gatilho do banco; só avisa uma vez por perfil, então chamar de novo não manda nada.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ADMIN = 'ney.comercial@gmail.com'
const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'

const ok = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ erro: 'Método não permitido' }, 405)
  let id = ''
  try {
    id = String((await req.json()).id ?? '')
  } catch {
    return ok({ erro: 'Dados inválidos' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return ok({ erro: 'Dados inválidos' }, 400)

  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return ok({ enviado: false, motivo: 'RESEND_API_KEY não configurada' })

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // Marca como avisado antes de mandar: duas chamadas ao mesmo tempo não mandam dois e-mails.
  const { data: perfil } = await banco
    .from('perfis')
    .update({ avisado_em: new Date().toISOString() })
    .eq('id', id)
    .is('avisado_em', null)
    .neq('papel', 'admin')
    .select('nome, email, papel, registro, situacao, profissional_id')
    .maybeSingle()
  if (!perfil) return ok({ enviado: false })

  const tipo = perfil.papel === 'profissional' ? 'profissional' : 'aluno'
  const nome = escapar(perfil.nome || 'Sem nome')
  const aguardando = perfil.situacao === 'pendente'
  let personal = ''
  if (perfil.profissional_id) {
    const { data: p } = await banco.from('perfis').select('nome, email').eq('id', perfil.profissional_id).maybeSingle()
    if (p) personal = p.nome || p.email
  }
  const frase = aguardando
    ? 'e está aguardando a sua liberação.'
    : personal
      ? `pelo personal <strong>${escapar(personal)}</strong> e já entrou liberado.`
      : 'e já entrou liberado.'
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <p>Um novo <strong>${tipo}</strong> foi cadastrado no FormaCerta ${frase}</p>
      <p><strong>Nome:</strong> ${nome}<br>
      <strong>E-mail:</strong> ${escapar(perfil.email)}${perfil.registro ? `<br><strong>Registro:</strong> ${escapar(perfil.registro)}` : ''}</p>
      <p><a href="${APP}" style="background:#36f294;color:#020b16;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir o FormaCerta</a></p>
      <p style="color:#555">${aguardando ? 'Entre com a sua conta e vá em Administração → Aguardando para liberar.' : 'Você pode ver ou bloquear em Administração → Alunos.'}</p>
    </div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Remetente: domínio verificado no Resend (segredo EMAIL_REMETENTE). Sem ele, o remetente de teste do Resend.
      from: Deno.env.get('EMAIL_REMETENTE') || 'FormaCerta <onboarding@resend.dev>',
      to: [ADMIN],
      reply_to: perfil.email,
      subject: aguardando
        ? `Novo ${tipo} aguardando liberação: ${perfil.nome || perfil.email}`
        : `Novo ${tipo} cadastrado: ${perfil.nome || perfil.email}`,
      html,
    }),
  })
  if (!r.ok) {
    // Libera para tentar de novo numa próxima chamada.
    await banco.from('perfis').update({ avisado_em: null }).eq('id', id)
    return ok({ enviado: false, motivo: `Resend respondeu ${r.status}` }, 502)
  }
  return ok({ enviado: true })
})
