import { supabase } from './cliente'
import { erroAmigavel } from './conta'

/** Uma conversa entre aluno e personal, com o nome do outro lado e quantas mensagens novas. */
export type Conversa = {
  id: string
  aluno_id: string
  profissional_id: string
  aluno_nome: string
  profissional_nome: string
  profissional_foto: string
  ultima_em: string
  ultima_previa: string
  nao_lidas: number
}

export type Mensagem = {
  id: string
  conversa_id: string
  autor_id: string
  texto: string
  /** Proposta do personal: serviço que o aluno paga pelo app. */
  servico_id: string | null
  /** Algum telefone, e-mail ou link foi escondido. */
  oculto: boolean
  criado_em: string
}

/** Quando o chat esconde telefone, e-mail e links. */
export type BloqueioChat = 'ate_contratar' | 'sempre' | 'nunca'

export const ROTULO_BLOQUEIO: Record<BloqueioChat, string> = {
  ate_contratar: 'Até o aluno contratar',
  sempre: 'Sempre',
  nunca: 'Nunca',
}

export const OCULTO = '[contato oculto]'
export const MENSAGEM_MAXIMO = 1000

// As mesmas regras da função ocultar_contato do banco (quem decide de verdade é o banco).
const REGRAS: RegExp[] = [
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu,
  /(https?:\/\/|www\.)\S+/giu,
  /\b(wa\.me|chat\.whatsapp\.com|instagram\.com|t\.me)\S*/giu,
  /\+?\(?\d([\s().-]*\d){7,}/gu,
  /(?<![\p{L}\p{N}])(whats\p{L}*|zap(zap)?|wpp|zapp|telegram|insta(gram)?)(?![\p{L}\p{N}])/giu,
]

/** Esconde telefone, e-mail, links e "me chama no zap". */
export function ocultarContato(texto: string): string {
  return REGRAS.reduce((t, r) => t.replace(r, OCULTO), texto)
}

export const temContato = (texto: string) => ocultarContato(texto) !== texto

/** Nome da outra pessoa da conversa. */
export const outroLado = (c: Conversa, meuId: string) =>
  c.aluno_id === meuId ? { nome: c.profissional_nome, foto: c.profissional_foto, sou: 'aluno' as const } : { nome: c.aluno_nome, foto: '', sou: 'profissional' as const }

/** "14:32" hoje, "ontem", ou a data. */
export function quando(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000)
  if (dias === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (dias === 1) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export async function listarConversas(todas = false): Promise<{ lista: Conversa[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('minhas_conversas', { todas })
  return { lista: (data ?? []) as Conversa[], erro: error ? erroAmigavel(error) : null }
}

/** Quantas mensagens novas em todas as conversas (0 se o banco ainda não tem o chat). */
export async function contarNaoLidas(): Promise<number> {
  const { lista } = await listarConversas()
  return lista.reduce((t, c) => t + c.nao_lidas, 0)
}

export async function abrirConversa(profissional: string): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('abrir_conversa', { profissional })
  return error ? { id: null, erro: erroAmigavel(error) } : { id: data as string, erro: null }
}

export async function lerMensagens(conversa: string): Promise<Mensagem[]> {
  const { data } = await supabase.from('mensagens').select('*').eq('conversa_id', conversa).order('criado_em').limit(500)
  return (data ?? []) as Mensagem[]
}

export async function enviarMensagem(conversa: string, texto: string, servico?: string) {
  const { error } = await supabase.rpc('enviar_mensagem', { conversa, texto, servico: servico ?? null })
  return error ? erroAmigavel(error) : null
}

export async function marcarLida(conversa: string) {
  await supabase.rpc('marcar_conversa_lida', { conversa })
}

export async function lerBloqueio(): Promise<BloqueioChat> {
  const { data } = await supabase.from('config_cobranca').select('chat_bloqueio').maybeSingle()
  return (data?.chat_bloqueio as BloqueioChat | undefined) ?? 'ate_contratar'
}

export async function salvarBloqueio(chat_bloqueio: BloqueioChat) {
  const { error } = await supabase.from('config_cobranca').update({ chat_bloqueio, atualizado_em: new Date().toISOString() }).eq('id', true)
  return error ? erroAmigavel(error) : null
}
