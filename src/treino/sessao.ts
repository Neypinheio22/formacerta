// Sessão de treino do aluno: modo visualização, INICIAR TREINO, cronômetro,
// exercícios marcados, cargas e repetições, descanso e exercícios combinados
// (bi-set). As contas ficam aqui, longe das telas, para dar para testar.

import { linhasDe, type LinhaSerie } from './linhas'

// ---------------------------------------------------------------------------
// Percepção subjetiva de esforço (PSE), escala de 8 níveis pedida pelo Romildo

export const PSES = [
  { n: 1, rotulo: 'Muito leve' },
  { n: 2, rotulo: 'Leve' },
  { n: 3, rotulo: 'Moderada' },
  { n: 4, rotulo: 'Pouco intensa' },
  { n: 5, rotulo: 'Intensa' },
  { n: 6, rotulo: 'Muito intensa' },
  { n: 7, rotulo: 'Muito, muito intensa' },
  { n: 8, rotulo: 'Exaustão máxima' },
] as const

export const rotuloPse = (n?: number | null) => PSES.find((p) => p.n === n)?.rotulo ?? ''

/** Tom para pintar a PSE: verde até 5, amarelo 6 e 7, laranja 8. */
export const tomPse = (n: number): 'ok' | 'atencao' | 'alerta' => (n >= 8 ? 'alerta' : n >= 6 ? 'atencao' : 'ok')

/** Intensidade antiga (5 opções) a partir da PSE, para o Retorno dos treinos antigo continuar valendo. */
export function intensidadeDaPse(n: number): string {
  if (n <= 1) return 'Muito leve'
  if (n <= 2) return 'Leve'
  if (n <= 4) return 'Moderada'
  if (n <= 6) return 'Intensa'
  return 'Muito intensa'
}

// ---------------------------------------------------------------------------
// Exercícios combinados

/** O que a sessão precisa de cada exercício da ficha. */
export type ExercicioSessao = { nome: string; series?: string; reps?: string; obs?: string; linhas?: LinhaSerie[]; junto?: boolean }

/**
 * Blocos do treino: um exercício sozinho ou um grupo de exercícios
 * combinados (bi-set, tri-set). O personal marca "combinar com o próximo"
 * (junto) e os seguidos viram um bloco só.
 */
export function blocosDe(exercicios: ExercicioSessao[]): number[][] {
  const blocos: number[][] = []
  exercicios.forEach((_, i) => {
    const anterior = exercicios[i - 1]
    if (i > 0 && anterior?.junto) blocos[blocos.length - 1].push(i)
    else blocos.push([i])
  })
  return blocos
}

/** "Bi-set", "Tri-set" ou "Exercícios combinados" (4 ou mais). */
export const nomeDoCombinado = (n: number) => (n === 2 ? 'Bi-set' : n === 3 ? 'Tri-set' : 'Exercícios combinados')

/** Letra de cada exercício dentro do combinado (A, B, C...). */
export const letraNoBloco = (i: number) => 'ABCDEFGH'[i] ?? String(i + 1)

// ---------------------------------------------------------------------------
// Prescrição

/** Primeira linha com série/repetição, carga ou intervalo. */
const linhaPrincipal = (ex: ExercicioSessao) => linhasDe(ex).find((l) => l.serie || l.carga || l.intervalo)

/** Carga que o personal passou para cada série ("52/59/64" → ["52", "59", "64"]; "40" → ["40", "40", ...]). */
export function cargasPrescritas(ex: ExercicioSessao, series: number): string[] {
  const carga = (linhaPrincipal(ex)?.carga ?? '').trim()
  if (!carga) return Array(series).fill('')
  const partes = carga
    .split(/[/;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
  // Carga com texto ("elástico forte", "peso do corpo") não vira número.
  if (partes.some((p) => !/^\d+([.,]\d+)?\s*(kg)?$/i.test(p))) return Array(series).fill('')
  const nums = partes.map((p) => p.replace(/\s*kg$/i, '').replace(',', '.'))
  return Array.from({ length: series }, (_, i) => nums[Math.min(i, nums.length - 1)])
}

/**
 * Segundos de descanso escritos pelo personal: "60 s", "60", "1 min",
 * "1'30", "1:30", "1min30", "90 seg". Null quando não dá para entender.
 */
export function segundosDe(texto?: string | null): number | null {
  const t = (texto ?? '').toLowerCase().replace(',', '.').trim()
  if (!t) return null
  let m = t.match(/^(\d+)\s*(?:'|:|min(?:utos?)?\.?)\s*(\d{1,2})\s*(?:"|s|seg(?:undos?)?)?$/)
  if (m) return limitar(Number(m[1]) * 60 + Number(m[2]))
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:'|min(?:utos?)?\.?)$/)
  if (m) return limitar(Math.round(Number(m[1]) * 60))
  m = t.match(/^(\d+)\s*(?:"|s|seg(?:undos?)?\.?)?$/)
  if (m) return limitar(Number(m[1]))
  return null
}

const limitar = (s: number) => (s >= 5 && s <= 900 ? s : null)

/** Descanso do exercício (pela linha principal). */
export const descansoDe = (ex: ExercicioSessao) => segundosDe(linhasDe(ex).find((l) => l.intervalo)?.intervalo)

// ---------------------------------------------------------------------------
// Cronômetro

/** "0m 04s", "12m 30s", "1h 05m". */
export function textoCronometro(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(seg).padStart(2, '0')}s`
}

/** "1:30", "0:45". */
export const textoDescanso = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, '0')}`

// ---------------------------------------------------------------------------
// Rascunho da sessão (salvamento automático no aparelho)

export type Anotacao = { kg: string; reps: string }

export type Sessao = {
  treinoId: string
  /** Hora em que o aluno apertou INICIAR TREINO. */
  inicio: string
  /** Índices dos exercícios já marcados como feitos. */
  feitos: number[]
  /** Séries anotadas por exercício (índice na ficha). */
  cargas: Record<number, Anotacao[]>
  /** Última mudança (para esquecer uma sessão largada). */
  em: string
}

/** Sessão aberta há mais de 5 h foi esquecida: começa do zero. */
export const VALIDADE_SESSAO_MS = 5 * 3600000

/** Lê o rascunho guardado, só se for deste treino e ainda valer. */
export function lerSessao(texto: string | null, treinoId: string, agora = Date.now()): Sessao | null {
  try {
    const s = JSON.parse(texto ?? 'null') as Sessao | null
    if (!s || s.treinoId !== treinoId || typeof s.inicio !== 'string') return null
    if (agora - new Date(s.inicio).getTime() > VALIDADE_SESSAO_MS) return null
    return { treinoId, inicio: s.inicio, feitos: Array.isArray(s.feitos) ? s.feitos.filter((n) => Number.isInteger(n)) : [], cargas: s.cargas && typeof s.cargas === 'object' ? s.cargas : {}, em: s.em ?? s.inicio }
  } catch {
    return null
  }
}

/** Marca ou desmarca os exercícios do bloco (o combinado se marca inteiro). */
export function alternarFeito(feitos: number[], bloco: number[]): number[] {
  const todos = bloco.every((i) => feitos.includes(i))
  return todos ? feitos.filter((i) => !bloco.includes(i)) : [...new Set([...feitos, ...bloco])].sort((a, b) => a - b)
}
