import { describe, expect, it } from 'vitest'
import { analyzeFrontBack, analyzeSide, bodyVisible, computeScore, jointAngle, tiltFromHorizontal } from './analysis'
import { LM, type Point } from './types'

// Pessoa de frente numa imagem quadrada 1000x1000, coordenadas normalizadas.
// De frente, o lado esquerdo da pessoa fica à direita da foto (x maior).
function standingFront(over: Partial<Record<number, Point>> = {}): Point[] {
  const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }))
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
  set(LM.nariz, 0.5, 0.12)
  set(LM.orelhaEsq, 0.54, 0.11)
  set(LM.orelhaDir, 0.46, 0.11)
  set(LM.ombroEsq, 0.6, 0.25)
  set(LM.ombroDir, 0.4, 0.25)
  set(LM.quadrilEsq, 0.56, 0.52)
  set(LM.quadrilDir, 0.44, 0.52)
  set(LM.joelhoEsq, 0.56, 0.72)
  set(LM.joelhoDir, 0.44, 0.72)
  set(LM.tornozeloEsq, 0.56, 0.92)
  set(LM.tornozeloDir, 0.44, 0.92)
  for (const [i, p] of Object.entries(over)) lm[Number(i)] = p!
  return lm
}

const byId = (fs: ReturnType<typeof analyzeFrontBack>, id: string) => fs.find((f) => f.id === id)!

describe('geometria', () => {
  it('mede inclinação em relação à horizontal', () => {
    expect(tiltFromHorizontal({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0)
    expect(tiltFromHorizontal({ x: 0, y: 0 }, { x: 10, y: 10 })).toBeCloseTo(45)
  })

  it('mede ângulo da articulação', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180)
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90)
  })
})

describe('frente', () => {
  it('postura alinhada não gera alertas', () => {
    const fs = analyzeFrontBack('frente', standingFront(), 1000, 1000)
    expect(fs.every((f) => f.status === 'ok')).toBe(true)
    expect(computeScore(fs)).toBe(100)
  })

  it('detecta ombro esquerdo mais alto', () => {
    const fs = analyzeFrontBack('frente', standingFront({ [LM.ombroEsq]: { x: 0.6, y: 0.22, visibility: 1 } }), 1000, 1000)
    const ombros = byId(fs, 'ombros-frente')
    expect(ombros.status).toBe('alerta')
    expect(ombros.detail).toContain('esquerdo mais alto')
  })

  it('detecta joelho direito para dentro', () => {
    // Joelho direito (lado esquerdo da foto) indo em direção ao centro.
    const fs = analyzeFrontBack('frente', standingFront({ [LM.joelhoDir]: { x: 0.48, y: 0.72, visibility: 1 } }), 1000, 1000)
    const joelho = byId(fs, 'joelho-direito-frente')
    expect(joelho.status).not.toBe('ok')
    expect(joelho.detail).toContain('para dentro')
  })

  it('de costas, o lado esquerdo da pessoa fica à esquerda da foto', () => {
    // Mesmo desenho da foto: o ombro à direita da foto mais alto agora é o direito.
    const fs = analyzeFrontBack('costas', standingFront({ [LM.ombroEsq]: { x: 0.6, y: 0.22, visibility: 1 } }), 1000, 1000)
    expect(byId(fs, 'ombros-costas').detail).toContain('direito mais alto')
  })
})

describe('lateral', () => {
  // Pessoa de lado olhando para a direita da foto, lado direito visível.
  function standingSide(orelhaX: number, joelhoX = 0.5): Point[] {
    const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }))
    const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
    set(LM.nariz, orelhaX + 0.05, 0.12)
    set(LM.orelhaDir, orelhaX, 0.11)
    set(LM.ombroDir, 0.5, 0.25)
    set(LM.quadrilDir, 0.5, 0.52)
    set(LM.joelhoDir, joelhoX, 0.72)
    set(LM.tornozeloDir, 0.5, 0.92)
    return lm
  }

  it('postura neutra', () => {
    const fs = analyzeSide('lateral-direita', standingSide(0.51), 1000, 1000)
    expect(fs.every((f) => f.status === 'ok')).toBe(true)
  })

  it('detecta cabeça projetada para frente', () => {
    const fs = analyzeSide('lateral-direita', standingSide(0.58), 1000, 1000)
    expect(fs.find((f) => f.id === 'cabeca-lateral-direita')!.status).toBe('alerta')
  })

  it('detecta joelho hiperestendido', () => {
    const fs = analyzeSide('lateral-direita', standingSide(0.51, 0.47), 1000, 1000)
    const joelho = fs.find((f) => f.id === 'joelho-lateral-direita')!
    expect(joelho.status).not.toBe('ok')
    expect(joelho.detail).toContain('hiperestendidos')
  })
})

describe('corpo visível', () => {
  it('rejeita foto com tornozelo fora do quadro', () => {
    expect(bodyVisible('frente', standingFront())).toBe(true)
    expect(bodyVisible('frente', standingFront({ [LM.tornozeloEsq]: { x: 0.56, y: 1.05, visibility: 0.3 } }))).toBe(false)
  })
})

describe('nota', () => {
  it('desconta mais para "corrigir" do que para "atenção"', () => {
    const f = (status: 'ok' | 'atencao' | 'alerta') => ({ id: status, title: '', value: '', status, detail: '', exercises: [] })
    expect(computeScore([f('ok'), f('ok')])).toBe(100)
    expect(computeScore([f('ok'), f('atencao')])).toBe(80)
    expect(computeScore([f('ok'), f('alerta')])).toBe(50)
  })
})
