// Histórico de execução, evolução e feedback dos treinos. Tudo sai dos treinos
// que o aluno concluiu (tabela treinos_feitos): quantas vezes fez cada treino,
// quando foi a última, a situação na semana, as cargas e repetições de cada
// exercício e como ele sentiu o treino. As contas ficam aqui, longe das telas,
// para dar para testar.

import { estimar1RM } from './carga'
import { CATALOGO, GRUPOS_MUSCULARES } from './catalogo'
import { linhasDe } from './linhas'
import { nomeChave } from './comoFazer'
import { diaLocal, inicioDaSemana } from './semana'

/** Série feita pelo aluno: carga em kg e repetições. Vazio quando ele não anotou. */
export type SerieFeita = { kg: number | null; reps: number | null }

export type CargaExercicio = { nome: string; series: SerieFeita[] }

/** O que o app precisa de cada treino concluído. */
export type Execucao = {
  id: string
  treino_id: string | null
  letra: string
  feito_em: string
  inicio?: string | null
  fim?: string | null
  intensidade?: string | null
  comentario?: string | null
  cargas?: CargaExercicio[] | null
  dificuldade?: number | null
  esforco?: number | null
  dor?: boolean | null
  dor_local?: string | null
  dor_nivel?: number | null
  avaliado_em?: string | null
  obs_personal?: string | null
  obs_personal_em?: string | null
}

// ---------------------------------------------------------------------------
// Feedback

export const DIFICULDADES = [
  { n: 1, rotulo: 'Muito fácil' },
  { n: 2, rotulo: 'Fácil' },
  { n: 3, rotulo: 'Na medida' },
  { n: 4, rotulo: 'Difícil' },
  { n: 5, rotulo: 'Muito difícil' },
] as const

export const rotuloDificuldade = (n?: number | null) => DIFICULDADES.find((d) => d.n === n)?.rotulo ?? ''

/** Escala de esforço percebido (Borg CR-10), do jeito que o aluno entende. */
export const ESFORCOS = [
  { n: 0, rotulo: 'Repouso' },
  { n: 1, rotulo: 'Muito, muito leve' },
  { n: 2, rotulo: 'Muito leve' },
  { n: 3, rotulo: 'Leve' },
  { n: 4, rotulo: 'Moderado' },
  { n: 5, rotulo: 'Um pouco pesado' },
  { n: 6, rotulo: 'Pesado' },
  { n: 7, rotulo: 'Muito pesado' },
  { n: 8, rotulo: 'Muito, muito pesado' },
  { n: 9, rotulo: 'Quase no máximo' },
  { n: 10, rotulo: 'Máximo' },
] as const

export const rotuloEsforco = (n?: number | null) => (n === null || n === undefined ? '' : (ESFORCOS.find((e) => e.n === n)?.rotulo ?? ''))

/** Intensidade antiga (Muito leve…Muito intensa) a partir do esforço, para o Retorno dos treinos continuar igual. */
export function intensidadeDoEsforco(n: number): string {
  if (n <= 2) return 'Muito leve'
  if (n <= 4) return 'Leve'
  if (n <= 6) return 'Moderada'
  if (n <= 8) return 'Intensa'
  return 'Muito intensa'
}

/** Tom do esforço para pintar o número: verde até 6, amarelo 7 e 8, laranja 9 e 10. */
export const tomEsforco = (n: number): 'ok' | 'atencao' | 'alerta' => (n >= 9 ? 'alerta' : n >= 7 ? 'atencao' : 'ok')

export const LOCAIS_DOR = ['Ombro', 'Cotovelo', 'Punho', 'Cervical', 'Costas', 'Lombar', 'Quadril', 'Joelho', 'Tornozelo', 'Outro'] as const

export type Feedback = { dificuldade: number | null; esforco: number | null; dor: boolean | null; dor_local: string; dor_nivel: number | null; comentario: string }

export const feedbackVazio = (): Feedback => ({ dificuldade: null, esforco: null, dor: null, dor_local: '', dor_nivel: null, comentario: '' })

/** O aluno já disse como foi o treino (pela tela nova ou pela antiga, de intensidade). */
export const temFeedback = (e: Execucao) => !!e.avaliado_em || e.dificuldade != null || e.esforco != null || !!e.intensidade

// ---------------------------------------------------------------------------
// Histórico e situação de cada treino

export type Status = 'realizado' | 'pendente' | 'nao_iniciado'

export const ROTULO_STATUS: Record<Status, { rotulo: string; tom: 'ok' | 'atencao' | 'neutro' }> = {
  realizado: { rotulo: 'Realizado na semana', tom: 'ok' },
  pendente: { rotulo: 'Pendente na semana', tom: 'atencao' },
  nao_iniciado: { rotulo: 'Não iniciado', tom: 'neutro' },
}

export type Historico = { vezes: number; ultima: string | null; lista: Execucao[]; status: Status }

/**
 * Histórico de um treino: quantas vezes foi feito, a última vez e a situação.
 * Realizado: feito nesta semana (de segunda até hoje). Pendente: já foi feito
 * antes, mas ainda não nesta semana. Não iniciado: nunca foi feito.
 */
export function historicoDoTreino(treinoId: string, execucoes: Execucao[], hoje = new Date()): Historico {
  const lista = execucoes.filter((e) => e.treino_id === treinoId).sort((a, b) => b.feito_em.localeCompare(a.feito_em))
  const ultima = lista[0]?.feito_em ?? null
  const segunda = diaLocal(inicioDaSemana(hoje))
  const status: Status = !ultima ? 'nao_iniciado' : diaLocal(ultima) >= segunda ? 'realizado' : 'pendente'
  return { vezes: lista.length, ultima, lista, status }
}

/** "hoje", "ontem", "há 5 dias", "há 3 semanas". */
export function haQuanto(iso: string, hoje = new Date()): string {
  const dias = Math.round((new Date(`${diaLocal(hoje)}T12:00:00`).getTime() - new Date(`${diaLocal(iso)}T12:00:00`).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 14) return `há ${dias} dias`
  if (dias < 60) return `há ${Math.round(dias / 7)} semanas`
  return `há ${Math.round(dias / 30)} meses`
}

// ---------------------------------------------------------------------------
// Anotar as cargas no treino

/** Quantas séries o personal passou ("4x8" → 4). Sem número: 3. */
export function seriesPrevistas(ex: { series?: string; reps?: string; obs?: string; linhas?: { tipo: string; serie?: string }[] }): number {
  const l = linhasDe(ex as Parameters<typeof linhasDe>[0]).find((x) => x.serie)
  const partes = (l?.serie ?? '').split(/x|×/i)
  const n = partes.length > 1 ? parseInt(partes[0], 10) : NaN
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 3
}

/** Número digitado ("42,5", "40kg") ou null. */
export function lerNumero(v: string): number | null {
  const n = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n >= 0 && n < 1000 ? Math.round(n * 10) / 10 : null
}

/** Só os exercícios com alguma série anotada, sem séries vazias. */
export function limparCargas(cargas: CargaExercicio[]): CargaExercicio[] {
  return cargas
    .map((c) => ({
      nome: c.nome.trim().slice(0, 80),
      series: c.series.filter((s) => s.kg !== null || s.reps !== null).slice(0, 10),
    }))
    .filter((c) => c.nome && c.series.length)
    .slice(0, 30)
}

/** Última vez que o aluno anotou este exercício (para mostrar como referência). */
export function ultimaCarga(execucoes: Execucao[], nome: string): { feito_em: string; series: SerieFeita[] } | null {
  const k = nomeChave(nome)
  for (const e of [...execucoes].sort((a, b) => b.feito_em.localeCompare(a.feito_em))) {
    const c = (e.cargas ?? []).find((x) => nomeChave(x.nome) === k)
    if (c?.series.length) return { feito_em: e.feito_em, series: c.series }
  }
  return null
}

// ---------------------------------------------------------------------------
// Evolução

export type PontoExercicio = { feito_em: string; cargaMax: number; reps: number; volume: number; rm: number }

/** Uma execução do exercício: maior carga, repetições somadas, volume (kg × reps) e 1RM estimado da melhor série. */
function pontoDe(feito_em: string, series: SerieFeita[]): PontoExercicio {
  let cargaMax = 0
  let reps = 0
  let volume = 0
  let rm = 0
  for (const s of series) {
    const kg = s.kg ?? 0
    const r = s.reps ?? 0
    cargaMax = Math.max(cargaMax, kg)
    reps += r
    volume += kg * r
    if (kg && r) rm = Math.max(rm, estimar1RM(kg, r))
  }
  return { feito_em, cargaMax, reps, volume, rm }
}

/** Execuções do exercício em ordem de data, uma por treino concluído. */
export function pontosDoExercicio(execucoes: Execucao[], nome: string): PontoExercicio[] {
  const k = nomeChave(nome)
  const pontos: PontoExercicio[] = []
  for (const e of execucoes) {
    const c = (e.cargas ?? []).find((x) => nomeChave(x.nome) === k)
    if (c?.series.length) pontos.push(pontoDe(e.feito_em, c.series))
  }
  return pontos.sort((a, b) => a.feito_em.localeCompare(b.feito_em))
}

/** Exercícios com carga anotada, do mais feito para o menos feito. */
export function exerciciosAnotados(execucoes: Execucao[]): string[] {
  const conta = new Map<string, { nome: string; n: number }>()
  for (const e of execucoes)
    for (const c of e.cargas ?? []) {
      if (!c.series.length) continue
      const k = nomeChave(c.nome)
      const atual = conta.get(k)
      conta.set(k, { nome: atual?.nome ?? c.nome, n: (atual?.n ?? 0) + 1 })
    }
  return [...conta.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR')).map((x) => x.nome)
}

export type Progresso = { primeiro: PontoExercicio; ultimo: PontoExercicio; difCarga: number; difReps: number; difRm: number; pctRm: number | null }

/** Primeira contra última execução do exercício. */
export function progressoDoExercicio(pontos: PontoExercicio[]): Progresso | null {
  if (pontos.length < 2) return null
  const primeiro = pontos[0]
  const ultimo = pontos[pontos.length - 1]
  return {
    primeiro,
    ultimo,
    difCarga: ultimo.cargaMax - primeiro.cargaMax,
    difReps: ultimo.reps - primeiro.reps,
    difRm: ultimo.rm - primeiro.rm,
    pctRm: primeiro.rm ? ((ultimo.rm - primeiro.rm) / primeiro.rm) * 100 : null,
  }
}

export type ResumoPeriodo = {
  execucoes: number
  porSemana: number
  volume: number
  reps: number
  /** Média da maior carga de cada exercício no período. */
  cargaMedia: number | null
  esforco: number | null
  dificuldade: number | null
  minutos: number | null
  dores: number
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Tudo o que aconteceu entre duas datas (AAAA-MM-DD, inclusive). */
export function resumoDoPeriodo(execucoes: Execucao[], de: string, ate: string): ResumoPeriodo {
  const no = execucoes.filter((e) => {
    const d = diaLocal(e.feito_em)
    return d >= de && d <= ate
  })
  const dias = Math.max(1, Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000) + 1)
  let volume = 0
  let reps = 0
  const maiores = new Map<string, number>()
  for (const e of no)
    for (const c of e.cargas ?? []) {
      const p = pontoDe(e.feito_em, c.series)
      volume += p.volume
      reps += p.reps
      if (p.cargaMax) {
        const k = nomeChave(c.nome)
        maiores.set(k, Math.max(maiores.get(k) ?? 0, p.cargaMax))
      }
    }
  const tempos = no
    .map((e) => (e.inicio && e.fim ? (new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000 : null))
    .filter((m): m is number => m !== null && m >= 1 && m <= 240)
  return {
    execucoes: no.length,
    porSemana: (no.length / dias) * 7,
    volume,
    reps,
    cargaMedia: media([...maiores.values()]),
    esforco: media(no.map((e) => e.esforco).filter((n): n is number => n != null)),
    dificuldade: media(no.map((e) => e.dificuldade).filter((n): n is number => n != null)),
    minutos: media(tempos),
    dores: no.filter((e) => e.dor).length,
  }
}

export const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '3 meses' },
] as const

function menosDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00`)
  d.setDate(d.getDate() - n)
  return diaLocal(d)
}

export type Comparacao = { atual: ResumoPeriodo; anterior: ResumoPeriodo; atualDe: string; anteriorDe: string; anteriorAte: string; ate: string }

/** Últimos N dias contra os N dias antes deles. */
export function compararPeriodos(execucoes: Execucao[], dias: number, hoje = new Date()): Comparacao {
  const ate = diaLocal(hoje)
  const atualDe = menosDias(ate, dias - 1)
  const anteriorAte = menosDias(atualDe, 1)
  const anteriorDe = menosDias(anteriorAte, dias - 1)
  return { atual: resumoDoPeriodo(execucoes, atualDe, ate), anterior: resumoDoPeriodo(execucoes, anteriorDe, anteriorAte), atualDe, anteriorDe, anteriorAte, ate }
}

/** Variação em % (null quando não dá para comparar). */
export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || !anterior) return null
  return ((atual - anterior) / anterior) * 100
}

// ---------------------------------------------------------------------------
// Foco do treino

/** Grupos musculares que mais aparecem nos exercícios do treino (pelo catálogo do app). */
export function focoSugerido(exercicios: { nome: string }[], max = 3): string[] {
  const conta = new Map<string, number>()
  for (const ex of exercicios) {
    const k = nomeChave(ex.nome)
    if (!k) continue
    const item = CATALOGO.find((c) => nomeChave(c.nome) === k)
    if (item) conta.set(item.grupo, (conta.get(item.grupo) ?? 0) + 1)
  }
  return [...conta.entries()]
    .sort((a, b) => b[1] - a[1] || GRUPOS_MUSCULARES.indexOf(a[0] as never) - GRUPOS_MUSCULARES.indexOf(b[0] as never))
    .slice(0, max)
    .map(([g]) => g)
}

/** "Peito, Tríceps" ↔ ["Peito", "Tríceps"]. */
export const focoEmLista = (foco: string) =>
  foco
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const listaEmFoco = (l: string[]) => l.join(', ').slice(0, 80)

/** Opções de foco: grupos musculares e objetivos comuns de um treino. */
export const OPCOES_FOCO = [...GRUPOS_MUSCULARES, 'Força', 'Hipertrofia', 'Resistência', 'Cardio', 'Mobilidade', 'Core', 'Reabilitação'] as const

/** Nova ordem de uma lista: move o item da posição i para i + passo. */
export function mover<T>(lista: T[], i: number, passo: -1 | 1): T[] {
  const j = i + passo
  if (j < 0 || j >= lista.length) return lista
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}

export const LETRAS_TREINO = 'ABCDEFGHIJ'

/** Letras em sequência (A, B, C...) na ordem da lista. */
export const reletrar = <T extends { letra: string }>(lista: T[]): T[] => lista.map((t, i) => ({ ...t, letra: LETRAS_TREINO[i] }))
