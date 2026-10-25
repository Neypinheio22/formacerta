import { formatDeg, jointAngle } from '../pose/analysis'
import { LM, type Point, type Status } from '../pose/types'
import { ContadorReps } from './contador'
import type { Achado, ExercicioId, Medidas, Pose, Quadro, RepBruta } from './tipos'

export const GRUPOS = ['Pernas', 'Costas', 'Trapézio', 'Ombro', 'Bíceps', 'Tríceps', 'Abdominal', 'Corpo inteiro'] as const
export type Grupo = (typeof GRUPOS)[number]

export type Exercicio = {
  id: ExercicioId
  nome: string
  grupo: Grupo
  vista: string
  /** Como posicionar o celular. */
  dica: string
  /** Nome do ângulo principal, mostrado ao vivo e no gráfico. */
  articulacao: string
  /** Ângulo de "em pé / braço esticado" e o mínimo para contar a repetição. */
  cima: number
  baixo: number
  /** Profundidade boa: o gráfico mostra uma linha aqui. */
  meta?: number
  /** O ângulo sobe durante a repetição: `cima` é o limite de saída e `baixo` o que precisa alcançar. */
  sobe?: boolean
  /** Conta pela mudança em relação à posição inicial, em % (ver ContadorReps). */
  relativo?: boolean
  /** Unidade da medida principal. Padrão: graus. */
  unidade?: string
  /** Nome das fases ao vivo: indo e voltando. Padrão: descendo e subindo. */
  fases?: [string, string]
  /** Onde fica o ponto extremo da repetição, para a lista de reps. Padrão: "no fundo". */
  pico?: string
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

/** Inclinação com sinal (positivo para a direita da imagem), para medir balanço. */
function inclinacao(base: Px, topo: Px): number {
  return deg(Math.atan2(topo.x - base.x, base.y - topo.y))
}

const LADO_ESQ: Record<'orelha' | 'ombro' | 'cotovelo' | 'punho' | 'quadril' | 'joelho' | 'tornozelo' | 'ponteira', number> = {
  orelha: LM.orelhaEsq,
  ombro: LM.ombroEsq,
  cotovelo: LM.cotoveloEsq,
  punho: LM.punhoEsq,
  quadril: LM.quadrilEsq,
  joelho: LM.joelhoEsq,
  tornozelo: LM.tornozeloEsq,
  ponteira: LM.ponteiraEsq,
}
const LADO_DIR: Lado = {
  orelha: LM.orelhaDir,
  ombro: LM.ombroDir,
  cotovelo: LM.cotoveloDir,
  punho: LM.punhoDir,
  quadril: LM.quadrilDir,
  joelho: LM.joelhoDir,
  tornozelo: LM.tornozeloDir,
  ponteira: LM.ponteiraDir,
}
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

/** Pontos de frente: os dois lados precisam aparecer. */
function frente(p: Pose, ids: number[]): ((i: number) => Px) | null {
  if (ids.some((i) => vis(p.lm[i]) < VISIVEL)) return null
  return (i) => ({ x: p.lm[i].x * p.w, y: p.lm[i].y * p.h })
}

const meio = (a: Px, b: Px): Px => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Quadros perto do fundo da repetição (ou do topo, se o ângulo sobe), onde os erros costumam aparecer. */
function pertoDoFundo(rep: RepBruta, quadros: Quadro[], margem = 15, sobe = false) {
  const perto = (a: number) => (sobe ? a >= rep.anguloMin - margem : a <= rep.anguloMin + margem)
  const fundo = quadros.filter((q) => q.medidas && perto(q.medidas.angulo)).map((q) => q.medidas!)
  return fundo.length ? fundo : quadros.flatMap((q) => (q.medidas ? [q.medidas] : []))
}

/** Valores de uma medida na repetição, sem os quadros em que ela não apareceu. */
function valores(lista: (Quadro | Medidas)[], chave: string): number[] {
  return lista.flatMap((x) => {
    const m = 'lm' in x ? (x as Quadro).medidas : (x as Medidas)
    const v = m?.[chave]
    return v != null && Number.isFinite(v) ? [v] : []
  })
}
const maior = (lista: (Quadro | Medidas)[], chave: string) => Math.max(0, ...valores(lista, chave))
function variacao(lista: (Quadro | Medidas)[], chave: string) {
  const v = valores(lista, chave)
  return v.length ? Math.max(...v) - Math.min(...v) : 0
}

const segundos = (s: number) => `${s.toFixed(1).replace('.', ',')} s`

type Ritmo = { fase: 'ida' | 'volta'; nome: string; verbo: string; exercicio: string }

const DESCIDA: Ritmo = { fase: 'ida', nome: 'descida', verbo: 'Desça', exercicio: 'Repetições lentas: 3 s descendo, 1 s parado embaixo (3x6)' }

/** Tempo da fase que mais pede controle: a ida (agachamento) ou a volta (rosca). */
function ritmo(rep: RepBruta, r: Ritmo = DESCIDA): Achado {
  const tempo = r.fase === 'ida' ? rep.fundo - rep.inicio : rep.fim - rep.fundo
  const status: Status = tempo < 0.6 ? 'atencao' : 'ok'
  const Nome = r.nome[0].toUpperCase() + r.nome.slice(1)
  return {
    id: 'ritmo',
    title: `Ritmo da ${r.nome}`,
    value: segundos(tempo),
    status,
    detail: status === 'ok' ? `${Nome} controlada.` : `${Nome} rápida demais. ${r.verbo} em uns 2 segundos, controlando.`,
    exercises: status === 'ok' ? [] : [r.exercicio],
    fala: `${r.verbo} mais devagar`,
  }
}

const VOLTA_DESCENDO: Ritmo = { fase: 'volta', nome: 'descida', verbo: 'Desça', exercicio: 'Repetições lentas: 1 s subindo, 3 s descendo (3x8)' }

/** Achado comum: `ok` usa o primeiro texto, o resto usa o segundo e indica os exercícios. */
function achado(id: string, title: string, value: string, status: Status, ok: string, erro: string, exercises: string[], fala: string): Achado {
  return { id, title, value, status, detail: status === 'ok' ? ok : erro, exercises: status === 'ok' ? [] : exercises, fala }
}

const pct = (v: number) => `${Math.round(v)}%`

const AJUDA = {
  profundidadeAgachamento: ['Agachamento na caixa ou cadeira (3x10)', 'Mobilidade de tornozelo na parede (2x10 cada lado)', 'Alongamento do flexor do quadril (30 s cada lado)'],
  tronco: ['Agachamento goblet, segurando peso no peito (3x10)', 'Extensão torácica no rolo (1 min)', 'Mobilidade de tornozelo na parede (2x10 cada lado)'],
  joelhoDentro: ['Abdução de quadril deitado (3x15)', 'Ponte com mini band nos joelhos (3x12)', 'Agachamento com elástico nos joelhos (3x10)'],
  peso: ['Afundo / passada parada (3x8 cada perna)', 'Ponte unilateral (3x10 cada perna)'],
  profundidadeFlexao: ['Flexão com joelhos apoiados (3x10)', 'Flexão inclinada com as mãos no banco (3x10)'],
  corpo: ['Prancha frontal (3x30 s)', 'Dead bug (3x10)'],
}

function profundidade(anguloMin: number, limites: [number, number], textos: { ok: string; raso: string }, ajuda: string[], fala = 'Desça mais'): Achado {
  const status = grade(anguloMin, ...limites)
  return {
    id: 'profundidade',
    title: 'Profundidade',
    value: formatDeg(anguloMin),
    status,
    detail: status === 'ok' ? textos.ok : textos.raso,
    exercises: status === 'ok' ? [] : ajuda,
    fala,
  }
}

const AGACHAMENTO_LATERAL: Exercicio = {
  id: 'agachamento-lateral',
  nome: 'Agachamento',
  grupo: 'Pernas',
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
  grupo: 'Pernas',
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
  grupo: 'Corpo inteiro',
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

// ---------- Pernas ----------

const AFUNDO: Exercicio = {
  id: 'afundo-lateral',
  nome: 'Afundo (avanço)',
  grupo: 'Pernas',
  vista: 'De lado',
  dica: 'Celular de lado para você, na altura do quadril, a uns 2 a 3 metros. Dê um passo à frente e desça o joelho de trás.',
  articulacao: 'Joelho',
  cima: 155,
  baixo: 125,
  meta: 95,
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'quadril', 'joelho', 'tornozelo'])
    const k = pontos(p, lado, ['ombro', 'quadril', 'joelho', 'tornozelo'])
    if (!k) return null
    // Perna da frente: o tornozelo mais à frente, para o lado em que o nariz aponta.
    let joelhoFrente = NaN
    const pernas = [LADO_ESQ, LADO_DIR].filter((l) => [l.joelho, l.tornozelo, l.ponteira].every((i) => vis(p.lm[i]) >= VISIVEL))
    if (pernas.length === 2 && vis(p.lm[LM.nariz]) >= VISIVEL) {
      const X = (i: number) => p.lm[i].x * p.w
      const Y = (i: number) => p.lm[i].y * p.h
      const sentido = Math.sign(X(LM.nariz) - (X(LM.ombroEsq) + X(LM.ombroDir)) / 2) || 1
      const f = sentido * (X(pernas[0].tornozelo) - X(pernas[1].tornozelo)) > 0 ? pernas[0] : pernas[1]
      const canela = Math.hypot(X(f.joelho) - X(f.tornozelo), Y(f.joelho) - Y(f.tornozelo)) || 1
      // Quanto o joelho da frente passa da ponta do pé, em % da canela.
      joelhoFrente = ((sentido * (X(f.joelho) - X(f.ponteira))) / canela) * 100
    }
    return { angulo: jointAngle(k.quadril, k.joelho, k.tornozelo), tronco: desvioDaVertical(k.quadril, k.ombro), joelhoFrente }
  },
  avaliar(rep, quadros) {
    const tronco = maior(quadros, 'tronco')
    const statusTronco = grade(tronco, 20, 30)
    const joelho = maior(pertoDoFundo(rep, quadros), 'joelhoFrente')
    const statusJoelho = grade(joelho, 15, 30)
    return [
      profundidade(rep.anguloMin, [100, 115], { ok: 'Boa profundidade: joelho de trás perto do chão.', raso: 'Afundo raso. Desça até o joelho de trás quase tocar o chão.' }, ['Afundo com apoio na parede (3x8 cada perna)', 'Alongamento do flexor do quadril (30 s cada lado)']),
      achado('tronco', 'Inclinação do tronco', formatDeg(tronco), statusTronco, 'Tronco reto na descida.', 'Tronco inclinando para frente. Desça reto, com o peito aberto.', AJUDA.tronco, 'Tronco reto'),
      achado('joelho-frente', 'Joelho da frente', pct(joelho), statusJoelho, 'Joelho da frente sobre o pé.', 'Joelho da frente passando muito da ponta do pé. Dê um passo mais longo.', ['Afundo parado com passo longo (3x8 cada perna)', 'Ponte unilateral (3x10 cada perna)'], 'Passo mais longo'),
      ritmo(rep),
    ]
  },
}

const PONTE: Exercicio = {
  id: 'ponte-lateral',
  nome: 'Elevação pélvica (ponte)',
  grupo: 'Pernas',
  vista: 'De lado, deitado',
  dica: 'Celular no chão, de lado para você, a uns 2 metros. Deitado de barriga para cima, joelhos dobrados e pés no chão.',
  articulacao: 'Quadril',
  sobe: true,
  cima: 150,
  baixo: 165,
  meta: 180,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'quadril', 'joelho'])
    const k = pontos(p, lado, ['ombro', 'quadril', 'joelho'])
    if (!k) return null
    // Passando de 180°: quadril acima da linha ombro–joelho, lombar arqueando.
    const t = (k.quadril.x - k.ombro.x) / (k.joelho.x - k.ombro.x || 1)
    const linhaY = k.ombro.y + (k.joelho.y - k.ombro.y) * t
    const j = jointAngle(k.ombro, k.quadril, k.joelho)
    return { angulo: k.quadril.y < linhaY ? 360 - j : j }
  },
  avaliar(rep) {
    const pico = rep.anguloMin
    const alto = pico > 195
    const status: Status = pico > 205 ? 'alerta' : alto || pico < 172 ? 'atencao' : 'ok'
    return [
      alto
        ? achado('altura', 'Altura do quadril', formatDeg(pico), status, '', 'Quadril alto demais, arqueando a lombar. Pare quando ombro, quadril e joelho ficarem em linha.', ['Dead bug (3x10)', 'Ponte com pausa, contraindo o abdômen (3x10)'], 'Não arqueie a lombar')
        : achado('altura', 'Altura do quadril', formatDeg(pico), status, 'Quadril subiu até alinhar com ombro e joelho.', 'Quadril não subiu até alinhar. Suba até ombro, quadril e joelho ficarem em linha.', ['Ponte com pausa de 2 s em cima (3x12)', 'Ponte com mini band nos joelhos (3x12)'], 'Suba o quadril'),
      ritmo(rep, VOLTA_DESCENDO),
    ]
  },
}

// ---------- Costas e trapézio ----------

const REMADA_CURVADA: Exercicio = {
  id: 'remada-curvada',
  nome: 'Remada curvada',
  grupo: 'Costas',
  vista: 'De lado',
  dica: 'Celular de lado para você, na altura do quadril, a uns 2 a 3 metros. Tronco inclinado, halter ou barra com os braços esticados.',
  articulacao: 'Cotovelo',
  cima: 150,
  baixo: 115,
  meta: 80,
  fases: ['Puxando', 'Voltando'],
  pico: 'na puxada',
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'cotovelo', 'punho', 'quadril'])
    const k = pontos(p, lado, ['ombro', 'cotovelo', 'punho', 'quadril'])
    if (!k) return null
    return { angulo: jointAngle(k.ombro, k.cotovelo, k.punho), tronco: desvioDaVertical(k.quadril, k.ombro) }
  },
  avaliar(rep, quadros) {
    const balanco = variacao(quadros, 'tronco')
    const statusBalanco = grade(balanco, 10, 18)
    const t = valores(quadros, 'tronco')
    const media = t.length ? t.reduce((s, v) => s + v, 0) / t.length : 0
    const statusIncl = grade(45 - media, 15, 25)
    return [
      profundidade(rep.anguloMin, [90, 110], { ok: 'Boa puxada: cotovelo passou da linha das costas.', raso: 'Puxada curta. Leve o cotovelo para trás até passar da linha das costas.' }, ['Remada com halter apoiada no banco (3x10)', 'Remada com elástico (3x15)'], 'Puxe mais'),
      achado('tronco', 'Tronco parado', formatDeg(balanco), statusBalanco, 'Tronco firme durante a puxada.', 'Tronco subindo para ajudar a puxar. Use menos peso e mantenha o tronco parado.', ['Remada apoiada no banco (3x10)', 'Prancha frontal (3x30 s)'], 'Tronco parado'),
      achado('inclinacao', 'Inclinação do tronco', formatDeg(media), statusIncl, 'Tronco bem inclinado.', 'Tronco muito em pé. Incline o tronco uns 45° para frente, com a coluna reta.', ['Bom dia com bastão (3x10)', 'Stiff com halter leve (3x10)'], 'Incline o tronco'),
      ritmo(rep, { fase: 'volta', nome: 'volta', verbo: 'Volte', exercicio: 'Repetições lentas: 1 s puxando, 3 s voltando (3x8)' }),
    ]
  },
}

const ENCOLHIMENTO: Exercicio = {
  id: 'encolhimento-frente',
  nome: 'Encolhimento de ombros',
  grupo: 'Trapézio',
  vista: 'De frente',
  dica: 'Celular de frente para você, na altura do peito, a uns 2 metros. Rosto e ombros bem visíveis, braços soltos com o peso.',
  articulacao: 'Pescoço',
  unidade: '%',
  relativo: true,
  cima: 96,
  baixo: 90,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const P = frente(p, [LM.orelhaEsq, LM.orelhaDir, LM.ombroEsq, LM.ombroDir])
    if (!P) return null
    const largura = Math.abs(P(LM.ombroEsq).x - P(LM.ombroDir).x) || 1
    // Distância das orelhas até a linha dos ombros, em % da largura dos ombros: diminui ao encolher.
    const pescoco = ((meio(P(LM.ombroEsq), P(LM.ombroDir)).y - meio(P(LM.orelhaEsq), P(LM.orelhaDir)).y) / largura) * 100
    return { angulo: pescoco, desnivel: ((P(LM.ombroEsq).y - P(LM.ombroDir).y) / largura) * 100 }
  },
  avaliar(rep, quadros) {
    const base = maior(quadros, 'angulo') || 1
    const subida = ((base - rep.anguloMin) / base) * 100
    const statusSubida: Status = subida < 15 ? 'atencao' : 'ok'
    const d = valores(quadros, 'desnivel')
    const inicio = d[0] ?? 0
    const torto = d.reduce((pior, v) => Math.max(pior, Math.abs(v - inicio)), 0)
    const statusTorto = grade(torto, 5, 10)
    return [
      achado('subida', 'Altura da subida', pct(subida), statusSubida, 'Boa subida: ombros perto das orelhas.', 'Subida curta. Leve os ombros na direção das orelhas.', ['Encolhimento com pausa de 2 s em cima (3x12)'], 'Suba mais os ombros'),
      achado('simetria', 'Os dois ombros juntos', pct(torto), statusTorto, 'Os dois ombros sobem juntos.', 'Um ombro subindo mais que o outro. Suba os dois por igual.', ['Encolhimento com um braço de cada vez (3x10 cada lado)'], 'Suba os dois juntos'),
      ritmo(rep, { ...VOLTA_DESCENDO, verbo: 'Desça os ombros', exercicio: 'Encolhimento lento: 1 s subindo, 3 s descendo (3x10)' }),
    ]
  },
}

// ---------- Ombro ----------

const DESENVOLVIMENTO: Exercicio = {
  id: 'desenvolvimento-frente',
  nome: 'Desenvolvimento com halter',
  grupo: 'Ombro',
  vista: 'De frente',
  dica: 'Celular de frente para você, na altura do peito, a uns 2 a 3 metros. Halteres na altura das orelhas para começar.',
  articulacao: 'Cotovelo',
  sobe: true,
  cima: 110,
  baixo: 150,
  meta: 165,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const P = frente(p, [LM.ombroEsq, LM.ombroDir, LM.cotoveloEsq, LM.cotoveloDir, LM.punhoEsq, LM.punhoDir])
    if (!P) return null
    const largura = Math.abs(P(LM.ombroEsq).x - P(LM.ombroDir).x) || 1
    const esq = jointAngle(P(LM.ombroEsq), P(LM.cotoveloEsq), P(LM.punhoEsq))
    const dir = jointAngle(P(LM.ombroDir), P(LM.cotoveloDir), P(LM.punhoDir))
    return { angulo: (esq + dir) / 2, desnivel: (Math.abs(P(LM.punhoEsq).y - P(LM.punhoDir).y) / largura) * 100 }
  },
  avaliar(rep, quadros) {
    const statusTopo = grade(180 - rep.anguloMin, 15, 25)
    const desnivel = maior(pertoDoFundo(rep, quadros, 15, true), 'desnivel')
    const statusDesnivel = grade(desnivel, 12, 22)
    const embaixo = Math.min(...valores(quadros, 'angulo'))
    const statusDescida = grade(embaixo, 95, 105)
    return [
      achado('topo', 'Braços em cima', formatDeg(rep.anguloMin), statusTopo, 'Braços esticados em cima.', 'Subida curta. Estique os braços em cima, sem travar o cotovelo.', ['Desenvolvimento com halter leve (3x12)', 'Mobilidade de ombro com bastão (2x10)'], 'Estique os braços'),
      achado('simetria', 'Os dois braços juntos', pct(desnivel), statusDesnivel, 'Os dois braços sobem juntos.', 'Um braço subindo mais que o outro. Suba os dois por igual.', ['Desenvolvimento com um braço de cada vez (3x10 cada braço)'], 'Suba os dois juntos'),
      achado('descida', 'Descida', formatDeg(embaixo), statusDescida, 'Boa descida: halteres na altura das orelhas.', 'Descida curta. Desça até os halteres ficarem na altura das orelhas.', ['Desenvolvimento com halter leve, amplitude total (3x12)'], 'Desça mais'),
      ritmo(rep, VOLTA_DESCENDO),
    ]
  },
}

const ELEVACAO_LATERAL: Exercicio = {
  id: 'elevacao-lateral-frente',
  nome: 'Elevação lateral',
  grupo: 'Ombro',
  vista: 'De frente',
  dica: 'Celular de frente para você, na altura do peito, a uns 2 a 3 metros. Rosto, braços e quadril visíveis.',
  articulacao: 'Ombro',
  sobe: true,
  cima: 35,
  baixo: 65,
  meta: 85,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const P = frente(p, [LM.ombroEsq, LM.ombroDir, LM.cotoveloEsq, LM.cotoveloDir, LM.quadrilEsq, LM.quadrilDir])
    if (!P) return null
    const esq = jointAngle(P(LM.quadrilEsq), P(LM.ombroEsq), P(LM.cotoveloEsq))
    const dir = jointAngle(P(LM.quadrilDir), P(LM.ombroDir), P(LM.cotoveloDir))
    let pescoco = NaN
    if (vis(p.lm[LM.orelhaEsq]) >= VISIVEL && vis(p.lm[LM.orelhaDir]) >= VISIVEL) {
      const largura = Math.abs(P(LM.ombroEsq).x - P(LM.ombroDir).x) || 1
      pescoco = ((meio(P(LM.ombroEsq), P(LM.ombroDir)).y - meio(P(LM.orelhaEsq), P(LM.orelhaDir)).y) / largura) * 100
    }
    return { angulo: (esq + dir) / 2, diferenca: Math.abs(esq - dir), pescoco }
  },
  avaliar(rep, quadros) {
    const pico = rep.anguloMin
    const alto = pico > 105
    const statusAltura: Status = pico > 115 ? 'alerta' : alto || pico < 75 ? 'atencao' : 'ok'
    const p = valores(quadros, 'pescoco')
    const encolheu = p.length ? ((Math.max(...p) - Math.min(...p)) / (Math.max(...p) || 1)) * 100 : 0
    const statusTrap = grade(encolheu, 15, 25)
    const diferenca = maior(pertoDoFundo(rep, quadros, 10, true), 'diferenca')
    const statusDif = grade(diferenca, 10, 18)
    return [
      achado('altura', 'Altura dos braços', formatDeg(pico), statusAltura, 'Braços na altura dos ombros.', alto ? 'Braços acima da linha do ombro. Suba só até a altura dos ombros.' : 'Subida curta. Leve os braços até a altura dos ombros.', ['Elevação lateral com halter leve (3x12)'], alto ? 'Só até o ombro' : 'Suba mais'),
      achado('trapezio', 'Ombros baixos', pct(encolheu), statusTrap, 'Ombros baixos, sem encolher.', 'Ombros subindo junto: o trapézio está ajudando. Use menos peso e mantenha os ombros longe das orelhas.', ['Elevação lateral com halter leve (3x12)', 'Depressão de escápula na barra (3x10)'], 'Ombros para baixo'),
      achado('simetria', 'Os dois braços juntos', formatDeg(diferenca), statusDif, 'Os dois braços sobem juntos.', 'Um braço subindo mais que o outro. Suba os dois por igual.', ['Elevação lateral com um braço de cada vez (3x10 cada braço)'], 'Suba os dois juntos'),
      ritmo(rep, VOLTA_DESCENDO),
    ]
  },
}

// ---------- Bíceps e tríceps ----------

const ROSCA_DIRETA: Exercicio = {
  id: 'rosca-direta',
  nome: 'Rosca direta',
  grupo: 'Bíceps',
  vista: 'De lado',
  dica: 'Celular de lado para você, na altura do peito, a uns 2 metros. Do quadril à cabeça no quadro, braço do lado do celular.',
  articulacao: 'Cotovelo',
  cima: 150,
  baixo: 100,
  meta: 50,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'cotovelo', 'punho', 'quadril'])
    const k = pontos(p, lado, ['ombro', 'cotovelo', 'punho', 'quadril'])
    if (!k) return null
    return {
      angulo: jointAngle(k.ombro, k.cotovelo, k.punho),
      tronco: inclinacao(k.quadril, k.ombro),
      // Braço (ombro–cotovelo) saindo da vertical: cotovelo indo para frente.
      braco: desvioDaVertical(k.cotovelo, k.ombro),
    }
  },
  avaliar(rep, quadros) {
    const statusTopo = grade(rep.anguloMin, 65, 85)
    const esticado = maior(quadros, 'angulo')
    const statusEsticado = grade(180 - esticado, 18, 25)
    const balanco = variacao(quadros, 'tronco')
    const statusBalanco = grade(balanco, 8, 15)
    const braco = maior(quadros, 'braco')
    const statusBraco = grade(braco, 20, 32)
    return [
      achado('topo', 'Subida', formatDeg(rep.anguloMin), statusTopo, 'Subida completa: mão perto do ombro.', 'Subida curta. Leve a mão até perto do ombro.', ['Rosca com menos peso e amplitude total (3x12)', 'Rosca concentrada sentado (3x10)'], 'Suba até o fim'),
      achado('esticado', 'Braço esticado embaixo', formatDeg(esticado), statusEsticado, 'Braço quase todo esticado embaixo.', 'Descida curta. Desça até esticar o braço quase todo.', ['Rosca com pausa embaixo, braço esticado (3x10)'], 'Estique o braço'),
      achado('tronco', 'Corpo parado', formatDeg(balanco), statusBalanco, 'Corpo parado, só o braço trabalha.', 'Tronco balançando para ajudar a subir o peso. Use menos peso e mantenha o corpo parado.', ['Rosca encostado na parede (3x10)', 'Prancha frontal (3x30 s)'], 'Sem balançar o corpo'),
      achado('cotovelo', 'Cotovelo colado', formatDeg(braco), statusBraco, 'Cotovelo parado ao lado do corpo.', 'Cotovelo indo para frente. Mantenha o cotovelo colado ao lado do corpo.', ['Rosca encostado na parede (3x10)', 'Rosca Scott leve (3x10)'], 'Cotovelo colado'),
      ritmo(rep, VOLTA_DESCENDO),
    ]
  },
}

const TRICEPS_FRANCES: Exercicio = {
  id: 'triceps-frances',
  nome: 'Tríceps francês em pé',
  grupo: 'Tríceps',
  vista: 'De lado',
  dica: 'Celular de lado para você, na altura do peito, a uns 2 metros. Do quadril até as mãos em cima da cabeça no quadro.',
  articulacao: 'Cotovelo',
  cima: 150,
  baixo: 110,
  meta: 70,
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'cotovelo', 'punho', 'quadril'])
    const k = pontos(p, lado, ['ombro', 'cotovelo', 'punho', 'quadril'])
    if (!k) return null
    return {
      angulo: jointAngle(k.ombro, k.cotovelo, k.punho),
      tronco: inclinacao(k.quadril, k.ombro),
      // Braço (ombro–cotovelo) saindo da vertical para cima.
      braco: desvioDaVertical(k.ombro, k.cotovelo),
    }
  },
  avaliar(rep, quadros) {
    const braco = maior(quadros, 'braco')
    const statusBraco = grade(braco, 25, 40)
    const balanco = variacao(quadros, 'tronco')
    const statusBalanco = grade(balanco, 8, 15)
    return [
      profundidade(rep.anguloMin, [80, 100], { ok: 'Boa amplitude: peso desceu atrás da cabeça.', raso: 'Descida curta. Deixe o peso descer atrás da cabeça, até o cotovelo fechar bem.' }, ['Tríceps francês com halter leve, amplitude total (3x12)', 'Alongamento de tríceps (30 s cada braço)']),
      achado('cotovelo', 'Cotovelo apontando para cima', formatDeg(braco), statusBraco, 'Braço parado perto da cabeça.', 'Cotovelo indo para frente. Mantenha o braço perto da cabeça, com o cotovelo apontando para cima.', ['Mobilidade de ombro com bastão (2x10)', 'Tríceps francês sentado com encosto (3x10)'], 'Cotovelo para cima'),
      achado('tronco', 'Costas firmes', formatDeg(balanco), statusBalanco, 'Costas firmes, sem arquear.', 'Costas arqueando. Contraia o abdômen e o glúteo; se precisar, faça sentado com encosto.', AJUDA.corpo, 'Contraia o abdômen'),
      ritmo(rep),
    ]
  },
}

const MERGULHO_BANCO: Exercicio = {
  id: 'mergulho-banco',
  nome: 'Mergulho no banco',
  grupo: 'Tríceps',
  vista: 'De lado',
  dica: 'Celular de lado para você, na altura do banco, a uns 2 metros. Mãos no banco atrás do corpo, da cabeça aos pés no quadro.',
  articulacao: 'Cotovelo',
  cima: 150,
  baixo: 115,
  meta: 90,
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'cotovelo', 'punho', 'quadril'])
    const k = pontos(p, lado, ['ombro', 'cotovelo', 'punho', 'quadril'])
    if (!k) return null
    const tronco = Math.hypot(k.ombro.x - k.quadril.x, k.ombro.y - k.quadril.y) || 1
    // Distância do quadril até as mãos (no banco), em % do tronco.
    return { angulo: jointAngle(k.ombro, k.cotovelo, k.punho), afastamento: (Math.abs(k.quadril.x - k.punho.x) / tronco) * 100 }
  },
  avaliar(rep, quadros) {
    const fundo = rep.anguloMin
    const fundoDemais = fundo < 70
    const afastamento = maior(pertoDoFundo(rep, quadros), 'afastamento')
    const statusAfast = grade(afastamento, 40, 60)
    return [
      fundoDemais
        ? achado('profundidade', 'Profundidade', formatDeg(fundo), 'alerta', '', 'Desceu demais: força a frente do ombro. Pare com o cotovelo em 90°.', ['Mergulho com joelhos dobrados, até 90° (3x10)', 'Tríceps francês (3x12)'], 'Não desça tanto')
        : profundidade(fundo, [100, 115], { ok: 'Boa amplitude: cotovelo perto de 90°.', raso: 'Descida curta. Desça até o cotovelo fazer 90°.' }, ['Mergulho com joelhos dobrados (3x10)', 'Tríceps francês (3x12)']),
      achado('quadril', 'Quadril perto do banco', pct(afastamento), statusAfast, 'Costas perto do banco.', 'Quadril longe do banco. Desça com as costas quase raspando no banco.', ['Mergulho com joelhos dobrados (3x10)', 'Tríceps francês (3x12)'], 'Quadril perto do banco'),
      ritmo(rep),
    ]
  },
}

// ---------- Abdominal ----------

const ABDOMINAL_SUPRA: Exercicio = {
  id: 'abdominal-supra',
  nome: 'Abdominal supra',
  grupo: 'Abdominal',
  vista: 'De lado, deitado',
  dica: 'Celular no chão, de lado para você, a uns 2 metros. Deitado de barriga para cima, joelhos dobrados. Cabeça e quadril no quadro.',
  articulacao: 'Tronco',
  sobe: true,
  cima: 10,
  baixo: 20,
  meta: 30,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'quadril'])
    const k = pontos(p, lado, ['ombro', 'quadril'])
    if (!k) return null
    // Tronco subindo do chão: o celular no chão deixa o chão na horizontal da imagem.
    const angulo = deg(Math.atan2(k.quadril.y - k.ombro.y, Math.abs(k.ombro.x - k.quadril.x)))
    // Queixo indo para o peito: o pescoço sai da linha do tronco.
    const pescoco = vis(p.lm[lado.orelha]) >= VISIVEL ? 180 - jointAngle(k.quadril, k.ombro, k.orelha) : NaN
    return { angulo, pescoco }
  },
  avaliar(rep, quadros) {
    const statusAltura: Status = rep.anguloMin < 25 ? 'atencao' : 'ok'
    const p = valores(quadros, 'pescoco')
    const puxou = p.length ? Math.max(...p) - p[0] : 0
    const statusPescoco = grade(puxou, 15, 25)
    return [
      achado('altura', 'Altura da subida', formatDeg(rep.anguloMin), statusAltura, 'Boa subida: escápulas fora do chão.', 'Subida curta. Tire as escápulas do chão, subindo com o abdômen.', ['Abdominal com pausa de 1 s em cima (3x12)', 'Dead bug (3x10)'], 'Suba mais'),
      achado('pescoco', 'Pescoço solto', formatDeg(puxou), statusPescoco, 'Pescoço alinhado com o tronco.', 'Puxando o pescoço. Mantenha o queixo afastado do peito e suba com o abdômen.', ['Abdominal olhando para o teto, mãos cruzadas no peito (3x12)', 'Queixo para dentro, deitado (2x10)'], 'Solte o pescoço'),
      ritmo(rep, VOLTA_DESCENDO),
    ]
  },
}

const ELEVACAO_PERNAS: Exercicio = {
  id: 'elevacao-pernas',
  nome: 'Elevação de pernas deitado',
  grupo: 'Abdominal',
  vista: 'De lado, deitado',
  dica: 'Celular no chão, de lado para você, a uns 2 a 3 metros. Deitado de barriga para cima, pernas esticadas. Da cabeça aos pés no quadro.',
  articulacao: 'Quadril',
  cima: 160,
  baixo: 130,
  meta: 95,
  fases: ['Subindo', 'Descendo'],
  pico: 'no topo',
  medir(p) {
    const lado = ladoVisivel(p.lm, ['ombro', 'quadril', 'joelho', 'tornozelo'])
    const k = pontos(p, lado, ['ombro', 'quadril', 'joelho', 'tornozelo'])
    if (!k) return null
    return { angulo: jointAngle(k.ombro, k.quadril, k.tornozelo), joelho: jointAngle(k.quadril, k.joelho, k.tornozelo) }
  },
  avaliar(rep, quadros) {
    const dobra = 180 - Math.min(180, ...valores(quadros, 'joelho'))
    const statusJoelho = grade(dobra, 20, 35)
    return [
      profundidade(rep.anguloMin, [105, 120], { ok: 'Boa subida: pernas perto da vertical.', raso: 'Subida curta. Leve as pernas até ficarem quase na vertical.' }, ['Elevação de pernas com joelhos dobrados (3x12)', 'Alongamento de posteriores (30 s cada perna)'], 'Suba mais'),
      achado('joelhos', 'Pernas esticadas', formatDeg(dobra), statusJoelho, 'Pernas esticadas.', 'Joelhos dobrando. Mantenha as pernas esticadas; se não der, dobre um pouco e suba devagar.', ['Alongamento de posteriores (30 s cada perna)', 'Elevação de pernas com joelhos dobrados (3x12)'], 'Pernas esticadas'),
      ritmo(rep, { ...VOLTA_DESCENDO, verbo: 'Desça as pernas' }),
    ]
  },
}

// ---------- Corpo inteiro ----------

const POLICHINELO: Exercicio = {
  id: 'polichinelo',
  nome: 'Polichinelo',
  grupo: 'Corpo inteiro',
  vista: 'De frente',
  dica: 'Celular de frente para você, na altura do quadril, a uns 3 metros. Corpo inteiro no quadro, com as mãos lá em cima.',
  articulacao: 'Ombro',
  sobe: true,
  cima: 40,
  baixo: 120,
  meta: 160,
  fases: ['Abrindo', 'Fechando'],
  pico: 'em cima',
  medir(p) {
    const P = frente(p, [LM.ombroEsq, LM.ombroDir, LM.punhoEsq, LM.punhoDir, LM.quadrilEsq, LM.quadrilDir, LM.tornozeloEsq, LM.tornozeloDir])
    if (!P) return null
    const esq = jointAngle(P(LM.quadrilEsq), P(LM.ombroEsq), P(LM.punhoEsq))
    const dir = jointAngle(P(LM.quadrilDir), P(LM.ombroDir), P(LM.punhoDir))
    const quadril = Math.abs(P(LM.quadrilEsq).x - P(LM.quadrilDir).x) || 1
    return { angulo: (esq + dir) / 2, pernas: Math.abs(P(LM.tornozeloEsq).x - P(LM.tornozeloDir).x) / quadril }
  },
  avaliar(rep, quadros) {
    const statusBracos = grade(180 - rep.anguloMin, 30, 45)
    const pernas = maior(quadros, 'pernas')
    const statusPernas = grade(2 - pernas, 0.4, 0.7)
    return [
      achado('bracos', 'Braços em cima', formatDeg(rep.anguloMin), statusBracos, 'Mãos acima da cabeça.', 'Braços não chegaram em cima. Leve as mãos até acima da cabeça.', ['Polichinelo mais lento, só os braços (2x15)', 'Mobilidade de ombro com bastão (2x10)'], 'Braços em cima'),
      achado('pernas', 'Abertura das pernas', `${pernas.toFixed(1).replace('.', ',')}x o quadril`, statusPernas, 'Boa abertura das pernas.', 'Pernas abrindo pouco. Abra os pés além da largura dos ombros.', ['Polichinelo sem salto, um pé de cada vez (2x20)', 'Abdução de quadril deitado (3x15)'], 'Abra mais as pernas'),
    ]
  },
}

export const EXERCICIOS: Exercicio[] = [
  AGACHAMENTO_LATERAL,
  AGACHAMENTO_FRENTE,
  AFUNDO,
  PONTE,
  REMADA_CURVADA,
  ENCOLHIMENTO,
  DESENVOLVIMENTO,
  ELEVACAO_LATERAL,
  ROSCA_DIRETA,
  TRICEPS_FRANCES,
  MERGULHO_BANCO,
  ABDOMINAL_SUPRA,
  ELEVACAO_PERNAS,
  FLEXAO_LATERAL,
  POLICHINELO,
]

export const exercicioPorId = (id: ExercicioId) => EXERCICIOS.find((e) => e.id === id)!

/** Contador de repetições já ajustado para o exercício. */
export const contadorDe = (ex: Exercicio) => new ContadorReps(ex.cima, ex.baixo, { sobe: ex.sobe, relativo: ex.relativo })
