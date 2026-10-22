import { computeScore } from '../pose/analysis'
import type { Status } from '../pose/types'
import { ContadorReps } from './contador'
import type { Exercicio } from './exercicios'
import type { Quadro, Repeticao, ResultadoExercicio } from './tipos'

const PESO: Record<Status, number> = { ok: 0, atencao: 1, alerta: 2 }

export const piorStatus = (lista: Status[]): Status => lista.reduce<Status>((a, b) => (PESO[b] > PESO[a] ? b : a), 'ok')

/** Avalia uma repetição usando só os quadros entre o início e o fim dela. */
export function avaliarRep(ex: Exercicio, n: number, rep: Omit<Repeticao, 'n' | 'achados' | 'status'>, quadros: Quadro[]): Repeticao {
  const daRep = quadros.filter((q) => q.t >= rep.inicio && q.t <= rep.fim)
  const achados = ex.avaliar(rep, daRep)
  return { ...rep, n, achados, status: piorStatus(achados.map((a) => a.status)) }
}

/** Passa por todos os quadros do vídeo, separa as repetições e avalia cada uma. */
export function encontrarReps(ex: Exercicio, quadros: Quadro[]): Repeticao[] {
  const contador = new ContadorReps(ex.cima, ex.baixo)
  const reps: Repeticao[] = []
  for (const q of quadros) {
    const rep = contador.adicionar(q.t, q.medidas?.angulo)
    if (rep) reps.push(avaliarRep(ex, reps.length + 1, rep, quadros))
  }
  return reps
}

/**
 * Junta as repetições numa linha por medida. A medida fica "Corrigir" quando
 * o erro aparece forte na maioria das repetições, e "Atenção" quando aparece
 * em parte delas.
 */
export function resumir(reps: Repeticao[]): ResultadoExercicio['resumo'] {
  if (reps.length === 0) return []
  return reps[0].achados.map((primeiro) => {
    const desta = reps.map((r) => r.achados.find((a) => a.id === primeiro.id)!).filter(Boolean)
    const ruins = desta.filter((a) => a.status !== 'ok')
    const media = desta.reduce((s, a) => s + PESO[a.status], 0) / desta.length
    const status: Status = media >= 1 ? 'alerta' : media >= 0.3 ? 'atencao' : 'ok'
    const pior = [...ruins].sort((a, b) => PESO[b.status] - PESO[a.status])[0]
    const exemplo = status === 'ok' ? (desta.find((a) => a.status === 'ok') ?? primeiro) : pior
    return {
      id: primeiro.id,
      title: primeiro.title,
      value: ruins.length ? `${ruins.length} de ${desta.length} reps` : 'todas certas',
      status,
      detail: exemplo.detail,
      exercises: status === 'ok' ? [] : exemplo.exercises,
      repsComProblema: ruins.length,
    }
  })
}

export function montarResultado(ex: Exercicio, quadros: Quadro[], largura: number, altura: number, video?: Blob): ResultadoExercicio {
  const reps = encontrarReps(ex, quadros)
  const resumo = resumir(reps)
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    exercicio: ex.id,
    duracao: quadros.at(-1)?.t ?? 0,
    largura,
    altura,
    quadros,
    reps,
    resumo,
    score: reps.length ? computeScore(reps.flatMap((r) => r.achados)) : 0,
    video,
  }
}
