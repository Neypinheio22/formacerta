import type { Fase, RepBruta } from './tipos'

const JANELA = 3
const VOLTA = 5

export type OpcoesContador = {
  /** O ângulo sobe durante a repetição (ex.: elevação lateral). `cima` é então o limite de saída e `baixo` o que precisa alcançar. */
  sobe?: boolean
  /** Compara com a posição inicial, em % (para medidas que mudam de pessoa para pessoa, como a altura dos ombros). */
  relativo?: boolean
}

/**
 * Conta repetições pelo ângulo principal, quadro a quadro.
 *
 * Uma repetição começa quando o ângulo cai abaixo de `cima` (saiu da posição
 * inicial) e termina quando volta acima de `cima`. Só vale se no caminho
 * passou abaixo de `baixo`; assim um balanço ou tremida não conta.
 * A média dos últimos quadros tira o tremido do detector.
 *
 * Com `sobe`, o mesmo vale de cabeça para baixo: a repetição começa quando o
 * ângulo passa de `cima` e só vale se chegou a `baixo`. `anguloMin` vira o pico.
 */
export class ContadorReps {
  fase: Fase = 'aguardando'
  private janela: number[] = []
  private ultimoCima = 0
  private inicio = 0
  private fundo = 0
  private min = Infinity
  private pico = 0
  private base = 0
  private readonly cima: number
  private readonly baixo: number
  private readonly sinal: number
  private readonly relativo: boolean

  constructor(cima: number, baixo: number, opcoes: OpcoesContador = {}) {
    this.sinal = opcoes.sobe ? -1 : 1
    this.relativo = !!opcoes.relativo
    this.cima = cima * this.sinal
    this.baixo = baixo * this.sinal
  }

  /** Recebe um quadro. Devolve a repetição quando ela termina neste quadro. */
  adicionar(t: number, angulo: number | null | undefined): RepBruta | null {
    if (angulo == null || Number.isNaN(angulo)) return null
    this.janela.push(angulo)
    if (this.janela.length > JANELA) this.janela.shift()
    const media = this.janela.reduce((s, v) => s + v, 0) / this.janela.length
    if (this.relativo && (this.fase === 'aguardando' || this.fase === 'em-cima')) this.base = Math.max(this.base, media)
    const a = (this.relativo ? (media / (this.base || 1)) * 100 : media) * this.sinal

    if (a >= this.cima) {
      const emRep = this.fase === 'descendo' || this.fase === 'subindo'
      const rep = emRep && this.min <= this.baixo ? { inicio: this.inicio, fundo: this.fundo, fim: t, anguloMin: this.pico } : null
      this.fase = 'em-cima'
      this.ultimoCima = t
      this.min = Infinity
      return rep
    }

    // Começou o vídeo já no meio do movimento: espera ficar em pé primeiro.
    if (this.fase === 'aguardando') return null

    if (this.fase === 'em-cima') {
      this.fase = 'descendo'
      this.inicio = this.ultimoCima
    }
    if (a < this.min) {
      this.min = a
      this.pico = media
      this.fundo = t
      this.fase = 'descendo'
    } else if (a > this.min + VOLTA) {
      this.fase = 'subindo'
    }
    return null
  }
}
