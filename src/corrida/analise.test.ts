import { describe, expect, it } from 'vitest'
import type { Point } from '../pose/types'
import { analisarCorrida, periodoDoPasso, preencher } from './analise'
import type { ConfigCorrida, QuadroCorrida } from './tipos'

const W = 1000
const H = 1000
const PX_POR_CM = 4
const ALTURA = 170
const PERNA = ALTURA * 0.48 * PX_POR_CM

/** Gerador de números fixo, para o teste dar sempre o mesmo resultado. */
function aleatorio(semente = 7) {
  let s = semente
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1
}

type Corredor = {
  cadencia: number
  /** Pé à frente do quadril no contato, em cm. */
  frente?: number
  /** Sobe e desce da pelve, em cm. */
  oscilacao?: number
  /** Graus, positivo para frente. */
  tronco?: number
  /** Ângulo do pé no contato: positivo = ponta para cima (calcanhar). */
  pe?: number
  /** Vista de trás: graus de joelho para dentro e de queda da pelve na perna direita. */
  valgoDir?: number
  quedaDir?: number
  /** Distância do pé à linha do meio, em cm (negativo cruza). */
  lateral?: number
  fps?: number
  segundos?: number
  /** Troca esquerda e direita em alguns quadros, como o detector faz de lado. */
  trocas?: boolean
}

function joelhoIK(quadril: { x: number; y: number }, tornozelo: { x: number; y: number }, frente: number) {
  const L = PERNA / 2
  const dx = tornozelo.x - quadril.x
  const dy = tornozelo.y - quadril.y
  const D = Math.min(Math.hypot(dx, dy), 2 * L - 0.01)
  const h = Math.sqrt(L * L - (D / 2) ** 2)
  const mx = quadril.x + dx / 2
  const my = quadril.y + dy / 2
  // Perpendicular à linha quadril–tornozelo, para o lado `frente`.
  const nx = -dy / Math.hypot(dx, dy)
  const ny = dx / Math.hypot(dx, dy)
  const s = sinalDe(nx) === sinalDe(frente) ? 1 : -1
  return { x: mx + nx * h * s, y: my + ny * h * s }
}
const sinalDe = (v: number) => (v < 0 ? -1 : 1)

/** Corredor de lado, indo para a direita da imagem, na esteira. */
function correrDeLado(c: Corredor): QuadroCorrida[] {
  const fps = c.fps ?? 30
  const T = 60 / c.cadencia
  const S = 0.7 * T
  const d = (c.frente ?? 5) * PX_POR_CM
  const A = (c.oscilacao ?? 7) * PX_POR_CM
  const lean = ((c.tronco ?? 8) * Math.PI) / 180
  const alfa = ((c.pe ?? 0) * Math.PI) / 180
  const chao = 400 + 0.97 * PERNA
  const rnd = aleatorio()
  const quadros: QuadroCorrida[] = []
  for (let k = 0; k < (c.segundos ?? 12) * fps; k++) {
    const t = k / fps
    const quadril = { x: 500, y: 400 + (A / 2) * Math.cos((2 * Math.PI * t) / T) }
    const pt: Record<number, { x: number; y: number }> = {}
    for (const [perna, desloc] of [
      [0, 0],
      [1, T],
    ] as const) {
      // Fase dentro da passada (2 passos), com o meio do apoio em 0.
      let f = ((t - desloc) % (2 * T)) + 2 * T
      f = ((f + T) % (2 * T)) - T
      let ax: number
      let ay: number
      let a: number
      if (Math.abs(f) <= S / 2) {
        const s = (f + S / 2) / S
        ax = quadril.x + d - 2 * d * s
        ay = chao
        a = s < 0.25 ? alfa * (1 - s / 0.25) : 0
      } else {
        const s = (f > 0 ? f - S / 2 : f + 2 * T - S / 2) / (2 * T - S)
        ax = quadril.x - d + 2 * d * ((1 - Math.cos(Math.PI * s)) / 2)
        ay = chao - 60 * Math.sin(Math.PI * s)
        a = alfa
      }
      const tornozelo = { x: ax, y: ay }
      const joelho = joelhoIK(quadril, tornozelo, 1)
      const calcanhar = { x: ax - 15, y: ay + 32 }
      const ponta = { x: calcanhar.x + 100 * Math.cos(a), y: calcanhar.y - 100 * Math.sin(a) }
      const [q, j, tz, ca, po] = perna === 0 ? [23, 25, 27, 29, 31] : [24, 26, 28, 30, 32]
      Object.assign(pt, { [q]: quadril, [j]: joelho, [tz]: tornozelo, [ca]: calcanhar, [po]: ponta })
    }
    const ombro = { x: quadril.x + 160 * Math.sin(lean), y: quadril.y - 160 * Math.cos(lean) }
    Object.assign(pt, { 11: ombro, 12: ombro, 7: { x: ombro.x, y: ombro.y - 50 }, 8: { x: ombro.x, y: ombro.y - 50 }, 0: { x: ombro.x + 15, y: ombro.y - 48 } })
    quadros.push({ t, lm: montar(pt, rnd, c.trocas && k % 7 === 3) })
  }
  return quadros
}

/** Corredor visto de trás, na esteira. O lado esquerdo da pessoa fica à esquerda da imagem. */
function correrDeTras(c: Corredor): QuadroCorrida[] {
  const fps = c.fps ?? 30
  const T = 60 / c.cadencia
  const S = 0.7 * T
  const A = (c.oscilacao ?? 7) * PX_POR_CM
  const hw = 10 * PX_POR_CM
  const rnd = aleatorio(3)
  const quadros: QuadroCorrida[] = []
  for (let k = 0; k < (c.segundos ?? 12) * fps; k++) {
    const t = k / fps
    const y0 = 400 + (A / 2) * Math.cos((2 * Math.PI * t) / T)
    const pt: Record<number, { x: number; y: number }> = {}
    const hips = { esq: { x: 500 - hw, y: y0 }, dir: { x: 500 + hw, y: y0 } }
    const fases: { lado: 'esq' | 'dir'; f: number }[] = (['esq', 'dir'] as const).map((lado, n) => {
      let f = ((t - n * T) % (2 * T)) + 2 * T
      f = ((f + T) % (2 * T)) - T
      return { lado, f }
    })
    // Queda da pelve: apoiando na direita, o quadril esquerdo desce.
    for (const { lado, f } of fases) {
      if (lado === 'dir' && Math.abs(f) <= S / 2) {
        const sino = Math.cos((Math.PI * f) / S)
        hips.esq.y += Math.tan(((c.quedaDir ?? 0) * Math.PI) / 180) * 2 * hw * sino
      }
    }
    for (const { lado, f } of fases) {
      const lateral = (lado === 'dir' ? c.lateral ?? 6 : 6) * PX_POR_CM
      const lx = lado === 'esq' ? 500 - lateral : 500 + lateral
      const apoio = Math.abs(f) <= S / 2
      const quadril = hips[lado]
      const tornozelo = { x: lx, y: apoio ? 400 + 0.97 * PERNA : 400 + 0.97 * PERNA - 60 * Math.sin(Math.PI * ((f > 0 ? f - S / 2 : f + 2 * T - S / 2) / (2 * T - S))) }
      const D = Math.hypot(tornozelo.x - quadril.x, tornozelo.y - quadril.y)
      const valgo = lado === 'dir' && apoio ? (c.valgoDir ?? 2) * Math.cos((Math.PI * f) / S) : 2
      const medial = lado === 'esq' ? 1 : -1
      const s = (D / 2) * Math.tan(((valgo / 2) * Math.PI) / 180)
      const joelho = { x: (quadril.x + tornozelo.x) / 2 + medial * s, y: (quadril.y + tornozelo.y) / 2 }
      const calcanhar = { x: tornozelo.x, y: tornozelo.y + 32 }
      const [q, j, tz, ca, po] = lado === 'esq' ? [23, 25, 27, 29, 31] : [24, 26, 28, 30, 32]
      Object.assign(pt, { [q]: quadril, [j]: joelho, [tz]: tornozelo, [ca]: calcanhar, [po]: calcanhar })
    }
    Object.assign(pt, { 11: { x: 460, y: y0 - 160 }, 12: { x: 540, y: y0 - 160 }, 7: { x: 480, y: y0 - 220 }, 8: { x: 520, y: y0 - 220 }, 0: { x: 500, y: y0 - 215 } })
    quadros.push({ t, lm: montar(pt, rnd, false) })
  }
  return quadros
}

function montar(pt: Record<number, { x: number; y: number }>, rnd: () => number, trocar = false): Point[] {
  const lm: Point[] = Array.from({ length: 33 }, (_, i) => {
    const p = pt[i] ?? { x: 500, y: 300 }
    return { x: (p.x + rnd() * 1.5) / W, y: (p.y + rnd() * 1.5) / H, visibility: 0.9 }
  })
  if (trocar) for (const [a, b] of [[23, 24], [25, 26], [27, 28], [29, 30], [31, 32]]) [lm[a], lm[b]] = [lm[b], lm[a]]
  return lm
}

/**
 * Deixa o vídeo simulado parecido com um de verdade: detector tremendo,
 * celular na mão balançando, quadros sem pessoa e quadros em que o detector
 * pegou outra pessoa da academia.
 */
function comoVideoReal(quadros: QuadroCorrida[], semente = 11): QuadroCorrida[] {
  const rnd = aleatorio(semente)
  return quadros.map((q, i) => {
    if (!q.lm) return q
    const sorteio = (rnd() + 1) / 2
    if (sorteio < 0.08) return { ...q, lm: null }
    if (sorteio < 0.13) {
      // Outra pessoa, em outro canto da imagem.
      const dx = 0.3 + rnd() * 0.1
      return { ...q, lm: q.lm.map((p) => ({ ...p, x: p.x + dx, y: p.y + 0.05 })) }
    }
    const balanco = (25 * Math.sin(i / 20) + 10 * Math.sin(i / 7.3)) / H
    return { ...q, lm: q.lm.map((p) => ({ ...p, x: p.x + (rnd() * 5) / W, y: p.y + balanco + (rnd() * 5) / H })) }
  })
}

const LADO: ConfigCorrida = { vista: 'lado', local: 'esteira', fator: 1, altura: ALTURA }
const TRAS: ConfigCorrida = { ...LADO, vista: 'tras' }
const achado = (r: ReturnType<typeof analisarCorrida>, id: string) => r.achados.find((a) => a.id === id)!

describe('ferramentas', () => {
  it('completa quadros sem pessoa', () => {
    expect(preencher([null, 1, null, 3, null])).toEqual([1, 1, 2, 3, 3])
  })

  it('acha o período de uma onda', () => {
    const x = Array.from({ length: 200 }, (_, i) => Math.cos((2 * Math.PI * i) / 10.5))
    expect(periodoDoPasso(x, 7, 18)).toBeCloseTo(10.5, 0)
  })
})

describe('corrida de lado', () => {
  it('corredor com boa técnica', () => {
    const r = analisarCorrida(correrDeLado({ cadencia: 176, frente: 4, oscilacao: 7 }), W, H, LADO)
    expect(r.falha).toBeUndefined()
    expect(Number.parseInt(achado(r, 'cadencia').value)).toBeGreaterThanOrEqual(172)
    expect(Number.parseInt(achado(r, 'cadencia').value)).toBeLessThanOrEqual(180)
    for (const id of ['cadencia', 'passada', 'pisada', 'tronco', 'oscilacao']) expect(achado(r, id).status, id).toBe('ok')
    expect(Number.parseInt(achado(r, 'oscilacao').value)).toBeGreaterThanOrEqual(6)
    expect(Number.parseInt(achado(r, 'oscilacao').value)).toBeLessThanOrEqual(8)
  })

  it('passada longa, lenta, de calcanhar e saltitando', () => {
    const r = analisarCorrida(correrDeLado({ cadencia: 148, frente: 30, oscilacao: 14, pe: 18, tronco: -6 }), W, H, LADO)
    expect(achado(r, 'cadencia').status).toBe('alerta')
    expect(achado(r, 'passada').status).toBe('alerta')
    expect(achado(r, 'passada').musculos?.fortalecer).toContain('Glúteo máximo')
    expect(achado(r, 'pisada').value).toBe('Calcanhar')
    expect(achado(r, 'pisada').status).toBe('atencao')
    expect(achado(r, 'oscilacao').status).toBe('alerta')
    expect(achado(r, 'tronco').status).toBe('alerta')
    expect(achado(r, 'tronco').exercises.length).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(40)
  })

  it('pisada de calcanhar com o pé perto do corpo não é erro', () => {
    const r = analisarCorrida(correrDeLado({ cadencia: 172, frente: 3, pe: 15 }), W, H, LADO)
    expect(achado(r, 'pisada').value).toBe('Calcanhar')
    expect(achado(r, 'pisada').status).toBe('ok')
  })

  it('segue o pé mesmo quando o detector troca as pernas', () => {
    const r = analisarCorrida(correrDeLado({ cadencia: 148, frente: 30, trocas: true }), W, H, LADO)
    expect(achado(r, 'passada').status).toBe('alerta')
  })

  it('desconta a câmera lenta', () => {
    // 120 quadros por segundo tocados a 30: o vídeo fica 4 vezes mais longo.
    const q = correrDeLado({ cadencia: 170, fps: 120, segundos: 5 }).map((x) => ({ ...x, t: x.t * 4 }))
    const r = analisarCorrida(q, W, H, { ...LADO, fator: 4 })
    expect(Math.abs(Number.parseInt(achado(r, 'cadencia').value) - 170)).toBeLessThanOrEqual(4)
  })

  it('avisa quando o corpo não aparece', () => {
    const q = correrDeLado({ cadencia: 170 }).map((x, i) => (i % 3 ? { ...x, lm: null } : x))
    expect(analisarCorrida(q, W, H, LADO).falha).toMatch(/corpo/)
  })
})

describe('vídeo de verdade (simulado)', () => {
  it('de lado, com celular na mão, tremor e outra pessoa passando', () => {
    const r = analisarCorrida(comoVideoReal(correrDeLado({ cadencia: 168, frente: 25 })), W, H, LADO)
    expect(r.falha).toBeUndefined()
    expect(Math.abs(Number.parseInt(achado(r, 'cadencia').value) - 168)).toBeLessThanOrEqual(4)
    expect(achado(r, 'passada').status).not.toBe('ok')
  })

  it('de trás, com celular na mão, tremor e outra pessoa passando', () => {
    const r = analisarCorrida(comoVideoReal(correrDeTras({ cadencia: 176, valgoDir: 20 })), W, H, TRAS)
    expect(r.falha).toBeUndefined()
    expect(Math.abs(Number.parseInt(achado(r, 'cadencia').value) - 176)).toBeLessThanOrEqual(4)
    expect(achado(r, 'joelho-dentro').lado).toBe('direito')
  })

  it('percebe câmera lenta quando a pessoa esqueceu de marcar', () => {
    // Gravado a 120 qps e tocado a 30: o vídeo fica 4 vezes mais longo, mas foi marcado como normal.
    const q = correrDeLado({ cadencia: 172, fps: 120, segundos: 5 }).map((x) => ({ ...x, t: x.t * 4 }))
    const r = analisarCorrida(q, W, H, LADO)
    expect(r.falha).toBeUndefined()
    expect(r.fator).toBe(4)
    expect(r.aviso).toMatch(/câmera lenta/)
    expect(Math.abs(Number.parseInt(achado(r, 'cadencia').value) - 172)).toBeLessThanOrEqual(4)
  })
})

describe('corrida de trás', () => {
  it('corredor alinhado', () => {
    const r = analisarCorrida(correrDeTras({ cadencia: 174 }), W, H, TRAS)
    expect(r.falha).toBeUndefined()
    for (const id of ['joelho-dentro', 'pelve', 'cruzamento']) expect(achado(r, id).status, id).toBe('ok')
  })

  it('joelho direito para dentro, pelve caindo e pé cruzando', () => {
    const r = analisarCorrida(correrDeTras({ cadencia: 174, valgoDir: 20, quedaDir: 12, lateral: -4 }), W, H, TRAS)
    const joelho = achado(r, 'joelho-dentro')
    expect(joelho.status).toBe('alerta')
    expect(joelho.lado).toBe('direito')
    expect(joelho.musculos?.fortalecer).toContain('Glúteo médio (direito)')
    const pelve = achado(r, 'pelve')
    expect(pelve.status).toBe('alerta')
    expect(pelve.lado).toBe('direito')
    expect(pelve.detail).toMatch(/quadril esquerdo cai/)
    const cruz = achado(r, 'cruzamento')
    expect(cruz.status).toBe('alerta')
    expect(cruz.value).toMatch(/pé direito/)
  })
})
