export type Angulo = 'frente' | 'lateral' | 'costas'

export const ANGULOS: { id: Angulo; label: string; dica: string }[] = [
  { id: 'frente', label: 'Frente', dica: 'De frente para o personal, na altura do quadril.' },
  { id: 'lateral', label: 'Lateral', dica: 'Do lado do personal, formando um "L" (90°) com a câmera da frente.' },
  { id: 'costas', label: 'Costas', dica: 'Atrás do personal. Opcional: útil em remadas e elevação de braços.' },
]

export const nomeAngulo = (a: Angulo) => ANGULOS.find((x) => x.id === a)!.label

/** Um vídeo de um ângulo, já com o horário de início no relógio do controle. */
export type VideoAngulo = {
  angulo: Angulo
  video: Blob
  /** Momento (ms, relógio do celular de controle) em que a gravação começou. */
  inicio: number
  /** Duração em ms. */
  duracao: number
}

export type Referencia = {
  id: string
  nome: string
  personal: string
  data: string
  videos: VideoAngulo[]
}

/** Mensagens trocadas entre os celulares do estúdio. */
export type Mensagem =
  | { t: 'ola'; angulo: Angulo; aparelho: string }
  | { t: 'ping'; id: number; enviado: number }
  | { t: 'pong'; id: number; enviado: number; controle: number }
  | { t: 'estado'; estado: EstadoCamera; erro?: string }
  | { t: 'gravar'; take: string; em: number }
  | { t: 'parar'; take: string }
  | { t: 'cancelar' }
  | { t: 'video-inicio'; take: string; tipo: string; tamanho: number; inicio: number; duracao: number }
  | { t: 'video-parte'; take: string; i: number; dados: ArrayBuffer }
  | { t: 'video-fim'; take: string }
  | { t: 'recebido'; take: string }

export type EstadoCamera = 'pronta' | 'sem-camera' | 'gravando' | 'enviando'
