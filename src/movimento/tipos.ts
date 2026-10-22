import type { Finding, Point, Status } from '../pose/types'

export type ExercicioId = 'agachamento-lateral' | 'agachamento-frente' | 'flexao-lateral'

/** Pontos do corpo num quadro: na imagem (0 a 1) e em 3D (metros, centro no quadril). */
export type Pose = { lm: Point[]; mundo: Point[] | null; w: number; h: number }

/** Medidas de um quadro. `angulo` é o ângulo principal, o que conta as repetições. */
export type Medidas = { angulo: number } & Record<string, number>

/** Um quadro do vídeo já analisado. `t` em segundos desde o início. */
export type Quadro = { t: number; lm: Point[] | null; medidas: Medidas | null }

/** Fase do movimento, para mostrar ao vivo. */
export type Fase = 'aguardando' | 'em-cima' | 'descendo' | 'subindo'

/** Início, ponto mais baixo e fim de uma repetição, em segundos. */
export type RepBruta = { inicio: number; fundo: number; fim: number; anguloMin: number }

/** `fala` é a correção curta dita em voz alta logo depois da repetição. */
export type Achado = Finding & { fala: string }

export type Repeticao = RepBruta & { n: number; achados: Achado[]; status: Status }

export type ResultadoExercicio = {
  id: string
  date: string
  exercicio: ExercicioId
  duracao: number
  largura: number
  altura: number
  quadros: Quadro[]
  reps: Repeticao[]
  /** Uma linha por medida, juntando todas as repetições. */
  resumo: (Finding & { repsComProblema: number })[]
  score: number
  video?: Blob
}
