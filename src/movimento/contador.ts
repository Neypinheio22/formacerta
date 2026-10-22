import type { Fase, RepBruta } from './tipos'

const JANELA = 3
const VOLTA = 5

/**
 * Conta repetições pelo ângulo principal, quadro a quadro.
 *
 * Uma repetição começa quando o ângulo cai abaixo de `cima` (saiu da posição
 * inicial) e termina quando volta acima de `cima`. Só vale se no caminho
 * passou abaixo de `baixo`; assim um balanço ou tremida não conta.
 * A média dos últimos quadros tira o tremido do detector.
 */
export class ContadorReps {
  fase: Fase = 'aguardando'
  private janela: number[] = []
  private ultimoCima = 0
  private inicio = 0
  private fundo = 0
  private min = Infinity
  private readonly cima: number
  private readonly baixo: number

  constructor(cima: number, baixo: number) {
    this.cima = cima
    this.baixo = baixo
  }

  /** Recebe um quadro. Devolve a repetição quando ela termina neste quadro. */
  adicionar(t: number, angulo: number | null | undefined): RepBruta | null {
    if (angulo == null || Number.isNaN(angulo)) return null
    this.janela.push(angulo)
    if (this.janela.length > JANELA) this.janela.shift()
    const a = this.janela.reduce((s, v) => s + v, 0) / this.janela.length

    if (a >= this.cima) {
      const emRep = this.fase === 'descendo' || this.fase === 'subindo'
      const rep = emRep && this.min <= this.baixo ? { inicio: this.inicio, fundo: this.fundo, fim: t, anguloMin: this.min } : null
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
      this.fundo = t
      this.fase = 'descendo'
    } else if (a > this.min + VOLTA) {
      this.fase = 'subindo'
    }
    return null
  }
}
