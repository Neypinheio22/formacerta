import { supabase } from './cliente'
import { erroAmigavel } from './conta'

export type SituacaoChamada = 'credito' | 'chamando' | 'em_andamento' | 'feita' | 'cancelada' | 'vencida'

export type Chamada = {
  id: string
  aluno_id: string
  profissional_id: string
  aluno_nome: string
  profissional_nome: string
  profissional_foto: string | null
  minutos: number
  valor: number
  comissao: number
  taxa: number
  situacao: SituacaoChamada
  chamando_em: string | null
  inicio_em: string | null
  fim_em: string | null
  nota: number | null
  repassado_em: string | null
  criado_em: string
  /** Até quando o crédito pode ser usado (vazio antes do SQL da validade). */
  vence_em?: string | null
}

export type RegrasVideo = { comissao_pct: number; taxa_video: number; termo_video_versao: string }

/** Valores da primeira versão do termo. O banco manda os atuais. */
export const REGRAS_PADRAO: RegrasVideo = { comissao_pct: 10, taxa_video: 2.69, termo_video_versao: '2026-11-02' }

/** Tempo que o personal tem para atender antes de o crédito voltar para o aluno. */
export const SEGUNDOS_PARA_ATENDER = 120

/** O que o personal recebe de uma chamada: preço menos a comissão e a taxa da chamada. */
export function dividirChamada(valor: number, comissaoPct: number, taxa: number) {
  const comissao = Math.round(valor * comissaoPct) / 100
  const liquido = Math.max(0, Math.round((valor - comissao - taxa) * 100) / 100)
  return { comissao, taxa, liquido }
}

/** Quanto falta (em segundos) para acabar o tempo da chamada. */
export function segundosRestantes(c: Pick<Chamada, 'inicio_em' | 'minutos'>, agora = Date.now()) {
  if (!c.inicio_em) return c.minutos * 60
  return Math.max(0, Math.round((new Date(c.inicio_em).getTime() + c.minutos * 60_000 - agora) / 1000))
}

/** Quanto falta para o personal atender. */
export function segundosParaAtender(c: Pick<Chamada, 'chamando_em'>, agora = Date.now()) {
  if (!c.chamando_em) return 0
  return Math.max(0, Math.round((new Date(c.chamando_em).getTime() + SEGUNDOS_PARA_ATENDER * 1000 - agora) / 1000))
}

export const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Resumo das chamadas feitas de um personal: bruto, comissão, taxas e o que ele recebe. */
export function resumoGanhos(chamadas: Chamada[]) {
  const feitas = chamadas.filter((c) => c.situacao === 'feita')
  const soma = (f: (c: Chamada) => number) => Math.round(feitas.reduce((t, c) => t + f(c), 0) * 100) / 100
  const bruto = soma((c) => c.valor)
  const comissao = soma((c) => c.comissao)
  const taxas = soma((c) => c.taxa)
  const aReceber = soma((c) => (c.repassado_em ? 0 : c.valor - c.comissao - c.taxa))
  return { feitas: feitas.length, bruto, comissao, taxas, liquido: Math.round((bruto - comissao - taxas) * 100) / 100, aReceber }
}

const numeros = (c: Chamada): Chamada => ({ ...c, valor: Number(c.valor), comissao: Number(c.comissao), taxa: Number(c.taxa), minutos: Number(c.minutos) })

export async function lerRegrasVideo(): Promise<RegrasVideo> {
  const { data } = await supabase.from('config_cobranca').select('comissao_pct, taxa_video, termo_video_versao').maybeSingle()
  if (!data) return REGRAS_PADRAO
  return { comissao_pct: Number(data.comissao_pct), taxa_video: Number(data.taxa_video), termo_video_versao: String(data.termo_video_versao) }
}

export async function aceitouTermoVideo(profissional: string): Promise<boolean> {
  const { data } = await supabase.rpc('aceitou_termo_video', { profissional })
  return data === true
}

export async function aceitarTermoVideo() {
  const { error } = await supabase.rpc('aceitar_termo_video')
  return error ? erroAmigavel(error) : null
}

/** Quantos alunos o personal atende ao mesmo tempo na sala de vídeo. */
export const VAGAS_MAXIMO = 5

export type Disponibilidade = { ate: Date; vagas: number }

/** Até quando o personal fica disponível para vídeo e quantos alunos atende juntos (vazio = não está). */
export async function disponibilidade(profissional: string): Promise<Disponibilidade | null> {
  const { data } = await supabase.from('disponibilidade_video').select('*').eq('profissional_id', profissional).maybeSingle()
  const ate = data?.ate ? new Date(data.ate as string) : null
  if (!ate || ate.getTime() <= Date.now()) return null
  return { ate, vagas: Math.min(VAGAS_MAXIMO, Math.max(1, Number(data?.vagas ?? 1))) }
}

/** minutos = 0 desliga. vagas = alunos ao mesmo tempo (1 a 5). */
export async function ficarDisponivel(minutos: number, vagas = 1): Promise<{ ate: Date | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('ficar_disponivel_video', { minutos, vagas })
  if (error) return { ate: null, erro: erroAmigavel(error) }
  return { ate: data ? new Date(data as string) : null, erro: null }
}

export async function minhasChamadas(): Promise<Chamada[]> {
  const { data } = await supabase.rpc('minhas_chamadas_video')
  return ((data ?? []) as Chamada[]).map(numeros)
}

export async function chamarVideo(profissional: string): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('chamar_video', { profissional })
  return error ? { id: null, erro: erroAmigavel(error) } : { id: data as string, erro: null }
}

export async function atenderVideo(chamada: string, aceitar: boolean) {
  const { error } = await supabase.rpc('atender_video', { chamada, aceitar })
  return error ? erroAmigavel(error) : null
}

export async function desistirVideo(chamada: string) {
  const { error } = await supabase.rpc('desistir_video', { chamada })
  return error ? erroAmigavel(error) : null
}

export async function encerrarVideo(chamada: string) {
  const { error } = await supabase.rpc('encerrar_video', { chamada })
  return error ? erroAmigavel(error) : null
}

export async function avaliarVideo(chamada: string, nota: number) {
  const { error } = await supabase.rpc('avaliar_video', { chamada, nota })
  return error ? erroAmigavel(error) : null
}

export async function repassarVideo(profissional: string) {
  const { error } = await supabase.rpc('admin_repassar_video', { profissional })
  return error ? erroAmigavel(error) : null
}

export async function salvarTaxaVideo(taxa_video: number) {
  const { error } = await supabase.from('config_cobranca').update({ taxa_video, atualizado_em: new Date().toISOString() }).eq('id', true)
  return error ? erroAmigavel(error) : null
}

/** Avisa a tela de chamada que algo mudou (o aluno chamou), para ela olhar o banco na hora. */
export const avisarChamada = () => window.dispatchEvent(new Event('formacerta:chamada'))

// ---------- Créditos com validade (item 13) ----------

/** Dias que faltam para o crédito vencer (null = sem validade). */
export function diasParaVencer(c: Pick<Chamada, 'vence_em'>, agora = Date.now()) {
  if (!c.vence_em) return null
  return Math.max(0, Math.ceil((new Date(c.vence_em).getTime() - agora) / 86_400_000))
}

export type CreditosDoPersonal = {
  profissional_id: string
  profissional_nome: string
  profissional_foto: string | null
  quantidade: number
  minutos: number[]
  /** Data do crédito que vence primeiro. */
  vence_em: string | null
}

/** Créditos do aluno ainda para usar, juntos por personal (o que vence primeiro na frente). */
export function creditosPorPersonal(chamadas: Chamada[], alunoId: string): CreditosDoPersonal[] {
  const grupos = new Map<string, CreditosDoPersonal>()
  for (const c of chamadas) {
    if (c.aluno_id !== alunoId || c.situacao !== 'credito') continue
    const g = grupos.get(c.profissional_id) ?? {
      profissional_id: c.profissional_id,
      profissional_nome: c.profissional_nome,
      profissional_foto: c.profissional_foto,
      quantidade: 0,
      minutos: [],
      vence_em: null,
    }
    g.quantidade++
    g.minutos.push(c.minutos)
    if (c.vence_em && (!g.vence_em || c.vence_em < g.vence_em)) g.vence_em = c.vence_em
    grupos.set(c.profissional_id, g)
  }
  return [...grupos.values()].sort((a, b) => (a.vence_em ?? '9').localeCompare(b.vence_em ?? '9'))
}

// ---------- Agenda (item 14) ----------

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export type HorarioSemana = { dia_semana: number; inicio: string; fim: string }

export type Agendamento = {
  id: string
  aluno_id: string
  profissional_id: string
  aluno_nome: string
  profissional_nome: string
  inicio: string
  minutos: number
  chamada_situacao: SituacaoChamada
}

const hm = (t: string) => t.slice(0, 5)

export async function meusHorarios(meuId: string): Promise<HorarioSemana[] | null> {
  const { data, error } = await supabase.from('horarios_video').select('dia_semana, inicio, fim').eq('profissional_id', meuId).order('dia_semana').order('inicio')
  if (error) return null
  return (data ?? []).map((h) => ({ dia_semana: Number(h.dia_semana), inicio: hm(String(h.inicio)), fim: hm(String(h.fim)) }))
}

/** Confere os horários antes de salvar: fim depois do início e sem sobrepor no mesmo dia. */
export function conferirHorarios(lista: HorarioSemana[]): string | null {
  for (const h of lista) if (h.fim <= h.inicio) return `${DIAS_SEMANA[h.dia_semana]}: o fim precisa ser depois do início.`
  for (let d = 0; d < 7; d++) {
    const dia = lista.filter((h) => h.dia_semana === d).sort((a, b) => a.inicio.localeCompare(b.inicio))
    for (let i = 1; i < dia.length; i++) if (dia[i].inicio < dia[i - 1].fim) return `${DIAS_SEMANA[d]}: dois horários se sobrepõem.`
  }
  return null
}

export async function salvarHorarios(lista: HorarioSemana[]) {
  const { error } = await supabase.rpc('salvar_horarios_video', { horarios: lista })
  return error ? erroAmigavel(error) : null
}

export async function horariosLivres(profissional: string, minutos: number): Promise<Date[]> {
  const { data } = await supabase.rpc('horarios_livres_video', { profissional, minutos })
  return ((data ?? []) as { inicio: string }[]).map((l) => new Date(l.inicio))
}

export async function agendarVideo(profissional: string, inicio: Date) {
  const { error } = await supabase.rpc('agendar_video', { profissional, inicio: inicio.toISOString() })
  return error ? erroAmigavel(error) : null
}

export async function cancelarAgendamento(agendamento: string) {
  const { error } = await supabase.rpc('cancelar_agendamento_video', { agendamento })
  return error ? erroAmigavel(error) : null
}

export async function meusAgendamentos(): Promise<Agendamento[]> {
  const { data } = await supabase.rpc('meus_agendamentos_video')
  return ((data ?? []) as Agendamento[]).map((a) => ({ ...a, minutos: Number(a.minutos) }))
}

/** Os horários livres juntos por dia (hora de Brasília). */
export function porDia(horarios: Date[]) {
  const dias = new Map<string, Date[]>()
  const chave = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' })
  for (const h of horarios) {
    const k = chave.format(h)
    dias.set(k, [...(dias.get(k) ?? []), h])
  }
  return [...dias.entries()].map(([dia, horas]) => ({ dia, horas }))
}

export const horaBr = (d: Date | string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
export const dataHoraBr = (d: Date | string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

/** Já dá para chamar o treino agendado (de 10 minutos antes até o fim)? */
export function horaDeChamar(a: Pick<Agendamento, 'inicio' | 'minutos'>, agora = Date.now()) {
  const ini = new Date(a.inicio).getTime()
  return agora >= ini - 10 * 60_000 && agora <= ini + a.minutos * 60_000
}

/** Aluno só desmarca até 2 horas antes. */
export const alunoPodeDesmarcar = (a: Pick<Agendamento, 'inicio'>, agora = Date.now()) => new Date(a.inicio).getTime() - agora > 2 * 3600_000
