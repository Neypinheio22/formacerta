import type { Finding, Point } from '../pose/types'

/** De lado mede a passada; de trás mede joelhos, pelve e largura dos passos. */
export type VistaCorrida = 'lado' | 'tras'

export type LocalCorrida = 'esteira' | 'rua'

export type ConfigCorrida = {
  vista: VistaCorrida
  local: LocalCorrida
  /** 1 = vídeo normal; 4 ou 8 = câmera lenta (120 ou 240 quadros por segundo tocados a 30). */
  fator: number
  /** Altura da pessoa em cm, para passar de pixels para centímetros. */
  altura: number
}

/** Um quadro do vídeo. `t` em segundos do vídeo (não do tempo real, se for câmera lenta). */
export type QuadroCorrida = { t: number; lm: Point[] | null }

export type Lado = 'esquerdo' | 'direito'

export type AchadoCorrida = Finding & {
  lado?: Lado
  /** Músculos a alongar e a fortalecer para corrigir este ponto. */
  musculos?: { alongar: string[]; fortalecer: string[] }
  /** Instante do vídeo que mostra o problema, para o botão "ver no vídeo". */
  momento?: number
}

export type ResultadoCorrida = ConfigCorrida & {
  id: string
  date: string
  duracao: number
  largura: number
  alturaVideo: number
  quadros: QuadroCorrida[]
  /** Instantes do vídeo no meio de cada apoio (um por passo). */
  apoios: number[]
  passos: number
  achados: AchadoCorrida[]
  score: number
  /** Motivo quando não deu para avaliar (corpo fora do quadro, vídeo curto...). */
  falha?: string
  /** Ajuste feito pela análise que a pessoa deve saber (ex.: era câmera lenta). */
  aviso?: string
  video?: Blob
}
