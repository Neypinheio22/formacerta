import { formatDeg, jointAngle } from '../pose/analysis'
import { LM, type Point, type Status } from '../pose/types'
import type { Achado, ExercicioId, Medidas, Pose, Quadro, RepBruta } from './tipos'

export type Exercicio = {
  id: ExercicioId
  nome: string
  vista: string
  /** Como posicionar o celular. */
  dica: string
  /** Nome do ângulo principal, mostrado ao vivo e no gráfico. */
  articulacao: string
  /** Ângulo de "em pé / braço esticado" e o mínimo para contar a repetição. */
  cima: number
  baixo: number
  /** Profundidade boa: o gráfico mostra uma linha aqui. */
  meta: number
  medir: (p: Pose) => Medidas | null
  avaliar: (rep: RepBruta, quadros: Quadro[]) => Achado[]
}

type Px = { x: number; y: number }
type P3 = { x: number; y: number; z: number }

const deg = (rad: number) => (rad * 180) / Math.PI
const vis = (p: Point) => p.visibility ?? 1
const VISIVEL = 0.5

function grade(value: number, atencao: number, alerta: number): Status {
  if (value >= alerta) return 'alerta'
  if (value >= atencao) return 'atencao'
  return 'ok'
}

/** Ângulo em 3D no vértice b, de 0 a 180 graus. */
export function jointAngle3d(a: P3, b: P3, c: P3): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const n = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z)
  const cos = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (n || 1)
  return deg(Math.acos(Math.min(1, Math.max(-1, cos))))
}

/** Inclinação do segmento base→topo em relação à vertical, de 0 a 180 graus. */
function desvioDaVertical(base: Px, topo: Px): number {
  return deg(Math.atan2(Math.abs(topo.x - base.x), base.y - topo.y))
}

const LADO_ESQ: Record<'ombro' | 'cotovelo' | 'punho' | 'quadril' | 'joelho' | 'tornozelo', number> = { ombro: LM.ombroEsq, cotovelo: LM.cotoveloEsq, punho: LM.punhoEsq, quadril: LM.quadrilEsq, joelho: LM.joelhoEsq, tornozelo: LM.tornozeloEsq }
const LADO_DIR = { ombro: LM.ombroDir, cotovelo: LM.cotoveloDir, punho: LM.punhoDir, quadril: LM.quadrilDir, joelho: LM.joelhoDir, tornozelo: LM.tornozeloDir }
type Lado = Record<keyof typeof LADO_ESQ, number>

/** De lado, usa o lado do corpo virado para a câmera (o mais visível). */
function ladoVisivel(lm: Point[], partes: (keyof Lado)[]): Lado {
  const media = (l: Lado) => partes.reduce((s, k) => s + vis(lm[l[k]]), 0) / partes.length
  return media(LADO_ESQ) >= media(LADO_DIR) ? LADO_ESQ : LADO_DIR
}

function pontos(p: Pose, lado: Lado, partes: (keyof Lado)[]): Record<keyof Lado, Px> | null {
  if (partes.some((k) => vis(p.lm[lado[k]]) < VISIVEL)) return null
  const r = {} as Record<keyof Lado, Px>
  for (const k of Object.keys(lado) as (keyof Lado)[]) r[k] = { x: p.lm[lado[k]].x * p.w, y: p.lm[lado[k]].y * p.h }
  return r
}

/** Quadros perto do fundo da repetição, onde os erros costumam aparecer. */
function pertoDoFundo(rep: RepBruta, quadros: Quadro[], margem = 15) {
  const fundo = quadros.filter((q) => q.medidas && q.medidas.angulo <= rep.anguloMin + margem).map((q) => q.medidas!)
  return fundo.length ? fundo : quadros.flatMap((q) => (q.medidas ? [q.medidas] : []))
}

const segundos = (s: number) => `${s.toFixed(1).replace('.', ',')} s`

function ritmo(rep: RepBruta): Achado {
  const descida = rep.fundo - rep.inicio
  const status: Status = descida < 0.6 ? 'atencao' : 'ok'
  return {
    id: 'ritmo',
    title: 'Ritmo da descida',
    value: segundos(descida),
    status,
    detail: status === 'ok' ? 'Descida controlada.' : 'Descida rápida demais. Desça em uns 2 segundos, controlando.',
    exercises: status === 'ok' ? [] : ['Repetições lentas: 3 s descendo, 1 s parado embaixo (3x6)'],
    fala: 'Desça mais devagar',
  }
}

const AJUDA = {
  profundidadeAgachamento: ['Agachamento na caixa ou cadeira (3x10)', 'Mobilidade de tornozelo na parede (2x10 cada lado)', 'Alongamento do flexor do quadril (30 s cada lado)'],
  tronco: ['Agachamento goblet, segurando peso no peito (3x10)', 'Extensão torácica no rolo (1 min)', 'Mobilidade de tornozelo na parede (2x10 cada lado)'],
  joelhoDentro: ['Abdução de quadril deitado (3x15)', 'Ponte com mini band nos joelhos (3x12)', 'Agachamento com elástico nos joelhos (3x10)'],
  peso: ['Afundo / passada parada (3x8 cada perna)', 'Ponte unilateral (3x10 cada perna)'],
  profundidadeFlexao: ['Flexão com joelhos apoiados (3x10)', 'Flexão inclinada com as mãos no banco (3x10)'],
  corpo: ['Prancha frontal (3x30 s)', 'Dead bug (3x10)'],
}

function profundidade(anguloMin: number, limites: [number, number], textos: { ok: string; raso: string }, ajuda: string[]): Achado {
  const status = grade(anguloMin, ...limites)
  return {
    id: 'profundidade',
    title: 'Profundidade',
    value: formatDeg(anguloMin),
    status,
    detail: status === 'ok' ? textos.ok : textos.raso,
    exercises: status === 'ok' ? [] : ajuda,
    fala: 'Desça mais',
  }
}

const AGACHAMENTO_LATERAL: Exercicio = {
  id: 'agachamento-lateral',
  nome: 'Agachamento',
  vista: 'De lado',
  dica: 'Celular de lado para você, na altura do quadril, a uns 2 a 3 metros. Corpo inteiro no quadro.',
  articulacao: 'Joelho',
  cima: 160,
  baixo: 140,
  meta: 100,
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'quadril', 'joelho', 'tornozelo'])
    const k = pontos(p, lado, ['ombro', 'quadril', 'joelho', 'tornozelo'])
    if (!k) return null
    return { angulo: jointAngle(k.quadril, k.joelho, k.tornozelo), tronco: desvioDaVertical(k.quadril, k.ombro) }
  },
  avaliar(rep, quadros) {
    const tronco = Math.max(...quadros.map((q) => q.medidas?.tronco ?? 0))
    const statusTronco = grade(tronco, 45, 55)
    return [
      profundidade(rep.anguloMin, [100, 120], { ok: 'Boa profundidade: coxa perto da linha do joelho.', raso: 'Agachamento raso. Desça até a coxa ficar perto da linha do joelho.' }, AJUDA.profundidadeAgachamento),
      {
        id: 'tronco',
        title: 'Inclinação do tronco',
        value: formatDeg(tronco),
        status: statusTronco,
        detail: statusTronco === 'ok' ? 'Tronco firme durante o movimento.' : 'Tronco caindo para frente. Mantenha o peito aberto e o olhar à frente.',
        exercises: statusTronco === 'ok' ? [] : AJUDA.tronco,
        fala: 'Peito para cima',
      },
      ritmo(rep),
    ]
  },
}

const AGACHAMENTO_FRENTE: Exercicio = {
  id: 'agachamento-frente',
  nome: 'Agachamento',
  vista: 'De frente',
  dica: 'Celular de frente para você, na altura do quadril, a uns 2 a 3 metros. Pés na largura dos ombros.',
  articulacao: 'Joelho',
  cima: 155,
  baixo: 135,
  meta: 100,
  medir(p) {
    const ids = [LM.quadrilEsq, LM.quadrilDir, LM.joelhoEsq, LM.joelhoDir, LM.tornozeloEsq, LM.tornozeloDir]
    if (ids.some((i) => vis(p.lm[i]) < VISIVEL)) return null
    const P = (i: number) => ({ x: p.lm[i].x * p.w, y: p.lm[i].y * p.h })
    // De frente, a flexão do joelho quase não aparece na imagem plana: usamos os pontos em 3D.
    const W = (i: number) => ({ x: p.mundo![i].x, y: p.mundo![i].y, z: p.mundo![i].z ?? 0 })
    const joelho = (q: number, j: number, t: number) => (p.mundo ? jointAngle3d(W(q), W(j), W(t)) : jointAngle(P(q), P(j), P(t)))
    const angulo = (joelho(LM.quadrilEsq, LM.joelhoEsq, LM.tornozeloEsq) + joelho(LM.quadrilDir, LM.joelhoDir, LM.tornozeloDir)) / 2

    const larguraTornozelos = Math.abs(P(LM.tornozeloEsq).x - P(LM.tornozeloDir).x) || 1
    const larguraJoelhos = Math.abs(P(LM.joelhoEsq).x - P(LM.joelhoDir).x)
    const meioQuadril = (P(LM.quadrilEsq).x + P(LM.quadrilDir).x) / 2
    const meioTornozelo = (P(LM.tornozeloEsq).x + P(LM.tornozeloDir).x) / 2
    return {
      angulo,
      // Joelhos mais juntos que os tornozelos = joelhos indo para dentro.
      joelhos: larguraJoelhos / larguraTornozelos,
      // Positivo: quadril deslocado para a direita da imagem (lado esquerdo da pessoa).
      deslocamento: ((meioQuadril - meioTornozelo) / larguraTornozelos) * 100,
    }
  },
  avaliar(rep, quadros) {
    const fundo = pertoDoFundo(rep, quadros)
    const joelhos = Math.min(...fundo.map((m) => m.joelhos))
    const statusJoelhos = grade((1 - joelhos) * 100, 10, 25)
    const desloc = fundo.reduce((pior, m) => (Math.abs(m.deslocamento) > Math.abs(pior) ? m.deslocamento : pior), 0)
    const statusPeso = grade(Math.abs(desloc), 12, 22)
    return [
      profundidade(rep.anguloMin, [100, 120], { ok: 'Boa profundidade.', raso: 'Agachamento raso. Desça mais, até a coxa ficar perto da linha do joelho.' }, AJUDA.profundidadeAgachamento),
      {
        id: 'joelhos',
        title: 'Joelhos na descida',
        value: `${Math.round(joelhos * 100)}%`,
        status: statusJoelhos,
        detail: statusJoelhos === 'ok' ? 'Joelhos acompanhando a linha dos pés.' : 'Joelhos indo para dentro na descida. Empurre os joelhos para fora, na direção dos dedos do pé.',
        exercises: statusJoelhos === 'ok' ? [] : AJUDA.joelhoDentro,
        fala: 'Joelhos para fora',
      },
      {
        id: 'peso',
        title: 'Distribuição do peso',
        value: `${Math.round(Math.abs(desloc))}%`,
        status: statusPeso,
        detail: statusPeso === 'ok' ? 'Peso bem dividido entre as duas pernas.' : `Quadril indo para o lado ${desloc > 0 ? 'esquerdo' : 'direito'}. Divida o peso nos dois pés.`,
        exercises: statusPeso === 'ok' ? [] : AJUDA.peso,
        fala: 'Peso nos dois pés',
      },
      ritmo(rep),
    ]
  },
}

const FLEXAO_LATERAL: Exercicio = {
  id: 'flexao-lateral',
  nome: 'Flexão de braço',
  vista: 'De lado',
  dica: 'Celular no chão, de lado para você, a uns 2 metros. Da cabeça aos pés no quadro.',
  articulacao: 'Cotovelo',
  cima: 145,
  baixo: 120,
  meta: 95,
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'cotovelo', 'punho', 'quadril', 'tornozelo'])
    const k = pontos(p, lado, ['ombro', 'cotovelo', 'punho', 'quadril', 'tornozelo'])
    if (!k) return null
    // Quanto o quadril sai da linha ombro–tornozelo. Positivo: quadril caindo.
    const t = (k.quadril.x - k.ombro.x) / (k.tornozelo.x - k.ombro.x || 1)
    const linhaY = k.ombro.y + (k.tornozelo.y - k.ombro.y) * t
    const desvio = 180 - jointAngle(k.ombro, k.quadril, k.tornozelo)
    return { angulo: jointAngle(k.ombro, k.cotovelo, k.punho), corpo: k.quadril.y > linhaY ? desvio : -desvio }
  },
  avaliar(rep, quadros) {
    const corpo = quadros.reduce((pior, q) => (q.medidas && Math.abs(q.medidas.corpo) > Math.abs(pior) ? q.medidas.corpo : pior), 0)
    const statusCorpo = grade(Math.abs(corpo), 12, 22)
    return [
      profundidade(rep.anguloMin, [95, 115], { ok: 'Boa amplitude: peito perto do chão.', raso: 'Flexão curta. Desça até o peito chegar perto do chão.' }, AJUDA.profundidadeFlexao),
      {
        id: 'corpo',
        title: 'Corpo alinhado',
        value: formatDeg(Math.abs(corpo)),
        status: statusCorpo,
        detail: statusCorpo === 'ok' ? 'Corpo reto, como uma prancha.' : corpo > 0 ? 'Quadril caindo. Contraia abdômen e glúteos.' : 'Quadril alto demais. Baixe o quadril até alinhar o corpo.',
        exercises: statusCorpo === 'ok' ? [] : AJUDA.corpo,
        fala: corpo > 0 ? 'Contraia o abdômen' : 'Baixe o quadril',
      },
      ritmo(rep),
    ]
  },
}

export const EXERCICIOS: Exercicio[] = [AGACHAMENTO_LATERAL, AGACHAMENTO_FRENTE, FLEXAO_LATERAL]

export const exercicioPorId = (id: ExercicioId) => EXERCICIOS.find((e) => e.id === id)!
