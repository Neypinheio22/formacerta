export type Point = { x: number; y: number; z?: number; visibility?: number }

export type ViewId = 'frente' | 'costas' | 'lateral-direita' | 'lateral-esquerda'

export type Status = 'ok' | 'atencao' | 'alerta'

export type Finding = {
  id: string
  title: string
  value: string
  status: Status
  detail: string
  exercises: string[]
}

export type ViewResult = {
  view: ViewId
  image: string
  width: number
  height: number
  landmarks: Point[]
  findings: Finding[]
}

export type Assessment = {
  id: string
  date: string
  score: number
  views: ViewResult[]
}

// Índices dos pontos do corpo no modelo MediaPipe Pose (33 pontos).
// "Esquerdo" e "direito" são do ponto de vista da pessoa, não da câmera.
export const LM = {
  nariz: 0,
  orelhaEsq: 7,
  orelhaDir: 8,
  ombroEsq: 11,
  ombroDir: 12,
  cotoveloEsq: 13,
  cotoveloDir: 14,
  punhoEsq: 15,
  punhoDir: 16,
  quadrilEsq: 23,
  quadrilDir: 24,
  joelhoEsq: 25,
  joelhoDir: 26,
  tornozeloEsq: 27,
  tornozeloDir: 28,
} as const

export const VIEWS: { id: ViewId; label: string; hint: string }[] = [
  { id: 'frente', label: 'Frente', hint: 'Fique de frente para o celular, braços soltos ao lado do corpo.' },
  { id: 'costas', label: 'Costas', hint: 'Fique de costas para o celular, braços soltos ao lado do corpo.' },
  { id: 'lateral-direita', label: 'Lateral direita', hint: 'Vire o lado direito do corpo para o celular e olhe para frente.' },
  { id: 'lateral-esquerda', label: 'Lateral esquerda', hint: 'Vire o lado esquerdo do corpo para o celular e olhe para frente.' },
]
