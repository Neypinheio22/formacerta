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

export type MensagemWhatsApp = {
  id: number
  autor: 'entrada' | 'robo' | 'humano'
  texto: string
  criado_em: string
  midia_tipo?: string | null
  midia_id?: string | null
  midia_caminho?: string | null
}

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
    .select('id, autor, texto, criado_em, midia_tipo, midia_id, midia_caminho')
    .eq('conversa_id', conversaId)
    .order('id', { ascending: false })
    .limit(60)
  return ((data ?? []) as MensagemWhatsApp[]).reverse()
}

/** Link temporário para ouvir uma mensagem de voz. A Edge Function verifica que a conta é admin. */
export async function buscarAudioWhatsApp(mensagemId: number): Promise<{ url: string | null; erro: string | null }> {
  const { data, error } = await supabase.functions.invoke('whatsapp-audio', { body: { mensagem_id: mensagemId } })
  if (error) {
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    return { url: null, erro: corpo?.erro || 'Não foi possível abrir o áudio. Tente novamente.' }
  }
  if (!data?.url) return { url: null, erro: data?.erro || 'Áudio indisponível.' }
  return { url: data.url, erro: null }
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
export async function responderConversa(conversaId: string, texto: string, anexo?: { url: string; tipo: 'imagem' | 'documento'; nome: string } | null): Promise<string | null> {
  const body = { conversa_id: conversaId, texto, ...(anexo ? { anexo_url: anexo.url, anexo_tipo: anexo.tipo, anexo_nome: anexo.nome } : {}) }
  const { data, error } = await supabase.functions.invoke('whatsapp-agente', { body })
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

// ---- Etiquetas, funil e mensagens agendadas ----

/** Etiqueta automática, pela situação da conta de quem está na conversa. */
export type SituacaoConversa = 'lead' | 'cadastrado' | 'testando' | 'assinante' | 'aguardando_pagamento' | 'vencido' | 'cortesia' | 'equipe'

export const SITUACOES: Record<SituacaoConversa, { nome: string; cor: string; dica: string }> = {
  lead: { nome: 'Lead', cor: '#3b82f6', dica: 'Ainda sem conta no app (ou com outro número no cadastro).' },
  cadastrado: { nome: 'Cadastrado', cor: '#9fb3c2', dica: 'Tem conta, mas sem plano pago.' },
  testando: { nome: 'Testando', cor: '#facc15', dica: 'Nos dias grátis do plano.' },
  aguardando_pagamento: { nome: 'Falta pagar', cor: '#fb8d1a', dica: 'Escolheu o plano e ainda não pagou.' },
  assinante: { nome: 'Assinante', cor: '#36f294', dica: 'Plano pago valendo.' },
  vencido: { nome: 'Vencido', cor: '#ff5a5f', dica: 'O plano venceu e não renovou.' },
  cortesia: { nome: 'Cortesia', cor: '#a855f7', dica: 'Plano de cortesia.' },
  equipe: { nome: 'Equipe', cor: '#14b8a6', dica: 'Conta de administrador.' },
}

export type Etapa = 'novo' | 'conversando' | 'follow_up' | 'aguardando' | 'fechado' | 'perdido'

export const ETAPAS: { id: Etapa; nome: string; dica: string }[] = [
  { id: 'novo', nome: 'Novo contato', dica: 'Chegou agora.' },
  { id: 'conversando', nome: 'Em conversa', dica: 'Tirando dúvidas.' },
  { id: 'follow_up', nome: 'Fazer follow-up', dica: 'Você precisa chamar de novo.' },
  { id: 'aguardando', nome: 'Aguardando resposta', dica: 'A bola está com a pessoa.' },
  { id: 'fechado', nome: 'Fechou', dica: 'Assinou (vai sozinho quando o Pix é pago).' },
  { id: 'perdido', nome: 'Perdido', dica: 'Não quis agora.' },
]

export type ConversaPainel = ConversaWhatsApp & {
  ultima_entrada_em: string | null
  etiquetas: string[]
  etapa: Etapa
  etapa_em: string
  anotacao: string
  situacao: SituacaoConversa
  conta_nome: string | null
  conta_tipo: string | null
  conta_ligada: boolean
  plano: string | null
  valido_ate: string | null
  ultimo_autor: 'entrada' | 'robo' | 'humano' | null
  agendadas: number
}

/** Conversas com etiqueta automática e etapa. `null` = SQL das etiquetas ainda não rodado. */
export async function listarPainel(): Promise<ConversaPainel[] | null> {
  const { data, error } = await supabase.rpc('whatsapp_painel')
  if (error) return null
  return (data ?? []) as ConversaPainel[]
}

export type Etiqueta = { id: string; nome: string; cor: string; ordem: number }

export const CORES_ETIQUETA = ['#36f294', '#3b82f6', '#a855f7', '#14b8a6', '#facc15', '#fb8d1a', '#ff5a5f', '#ec4899', '#9fb3c2']

export async function listarEtiquetas(): Promise<Etiqueta[]> {
  const { data } = await supabase.from('whatsapp_etiquetas').select('id, nome, cor, ordem').order('ordem').order('criado_em')
  return (data ?? []) as Etiqueta[]
}

export async function criarEtiqueta(nome: string, cor: string, ordem: number): Promise<string | null> {
  const { error } = await supabase.from('whatsapp_etiquetas').insert({ nome: nome.trim(), cor, ordem })
  if (error?.code === '23505') return 'Já existe uma etiqueta com esse nome.'
  return error ? erroAmigavel(error) : null
}

export async function apagarEtiqueta(id: string): Promise<string | null> {
  const { error } = await supabase.from('whatsapp_etiquetas').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Muda etiquetas, etapa do funil ou anotação de uma conversa. */
export async function salvarConversa(id: string, d: Partial<Pick<ConversaPainel, 'etiquetas' | 'etapa' | 'anotacao'>>): Promise<string | null> {
  const dados: Record<string, unknown> = { ...d }
  if (d.etapa) dados.etapa_em = new Date().toISOString()
  const { error } = await supabase.from('whatsapp_conversas').update(dados).eq('id', id)
  return error ? erroAmigavel(error) : null
}

export type Agendada = {
  id: string
  conversa_id: string
  texto: string
  anexo_url: string | null
  anexo_tipo: 'imagem' | 'documento' | null
  anexo_nome: string
  enviar_em: string
  situacao: 'agendada' | 'enviando' | 'enviada' | 'modelo' | 'falhou' | 'cancelada'
  observacao: string
  enviada_em: string | null
  conversa?: { nome: string; telefone: string } | null
}

/** Agendadas (de uma conversa, ou todas as recentes). */
export async function listarAgendadas(conversaId?: string): Promise<Agendada[]> {
  let q = supabase
    .from('whatsapp_agendadas')
    .select('id, conversa_id, texto, anexo_url, anexo_tipo, anexo_nome, enviar_em, situacao, observacao, enviada_em, conversa:whatsapp_conversas(nome, telefone)')
    .order('enviar_em', { ascending: false })
    .limit(100)
  if (conversaId) q = q.eq('conversa_id', conversaId)
  const { data } = await q
  return (data ?? []) as unknown as Agendada[]
}

export async function agendarMensagem(d: Pick<Agendada, 'conversa_id' | 'texto' | 'anexo_url' | 'anexo_tipo' | 'anexo_nome' | 'enviar_em'>): Promise<string | null> {
  const { error } = await supabase.from('whatsapp_agendadas').insert(d)
  return error ? erroAmigavel(error) : null
}

export async function cancelarAgendada(id: string): Promise<string | null> {
  const { error } = await supabase.from('whatsapp_agendadas').update({ situacao: 'cancelada' }).eq('id', id).eq('situacao', 'agendada')
  return error ? erroAmigavel(error) : null
}

const PASTA_ANEXOS = 'whatsapp-anexos'

/** Sobe o anexo da mensagem agendada: foto (vira JPEG) ou PDF até 15 MB. */
export async function subirAnexo(arquivo: File): Promise<{ url?: string; tipo?: 'imagem' | 'documento'; nome?: string; erro?: string }> {
  try {
    const pdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf')
    if (pdf && arquivo.size > 15 * 1024 * 1024) return { erro: 'O PDF pode ter até 15 MB.' }
    const blob = pdf ? arquivo : await prepararImagem(arquivo)
    const caminho = `${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`
    const { error } = await supabase.storage.from(PASTA_ANEXOS).upload(caminho, blob, { contentType: pdf ? 'application/pdf' : 'image/jpeg' })
    if (error) return { erro: erroAmigavel(error) }
    return { url: supabase.storage.from(PASTA_ANEXOS).getPublicUrl(caminho).data.publicUrl, tipo: pdf ? 'documento' : 'imagem', nome: arquivo.name.slice(0, 120) }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Não deu para enviar o arquivo.' }
  }
}

/** Janela de 24 horas ainda aberta numa data futura? (conta a partir da última mensagem da pessoa) */
export function janelaAbertaEm(ultimaEntrada: string | null, quando: Date): boolean {
  return !!ultimaEntrada && quando.getTime() - new Date(ultimaEntrada).getTime() < 24 * 3600_000
}
