// Agente de WhatsApp do FormaCerta.
// A Meta chama esta função a cada mensagem que chega no número oficial. O agente
// (Claude) responde dúvidas do app, planos e cadastro, e passa para o Ney quando
// precisa. O Ney responde pela Administração → WhatsApp (ou pelo celular, se o
// número estiver num parceiro com coexistência): o robô fica quieto naquela
// conversa por algumas horas.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN         token permanente da Meta (usuário do sistema)
//   WHATSAPP_APP_SECRET    chave secreta do aplicativo na Meta (confere que o aviso veio da Meta)
//   WHATSAPP_VERIFY_TOKEN  senha inventada pelo Ney, colada também no Webhook da Meta
//   ANTHROPIC_API_KEY      chave da IA (console.anthropic.com)
// Opcionais: WHATSAPP_NUMERO_ID (id do número na Meta), AGENTE_MODELO, AGENTE_HORAS_HUMANO (padrão 12), RESEND_API_KEY e EMAIL_REMETENTE (já existem).
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { MODELO_PADRAO, responder, type Ferramentas, type Turno } from './agente.ts'
import { assinaturaValida, lerAviso, mandarTexto, marcarLidaDigitando, type EcoDoCelular, type MensagemRecebida } from './whatsapp.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const ADMIN = 'ney.comercial@gmail.com'
const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'
const HORAS_HUMANO = Number(Deno.env.get('AGENTE_HORAS_HUMANO') ?? '12') || 12
const HORAS_PASSOU = 24
const LIMITE_RESPOSTAS_DIA = 30
const ESPERA_MS = 3000

const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const daquiHoras = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()

async function avisarNey(telefone: string, nome: string, motivo: string, resumo: string) {
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <p>O robô do WhatsApp passou uma conversa para você.</p>
      <p><strong>Quem:</strong> ${escapar(nome || 'Sem nome')} (+${escapar(telefone)})<br>
      <strong>Motivo:</strong> ${escapar(motivo)}</p>
      <p>${escapar(resumo)}</p>
      <p><a href="${APP}" style="background:#36f294;color:#020b16;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir o FormaCerta</a></p>
      <p style="color:#555">Responda em Administração → WhatsApp. O robô fica quieto nessa conversa por ${HORAS_PASSOU} horas, ou até você tocar em "Devolver ao robô".</p>
    </div>`
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_REMETENTE') || 'FormaCerta <onboarding@resend.dev>',
      to: [ADMIN],
      subject: `WhatsApp: ${nome || telefone} precisa de você (${motivo})`,
      html,
    }),
  }).catch((e) => console.error('Resend', e))
}

type Conversa = { id: string; telefone: string; nome: string; atendimento: 'robo' | 'humano'; humano_ate: string | null; ultimo_reenvio_em: string | null }

async function abrirConversa(telefone: string, nome: string, numeroId = ''): Promise<Conversa> {
  const dados: Record<string, unknown> = { telefone, ultima_mensagem_em: new Date().toISOString() }
  if (nome) dados.nome = nome.slice(0, 120)
  if (numeroId) dados.numero_id = numeroId
  const { data, error } = await banco
    .from('whatsapp_conversas')
    .upsert(dados, { onConflict: 'telefone' })
    .select('id, telefone, nome, atendimento, humano_ate, ultimo_reenvio_em')
    .single()
  if (error || !data) throw new Error(`Conversa: ${error?.message}`)
  return data as Conversa
}

/** Guarda a mensagem. Devolve null se ela já tinha chegado antes (a Meta repete avisos). */
async function guardar(conversaId: string, autor: Turno['autor'], texto: string, waId: string | null): Promise<number | null> {
  const { data, error } = await banco
    .from('whatsapp_mensagens')
    .insert({ conversa_id: conversaId, autor, texto: texto.slice(0, 8000), wa_id: waId })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return null
    throw new Error(`Mensagem: ${error.message}`)
  }
  return data.id as number
}

async function passarParaHumano(c: Conversa, motivo: string, resumo: string) {
  await banco
    .from('whatsapp_conversas')
    .update({ atendimento: 'humano', humano_ate: daquiHoras(HORAS_PASSOU), motivo_humano: motivo.slice(0, 500) })
    .eq('id', c.id)
  await avisarNey(c.telefone, c.nome, motivo, resumo)
}

function ferramentas(c: Conversa): Ferramentas {
  return {
    async verPlanos() {
      const [{ data: planos }, { data: config }] = await Promise.all([
        banco.from('planos').select('publico, nome, descricao, preco_mensal, preco_anual, limite_alunos, profissionais, recursos').eq('ativo', true).order('publico').order('ordem'),
        banco.from('config_cobranca').select('dias_gratis').maybeSingle(),
      ])
      return {
        planos: (planos ?? []).map((p) => ({ ...p, publico: p.publico === 'profissional' ? 'personal' : 'aluno', limite_alunos: p.limite_alunos ?? 'ilimitado' })),
        dias_gratis_no_primeiro_plano_pago: config?.dias_gratis ?? 0,
        observacao: 'Plano anual = preço anual pago de uma vez. Alunos de personal com plano Essencial, Pro ou Estúdio ganham o Aluno Pro.',
      }
    },
    async consultarCadastro(email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: 'E-mail inválido. Peça o e-mail completo.' }
      const { data, error } = await banco.rpc('whatsapp_situacao_cadastro', { p_email: email })
      if (error) throw new Error(error.message)
      return data
    },
    async reenviarConfirmacao(email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: 'E-mail inválido.' }
      if (c.ultimo_reenvio_em && Date.now() - new Date(c.ultimo_reenvio_em).getTime() < 10 * 60_000) {
        return { enviado: false, motivo: 'Já foi reenviado há menos de 10 minutos. Peça para aguardar e olhar no Spam.' }
      }
      const { data: s } = await banco.rpc('whatsapp_situacao_cadastro', { p_email: email })
      if (!s?.existe) return { enviado: false, motivo: 'Não existe cadastro com esse e-mail.' }
      if (s.email_confirmado) return { enviado: false, motivo: 'Esse e-mail já está confirmado.' }
      const { error } = await banco.auth.resend({ type: 'signup', email, options: { emailRedirectTo: APP } })
      if (error) return { enviado: false, motivo: error.message }
      c.ultimo_reenvio_em = new Date().toISOString()
      await banco.from('whatsapp_conversas').update({ ultimo_reenvio_em: c.ultimo_reenvio_em }).eq('id', c.id)
      return { enviado: true, remetente: 'avisos@formacerta.app.br' }
    },
    async passarParaHumano(motivo, resumo) {
      await passarParaHumano(c, motivo || 'atendimento', resumo)
      return { ok: true }
    },
  }
}

/** O Ney respondeu pelo celular (só com parceiro de coexistência): guarda e deixa o robô quieto nessa conversa. */
async function tratarEco(eco: EcoDoCelular) {
  const c = await abrirConversa(eco.para, '')
  const novo = await guardar(c.id, 'humano', eco.texto, eco.id)
  if (novo === null) return
  await banco.from('whatsapp_conversas').update({ atendimento: 'humano', humano_ate: daquiHoras(HORAS_HUMANO), motivo_humano: 'Ney respondeu pelo celular' }).eq('id', c.id)
}

const ROTULO_TIPO: Record<string, string> = { audio: 'áudio', image: 'foto', video: 'vídeo', document: 'documento', sticker: 'figurinha', location: 'localização', contacts: 'contato' }

async function tratarMensagem(m: MensagemRecebida) {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  if (!token) return console.error('WHATSAPP_TOKEN não configurado')
  const c = await abrirConversa(m.de, m.nome, m.numeroId)
  const texto = m.texto || `[Mandou ${ROTULO_TIPO[m.tipo] ?? 'uma mensagem'} que o robô não consegue ver]`
  const minhaId = await guardar(c.id, 'entrada', texto, m.id)
  if (minhaId === null) return

  if (c.atendimento === 'humano') {
    if (!c.humano_ate || new Date(c.humano_ate).getTime() > Date.now()) return
    await banco.from('whatsapp_conversas').update({ atendimento: 'robo', humano_ate: null, motivo_humano: '' }).eq('id', c.id)
    c.atendimento = 'robo'
  }

  await marcarLidaDigitando(m.numeroId, token, m.id)

  // Quem manda várias mensagens seguidas recebe uma resposta só, para a última.
  await new Promise((r) => setTimeout(r, ESPERA_MS))
  const { data: ultima } = await banco.from('whatsapp_mensagens').select('id').eq('conversa_id', c.id).eq('autor', 'entrada').order('id', { ascending: false }).limit(1).single()
  if (ultima?.id !== minhaId) return
  const { data: agora } = await banco.from('whatsapp_conversas').select('atendimento').eq('id', c.id).single()
  if (agora?.atendimento === 'humano') return

  // Trava de segurança contra custo alto: muitas respostas no dia passam para o Ney.
  const { count } = await banco.from('whatsapp_mensagens').select('id', { count: 'exact', head: true }).eq('conversa_id', c.id).eq('autor', 'robo').gte('criado_em', daquiHoras(-24))
  if ((count ?? 0) >= LIMITE_RESPOSTAS_DIA) {
    await passarParaHumano(c, 'conversa muito longa', `O robô já respondeu ${count} vezes nas últimas 24 horas e parou.`)
    return
  }

  const { data: linhas } = await banco
    .from('whatsapp_mensagens')
    .select('autor, texto')
    .eq('conversa_id', c.id)
    .gte('criado_em', daquiHoras(-72))
    .order('id', { ascending: false })
    .limit(30)
  const historico = ((linhas ?? []) as Turno[]).reverse()

  let resposta: string
  try {
    const cliente = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const r = await responder(cliente, Deno.env.get('AGENTE_MODELO') || MODELO_PADRAO, historico, c.nome, ferramentas(c))
    resposta = r.texto
    if (!resposta && !r.passouParaHumano) {
      await passarParaHumano(c, 'robô sem resposta', `Última mensagem: ${texto.slice(0, 300)}`)
      resposta = 'Vou chamar uma pessoa da equipe para te ajudar com isso. O Ney responde por aqui assim que puder. 😉'
    }
  } catch (e) {
    console.error('Agente falhou', e)
    await passarParaHumano(c, 'erro no robô', `O robô deu erro ao responder. Última mensagem: ${texto.slice(0, 300)}`)
    resposta = 'Tive um probleminha aqui agora. Já avisei a equipe e o Ney te responde por aqui assim que puder.'
  }
  if (!resposta) return
  const enviadoId = await mandarTexto(m.numeroId, token, m.de, resposta)
  if (enviadoId) await guardar(c.id, 'robo', resposta, enviadoId)
}

/** O administrador responde uma conversa pela tela Administração → WhatsApp. */
async function responderPeloApp(req: Request): Promise<Response> {
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: quem } = await banco.auth.getUser(jwt)
  if (!quem?.user) return json({ erro: 'Entre com a sua conta.' }, 401)
  const { data: perfil } = await banco.from('perfis').select('papel').eq('id', quem.user.id).maybeSingle()
  if (perfil?.papel !== 'admin') return json({ erro: 'Só o administrador pode responder.' }, 403)

  let pedido: { conversa_id?: string; texto?: string }
  try {
    pedido = await req.json()
  } catch {
    return json({ erro: 'Dados inválidos' }, 400)
  }
  const texto = String(pedido.texto ?? '').trim().slice(0, 4000)
  if (!texto || !/^[0-9a-f-]{36}$/i.test(String(pedido.conversa_id ?? ''))) return json({ erro: 'Escreva a mensagem.' }, 400)

  const token = Deno.env.get('WHATSAPP_TOKEN')
  if (!token) return json({ erro: 'O WhatsApp ainda não foi ligado (falta o WHATSAPP_TOKEN).' }, 400)
  const { data: c } = await banco.from('whatsapp_conversas').select('id, telefone, numero_id').eq('id', pedido.conversa_id).maybeSingle()
  const numeroId = c?.numero_id || Deno.env.get('WHATSAPP_NUMERO_ID') || ''
  if (!c || !numeroId) return json({ erro: 'Conversa não encontrada.' }, 404)

  const enviadoId = await mandarTexto(numeroId, token, c.telefone, texto)
  if (!enviadoId) {
    return json({ erro: 'O WhatsApp não aceitou. Se a pessoa escreveu há mais de 24 horas, só dá para responder quando ela escrever de novo.' }, 502)
  }
  await guardar(c.id, 'humano', texto, enviadoId)
  await banco.from('whatsapp_conversas').update({ atendimento: 'humano', humano_ate: daquiHoras(HORAS_HUMANO), motivo_humano: 'Você respondeu pelo app' }).eq('id', c.id)
  return json({ enviado: true })
}

async function processar(corpo: unknown) {
  const { recebidas, ecos } = lerAviso(corpo)
  for (const eco of ecos) await tratarEco(eco).catch((e) => console.error('Eco', e))
  await Promise.all(recebidas.map((m) => tratarMensagem(m).catch((e) => console.error('Mensagem', e))))
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // A Meta confere o endereço uma vez, quando o Ney cadastra o Webhook.
  if (req.method === 'GET') {
    const senha = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    if (senha && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === senha) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Proibido', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 })

  // Sem assinatura da Meta e com login: é o administrador respondendo pelo app.
  if (!req.headers.get('x-hub-signature-256') && req.headers.get('authorization')) return await responderPeloApp(req)

  const bruto = await req.text()
  if (!(await assinaturaValida(bruto, req.headers.get('x-hub-signature-256'), Deno.env.get('WHATSAPP_APP_SECRET') ?? ''))) {
    return new Response('Assinatura inválida', { status: 401 })
  }
  let corpo: unknown
  try {
    corpo = JSON.parse(bruto)
  } catch {
    return new Response('ok', { status: 200 })
  }
  // Responde já para a Meta (ela repete o aviso se demorar) e trabalha em segundo plano.
  EdgeRuntime.waitUntil(processar(corpo))
  return new Response('ok', { status: 200 })
})
