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
