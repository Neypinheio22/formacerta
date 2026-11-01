// Manda um e-mail ao administrador quando alguém se cadastra e fica aguardando
// liberação. Chamada pelo gatilho do banco; só avisa uma vez por perfil e só
// perfis pendentes, então chamar de novo não manda nada.
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
    .eq('situacao', 'pendente')
    .is('avisado_em', null)
    .select('nome, email, papel, registro')
    .maybeSingle()
  if (!perfil) return ok({ enviado: false })

  const tipo = perfil.papel === 'profissional' ? 'profissional' : 'aluno'
  const nome = escapar(perfil.nome || 'Sem nome')
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <p>Um novo <strong>${tipo}</strong> se cadastrou no FormaCerta e está aguardando a sua liberação.</p>
      <p><strong>Nome:</strong> ${nome}<br>
      <strong>E-mail:</strong> ${escapar(perfil.email)}${perfil.registro ? `<br><strong>Registro:</strong> ${escapar(perfil.registro)}` : ''}</p>
      <p><a href="${APP}" style="background:#36f294;color:#020b16;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir o FormaCerta</a></p>
      <p style="color:#555">Entre com a sua conta e vá em Administração → Aguardando para liberar.</p>
    </div>`

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'FormaCerta <onboarding@resend.dev>',
      to: [ADMIN],
      reply_to: perfil.email,
      subject: `Novo ${tipo} aguardando liberação: ${perfil.nome || perfil.email}`,
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
