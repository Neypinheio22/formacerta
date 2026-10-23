import { describe, expect, it } from 'vitest'
import { LM, type Point } from '../pose/types'
import { encontrarReps, resumir } from './analise'
import { ContadorReps } from './contador'
import { exercicioPorId, jointAngle3d } from './exercicios'
import type { Quadro } from './tipos'

const FPS = 15

/** Ângulo do joelho ao longo do tempo: cada rep desce de `topo` até `fundo` e volta, em `dur` segundos. */
function serie(reps: { fundo: number; dur: number }[], topo = 175, pausa = 1): { t: number; a: number }[] {
  const out: { t: number; a: number }[] = []
  let t = 0
  const parado = () => {
    for (let i = 0; i < pausa * FPS; i++, t += 1 / FPS) out.push({ t, a: topo + Math.sin(i) * 2 })
  }
  parado()
  for (const r of reps) {
    const n = Math.round(r.dur * FPS)
    for (let i = 0; i < n; i++, t += 1 / FPS) {
      const fase = (1 - Math.cos((2 * Math.PI * i) / n)) / 2
      out.push({ t, a: topo - (topo - r.fundo) * fase + Math.sin(i * 7) * 2 })
    }
    parado()
  }
  return out
}

function contar(s: { t: number; a: number }[], cima = 160, baixo = 140) {
  const c = new ContadorReps(cima, baixo)
  return s.map((q) => c.adicionar(q.t, q.a)).filter((r) => r !== null)
}

describe('contador de repetições', () => {
  it('conta cada descida e subida completa', () => {
    const reps = contar(serie([{ fundo: 90, dur: 2 }, { fundo: 95, dur: 2.5 }, { fundo: 85, dur: 2 }]))
    expect(reps).toHaveLength(3)
    expect(reps[0].anguloMin).toBeLessThan(100)
    expect(reps[0].fundo).toBeGreaterThan(reps[0].inicio)
    expect(reps[0].fim).toBeGreaterThan(reps[0].fundo)
  })

  it('ignora balanço pequeno que não chega ao mínimo', () => {
    expect(contar(serie([{ fundo: 150, dur: 1.5 }, { fundo: 90, dur: 2 }]))).toHaveLength(1)
  })

  it('não conta quando o vídeo começa no meio do movimento', () => {
    const s = serie([{ fundo: 90, dur: 2 }]).filter((q) => q.t > 1.5)
    expect(contar(s)).toHaveLength(0)
  })

  it('ignora quadros sem pessoa', () => {
    const c = new ContadorReps(160, 140)
    const s = serie([{ fundo: 90, dur: 2 }])
    const reps = s.map((q, i) => c.adicionar(q.t, i % 4 === 0 ? null : q.a)).filter(Boolean)
    expect(reps).toHaveLength(1)
  })
})

// Pessoa de lado olhando para a direita, numa imagem 1000x1000.
function ladoAgachando(joelho: number, tronco: number): Point[] {
  const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }))
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
  const rad = (d: number) => (d * Math.PI) / 180
  const tornozelo = { x: 0.5, y: 0.9 }
  // Canela inclinada para frente; coxa fecha o ângulo `joelho` com a canela.
  const canela = rad(20)
  const j = { x: tornozelo.x + Math.sin(canela) * 0.22, y: tornozelo.y - Math.cos(canela) * 0.22 }
  // Gira a direção joelho→tornozelo pelo ângulo do joelho, levando o quadril para trás.
  const u = { x: tornozelo.x - j.x, y: tornozelo.y - j.y }
  const g = -rad(joelho)
  const q = { x: j.x + u.x * Math.cos(g) - u.y * Math.sin(g), y: j.y + u.x * Math.sin(g) + u.y * Math.cos(g) }
  const o = { x: q.x + Math.sin(rad(tronco)) * 0.3, y: q.y - Math.cos(rad(tronco)) * 0.3 }
  set(LM.tornozeloDir, tornozelo.x, tornozelo.y)
  set(LM.joelhoDir, j.x, j.y)
  set(LM.quadrilDir, q.x, q.y)
  set(LM.ombroDir, o.x, o.y)
  return lm
}

describe('agachamento de lado', () => {
  const ex = exercicioPorId('agachamento-lateral')

  it('mede o joelho e o tronco no quadro', () => {
    const m = ex.medir({ lm: ladoAgachando(100, 30), mundo: null, w: 1000, h: 1000 })!
    expect(m.angulo).toBeCloseTo(100, 0)
    expect(m.tronco).toBeCloseTo(30, 0)
  })

  it('sem o corpo visível não mede', () => {
    const lm = ladoAgachando(100, 30)
    lm[LM.tornozeloDir] = { ...lm[LM.tornozeloDir], visibility: 0.1 }
    expect(ex.medir({ lm, mundo: null, w: 1000, h: 1000 })).toBeNull()
  })

  function video(reps: { fundo: number; tronco: number }[]): Quadro[] {
    return serie(reps.map((r) => ({ fundo: r.fundo, dur: 2.4 }))).map(({ t, a }) => {
      const r = reps[Math.min(reps.length - 1, Math.floor((t - 1) / 3.4))] ?? reps[0]
      const tronco = 10 + ((175 - a) / (175 - r.fundo)) * (r.tronco - 10)
      const lm = ladoAgachando(a, tronco)
      return { t, lm, medidas: ex.medir({ lm, mundo: null, w: 1000, h: 1000 }) }
    })
  }

  it('avalia cada repetição: boa, rasa e com tronco caindo', () => {
    const reps = encontrarReps(ex, video([{ fundo: 90, tronco: 35 }, { fundo: 130, tronco: 35 }, { fundo: 90, tronco: 62 }]))
    expect(reps.map((r) => r.n)).toEqual([1, 2, 3])
    const achado = (i: number, id: string) => reps[i].achados.find((a) => a.id === id)!
    expect(achado(0, 'profundidade').status).toBe('ok')
    expect(achado(0, 'tronco').status).toBe('ok')
    expect(achado(1, 'profundidade').status).toBe('alerta')
    expect(achado(2, 'tronco').status).toBe('alerta')
    expect(reps[0].status).toBe('ok')
  })

  it('resume quantas repetições tiveram cada problema', () => {
    const reps = encontrarReps(ex, video([{ fundo: 90, tronco: 35 }, { fundo: 130, tronco: 35 }, { fundo: 130, tronco: 35 }]))
    const prof = resumir(reps).find((r) => r.id === 'profundidade')!
    expect(prof.repsComProblema).toBe(2)
    expect(prof.status).toBe('alerta')
    expect(prof.exercises.length).toBeGreaterThan(0)
  })
})

describe('agachamento de frente', () => {
  const ex = exercicioPorId('agachamento-frente')

  function frente(joelhoX: number): Point[] {
    const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }))
    const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
    set(LM.quadrilEsq, 0.58, 0.6)
    set(LM.quadrilDir, 0.42, 0.6)
    set(LM.joelhoEsq, 0.5 + joelhoX, 0.72)
    set(LM.joelhoDir, 0.5 - joelhoX, 0.72)
    set(LM.tornozeloEsq, 0.6, 0.9)
    set(LM.tornozeloDir, 0.4, 0.9)
    return lm
  }

  it('percebe joelhos indo para dentro', () => {
    const certo = ex.medir({ lm: frente(0.1), mundo: null, w: 1000, h: 1000 })!
    const dentro = ex.medir({ lm: frente(0.06), mundo: null, w: 1000, h: 1000 })!
    expect(certo.joelhos).toBeCloseTo(1, 1)
    expect(dentro.joelhos).toBeLessThan(0.7)
  })

  it('usa o ângulo em 3D quando disponível', () => {
    expect(jointAngle3d({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 1 })).toBeCloseTo(90)
  })
})
