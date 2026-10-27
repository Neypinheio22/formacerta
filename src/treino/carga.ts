// Diário de cargas e projeção: o aluno anota a carga e as repetições de cada
// série; o app estima a carga máxima (1RM), sugere a próxima carga e projeta
// as próximas semanas pelo ritmo dos treinos anotados. Fica no aparelho.

export const CHAVE_CARGA = 'formacerta:cargas'

export type Serie = { id: string; date: string; exercicio: string; kg: number; reps: number }

export type Faixa = { min: number; max: number }

export const OBJETIVOS: { id: string; nome: string; faixa: Faixa; texto: string }[] = [
  { id: 'forca', nome: 'Força', faixa: { min: 3, max: 6 }, texto: '3 a 6 repetições, carga alta' },
  { id: 'hipertrofia', nome: 'Hipertrofia', faixa: { min: 8, max: 12 }, texto: '8 a 12 repetições' },
  { id: 'resistencia', nome: 'Resistência', faixa: { min: 15, max: 20 }, texto: '15 a 20 repetições, carga leve' },
]

export const SUGESTOES_EXERCICIO = [
  'Agachamento livre',
  'Leg press',
  'Cadeira extensora',
  'Mesa flexora',
  'Supino reto',
  'Supino inclinado',
  'Puxada na frente',
  'Remada curvada',
  'Remada baixa',
  'Desenvolvimento com halter',
  'Elevação lateral',
  'Rosca direta',
  'Tríceps na polia',
  'Levantamento terra',
  'Panturrilha em pé',
]

// Acima de 12 repetições as fórmulas erram mais; o app avisa.
export const REPS_CONFIAVEL = 12

/**
 * Carga máxima para 1 repetição (1RM) estimada pela média das fórmulas de
 * Epley e Brzycki, as mais usadas em academia.
 */
export function estimar1RM(kg: number, reps: number): number {
  if (kg <= 0 || reps <= 0) return 0
  if (reps === 1) return kg
  const epley = kg * (1 + reps / 30)
  const brzycki = reps < 37 ? (kg * 36) / (37 - reps) : epley
  return (epley + brzycki) / 2
}

/** Quanto dá para levantar N vezes com essa carga máxima (inverso da fórmula acima). */
export function cargaPara(rm: number, reps: number): number {
  if (reps <= 1) return rm
  const epley = 1 + reps / 30
  const brzycki = 36 / (37 - reps)
  return rm / ((epley + brzycki) / 2)
}

/** Arredonda para o que existe na academia: anilhas e halteres de tanto em tanto. */
export const arredondar = (kg: number, passo: number) => Math.max(passo, Math.round(kg / passo) * passo)

export type Sugestao = { tipo: 'subir' | 'manter' | 'baixar'; kg: number; reps: string; texto: string }

/**
 * Dupla progressão: primeiro sobe as repetições até o topo da faixa; quando
 * passar do topo, sobe a carga (cerca de 2,5 a 5%) e volta para o começo da faixa.
 */
export function proximaCarga(ultima: Serie, faixa: Faixa, passo: number): Sugestao {
  const { kg, reps } = ultima
  if (reps >= faixa.max) {
    const arredondada = arredondar(Math.max(kg * 1.025, kg + passo), passo)
    const nova = arredondada > kg ? arredondada : kg + passo
    return { tipo: 'subir', kg: nova, reps: `${faixa.min} a ${faixa.max}`, texto: `Você chegou a ${reps} repetições: hora de subir a carga.` }
  }
  if (reps < faixa.min) {
    const nova = arredondar(kg * 0.93, passo)
    return {
      tipo: 'baixar',
      kg: nova < kg ? nova : Math.max(passo, kg - passo),
      reps: `${faixa.min} a ${faixa.max}`,
      texto: `${reps} repetições ficou abaixo da faixa: baixe um pouco para fazer o movimento certo.`,
    }
  }
  return { tipo: 'manter', kg, reps: `${reps + 1} ou mais`, texto: `Mantenha a carga e tente fazer ${reps + 1} repetições.` }
}

/** Melhor série de cada dia: a de maior carga máxima estimada. */
export function melhorPorDia(series: Serie[]): { date: string; rm: number; serie: Serie }[] {
  const dias = new Map<string, Serie>()
  for (const s of series) {
    const dia = s.date.slice(0, 10)
    const atual = dias.get(dia)
    if (!atual || estimar1RM(s.kg, s.reps) > estimar1RM(atual.kg, atual.reps)) dias.set(dia, s)
  }
  return [...dias.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, serie]) => ({ date, rm: estimar1RM(serie.kg, serie.reps), serie }))
}

const DIA = 86_400_000
// Ninguém sobe mais que isso por semana de forma sustentável; segura projeções exageradas.
const TETO_SEMANAL = 0.03

export type Projecao = { porSemana: number; semanas: { semana: number; rm: number }[] }

/**
 * Ritmo dos treinos anotados (reta que passa mais perto dos pontos) projetado
 * para as próximas semanas. Precisa de 3 dias de treino em pelo menos 7 dias.
 */
export function projetar(series: Serie[], semanas = 4): Projecao | null {
  const pontos = melhorPorDia(series)
  if (pontos.length < 3) return null
  const t0 = Date.parse(pontos[0].date)
  const xs = pontos.map((p) => (Date.parse(p.date) - t0) / (7 * DIA))
  const ys = pontos.map((p) => p.rm)
  if (xs[xs.length - 1] < 1) return null
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my)
    den += (x - mx) ** 2
  })
  const base = ys[ys.length - 1]
  const inclinacao = den ? num / den : 0
  const porSemana = Math.max(-base * TETO_SEMANAL, Math.min(base * TETO_SEMANAL, inclinacao))
  return { porSemana, semanas: Array.from({ length: semanas }, (_, i) => ({ semana: i + 1, rm: base + porSemana * (i + 1) })) }
}

export function exercicios(series: Serie[]): string[] {
  const vistos = new Map<string, string>()
  for (const s of [...series].sort((a, b) => b.date.localeCompare(a.date))) {
    const chave = s.exercicio.trim().toLowerCase()
    if (!vistos.has(chave)) vistos.set(chave, s.exercicio.trim())
  }
  return [...vistos.values()]
}

export const doExercicio = (series: Serie[], nome: string) =>
  series.filter((s) => s.exercicio.trim().toLowerCase() === nome.trim().toLowerCase()).sort((a, b) => a.date.localeCompare(b.date))

export function carregarSeries(): Serie[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CARGA) ?? '[]') as Serie[]
  } catch {
    return []
  }
}

export function gravarSeries(lista: Serie[]): boolean {
  try {
    localStorage.setItem(CHAVE_CARGA, JSON.stringify(lista.slice(-2000)))
    return true
  } catch {
    return false
  }
}
