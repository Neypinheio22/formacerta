// Partes do WhatsApp Cloud API (Meta) usadas pelo agente: conferir a assinatura
// do aviso, ler as mensagens do aviso e mandar texto.

const GRAPH = 'https://graph.facebook.com/v23.0'

export type MensagemRecebida = {
  /** Id da mensagem no WhatsApp. */
  id: string
  /** Número de quem escreveu (ex.: 5511987654321). */
  de: string
  nome: string
  /** Texto da mensagem; vazio quando é áudio, foto etc. */
  texto: string
  tipo: string
  /** Identificador da mídia enviado pela Meta no webhook de áudio. */
  midiaId?: string
  /** Número do FormaCerta que recebeu (id da Meta). */
  numeroId: string
}

export type EcoDoCelular = {
  /** Id da mensagem que o Ney mandou pelo app WhatsApp Business do celular. */
  id: string
  /** Para quem o Ney mandou. */
  para: string
  texto: string
}

/** Confere se o aviso veio mesmo da Meta (cabeçalho X-Hub-Signature-256). */
export async function assinaturaValida(corpo: string, cabecalho: string | null, segredo: string): Promise<boolean> {
  if (!cabecalho?.startsWith('sha256=') || !segredo) return false
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
  const esperado = Array.from(assinatura, (b) => b.toString(16).padStart(2, '0')).join('')
  const recebido = cabecalho.slice(7).toLowerCase()
  if (recebido.length !== esperado.length) return false
  let dif = 0
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i)
  return dif === 0
}

type Valor = {
  metadata?: { phone_number_id?: string }
  contacts?: { wa_id?: string; profile?: { name?: string } }[]
  messages?: { id?: string; from?: string; type?: string; audio?: { id?: string; mime_type?: string }; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }[]
  message_echoes?: { id?: string; to?: string; type?: string; text?: { body?: string } }[]
}

/** Separa o que interessa do aviso da Meta: mensagens novas e respostas do Ney pelo celular. */
export function lerAviso(aviso: unknown): { recebidas: MensagemRecebida[]; ecos: EcoDoCelular[] } {
  const recebidas: MensagemRecebida[] = []
  const ecos: EcoDoCelular[] = []
  const entradas = (aviso as { entry?: { changes?: { field?: string; value?: Valor }[] }[] })?.entry ?? []
  for (const entrada of entradas) {
    for (const mudanca of entrada.changes ?? []) {
      const v = mudanca.value ?? {}
      const numeroId = v.metadata?.phone_number_id ?? ''
      if (mudanca.field === 'messages') {
        for (const m of v.messages ?? []) {
          if (!m.id || !m.from) continue
          const contato = v.contacts?.find((c) => c.wa_id === m.from) ?? v.contacts?.[0]
          const texto = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? ''
          recebidas.push({ id: m.id, de: m.from, nome: contato?.profile?.name ?? '', texto, tipo: m.type ?? '', midiaId: m.audio?.id, numeroId })
        }
      } else if (mudanca.field === 'smb_message_echoes') {
        for (const e of v.message_echoes ?? []) {
          if (!e.id || !e.to) continue
          ecos.push({ id: e.id, para: e.to, texto: e.text?.body ?? `[${e.type ?? 'mensagem'}]` })
        }
      }
    }
  }
  return { recebidas, ecos }
}

/** Manda uma mensagem de texto. Devolve o id da mensagem no WhatsApp. */
export async function mandarTexto(numeroId: string, token: string, para: string, texto: string): Promise<string | null> {
  const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'text', text: { preview_url: true, body: texto.slice(0, 4000) } }),
  })
  if (!r.ok) {
    console.error('WhatsApp não aceitou a mensagem', r.status, await r.text())
    return null
  }
  const corpo = await r.json().catch(() => null)
  return corpo?.messages?.[0]?.id ?? null
}

/** Manda uma imagem por link público (JPEG ou PNG, até 5 MB) com legenda. */
export async function mandarImagem(numeroId: string, token: string, para: string, link: string, legenda: string): Promise<string | null> {
  const image: { link: string; caption?: string } = { link }
  if (legenda.trim()) image.caption = legenda.slice(0, 1024)
  const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'image', image }),
  })
  if (!r.ok) {
    console.error('WhatsApp não aceitou a imagem', r.status, await r.text())
    return null
  }
  const corpo = await r.json().catch(() => null)
  return corpo?.messages?.[0]?.id ?? null
}

/** Manda um documento (PDF) por link público, com o nome do arquivo que a pessoa vê. */
export async function mandarDocumento(numeroId: string, token: string, para: string, link: string, nomeArquivo: string, legenda = ''): Promise<string | null> {
  const document: { link: string; filename?: string; caption?: string } = { link }
  if (nomeArquivo.trim()) document.filename = nomeArquivo.slice(0, 120)
  if (legenda.trim()) document.caption = legenda.slice(0, 1024)
  const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'document', document }),
  })
  if (!r.ok) {
    console.error('WhatsApp não aceitou o documento', r.status, await r.text())
    return null
  }
  const corpo = await r.json().catch(() => null)
  return corpo?.messages?.[0]?.id ?? null
}

/** Marca como lida e mostra "digitando…" enquanto o agente pensa. */
export async function marcarLidaDigitando(numeroId: string, token: string, mensagemId: string): Promise<void> {
  await fetch(`${GRAPH}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: mensagemId, typing_indicator: { type: 'text' } }),
  }).catch(() => undefined)
}

/**
 * Manda um modelo aprovado na Meta (único jeito de escrever para quem não
 * mandou mensagem nas últimas 24 horas). `parametros` preenche {{1}}, {{2}}… do corpo.
 */
export async function mandarModelo(numeroId: string, token: string, para: string, nome: string, idioma: string, parametros: string[]): Promise<string | null> {
  const componentes = parametros.length ? [{ type: 'body', parameters: parametros.map((text) => ({ type: 'text', text })) }] : []
  const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'template', template: { name: nome, language: { code: idioma }, components: componentes } }),
  })
  if (!r.ok) {
    console.error('WhatsApp não aceitou o modelo', r.status, await r.text())
    return null
  }
  const corpo = await r.json().catch(() => null)
  return corpo?.messages?.[0]?.id ?? null
}
