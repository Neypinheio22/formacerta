import { exerciciosDe, type CorrecaoId } from './recomendacoes'
import { LM, type Finding, type Point, type Status, type ViewId } from './types'

type Px = { x: number; y: number }


const px = (p: Point, w: number, h: number): Px => ({ x: p.x * w, y: p.y * h })

const deg = (rad: number) => (rad * 180) / Math.PI

export const formatDeg = (v: number) => `${v.toFixed(1).replace('.', ',')}°`

/** Inclinação da linha a→b em relação à horizontal, de 0 a 90 graus. */
export function tiltFromHorizontal(a: Px, b: Px): number {
  return deg(Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)))
}

/** Ângulo no vértice b formado por a-b-c, de 0 a 180 graus. */
export function jointAngle(a: Px, b: Px, c: Px): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y))
  return deg(Math.acos(Math.min(1, Math.max(-1, cos))))
}

function corrigir(status: Status, correcao: CorrecaoId): Pick<Finding, 'exercises' | 'correcao'> {
  return status === 'ok' ? { exercises: [] } : { exercises: exerciciosDe(correcao), correcao }
}

function grade(value: number, atencao: number, alerta: number): Status {
  if (value >= alerta) return 'alerta'
  if (value >= atencao) return 'atencao'
  return 'ok'
}

/**
 * Lados do corpo pela posição na foto. De frente, o lado esquerdo da pessoa
 * aparece à direita da foto; de costas, à esquerda. Assim não dependemos do
 * modelo acertar esquerda/direita quando a pessoa está de costas.
 */
function sides(view: ViewId, a: Px, b: Px): { esq: Px; dir: Px } {
  const [imgEsq, imgDir] = a.x < b.x ? [a, b] : [b, a]
  return view === 'frente' ? { esq: imgDir, dir: imgEsq } : { esq: imgEsq, dir: imgDir }
}

function levelFinding(id: string, title: string, parte: string, view: ViewId, a: Px, b: Px, limites: [number, number], correcao: CorrecaoId): Finding {
  const angle = tiltFromHorizontal(a, b)
  const status = grade(angle, ...limites)
  const { esq, dir } = sides(view, a, b)
  const maisAlto = esq.y < dir.y ? 'esquerdo' : 'direito'
  return {
    id,
    title,
    value: formatDeg(angle),
    status,
    detail: status === 'ok' ? `${parte} alinhados.` : `${parte}: lado ${maisAlto} mais alto.`,
    ...corrigir(status, correcao),
    lado: maisAlto,
  }
}

function kneeFinding(view: ViewId, quadril: Px, joelho: Px, tornozelo: Px, meioX: number, lado: 'esquerdo' | 'direito'): Finding {
  const desvio = 180 - jointAngle(quadril, joelho, tornozelo)
  const status = grade(desvio, 6, 12)
  const t = (joelho.y - quadril.y) / (tornozelo.y - quadril.y || 1)
  const linhaX = quadril.x + (tornozelo.x - quadril.x) * t
  const paraDentro = Math.sign(joelho.x - linhaX) === Math.sign(meioX - linhaX)
  const direcao = paraDentro ? 'para dentro' : 'para fora'
  return {
    id: `joelho-${lado}-${view}`,
    title: `Joelho ${lado}`,
    value: formatDeg(desvio),
    status,
    detail: status === 'ok' ? 'Joelho alinhado com quadril e tornozelo.' : `Joelho ${lado} desviando ${direcao}.`,
    ...corrigir(status, paraDentro ? 'joelhoValgo' : 'joelhoVaro'),
    lado,
  }
}

export function analyzeFrontBack(view: 'frente' | 'costas', lm: Point[], w: number, h: number): Finding[] {
  const P = (i: number) => px(lm[i], w, h)
  const ombroA = P(LM.ombroEsq), ombroB = P(LM.ombroDir)
  const quadrilA = P(LM.quadrilEsq), quadrilB = P(LM.quadrilDir)

  const findings: Finding[] = [
    levelFinding(`ombros-${view}`, 'Altura dos ombros', 'Ombros', view, ombroA, ombroB, [3, 6], 'ombroElevado'),
    levelFinding(`quadril-${view}`, 'Altura do quadril', 'Quadril', view, quadrilA, quadrilB, [3, 6], 'quadrilElevado'),
  ]

  if (view === 'frente') {
    findings.push(levelFinding('cabeca-frente', 'Inclinação da cabeça', 'Orelhas', view, P(LM.orelhaEsq), P(LM.orelhaDir), [4, 8], 'cabecaInclinada'))
  }

  const meioOmbro = (ombroA.x + ombroB.x) / 2
  const meioQuadril = (quadrilA.x + quadrilB.x) / 2
  const larguraOmbros = Math.abs(ombroA.x - ombroB.x) || 1
  const deslocamento = (Math.abs(meioOmbro - meioQuadril) / larguraOmbros) * 100
  const statusTronco = grade(deslocamento, 8, 15)
  findings.push({
    id: `tronco-${view}`,
    title: 'Tronco centralizado',
    value: `${deslocamento.toFixed(0)}%`,
    status: statusTronco,
    detail: statusTronco === 'ok' ? 'Tronco centralizado sobre o quadril.' : 'Tronco deslocado para um dos lados em relação ao quadril.',
    ...corrigir(statusTronco, 'troncoDeslocado'),
  })

  const pernas = [
    [P(LM.quadrilEsq), P(LM.joelhoEsq), P(LM.tornozeloEsq)],
    [P(LM.quadrilDir), P(LM.joelhoDir), P(LM.tornozeloDir)],
  ] as const
  for (const [q, j, t] of pernas) {
    const outroQuadril = q === pernas[0][0] ? pernas[1][0] : pernas[0][0]
    const { esq } = sides(view, q, outroQuadril)
    findings.push(kneeFinding(view, q, j, t, meioQuadril, esq === q ? 'esquerdo' : 'direito'))
  }

  return findings
}

const vis = (p: Point) => p.visibility ?? 1

/** Escolhe o lado do corpo mais visível (o que está virado para a câmera). */
function nearSide(lm: Point[]) {
  const esq = [LM.orelhaEsq, LM.ombroEsq, LM.quadrilEsq, LM.joelhoEsq, LM.tornozeloEsq]
  const dir = [LM.orelhaDir, LM.ombroDir, LM.quadrilDir, LM.joelhoDir, LM.tornozeloDir]
  const media = (ids: number[]) => ids.reduce((s, i) => s + vis(lm[i]), 0) / ids.length
  return media(esq) >= media(dir) ? esq : dir
}

/** Ângulo do segmento base→topo em relação à vertical; positivo quando inclina para onde a pessoa olha. */
function leanFromVertical(base: Px, topo: Px, facing: number): number {
  return deg(Math.atan2((topo.x - base.x) * facing, base.y - topo.y))
}

export function analyzeSide(view: 'lateral-direita' | 'lateral-esquerda', lm: Point[], w: number, h: number): Finding[] {
  const [orelha, ombro, quadril, joelho, tornozelo] = nearSide(lm).map((i) => px(lm[i], w, h))
  const nariz = px(lm[LM.nariz], w, h)
  const facing = nariz.x >= orelha.x ? 1 : -1
  const findings: Finding[] = []

  const cabeca = leanFromVertical(ombro, orelha, facing)
  const statusCabeca = grade(cabeca, 15, 25)
  findings.push({
    id: `cabeca-${view}`,
    title: 'Posição da cabeça',
    value: formatDeg(Math.max(0, cabeca)),
    status: statusCabeca,
    detail: statusCabeca === 'ok' ? 'Orelha alinhada sobre o ombro.' : 'Cabeça projetada para frente.',
    ...corrigir(statusCabeca, 'cabecaAnteriorizada'),
  })

  const tronco = leanFromVertical(quadril, ombro, facing)
  const statusTronco = tronco >= 0 ? grade(tronco, 8, 15) : grade(-tronco, 8, 15)
  findings.push({
    id: `tronco-${view}`,
    title: 'Inclinação do tronco',
    value: formatDeg(Math.abs(tronco)),
    status: statusTronco,
    detail: statusTronco === 'ok' ? 'Ombro alinhado sobre o quadril.' : tronco > 0 ? 'Tronco inclinado para frente (ombros à frente do quadril).' : 'Tronco inclinado para trás.',
    ...corrigir(statusTronco, tronco > 0 ? 'troncoAFrente' : 'troncoParaTras'),
  })

  const desvio = 180 - jointAngle(quadril, joelho, tornozelo)
  const t = (joelho.y - quadril.y) / (tornozelo.y - quadril.y || 1)
  const linhaX = quadril.x + (tornozelo.x - quadril.x) * t
  const joelhoAFrente = (joelho.x - linhaX) * facing > 0
  const statusJoelho = joelhoAFrente ? grade(desvio, 10, 20) : grade(desvio, 5, 10)
  findings.push({
    id: `joelho-${view}`,
    title: 'Joelhos',
    value: formatDeg(desvio),
    status: statusJoelho,
    detail: statusJoelho === 'ok' ? 'Joelhos em posição neutra.' : joelhoAFrente ? 'Joelhos flexionados em pé.' : 'Joelhos hiperestendidos (travados para trás).',
    ...corrigir(statusJoelho, joelhoAFrente ? 'joelhoFlexionado' : 'joelhoHiperestendido'),
  })

  return findings
}

export function analyzeView(view: ViewId, lm: Point[], w: number, h: number): Finding[] {
  return view === 'frente' || view === 'costas' ? analyzeFrontBack(view, lm, w, h) : analyzeSide(view, lm, w, h)
}

const ESSENCIAIS_FRENTE = [LM.ombroEsq, LM.ombroDir, LM.quadrilEsq, LM.quadrilDir, LM.joelhoEsq, LM.joelhoDir, LM.tornozeloEsq, LM.tornozeloDir]

/** Confere se o corpo inteiro aparece na foto, para não analisar foto cortada. */
export function bodyVisible(view: ViewId, lm: Point[]): boolean {
  const ids = view === 'frente' || view === 'costas' ? ESSENCIAIS_FRENTE : nearSide(lm)
  return ids.every((i) => vis(lm[i]) > 0.5 && lm[i].y > 0 && lm[i].y < 1 && lm[i].x > 0 && lm[i].x < 1)
}

/** Nota de 0 a 100: média das medições, onde "atenção" perde menos que "corrigir". */
export function computeScore(findings: Finding[]): number {
  if (findings.length === 0) return 100
  const perda = findings.reduce((s, f) => s + (f.status === 'alerta' ? 1 : f.status === 'atencao' ? 0.4 : 0), 0)
  return Math.round(100 * (1 - perda / findings.length))
}
