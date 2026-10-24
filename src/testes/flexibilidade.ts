import { jointAngle } from '../pose/analysis'
import { LM, type Point, type Status } from '../pose/types'
import type { FotoTeste, Registro } from './historico'

// Teste de flexibilidade em pé (sentar e alcançar sem banco): de pé, joelhos
// esticados, inclina o tronco e vê até onde as mãos chegam. Na foto de lado o
// app compara a ponta dos dedos com o joelho, a canela, o tornozelo e o chão.

export type NivelFlex = 'Muito limitada' | 'Limitada' | 'Moderada' | 'Boa' | 'Excelente'

export const NIVEIS: { nivel: NivelFlex; onde: string; status: Status; dica: string }[] = [
  { nivel: 'Muito limitada', onde: 'Mãos bem acima dos joelhos', status: 'alerta', dica: 'Cadeia posterior bem encurtada (posteriores da coxa, panturrilha e lombar). Comece com alongamentos leves e diários.' },
  { nivel: 'Limitada', onde: 'Mãos na altura dos joelhos', status: 'atencao', dica: 'Encurtamento dos posteriores da coxa. Alongamentos e mobilidade de quadril ajudam a evoluir.' },
  { nivel: 'Moderada', onde: 'Mãos na altura da canela', status: 'atencao', dica: 'Flexibilidade razoável. Mantenha os alongamentos para chegar ao tornozelo.' },
  { nivel: 'Boa', onde: 'Mãos no tornozelo ou dedos no chão', status: 'ok', dica: 'Boa flexibilidade da cadeia posterior. Mantenha a rotina.' },
  { nivel: 'Excelente', onde: 'Palmas das mãos encostando no chão', status: 'ok', dica: 'Flexibilidade excelente. Cuide também da força para dar estabilidade.' },
]

export const infoNivel = (n: NivelFlex) => NIVEIS.find((x) => x.nivel === n)!

// Alcance: 0 = altura do joelho, 100 = chão. Negativo = acima do joelho.
// A canela vai de 0 a 100 e o tornozelo fica perto de 85.
const LIMITES = { muitoLimitada: -20, limitada: 20, moderada: 75, dedosNoChao: 95 }

/** Excelente pede os dedos no chão e a mão deitada (palma apoiada), não só a ponta dos dedos. */
export function classificarFlex(alcanceDedos: number, maoDeitada: boolean): NivelFlex {
  if (alcanceDedos >= LIMITES.dedosNoChao && maoDeitada) return 'Excelente'
  if (alcanceDedos >= LIMITES.moderada) return 'Boa'
  if (alcanceDedos >= LIMITES.limitada) return 'Moderada'
  if (alcanceDedos >= LIMITES.muitoLimitada) return 'Limitada'
  return 'Muito limitada'
}

export type MedidaFlex = {
  /** Ponta dos dedos, de 0 (joelho) a 100 (chão). */
  alcance: number
  /** Mão deitada no chão, do punho aos dedos na horizontal: palmas apoiadas. */
  palmasNoChao: boolean
  nivel: NivelFlex
  /** Quanto o joelho dobrou, em graus. Até 15° vale. */
  joelho: number
  joelhosOk: boolean
  /** Inclinação do tronco em relação à vertical, em graus. */
  tronco: number
}

const visivel = (p: Point | undefined) => !!p && (p.visibility ?? 1) > 0.3

/** Lado (esquerdo ou direito) com quadril, joelho e tornozelo mais visíveis. */
function pernaVisivel(lm: Point[]) {
  const esq = [LM.ombroEsq, LM.quadrilEsq, LM.joelhoEsq, LM.tornozeloEsq]
  const dir = [LM.ombroDir, LM.quadrilDir, LM.joelhoDir, LM.tornozeloDir]
  const soma = (ids: number[]) => ids.reduce((s, i) => s + (lm[i].visibility ?? 1), 0)
  return soma(esq) >= soma(dir) ? esq : dir
}

const MAOS = [LM.punhoEsq, LM.punhoDir, LM.mindinhoEsq, LM.mindinhoDir, LM.indicadorEsq, LM.indicadorDir, LM.polegarEsq, LM.polegarDir]
const PES = [LM.tornozeloEsq, LM.tornozeloDir, LM.calcanharEsq, LM.calcanharDir, LM.ponteiraEsq, LM.ponteiraDir]

const maisBaixo = (lm: Point[], ids: number[]) => Math.max(...ids.filter((i) => visivel(lm[i])).map((i) => lm[i].y))

/** Alturas (0 a 1 na foto) do joelho, tornozelo, chão e ponta dos dedos. */
export function alturasFlex(lm: Point[]) {
  const [, , joelho, tornozelo] = pernaVisivel(lm)
  const punho = maisBaixo(lm, [LM.punhoEsq, LM.punhoDir])
  const dedos = Math.max(maisBaixo(lm, MAOS), punho)
  return {
    joelho: lm[joelho].y,
    tornozelo: lm[tornozelo].y,
    chao: Math.max(maisBaixo(lm, PES), lm[tornozelo].y),
    dedos,
  }
}

/** A mão mais visível está deitada (do punho ao indicador mais na horizontal que na vertical)? */
function maoDeitada(lm: Point[], w: number, h: number) {
  const maos = [
    [LM.punhoEsq, LM.indicadorEsq],
    [LM.punhoDir, LM.indicadorDir],
  ].filter(([p, i]) => visivel(lm[p]) && visivel(lm[i]))
  if (!maos.length) return false
  const [p, i] = maos.reduce((a, b) => ((lm[b[0]].visibility ?? 1) > (lm[a[0]].visibility ?? 1) ? b : a))
  return Math.abs(lm[i].x - lm[p].x) * w > 1.5 * Math.abs(lm[i].y - lm[p].y) * h
}

/** Mede a foto de lado da posição final. */
export function medirFlex(lm: Point[], w: number, h: number): MedidaFlex {
  const px = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h })
  const [ombro, quadril, joelho, tornozelo] = pernaVisivel(lm).map(px)
  const a = alturasFlex(lm)
  const escala = (y: number) => Math.round(((y - a.joelho) / (a.chao - a.joelho || 1e-6)) * 100)
  const alcance = escala(a.dedos)
  const palmasNoChao = alcance >= LIMITES.dedosNoChao && maoDeitada(lm, w, h)
  const dobraJoelho = 180 - jointAngle(quadril, joelho, tornozelo)
  const tronco = (Math.atan2(Math.abs(ombro.x - quadril.x), quadril.y - ombro.y) * 180) / Math.PI
  return { alcance, palmasNoChao, nivel: classificarFlex(alcance, palmasNoChao), joelho: dobraJoelho, joelhosOk: dobraJoelho <= 15, tronco }
}

/** De lado, inclinado à frente, com quadril, joelho, tornozelo e uma das mãos à vista. */
export function fotoFlexValida(lm: Point[]) {
  const dentro = (i: number) => visivel(lm[i]) && lm[i].x > 0 && lm[i].x < 1 && lm[i].y > 0 && lm[i].y < 1
  const perna = pernaVisivel(lm)
  if (!perna.every(dentro)) return false
  if (![LM.punhoEsq, LM.punhoDir].some(dentro)) return false
  const [ombro, quadril] = perna.map((i) => lm[i])
  return quadril.y - ombro.y < Math.abs(ombro.x - quadril.x) * 1.7 // tronco a mais de ~30° da vertical
}

export type RegistroFlex = Registro & {
  nivel: NivelFlex
  /** Nível que o app achou na foto; difere de `nivel` se o profissional ajustou. */
  nivelApp: NivelFlex
  alcance: number
  joelho: number
  joelhosOk: boolean
  foto?: FotoTeste
}

export const CHAVE_FLEX = 'formacerta:flexibilidade'
