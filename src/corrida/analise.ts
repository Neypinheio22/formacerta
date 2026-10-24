import { computeScore, formatDeg, jointAngle } from '../pose/analysis'
import type { Point, Status } from '../pose/types'
import { recomendar, type RecomendacaoId } from './recomendacoes'
import type { AchadoCorrida, ConfigCorrida, Lado, QuadroCorrida, ResultadoCorrida } from './tipos'

type Px = { x: number; y: number }

// Pontos do MediaPipe Pose usados na corrida (inclui calcanhar e ponta do pé).
const NARIZ = 0
const ORELHAS = [7, 8]
const OMBROS = [11, 12]
type Perna = { quadril: number; joelho: number; tornozelo: number; calcanhar: number; ponta: number }
const PERNA_ESQ: Perna = { quadril: 23, joelho: 25, tornozelo: 27, calcanhar: 29, ponta: 31 }
const PERNA_DIR: Perna = { quadril: 24, joelho: 26, tornozelo: 28, calcanhar: 30, ponta: 32 }

/** Do quadril ao tornozelo, com a perna esticada, é cerca de 48% da altura. */
const PERNA_SOBRE_ALTURA = 0.48
/** Um passo dura de 0,24 s (250 passos/min) a 0,6 s (100 passos/min). */
const PASSO_MIN = 0.24
const PASSO_MAX = 0.6
/** Mínimo de passos para dar um resultado. */
const MIN_PASSOS = 4

const deg = (rad: number) => (rad * 180) / Math.PI
const sinal = (v: number) => (v < 0 ? -1 : 1)

function grade(value: number, atencao: number, alerta: number): Status {
  if (value >= alerta) return 'alerta'
  if (value >= atencao) return 'atencao'
  return 'ok'
}

export function mediana(v: number[]): number {
  if (v.length === 0) return NaN
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function percentil(v: number[], p: number) {
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

const cm = (v: number) => `${Math.round(v)} cm`

/** Lê os pontos em pixels. */
class Leitor {
  readonly w: number
  readonly h: number
  constructor(w: number, h: number) {
    this.w = w
    this.h = h
  }
  p(lm: Point[], i: number): Px {
    return { x: lm[i].x * this.w, y: lm[i].y * this.h }
  }
  meio(lm: Point[], [a, b]: number[]): Px {
    const pa = this.p(lm, a)
    const pb = this.p(lm, b)
    return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
  }
  /** Ponto mais baixo do pé (calcanhar ou ponta): é ele que encosta no chão. */
  pe(lm: Point[], perna: Perna): number {
    return Math.max(this.p(lm, perna.calcanhar).y, this.p(lm, perna.ponta).y)
  }
}

/** Completa os quadros sem pessoa ligando os vizinhos com uma reta. */
export function preencher(v: (number | null)[]): number[] {
  const r = [...v] as number[]
  const ok = v.flatMap((x, i) => (x == null ? [] : [i]))
  if (ok.length === 0) return v.map(() => 0)
  for (let i = 0; i < r.length; i++) {
    if (v[i] != null) continue
    const depois = ok.find((j) => j > i)
    const antes = [...ok].reverse().find((j) => j < i)
    if (antes == null) r[i] = v[depois!]!
    else if (depois == null) r[i] = v[antes]!
    else r[i] = v[antes]! + ((v[depois]! - v[antes]!) * (i - antes)) / (depois - antes)
  }
  return r
}

/** Tira a tendência lenta (celular acompanhando a pessoa, esteira acelerando), deixando só o sobe e desce dos passos. */
export function tirarTendencia(v: number[], janela: number): number[] {
  const meia = Math.max(1, Math.floor(janela / 2))
  return v.map((x, i) => {
    const ini = Math.max(0, i - meia)
    const fim = Math.min(v.length, i + meia + 1)
    let s = 0
    for (let j = ini; j < fim; j++) s += v[j]
    return x - s / (fim - ini)
  })
}

/**
 * Duração de um passo, em quadros, pela autocorrelação do sobe e desce da pelve.
 * A pelve desce uma vez a cada passo (no apoio) e sobe no voo.
 */
export function periodoDoPasso(x: number[], minLag: number, maxLag: number): number | null {
  const r: number[] = []
  // Olha até a passada completa (2 passos): de trás, a pelve às vezes marca mais a passada que o passo.
  const ate = Math.min(2 * maxLag + 2, Math.floor(x.length / 2))
  for (let lag = 0; lag <= ate; lag++) {
    let s = 0
    let a = 0
    let b = 0
    for (let i = 0; i + lag < x.length; i++) {
      s += x[i] * x[i + lag]
      a += x[i] * x[i]
      b += x[i + lag] * x[i + lag]
    }
    r.push(s / (Math.sqrt(a * b) || 1))
  }
  const picos: number[] = []
  for (let lag = Math.max(2, minLag); lag < ate; lag++) if (r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1] && r[lag] > 0.2) picos.push(lag)
  if (picos.length === 0) return null
  const maior = Math.max(...picos.map((l) => r[l]))
  const refinar = (lag: number) => {
    const a = r[lag - 1]
    const b = r[lag]
    const c = r[lag + 1]
    const ajuste = a - 2 * b + c ? (0.5 * (a - c)) / (a - 2 * b + c) : 0
    return lag + Math.max(-0.5, Math.min(0.5, ajuste))
  }
  // O primeiro pico forte dentro da faixa de um passo é o passo.
  const passo = picos.find((l) => l <= maxLag && r[l] >= 0.8 * maior)
  if (passo != null) return refinar(passo)
  // Senão o pico forte é a passada completa (uma perna pisa diferente da outra): o passo é a metade.
  const passada = picos.find((l) => r[l] === maior)!
  const metade = refinar(passada) / 2
  return metade >= minLag ? metade : null
}

/** Momentos de apoio: a pelve no ponto mais baixo de cada passo (maior y na imagem). */
export function momentosDeApoio(x: number[], periodo: number): number[] {
  const suave = x.map((_, i) => (x[Math.max(0, i - 1)] + x[i] + x[Math.min(x.length - 1, i + 1)]) / 3)
  const raio = Math.max(1, Math.floor(periodo * 0.4))
  const r: number[] = []
  for (let i = 0; i < suave.length; i++) {
    let maior = true
    for (let j = Math.max(0, i - raio); j <= Math.min(suave.length - 1, i + raio) && maior; j++) if (suave[j] > suave[i] || (suave[j] === suave[i] && j < i)) maior = false
    if (maior) r.push(i)
  }
  return r
}

type Base = {
  ler: Leitor
  quadros: QuadroCorrida[]
  /** Tempo real de cada quadro, já descontada a câmera lenta. */
  tReal: number[]
  apoios: number[]
  periodo: number
  cmPorPx: number
  pelve: number[]
}

/** Parte comum às duas vistas: escala em cm e os passos pelo sobe e desce da pelve. */
function prepararBase(quadros: QuadroCorrida[], w: number, h: number, config: ConfigCorrida): Base | string {
  const ler = new Leitor(w, h)
  const comPessoa = quadros.filter((q) => q.lm).length
  if (quadros.length < 10 || comPessoa < quadros.length * 0.6) return 'O corpo não apareceu inteiro na maior parte do vídeo. Enquadre da cabeça aos pés e grave de novo.'

  const pernas = quadros.flatMap((q) =>
    q.lm ? [PERNA_ESQ, PERNA_DIR].map((p) => Math.hypot(ler.p(q.lm!, p.quadril).x - ler.p(q.lm!, p.tornozelo).x, ler.p(q.lm!, p.quadril).y - ler.p(q.lm!, p.tornozelo).y)) : [],
  )
  const perna = percentil(pernas, 0.9)
  const cmPorPx = (config.altura * PERNA_SOBRE_ALTURA) / (perna || 1)

  const tReal = quadros.map((q) => q.t / config.fator)
  const dt = mediana(tReal.slice(1).map((t, i) => t - tReal[i])) || 1 / 30
  const pelveBruta = preencher(quadros.map((q) => (q.lm ? ler.meio(q.lm, [PERNA_ESQ.quadril, PERNA_DIR.quadril]).y : null)))
  const pelve = tirarTendencia(pelveBruta, Math.round(0.8 / dt))
  const periodo = periodoDoPasso(pelve, Math.ceil(PASSO_MIN / dt), Math.floor(PASSO_MAX / dt))
  if (periodo == null) return 'Não encontramos o ritmo da corrida. Grave pelo menos 10 segundos correndo, sem cortar o corpo.'
  const apoios = momentosDeApoio(pelve, periodo).filter((i) => quadros[i].lm)
  if (apoios.length < MIN_PASSOS) return 'Vídeo curto demais: precisamos de pelo menos 4 passos inteiros. Grave de 10 a 20 segundos.'
  return { ler, quadros, tReal, apoios, periodo, cmPorPx, pelve }
}

/** Passos por minuto pela duração do passo (mais firme que contar os apoios, que pode perder algum). */
function cadencia(b: Base): number {
  const dt = (b.tReal.at(-1)! - b.tReal[0]) / (b.tReal.length - 1)
  return 60 / (b.periodo * dt)
}

function achado(id: string, rec: RecomendacaoId | null, title: string, value: string, status: Status, detail: string, extra: Partial<AchadoCorrida> = {}): AchadoCorrida {
  const r = rec && status !== 'ok' ? recomendar(rec, extra.lado) : null
  return { id, title, value, status, detail, exercises: r?.exercises ?? [], musculos: r?.musculos, ...extra }
}

function achadoCadencia(spm: number): AchadoCorrida {
  const status: Status = spm < 150 ? 'alerta' : spm < 160 ? 'atencao' : 'ok'
  const alvo = Math.round((spm * 1.075) / 2) * 2
  return achado(
    'cadencia',
    'cadencia',
    'Cadência',
    `${Math.round(spm)} passos/min`,
    status,
    status === 'ok'
      ? 'Boa cadência: passos curtos e rápidos diminuem o impacto.'
      : `Passos longos e lentos aumentam o impacto em joelho e quadril. Tente chegar perto de ${alvo} passos/min aos poucos (5 a 10% por vez). A cadência ideal muda com a velocidade.`,
  )
}

function achadoOscilacao(osc: number, momento: number): AchadoCorrida {
  const status = grade(osc, 10, 12.5)
  return achado(
    'oscilacao',
    'oscilacao',
    'Sobe e desce do corpo',
    cm(osc),
    status,
    status === 'ok' ? 'O corpo sobe e desce pouco: a energia vai para frente.' : 'O corpo sobe muito a cada passo. É energia gasta para cima em vez de para frente, e mais impacto na descida.',
    { momento },
  )
}

/** Inclinação do segmento base→topo em relação à vertical, positiva para o lado `dir`. */
function inclinacao(base: Px, topo: Px, dir: number) {
  return deg(Math.atan2(dir * (topo.x - base.x), base.y - topo.y))
}

/** Para que lado a pessoa corre na imagem: 1 = direita, -1 = esquerda. */
function direcao(b: Base): number {
  let votos = 0
  for (const q of b.quadros) {
    if (!q.lm) continue
    const nariz = b.ler.p(q.lm, NARIZ)
    const orelhas = b.ler.meio(q.lm, ORELHAS)
    votos += sinal(nariz.x - orelhas.x)
    for (const p of [PERNA_ESQ, PERNA_DIR]) votos += sinal(b.ler.p(q.lm, p.ponta).x - b.ler.p(q.lm, p.calcanhar).x)
  }
  return sinal(votos)
}

type Contato = { i: number; tibia: number; joelho: number; pe: number; frente: number }

/**
 * Volta no tempo a partir do apoio até o primeiro quadro em que o pé de apoio
 * já estava no chão: é o contato inicial. O pé é seguido pela posição, porque
 * de lado o detector às vezes troca a perna esquerda pela direita.
 */
function acharContato(b: Base, apoio: number, limite: number, dir: number): Contato | null {
  const { ler, quadros } = b
  const lm = quadros[apoio].lm!
  let perna = ler.pe(lm, PERNA_ESQ) >= ler.pe(lm, PERNA_DIR) ? PERNA_ESQ : PERNA_DIR
  const chao = ler.pe(lm, perna)
  // Até 5 cm acima do chão ainda conta como apoiado (o detector treme um pouco).
  const tolerancia = 5 / b.cmPorPx
  let pos = ler.p(lm, perna.tornozelo)
  let ic = apoio
  let pernaIc = perna
  for (let i = apoio - 1; i > limite; i--) {
    const q = quadros[i].lm
    if (!q) break
    const dist = (p: Perna) => Math.hypot(ler.p(q, p.tornozelo).x - pos.x, ler.p(q, p.tornozelo).y - pos.y)
    perna = dist(PERNA_ESQ) <= dist(PERNA_DIR) ? PERNA_ESQ : PERNA_DIR
    pos = ler.p(q, perna.tornozelo)
    if (ler.pe(q, perna) < chao - tolerancia) break
    ic = i
    pernaIc = perna
  }
  const q = quadros[ic].lm!
  const quadril = ler.p(q, pernaIc.quadril)
  const joelho = ler.p(q, pernaIc.joelho)
  const tornozelo = ler.p(q, pernaIc.tornozelo)
  const calcanhar = ler.p(q, pernaIc.calcanhar)
  const ponta = ler.p(q, pernaIc.ponta)
  const pelve = ler.meio(q, [PERNA_ESQ.quadril, PERNA_DIR.quadril])
  return {
    i: ic,
    // Canela inclinada com o tornozelo à frente do joelho: o pé chegou na frente do corpo.
    tibia: inclinacao(tornozelo, joelho, -dir),
    joelho: 180 - jointAngle(quadril, joelho, tornozelo),
    // Positivo: ponta do pé mais alta que o calcanhar (pisada de calcanhar).
    pe: deg(Math.atan2(calcanhar.y - ponta.y, dir * (ponta.x - calcanhar.x))),
    frente: dir * (tornozelo.x - pelve.x) * b.cmPorPx,
  }
}

function piorContato(cs: Contato[], chave: keyof Contato) {
  return [...cs].sort((a, b) => b[chave] - a[chave])[0]
}

/** Vista de lado: cadência, pisada, passada à frente do corpo, joelho no contato, tronco e sobe e desce. */
export function analisarLado(b: Base): AchadoCorrida[] {
  const { quadros, apoios, ler } = b
  const t = (i: number) => quadros[i].t
  const dir = direcao(b)

  const contatos: Contato[] = []
  for (let k = 0; k < apoios.length; k++) {
    const limite = k > 0 ? apoios[k - 1] : Math.max(-1, apoios[k] - Math.round(b.periodo))
    const c = acharContato(b, apoios[k], limite, dir)
    if (c) contatos.push(c)
  }

  const tibia = mediana(contatos.map((c) => c.tibia))
  const joelho = mediana(contatos.map((c) => c.joelho))
  const pe = mediana(contatos.map((c) => c.pe))
  const frente = mediana(contatos.map((c) => c.frente))

  const troncos = quadros.flatMap((q) => (q.lm ? [inclinacao(ler.meio(q.lm, [PERNA_ESQ.quadril, PERNA_DIR.quadril]), ler.meio(q.lm, OMBROS), dir)] : []))
  const tronco = mediana(troncos)

  const amplitudes: number[] = []
  for (let k = 1; k < apoios.length; k++) {
    const trecho = b.pelve.slice(apoios[k - 1], apoios[k] + 1)
    amplitudes.push((b.pelve[apoios[k]] - Math.min(...trecho)) * b.cmPorPx)
  }
  const osc = mediana(amplitudes)

  const statusPassada = grade(tibia, 8, 14)
  const pisada = pe > 8 ? 'Calcanhar' : pe < -4 ? 'Antepé' : 'Meio do pé'
  // Pisar de calcanhar não é erro sozinho; vira ponto de atenção junto com o pé à frente do corpo.
  const statusPisada: Status = pisada === 'Calcanhar' && statusPassada !== 'ok' ? 'atencao' : 'ok'
  const statusJoelho: Status = joelho < 10 ? 'alerta' : joelho < 15 ? 'atencao' : 'ok'
  const statusTronco: Status = tronco < -4 || tronco > 22 ? 'alerta' : tronco < 0 || tronco > 16 ? 'atencao' : 'ok'
  const pior = (k: keyof Contato) => t(piorContato(contatos, k).i)

  return [
    achadoCadencia(cadencia(b)),
    achado(
      'passada',
      'overstriding',
      'Pé à frente do corpo',
      `canela ${formatDeg(tibia)} · pé ${cm(frente)} à frente`,
      statusPassada,
      statusPassada === 'ok'
        ? 'O pé toca o chão perto da linha do quadril, com a canela quase vertical.'
        : 'O pé toca o chão muito à frente do corpo (overstriding): a perna funciona como freio e o impacto sobe para joelho e quadril.',
      { momento: pior('tibia') },
    ),
    achado(
      'pisada',
      'pisada',
      'Pisada',
      pisada,
      statusPisada,
      statusPisada !== 'ok'
        ? 'Pisada de calcanhar com o pé longe do corpo. Não precisa forçar a pisada de antepé: encurtar o passo já traz o pé para baixo do quadril.'
        : pisada === 'Calcanhar'
          ? 'Pisada de calcanhar, mas com o pé perto do corpo: tudo bem, não precisa mudar.'
          : `Pisada de ${pisada.toLowerCase()}. Se mudou a pisada há pouco tempo, aumente o volume aos poucos para a panturrilha se adaptar.`,
      { momento: pior('pe') },
    ),
    achado(
      'joelho-contato',
      'joelhoContato',
      'Joelho no contato',
      `${formatDeg(joelho)} dobrado`,
      statusJoelho,
      statusJoelho === 'ok' ? 'Joelho levemente dobrado ao tocar o chão: ele amortece o impacto.' : 'Joelho quase esticado ao tocar o chão. O impacto passa direto para o joelho e o quadril.',
      { momento: t([...contatos].sort((a, c) => a.joelho - c.joelho)[0].i) },
    ),
    achado(
      'tronco',
      tronco < 0 ? 'troncoTras' : 'troncoFrente',
      'Inclinação do tronco',
      formatDeg(tronco),
      statusTronco,
      statusTronco === 'ok'
        ? 'Tronco levemente inclinado à frente, como deve ser.'
        : tronco < 0
          ? 'Tronco jogado para trás. Incline o corpo inteiro um pouco à frente, a partir do tornozelo.'
          : 'Tronco muito inclinado à frente, dobrando no quadril. Corra mais "alto", com o peito aberto.',
    ),
    achadoOscilacao(osc, t(apoios[Math.floor(apoios.length / 2)])),
  ]
}

type Apoio = { lado: Lado; valgo: number; queda: number; lateral: number; i: number }

/**
 * Vista de trás: joelho para dentro, queda da pelve e pé cruzando a linha do
 * meio, medidos no meio do apoio de cada passo e separados por perna.
 */
export function analisarTras(b: Base): AchadoCorrida[] {
  const { quadros, apoios, ler } = b
  // De costas, o lado esquerdo da pessoa fica à esquerda da imagem.
  const pernas = (lm: Point[]) => (ler.p(lm, PERNA_ESQ.quadril).x <= ler.p(lm, PERNA_DIR.quadril).x ? [PERNA_ESQ, PERNA_DIR] : [PERNA_DIR, PERNA_ESQ])
  const inclinacaoPelve = (lm: Point[]) => {
    const [e, d] = pernas(lm)
    const qe = ler.p(lm, e.quadril)
    const qd = ler.p(lm, d.quadril)
    // Positivo: quadril esquerdo mais baixo.
    return deg(Math.atan2(qe.y - qd.y, qd.x - qe.x))
  }
  // O celular pode estar um pouco torto: a referência é a média do vídeo todo.
  const nivel = mediana(quadros.flatMap((q) => (q.lm ? [inclinacaoPelve(q.lm)] : [])))
  const raio = Math.max(1, Math.round(b.periodo * 0.15))

  const medidas: Apoio[] = []
  for (const m of apoios) {
    const [e, d] = pernas(quadros[m].lm!)
    const ladoApoio: Lado = ler.pe(quadros[m].lm!, e) >= ler.pe(quadros[m].lm!, d) ? 'esquerdo' : 'direito'
    const v: Omit<Apoio, 'lado' | 'i'>[] = []
    for (let j = Math.max(0, m - raio); j <= Math.min(quadros.length - 1, m + raio); j++) {
      const lm = quadros[j].lm
      if (!lm) continue
      const [pe, pd] = pernas(lm)
      const [apoio, livre] = ladoApoio === 'esquerdo' ? [pe, pd] : [pd, pe]
      const quadril = ler.p(lm, apoio.quadril)
      const outro = ler.p(lm, livre.quadril)
      const joelho = ler.p(lm, apoio.joelho)
      const tornozelo = ler.p(lm, apoio.tornozelo)
      const medial = sinal(outro.x - quadril.x)
      const linha = quadril.x + ((tornozelo.x - quadril.x) * (joelho.y - quadril.y)) / (tornozelo.y - quadril.y || 1)
      const desvio = 180 - jointAngle(quadril, joelho, tornozelo)
      const meio = (quadril.x + outro.x) / 2
      const inc = inclinacaoPelve(lm) - nivel
      v.push({
        valgo: (joelho.x - linha) * medial >= 0 ? desvio : -desvio,
        // Apoiando na direita, quem cai é o quadril esquerdo, e vice-versa.
        queda: ladoApoio === 'direito' ? inc : -inc,
        lateral: (tornozelo.x - meio) * -medial * b.cmPorPx,
      })
    }
    if (v.length === 0) continue
    const media = (k: keyof (typeof v)[number]) => v.reduce((s, x) => s + x[k], 0) / v.length
    medidas.push({ lado: ladoApoio, i: m, valgo: media('valgo'), queda: media('queda'), lateral: media('lateral') })
  }

  const porLado = (lado: Lado, k: 'valgo' | 'queda' | 'lateral') => {
    const ms = medidas.filter((m) => m.lado === lado)
    return { lado, valor: mediana(ms.map((m) => m[k])), n: ms.length, momento: ms.length ? quadros[[...ms].sort((a, c) => (k === 'lateral' ? a[k] - c[k] : c[k] - a[k]))[0].i].t : undefined }
  }
  const ladoA = (k: 'valgo' | 'queda' | 'lateral', piorMaior: boolean) => {
    const ls = [porLado('esquerdo', k), porLado('direito', k)].filter((l) => l.n > 0)
    return ls.sort((a, c) => (piorMaior ? c.valor - a.valor : a.valor - c.valor))
  }

  const [valgo, valgoOutro] = ladoA('valgo', true)
  const statusValgo = grade(valgo.valor, 10, 15)
  const outroValgo = valgoOutro && grade(valgoOutro.valor, 10, 15) !== 'ok'

  const [queda] = ladoA('queda', true)
  const statusQueda = grade(queda.valor, 6, 9)
  const caiu: Lado = queda.lado === 'direito' ? 'esquerdo' : 'direito'

  const [lateral] = ladoA('lateral', false)
  const statusLateral: Status = lateral.valor < -1 ? 'alerta' : lateral.valor < 2 ? 'atencao' : 'ok'

  return [
    achadoCadencia(cadencia(b)),
    achado(
      'joelho-dentro',
      'joelhoDentro',
      'Joelho para dentro',
      `${formatDeg(Math.max(0, valgo.valor))} · ${valgo.lado}`,
      statusValgo,
      statusValgo === 'ok'
        ? 'Joelhos alinhados com o pé durante o apoio.'
        : `O joelho ${valgo.lado}${outroValgo ? ' (e também o outro)' : ''} vai para dentro quando o pé apoia. É sinal de glúteo fraco e sobrecarrega o joelho.`,
      { lado: statusValgo === 'ok' ? undefined : valgo.lado, momento: valgo.momento },
    ),
    achado(
      'pelve',
      'quedaPelve',
      'Queda da pelve',
      `${formatDeg(Math.max(0, queda.valor))} · apoio ${queda.lado}`,
      statusQueda,
      statusQueda === 'ok'
        ? 'Quadril nivelado durante o apoio.'
        : `Quando apoia a perna ${queda.lado}, o quadril ${caiu} cai. O glúteo médio ${queda.lado} não está segurando a pelve.`,
      { lado: statusQueda === 'ok' ? undefined : queda.lado, momento: queda.momento },
    ),
    achado(
      'cruzamento',
      'cruzamento',
      'Pés cruzando a linha do meio',
      lateral.valor < 0 ? `cruza ${cm(-lateral.valor)} · pé ${lateral.lado}` : `${cm(lateral.valor)} da linha · pé ${lateral.lado}`,
      statusLateral,
      statusLateral === 'ok'
        ? 'Cada pé pisa do seu lado da linha do corpo.'
        : statusLateral === 'alerta'
          ? `O pé ${lateral.lado} cruza a linha do meio do corpo, como se corresse numa corda bamba. Isso aumenta a carga na lateral da coxa e no joelho.`
          : `O pé ${lateral.lado} pisa quase em cima da linha do meio do corpo. Abra um pouco a passada.`,
      { momento: lateral.momento },
    ),
    achadoOscilacao(mediana(apoios.slice(1).map((m, k) => (b.pelve[m] - Math.min(...b.pelve.slice(apoios[k], m + 1))) * b.cmPorPx)), quadros[apoios[0]].t),
  ]
}

export function analisarCorrida(quadros: QuadroCorrida[], largura: number, alturaVideo: number, config: ConfigCorrida, video?: Blob): ResultadoCorrida {
  const base = prepararBase(quadros, largura, alturaVideo, config)
  const comum = { ...config, id: crypto.randomUUID(), date: new Date().toISOString(), duracao: quadros.at(-1)?.t ?? 0, largura, alturaVideo, quadros, video }
  if (typeof base === 'string') return { ...comum, apoios: [], passos: 0, achados: [], score: 0, falha: base }
  const achados = config.vista === 'lado' ? analisarLado(base) : analisarTras(base)
  return { ...comum, apoios: base.apoios.map((i) => quadros[i].t), passos: base.apoios.length, achados, score: computeScore(achados) }
}
