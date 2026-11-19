import { supabase } from './cliente'
import { erroAmigavel } from './conta'

/** Conversa do número oficial do FormaCerta (Administração → WhatsApp). */
export type ConversaWhatsApp = {
  id: string
  telefone: string
  nome: string
  atendimento: 'robo' | 'humano'
  humano_ate: string | null
  motivo_humano: string
  ultima_mensagem_em: string
}

export type MensagemWhatsApp = { id: number; autor: 'entrada' | 'robo' | 'humano'; texto: string; criado_em: string }

/** Robô pausado agora nesta conversa? (o Ney está atendendo) */
export const comNey = (c: ConversaWhatsApp) => c.atendimento === 'humano' && (!c.humano_ate || new Date(c.humano_ate).getTime() > Date.now())

/** Últimas conversas. `null` = SQL do agente ainda não rodado. */
export async function listarConversas(): Promise<ConversaWhatsApp[] | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversas')
    .select('id, telefone, nome, atendimento, humano_ate, motivo_humano, ultima_mensagem_em')
    .order('ultima_mensagem_em', { ascending: false })
    .limit(100)
  if (error) return null
  return data as ConversaWhatsApp[]
}

export async function lerMensagens(conversaId: string): Promise<MensagemWhatsApp[]> {
  const { data } = await supabase
    .from('whatsapp_mensagens')
    .select('id, autor, texto, criado_em')
    .eq('conversa_id', conversaId)
    .order('id', { ascending: false })
    .limit(60)
  return ((data ?? []) as MensagemWhatsApp[]).reverse()
}

/** Pausa o robô nesta conversa (você atende) ou devolve para ele. Devolve o erro, se houver. */
export async function mudarAtendimento(conversaId: string, robo: boolean): Promise<string | null> {
  const { error } = await supabase
    .from('whatsapp_conversas')
    .update(robo ? { atendimento: 'robo', humano_ate: null, motivo_humano: '' } : { atendimento: 'humano', humano_ate: null, motivo_humano: 'Pausado pelo administrador' })
    .eq('id', conversaId)
  return error ? erroAmigavel(error) : null
}

/** Responde a conversa pelo número do FormaCerta. O robô fica quieto nela por 12 horas. */
export async function responderConversa(conversaId: string, texto: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('whatsapp-agente', { body: { conversa_id: conversaId, texto } })
  if (error) {
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    return corpo?.erro ?? 'Não deu para enviar agora. Tente de novo.'
  }
  return data?.erro ?? null
}

/** A pessoa escreveu há menos de 24 horas? (fora disso o WhatsApp não deixa responder com texto livre) */
export function janelaAberta(msgs: MensagemWhatsApp[]): boolean {
  const ultima = [...msgs].reverse().find((m) => m.autor === 'entrada')
  return !!ultima && Date.now() - new Date(ultima.criado_em).getTime() < 24 * 3600_000
}

// ---- Imagens do robô (passo a passo que ele manda na conversa) ----

export type ImagemRobo = {
  id: string
  chave: string
  titulo: string
  quando_usar: string
  legenda: string
  url: string
  ativo: boolean
  ordem: number
}

const PASTA_IMAGENS = 'whatsapp-imagens'
const LADO_MAXIMO_IMAGEM = 1600

/** Imagens do robô. `null` = SQL das imagens ainda não rodado. */
export async function listarImagens(): Promise<ImagemRobo[] | null> {
  const { data, error } = await supabase
    .from('whatsapp_imagens')
    .select('id, chave, titulo, quando_usar, legenda, url, ativo, ordem')
    .order('ordem')
    .order('criado_em')
  if (error) return null
  return data as ImagemRobo[]
}

/** Transforma um título em chave (ex.: "Como pagar o Pix" → "como-pagar-o-pix"). */
export function chaveDoTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
}

/** Reduz para no máximo 1600 px e converte em JPEG (o WhatsApp aceita JPEG/PNG até 5 MB). */
async function prepararImagem(arquivo: File): Promise<Blob> {
  const img = await createImageBitmap(arquivo)
  const escala = Math.min(1, LADO_MAXIMO_IMAGEM / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não deu para ler a imagem.'))), 'image/jpeg', 0.9))
}

/** Sobe a imagem para a pasta pública e devolve o link. */
export async function subirImagem(arquivo: File): Promise<{ url?: string; erro?: string }> {
  try {
    const blob = await prepararImagem(arquivo)
    const caminho = `${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(PASTA_IMAGENS).upload(caminho, blob, { contentType: 'image/jpeg' })
    if (error) return { erro: erroAmigavel(error) }
    return { url: supabase.storage.from(PASTA_IMAGENS).getPublicUrl(caminho).data.publicUrl }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Não deu para enviar a imagem.' }
  }
}

/** Caminho do arquivo na pasta, se o link for de uma imagem que subimos (as do site não são apagadas). */
function caminhoNaPasta(url: string): string | null {
  const marca = `/storage/v1/object/public/${PASTA_IMAGENS}/`
  const i = url.indexOf(marca)
  return i >= 0 ? decodeURIComponent(url.slice(i + marca.length)) : null
}

/** Apaga o arquivo antigo depois de trocar a imagem. */
export async function apagarArquivo(url: string) {
  const caminho = caminhoNaPasta(url)
  if (caminho) await supabase.storage.from(PASTA_IMAGENS).remove([caminho])
}

type DadosImagem = Pick<ImagemRobo, 'titulo' | 'quando_usar' | 'legenda' | 'url' | 'ativo'>

export async function criarImagem(d: DadosImagem & { chave: string; ordem: number }): Promise<string | null> {
  const { error } = await supabase.from('whatsapp_imagens').insert(d)
  if (error?.code === '23505') return 'Já existe uma imagem com esse nome. Escolha outro título.'
  return error ? erroAmigavel(error) : null
}

export async function salvarImagem(id: string, d: Partial<DadosImagem>): Promise<string | null> {
  const { error } = await supabase
    .from('whatsapp_imagens')
    .update({ ...d, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  return error ? erroAmigavel(error) : null
}

export async function apagarImagem(img: ImagemRobo): Promise<string | null> {
  const { error } = await supabase.from('whatsapp_imagens').delete().eq('id', img.id)
  if (error) return erroAmigavel(error)
  await apagarArquivo(img.url)
  return null
}
