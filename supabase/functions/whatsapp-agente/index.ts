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
// Nome que aparece em cima das respostas da equipe pelo app: NOME_ATENDIMENTO (padrão "Atendimento FormaCerta").
// Venda por Pix: MP_ACCESS_TOKEN (já existe, o mesmo da função mercado-pago).
// Lembrete de 3 dias: WHATSAPP_MODELO_LEMBRETE (nome do modelo aprovado na Meta) e WHATSAPP_MODELO_IDIOMA (padrão pt_BR).
//
// Também é chamada a cada 5 minutos pelo pg_cron com {"tarefa": "lembretes"}:
// manda as mensagens agendadas pelo administrador, os lembretes de 24 horas e 3 dias
// e avisa quando um Pix gerado aqui foi pago (e move a conversa para "Fechou" no funil).
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { escreverLembrete, MODELO_PADRAO, responder, type Ferramentas, type Turno } from './agente.ts'
import { deveEncaminharAudio, orientacaoContraRepeticao, respostaInicialLead } from './triagem.ts'
import { baixarAudioMeta } from './audio.ts'
import { assinaturaValida, lerAviso, mandarDocumento, mandarImagem, mandarModelo, mandarTexto, marcarLidaDigitando, type EcoDoCelular, type MensagemRecebida } from './whatsapp.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const ADMIN = 'ney.comercial@gmail.com'
const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'
const HORAS_HUMANO = Number(Deno.env.get('AGENTE_HORAS_HUMANO') ?? '12') || 12
const HORAS_PASSOU = 24
const LIMITE_RESPOSTAS_DIA = 30
const ESPERA_MS = 3000
const CODIGO_MINUTOS = 15
const CODIGO_TENTATIVAS = 5
const MP = 'https://api.mercadopago.com'

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

type Conversa = {
  id: string
  telefone: string
  nome: string
  numero_id: string
  atendimento: 'robo' | 'humano'
  humano_ate: string | null
  ultimo_reenvio_em: string | null
  usuario_id: string | null
  codigo_hash: string | null
  codigo_email: string | null
  codigo_expira_em: string | null
  codigo_enviado_em: string | null
  codigo_tentativas: number
}
const CAMPOS_CONVERSA = 'id, telefone, nome, numero_id, atendimento, humano_ate, ultimo_reenvio_em, usuario_id, codigo_hash, codigo_email, codigo_expira_em, codigo_enviado_em, codigo_tentativas'

const emailValido = (e: string) => /^\S+@\S+\.\S+$/.test(e)

async function resumir(texto: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Código de 6 números para provar que a conta é de quem está no WhatsApp. */
async function mandarCodigoPorEmail(email: string, codigo: string): Promise<boolean> {
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return false
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <p>Seu código para continuar no WhatsApp do FormaCerta:</p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:6px">${codigo}</p>
      <p>Digite esse código na conversa do WhatsApp. Ele vale por ${CODIGO_MINUTOS} minutos.</p>
      <p style="color:#555">Se não foi você que pediu, ignore este e-mail: sem o código ninguém mexe na sua conta.</p>
    </div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_REMETENTE') || 'FormaCerta <onboarding@resend.dev>',
      to: [email],
      subject: `${codigo} é o seu código do FormaCerta`,
      html,
    }),
  }).catch(() => null)
  return !!r?.ok
}

/** Cria o Pix no Mercado Pago para um pagamento pendente (igual à função mercado-pago). */
async function criarPix(pagamentoId: string, email: string): Promise<{ codigo: string; link: string | null } | null> {
  const tokenMp = Deno.env.get('MP_ACCESS_TOKEN')
  if (!tokenMp) return null
  const { data: pg } = await banco.from('pagamentos').select('id, valor, descricao, situacao, pix_copia_cola, link_pagamento').eq('id', pagamentoId).maybeSingle()
  if (!pg || pg.situacao !== 'pendente') return null
  if (pg.pix_copia_cola) return { codigo: pg.pix_copia_cola, link: pg.link_pagamento ?? null }
  const r = await fetch(`${MP}/v1/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenMp}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': `pix-${pg.id}` },
    body: JSON.stringify({
      transaction_amount: Number(pg.valor),
      description: `FormaCerta: ${pg.descricao}`,
      payment_method_id: 'pix',
      payer: { email },
      external_reference: pg.id,
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercado-pago-aviso`,
    }),
  })
  const mp = await r.json().catch(() => null)
  const pix = mp?.point_of_interaction?.transaction_data
  if (!r.ok || !pix?.qr_code) {
    console.error('Mercado Pago não gerou o Pix', r.status, JSON.stringify(mp)?.slice(0, 500))
    return null
  }
  await banco
    .from('pagamentos')
    .update({ forma: 'pix', gateway_id: String(mp.id), pix_copia_cola: pix.qr_code, pix_qr: pix.qr_code_base64 ?? null, link_pagamento: pix.ticket_url ?? null })
    .eq('id', pg.id)
  return { codigo: pix.qr_code, link: pix.ticket_url ?? null }
}

/** Linha de contexto para o robô quando a conversa já está ligada a uma conta. */
async function contextoDaConta(c: Conversa): Promise<string> {
  if (!c.usuario_id) return ''
  const { data } = await banco.rpc('whatsapp_resumo_conta', { p_usuario: c.usuario_id })
  return data ? `[Conta ligada (código confirmado): ${JSON.stringify(data)}]` : ''
}

type Imagem = { chave: string; titulo: string; quando_usar: string; legenda: string; url: string }
/** O que vai logo depois da resposta do robô: texto (código do Pix) ou imagem de passo a passo. */
type Extra = string | { imagem: string; legenda: string; titulo: string }
const MAX_IMAGENS_POR_RESPOSTA = 2

/** Imagens ligadas em Administração → WhatsApp → Imagens do robô. */
async function carregarImagens(): Promise<Imagem[]> {
  const { data, error } = await banco.from('whatsapp_imagens').select('chave, titulo, quando_usar, legenda, url').eq('ativo', true).order('ordem').limit(30)
  if (error) console.error('Imagens do robô', error.message)
  return (data ?? []) as Imagem[]
}

function listaDeImagens(imagens: Imagem[]): string {
  if (!imagens.length) return ''
  return `[Imagens que você pode mandar com mandar_imagem:\n${imagens.map((i) => `- ${i.chave}: ${i.titulo}. Quando usar: ${i.quando_usar || i.titulo}`).join('\n')}]`
}

async function abrirConversa(telefone: string, nome: string, numeroId = '', entrada = false): Promise<Conversa> {
  const dados: Record<string, unknown> = { telefone, ultima_mensagem_em: new Date().toISOString() }
  if (entrada) dados.ultima_entrada_em = dados.ultima_mensagem_em
  if (nome) dados.nome = nome.slice(0, 120)
  if (numeroId) dados.numero_id = numeroId
  const { data, error } = await banco
    .from('whatsapp_conversas')
    .upsert(dados, { onConflict: 'telefone' })
    .select(CAMPOS_CONVERSA)
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

/** Salva a gravação em bucket privado e registra o identificador para recuperação.
 * Falha na mídia não bloqueia o atendimento nem a transferência ao humano.
 */
async function salvarAudioDaMensagem(m: MensagemRecebida, idMensagem: number, conversaId: string, token: string) {
  if (m.tipo !== 'audio') return
  const { error: erroMeta } = await banco.from('whatsapp_mensagens')
    .update({ midia_tipo: 'audio', midia_id: m.midiaId || null }).eq('id', idMensagem)
  if (erroMeta) {
    console.error('Não foi possível registrar identificador do áudio', erroMeta.message)
    return
  }
  if (!m.midiaId) {
    console.error('Webhook de áudio sem identificador de mídia')
    return
  }
  try {
    const audio = await baixarAudioMeta(m.midiaId, token)
    const extensoes: Record<string, string> = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'audio/3gpp': '3gp', 'audio/opus': 'opus', 'audio/webm': 'webm', 'audio/x-m4a': 'm4a' }
    const caminho = `${conversaId}/${idMensagem}.${extensoes[audio.tipo] || 'bin'}`
    const { error: erroUpload } = await banco.storage.from('whatsapp-audios')
      .upload(caminho, audio.dados, { contentType: audio.tipo, upsert: false })
    if (erroUpload) throw erroUpload
    const { error: erroBanco } = await banco.from('whatsapp_mensagens')
      .update({ midia_caminho: caminho }).eq('id', idMensagem)
    if (erroBanco) throw erroBanco
  } catch (e) {
    console.error('Não foi possível salvar a gravação recebida', e)
  }
}

async function passarParaHumano(c: Conversa, motivo: string, resumo: string) {
  await banco
    .from('whatsapp_conversas')
    .update({ atendimento: 'humano', humano_ate: daquiHoras(HORAS_PASSOU), motivo_humano: motivo.slice(0, 500) })
    .eq('id', c.id)
  await avisarNey(c.telefone, c.nome, motivo, resumo)
}

/** `extras`: mensagens que vão logo depois da resposta do robô (ex.: o código do Pix, imagens). */
function ferramentas(c: Conversa, extras: Extra[] = [], imagens: Imagem[] = []): Ferramentas {
  return {
    async verPlanos() {
      const [{ data: planos }, { data: config }] = await Promise.all([
        banco.from('planos').select('id, publico, nome, descricao, preco_mensal, preco_anual, limite_alunos, profissionais, recursos').eq('ativo', true).order('publico').order('ordem'),
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
    async vincularConta(email) {
      if (!emailValido(email)) return { enviado: false, motivo: 'E-mail inválido. Peça o e-mail completo.' }
      if (c.codigo_enviado_em && Date.now() - new Date(c.codigo_enviado_em).getTime() < 60_000) {
        return { enviado: false, motivo: 'Um código foi enviado há menos de 1 minuto. Peça para olhar a caixa de entrada e o Spam.' }
      }
      const { data: conta } = await banco.rpc('whatsapp_conta_por_email', { p_email: email })
      if (!conta?.existe) return { enviado: false, motivo: 'Não existe conta com esse e-mail. Confira o e-mail ou ajude a pessoa a se cadastrar.' }
      if (!conta.email_confirmado) return { enviado: false, motivo: 'O e-mail dessa conta ainda não foi confirmado. Use reenviar_confirmacao.' }
      const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
      const agora = new Date()
      c.codigo_hash = await resumir(`${c.id}:${codigo}`)
      c.codigo_email = String(conta.email)
      c.codigo_expira_em = new Date(agora.getTime() + CODIGO_MINUTOS * 60_000).toISOString()
      c.codigo_enviado_em = agora.toISOString()
      c.codigo_tentativas = 0
      await banco
        .from('whatsapp_conversas')
        .update({ codigo_hash: c.codigo_hash, codigo_email: c.codigo_email, codigo_expira_em: c.codigo_expira_em, codigo_enviado_em: c.codigo_enviado_em, codigo_tentativas: 0 })
        .eq('id', c.id)
      if (!(await mandarCodigoPorEmail(c.codigo_email, codigo))) return { enviado: false, motivo: 'Não consegui mandar o e-mail agora. Passe para humano.' }
      return { enviado: true, remetente: 'avisos@formacerta.app.br', vale_minutos: CODIGO_MINUTOS }
    },
    async confirmarCodigo(codigo) {
      const limpo = codigo.replace(/\D/g, '')
      if (!c.codigo_hash || !c.codigo_email) return { ok: false, motivo: 'Nenhum código pedido. Peça o e-mail e use vincular_conta.' }
      if (!c.codigo_expira_em || new Date(c.codigo_expira_em).getTime() < Date.now()) return { ok: false, motivo: 'O código venceu. Use vincular_conta para mandar outro.' }
      if (c.codigo_tentativas >= CODIGO_TENTATIVAS) return { ok: false, motivo: 'Muitas tentativas erradas. Use vincular_conta para mandar um código novo.' }
      if (limpo.length !== 6 || (await resumir(`${c.id}:${limpo}`)) !== c.codigo_hash) {
        c.codigo_tentativas += 1
        await banco.from('whatsapp_conversas').update({ codigo_tentativas: c.codigo_tentativas }).eq('id', c.id)
        return { ok: false, motivo: 'Código errado.', tentativas_restantes: CODIGO_TENTATIVAS - c.codigo_tentativas }
      }
      const { data: conta } = await banco.rpc('whatsapp_conta_por_email', { p_email: c.codigo_email })
      if (!conta?.existe) return { ok: false, motivo: 'Conta não encontrada.' }
      c.usuario_id = String(conta.id)
      c.codigo_hash = null
      await banco
        .from('whatsapp_conversas')
        .update({ usuario_id: c.usuario_id, codigo_hash: null, codigo_expira_em: null, codigo_tentativas: 0 })
        .eq('id', c.id)
      const { data: resumo } = await banco.rpc('whatsapp_resumo_conta', { p_usuario: c.usuario_id })
      return { ok: true, conta: resumo }
    },
    async gerarPix(plano, ciclo) {
      if (!c.usuario_id) return { erro: 'Conversa ainda não ligada a uma conta. Peça o e-mail e use vincular_conta e depois confirmar_codigo.' }
      const { data: pedido, error } = await banco.rpc('whatsapp_pedir_plano', { p_usuario: c.usuario_id, p_plano: plano, p_ciclo: ciclo })
      if (error) return { erro: error.message }
      if (pedido?.acao !== 'pagar') return pedido
      const { data: perfil } = await banco.from('perfis').select('email').eq('id', c.usuario_id).maybeSingle()
      const pix = await criarPix(String(pedido.pagamento_id), String(perfil?.email ?? c.codigo_email ?? ''))
      if (!pix) return { erro: 'O Mercado Pago não gerou o Pix agora. Sugira tentar de novo em alguns minutos ou pagar pelo app (Conta → Meu plano e pagamentos).' }
      await banco.from('whatsapp_conversas').update({ pix_pagamento_id: pedido.pagamento_id, pix_avisado_em: null }).eq('id', c.id)
      extras.push(pix.codigo)
      if (pix.link) extras.push(`Se preferir, abra o QR Code do Pix aqui: ${pix.link}`)
      return { ...pedido, pix_gerado: true, codigo: 'vai numa mensagem separada, logo depois da sua resposta (não escreva o código)' }
    },
    async pararLembretes() {
      await banco.from('whatsapp_conversas').update({ sem_lembretes: true }).eq('id', c.id)
      return { ok: true }
    },
    async mandarImagem(chave: string) {
      const img = imagens.find((i) => i.chave === chave.toLowerCase())
      if (!img) return { erro: `Não existe imagem "${chave}". Use só as chaves da lista: ${imagens.map((i) => i.chave).join(', ') || 'nenhuma'}.` }
      const fila = extras.filter((e) => typeof e !== 'string')
      if (fila.some((e) => e.imagem === img.url)) return { ok: true, observacao: 'Essa imagem já vai nesta resposta.' }
      if (fila.length >= MAX_IMAGENS_POR_RESPOSTA) return { erro: `No máximo ${MAX_IMAGENS_POR_RESPOSTA} imagens por resposta.` }
      extras.push({ imagem: img.url, legenda: img.legenda, titulo: img.titulo })
      return { ok: true, vai: 'logo depois da sua resposta, com a legenda', legenda: img.legenda }
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
  const c = await abrirConversa(m.de, m.nome, m.numeroId, true)
  const texto = m.texto || `[Mandou ${ROTULO_TIPO[m.tipo] ?? 'uma mensagem'} que o robô não consegue ver]`
  const minhaId = await guardar(c.id, 'entrada', texto, m.id)
  if (minhaId === null) return
  // Recebe e guarda o áudio antes de encerrar o fluxo ou transferir o atendimento.
  await salvarAudioDaMensagem(m, minhaId, c.id, token)
  // Funil: quem estava em follow-up, aguardando ou perdido e escreveu de novo volta para "Em conversa".
  await banco
    .from('whatsapp_conversas')
    .update({ etapa: 'conversando', etapa_em: new Date().toISOString() })
    .eq('id', c.id)
    .in('etapa', ['follow_up', 'aguardando', 'perdido'])
    .then(({ error }) => error && console.error('Etapa', error.message))

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

  // Não fingir que ouvimos áudios. Preserva a mensagem no histórico e pede atendimento humano.
  if (deveEncaminharAudio(m.tipo, m.texto)) {
    await passarParaHumano(c, 'áudio sem transcrição', 'A pessoa enviou um áudio. O atendimento automático não consegue ouvi-lo; verificar a mensagem original no WhatsApp.')
    const aviso = 'Recebi seu áudio! 😊 Aqui ainda não consigo ouvi-lo. Vou encaminhar para a equipe do FormaCerta. Se preferir, também pode escrever sua dúvida por aqui.'
    const enviadoId = await mandarTexto(m.numeroId, token, m.de, aviso)
    if (enviadoId) await guardar(c.id, 'robo', aviso, enviadoId)
    return
  }

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

  // Quem chega pelo anúncio e pede informações genéricas recebe resposta curta e útil.
  // Dúvidas específicas continuam sendo tratadas pelo agente com as ferramentas existentes.
  const saudacao = respostaInicialLead(historico, c.nome)
  if (saudacao) {
    const enviadoId = await mandarTexto(m.numeroId, token, m.de, saudacao)
    if (enviadoId) await guardar(c.id, 'robo', saudacao, enviadoId)
    return
  }

  let resposta: string
  const extras: Extra[] = []
  try {
    const cliente = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const [imagens, conta] = await Promise.all([carregarImagens(), contextoDaConta(c)])
    const contexto = [conta, listaDeImagens(imagens), orientacaoContraRepeticao(historico)].filter(Boolean).join('\n')
    const r = await responder(cliente, Deno.env.get('AGENTE_MODELO') || MODELO_PADRAO, historico, c.nome, ferramentas(c, extras, imagens), contexto)
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
  for (const item of resposta ? [resposta, ...extras] : extras) {
    if (typeof item === 'string') {
      const enviadoId = await mandarTexto(m.numeroId, token, m.de, item)
      if (enviadoId) await guardar(c.id, 'robo', item, enviadoId)
    } else {
      const enviadoId = await mandarImagem(m.numeroId, token, m.de, item.imagem, item.legenda)
      if (enviadoId) await guardar(c.id, 'robo', `[Imagem: ${item.titulo}]${item.legenda ? ` ${item.legenda}` : ''}`, enviadoId)
    }
  }
}

// ---- Tarefas do pg_cron (a cada 5 minutos) ----

type ConversaLembrete = Conversa & { ultima_entrada_em: string; lembrete_24h_em: string | null; lembrete_3d_em: string | null; etapa?: string }
const horas = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600_000 : Infinity)
const comNey = (c: Conversa) => c.atendimento === 'humano' && (!c.humano_ate || new Date(c.humano_ate).getTime() > Date.now())

/** Avisa na conversa quando o Pix gerado ali foi pago (o plano já ativou pelo mercado-pago-aviso). */
async function avisarPixPagos(token: string) {
  const { data } = await banco
    .from('whatsapp_conversas')
    .select('id, telefone, numero_id, ultima_entrada_em, pix_pagamento_id, pagamento:pagamentos(situacao, descricao, criado_em)')
    .not('pix_pagamento_id', 'is', null)
    .is('pix_avisado_em', null)
    .limit(20)
  for (const c of (data ?? []) as unknown as { id: string; telefone: string; numero_id: string; ultima_entrada_em: string | null; pagamento: { situacao: string; descricao: string; criado_em: string } | null }[]) {
    const pg = c.pagamento
    const parar = !pg || pg.situacao === 'cancelado' || (pg.situacao === 'pendente' && horas(pg.criado_em) > 48)
    if (!parar && pg?.situacao !== 'pago') continue
    // Marca antes de mandar: duas chamadas ao mesmo tempo não mandam duas vezes.
    const { data: marcou } = await banco.from('whatsapp_conversas').update({ pix_avisado_em: new Date().toISOString() }).eq('id', c.id).is('pix_avisado_em', null).select('id')
    if (!marcou?.length || parar) continue
    await banco.from('whatsapp_conversas').update({ etapa: 'fechado', etapa_em: new Date().toISOString() }).eq('id', c.id)
    const numeroId = c.numero_id || Deno.env.get('WHATSAPP_NUMERO_ID') || ''
    if (!numeroId || horas(c.ultima_entrada_em) > 23.9) continue
    const texto = `✅ Pagamento confirmado! ${pg!.descricao} já está ativo na sua conta. É só entrar em https://formacerta.app.br e aproveitar. Qualquer dúvida, é só chamar aqui. 💚`
    const id = await mandarTexto(numeroId, token, c.telefone, texto)
    if (id) await guardar(c.id, 'robo', texto, id)
  }
}

/** Lembrete para quem parou de responder: perto de 24 horas (texto livre) e perto de 3 dias (modelo da Meta). */
async function mandarLembretes(token: string) {
  // Só em horário comercial de Brasília (8h às 21h).
  const hora = (new Date().getUTCHours() + 21) % 24
  if (hora < 8 || hora >= 21) return
  const cliente = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  const modelo = Deno.env.get('AGENTE_MODELO') || MODELO_PADRAO
  const modeloMeta = Deno.env.get('WHATSAPP_MODELO_LEMBRETE') ?? ''
  const idioma = Deno.env.get('WHATSAPP_MODELO_IDIOMA') || 'pt_BR'

  const tipos: { coluna: 'lembrete_24h_em' | 'lembrete_3d_em'; de: number; ate: number }[] = [{ coluna: 'lembrete_24h_em', de: 20, ate: 23.5 }]
  if (modeloMeta) tipos.push({ coluna: 'lembrete_3d_em', de: 68, ate: 96 })

  for (const tipo of tipos) {
    const { data } = await banco
      .from('whatsapp_conversas')
      .select(`${CAMPOS_CONVERSA}, ultima_entrada_em, lembrete_24h_em, lembrete_3d_em, etapa`)
      .eq('sem_lembretes', false)
      .gte('ultima_entrada_em', daquiHoras(-tipo.ate))
      .lte('ultima_entrada_em', daquiHoras(-tipo.de))
      .order('ultima_entrada_em')
      .limit(10)
    for (const c of (data ?? []) as unknown as ConversaLembrete[]) {
      try {
        if (comNey(c)) continue
        // Fechou, perdeu ou já tem mensagem agendada pelo administrador: o robô não manda lembrete.
        if (c.etapa === 'fechado' || c.etapa === 'perdido') continue
        const { count: agendadas } = await banco.from('whatsapp_agendadas').select('id', { count: 'exact', head: true }).eq('conversa_id', c.id).eq('situacao', 'agendada')
        if ((agendadas ?? 0) > 0) continue
        const ja = c[tipo.coluna]
        if (ja && ja >= c.ultima_entrada_em) continue
        // Só se a última mensagem foi do robô (a pessoa não respondeu depois).
        const { data: ultima } = await banco.from('whatsapp_mensagens').select('autor').eq('conversa_id', c.id).order('id', { ascending: false }).limit(1).maybeSingle()
        if (ultima?.autor !== 'robo') continue
        const { data: marcou } = await banco
          .from('whatsapp_conversas')
          .update({ [tipo.coluna]: new Date().toISOString() })
          .eq('id', c.id)
          .or(`${tipo.coluna}.is.null,${tipo.coluna}.lt.${c.ultima_entrada_em}`)
          .select('id')
        if (!marcou?.length) continue

        const { data: linhas } = await banco.from('whatsapp_mensagens').select('autor, texto').eq('conversa_id', c.id).order('id', { ascending: false }).limit(30)
        const historico = ((linhas ?? []) as Turno[]).reverse()
        const texto = await escreverLembrete(cliente, modelo, historico, c.nome, await contextoDaConta(c))
        if (!texto) continue
        const numeroId = c.numero_id || Deno.env.get('WHATSAPP_NUMERO_ID') || ''
        if (!numeroId) continue
        if (tipo.coluna === 'lembrete_24h_em') {
          const id = await mandarTexto(numeroId, token, c.telefone, texto)
          if (id) await guardar(c.id, 'robo', texto, id)
        } else {
          const primeiro = c.nome.trim().split(/\s+/)[0] || 'tudo bem'
          const id = await mandarModelo(numeroId, token, c.telefone, modeloMeta, idioma, [primeiro])
          if (id) await guardar(c.id, 'robo', `[Lembrete de 3 dias: modelo "${modeloMeta}" enviado]`, id)
        }
      } catch (e) {
        console.error('Lembrete', c.id, e)
      }
    }
  }
}

const nomeAtendimento = () => (Deno.env.get('NOME_ATENDIMENTO') || 'Atendimento FormaCerta').trim()

type Agendada = {
  id: string
  texto: string
  anexo_url: string | null
  anexo_tipo: 'imagem' | 'documento' | null
  anexo_nome: string
  conversa: { id: string; telefone: string; nome: string; numero_id: string; ultima_entrada_em: string | null } | null
}

/**
 * Mensagens agendadas pelo administrador que chegaram na hora (a qualquer hora do dia).
 * Dentro da janela de 24 horas vai o texto (e o anexo). Fora dela o WhatsApp não deixa:
 * vai o modelo aprovado de lembrete (se existir) ou fica marcada como "não enviada".
 */
async function enviarAgendadas(token: string) {
  const { data, error } = await banco
    .from('whatsapp_agendadas')
    .select('id, texto, anexo_url, anexo_tipo, anexo_nome, conversa:whatsapp_conversas(id, telefone, nome, numero_id, ultima_entrada_em)')
    .eq('situacao', 'agendada')
    .lte('enviar_em', new Date().toISOString())
    .order('enviar_em')
    .limit(20)
  if (error) return console.error('Agendadas', error.message)
  const modeloMeta = Deno.env.get('WHATSAPP_MODELO_LEMBRETE') ?? ''
  const idioma = Deno.env.get('WHATSAPP_MODELO_IDIOMA') || 'pt_BR'

  for (const a of (data ?? []) as unknown as Agendada[]) {
    // Marca antes de mandar: duas chamadas ao mesmo tempo não mandam duas vezes.
    const { data: marcou } = await banco.from('whatsapp_agendadas').update({ situacao: 'enviando' }).eq('id', a.id).eq('situacao', 'agendada').select('id')
    if (!marcou?.length) continue
    const fim = (situacao: string, observacao = '') =>
      banco.from('whatsapp_agendadas').update({ situacao, observacao: observacao.slice(0, 500), enviada_em: situacao === 'falhou' ? null : new Date().toISOString() }).eq('id', a.id)
    try {
      const c = a.conversa
      const numeroId = c?.numero_id || Deno.env.get('WHATSAPP_NUMERO_ID') || ''
      if (!c || !numeroId) {
        await fim('falhou', 'Conversa não encontrada.')
        continue
      }
      if (horas(c.ultima_entrada_em) > 23.9) {
        if (!modeloMeta) {
          await fim('falhou', 'Não enviada: a pessoa não escreve há mais de 24 horas e o WhatsApp só deixa mandar modelo aprovado pela Meta.')
          continue
        }
        const primeiro = c.nome.trim().split(/\s+/)[0] || 'tudo bem'
        const id = await mandarModelo(numeroId, token, c.telefone, modeloMeta, idioma, [primeiro])
        if (!id) {
          await fim('falhou', 'O WhatsApp não aceitou o modelo de lembrete.')
          continue
        }
        await guardar(c.id, 'humano', `[Agendada: janela fechada, foi o modelo "${modeloMeta}" no lugar do texto]`, id)
        await fim('modelo', 'A janela de 24 horas estava fechada: foi o modelo de lembrete. Quando a pessoa responder, mande o seu texto.')
        continue
      }
      let algum = false
      if (a.texto.trim()) {
        const texto = `*${nomeAtendimento()}:*\n${a.texto.trim()}`
        const id = await mandarTexto(numeroId, token, c.telefone, texto)
        if (id) {
          algum = true
          await guardar(c.id, 'humano', a.texto.trim(), id)
        }
      }
      if (a.anexo_url) {
        const id =
          a.anexo_tipo === 'documento'
            ? await mandarDocumento(numeroId, token, c.telefone, a.anexo_url, a.anexo_nome || 'arquivo.pdf')
            : await mandarImagem(numeroId, token, c.telefone, a.anexo_url, '')
        if (id) {
          algum = true
          await guardar(c.id, 'humano', `[${a.anexo_tipo === 'documento' ? 'Arquivo' : 'Imagem'}: ${a.anexo_nome || 'anexo'}]`, id)
        }
      }
      if (algum) {
        await fim('enviada')
        await banco.from('whatsapp_conversas').update({ ultima_mensagem_em: new Date().toISOString() }).eq('id', c.id)
      } else await fim('falhou', 'O WhatsApp não aceitou a mensagem.')
    } catch (e) {
      console.error('Agendada', a.id, e)
      await fim('falhou', 'Erro ao enviar. Tente agendar de novo.')
    }
  }
}

async function tarefas() {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  if (!token) return
  await enviarAgendadas(token).catch((e) => console.error('Agendadas', e))
  await avisarPixPagos(token).catch((e) => console.error('Pix pagos', e))
  await mandarLembretes(token).catch((e) => console.error('Lembretes', e))
}

/** O administrador responde uma conversa pela tela Administração → WhatsApp. */
async function responderPeloApp(req: Request): Promise<Response> {
  const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: quem } = await banco.auth.getUser(jwt)
  if (!quem?.user) return json({ erro: 'Entre com a sua conta.' }, 401)
  const { data: perfil } = await banco.from('perfis').select('papel').eq('id', quem.user.id).maybeSingle()
  if (perfil?.papel !== 'admin') return json({ erro: 'Só o administrador pode responder.' }, 403)

  let pedido: { conversa_id?: string; texto?: string; anexo_url?: string; anexo_tipo?: string; anexo_nome?: string }
  try {
    pedido = await req.json()
  } catch {
    return json({ erro: 'Dados inválidos' }, 400)
  }
  const texto = String(pedido.texto ?? '').trim().slice(0, 4000)
  // Anexo: só arquivos que o administrador subiu na pasta whatsapp-anexos.
  const pastaAnexos = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/whatsapp-anexos/`
  const anexoUrl = String(pedido.anexo_url ?? '')
  const anexo = anexoUrl.startsWith(pastaAnexos) && anexoUrl.length <= 500 ? { url: anexoUrl, tipo: pedido.anexo_tipo === 'documento' ? 'documento' : 'imagem', nome: String(pedido.anexo_nome ?? '').slice(0, 120) } : null
  if (anexoUrl && !anexo) return json({ erro: 'Anexo inválido. Envie o arquivo de novo.' }, 400)
  if ((!texto && !anexo) || !/^[0-9a-f-]{36}$/i.test(String(pedido.conversa_id ?? ''))) return json({ erro: 'Escreva a mensagem ou anexe um arquivo.' }, 400)

  const token = Deno.env.get('WHATSAPP_TOKEN')
  if (!token) return json({ erro: 'O WhatsApp ainda não foi ligado (falta o WHATSAPP_TOKEN).' }, 400)
  const { data: c } = await banco.from('whatsapp_conversas').select('id, telefone, numero_id').eq('id', pedido.conversa_id).maybeSingle()
  const numeroId = c?.numero_id || Deno.env.get('WHATSAPP_NUMERO_ID') || ''
  if (!c || !numeroId) return json({ erro: 'Conversa não encontrada.' }, 404)

  // A pessoa vê que agora é alguém da equipe, e não o robô.
  const naoAceitou = 'O WhatsApp não aceitou. Se a pessoa escreveu há mais de 24 horas, só dá para responder quando ela escrever de novo.'
  if (texto) {
    const enviadoId = await mandarTexto(numeroId, token, c.telefone, `*${nomeAtendimento()}:*\n${texto}`)
    if (!enviadoId) return json({ erro: naoAceitou }, 502)
    await guardar(c.id, 'humano', texto, enviadoId)
  }
  if (anexo) {
    // Sem texto, a foto vai com a legenda "Atendimento FormaCerta" (a pessoa vê que é da equipe).
    const legenda = texto ? '' : `*${nomeAtendimento()}*`
    const id =
      anexo.tipo === 'documento'
        ? await mandarDocumento(numeroId, token, c.telefone, anexo.url, anexo.nome || 'arquivo.pdf', legenda)
        : await mandarImagem(numeroId, token, c.telefone, anexo.url, legenda)
    if (!id) return json({ erro: texto ? 'A mensagem foi, mas o WhatsApp não aceitou o anexo. Tente de novo.' : naoAceitou }, 502)
    await guardar(c.id, 'humano', `[${anexo.tipo === 'documento' ? 'Arquivo' : 'Imagem'}: ${anexo.nome || 'anexo'}]`, id)
  }
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

  // Sem assinatura e sem login: o pg_cron pedindo as tarefas (só manda o que já está na hora, uma vez).
  if (!req.headers.get('x-hub-signature-256')) {
    const pedido = await req.json().catch(() => null)
    if (pedido?.tarefa !== 'lembretes') return new Response('Assinatura inválida', { status: 401 })
    EdgeRuntime.waitUntil(tarefas())
    return new Response('ok', { status: 202 })
  }

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
