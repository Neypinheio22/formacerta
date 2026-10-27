import { describe, expect, it } from 'vitest'
import { LM, type Point } from '../pose/types'
import { encontrarReps } from './analise'
import { ContadorReps } from './contador'
import { EXERCICIOS, GRUPOS, exercicioPorId } from './exercicios'
import type { Quadro } from './tipos'

const FPS = 15
const rad = (d: number) => (d * Math.PI) / 180

/** Valor indo de `de` até `ate` e voltando, `n` vezes, com pausa entre as repetições. */
function serie(de: number, ate: number, n: number, dur = 2, pausa = 1): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = []
  let t = 0
  const parado = () => {
    for (let i = 0; i < pausa * FPS; i++, t += 1 / FPS) out.push({ t, v: de })
  }
  parado()
  for (let r = 0; r < n; r++) {
    const q = Math.round(dur * FPS)
    for (let i = 0; i < q; i++, t += 1 / FPS) out.push({ t, v: de + (ate - de) * ((1 - Math.cos((2 * Math.PI * i) / q)) / 2) })
    parado()
  }
  return out
}

function vazio(): Point[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }))
}

describe('lista de exercícios', () => {
  it('tem 15 exercícios, todos os grupos e ids únicos', () => {
    expect(EXERCICIOS).toHaveLength(15)
    expect(new Set(EXERCICIOS.map((e) => e.id)).size).toBe(15)
    for (const g of GRUPOS) expect(EXERCICIOS.some((e) => e.grupo === g)).toBe(true)
  })

  it('limites de contagem no sentido certo', () => {
    for (const e of EXERCICIOS) {
      if (e.sobe) expect(e.cima, e.id).toBeLessThan(e.baixo)
      else expect(e.cima, e.id).toBeGreaterThan(e.baixo)
    }
  })

  it('sem corpo na imagem, nenhum exercício mede', () => {
    for (const e of EXERCICIOS) expect(e.medir({ lm: vazio(), mundo: null, w: 1000, h: 1000 }), e.id).toBeNull()
  })
})

describe('contador nos exercícios que sobem', () => {
  it('conta o ângulo subindo e devolve o pico', () => {
    const c = new ContadorReps(35, 65, { sobe: true })
    const reps = serie(15, 90, 3).map((q) => c.adicionar(q.t, q.v)).filter((r) => r !== null)
    expect(reps).toHaveLength(3)
    expect(reps[0].anguloMin).toBeGreaterThan(80)
  })

  it('não conta subida que não chega ao mínimo', () => {
    const c = new ContadorReps(35, 65, { sobe: true })
    expect(serie(15, 55, 2).map((q) => c.adicionar(q.t, q.v)).filter(Boolean)).toHaveLength(0)
  })

  it('no modo relativo conta pela mudança, qualquer que seja a medida de partida', () => {
    for (const base of [40, 70]) {
      const c = new ContadorReps(96, 90, { relativo: true })
      const reps = serie(base, base * 0.8, 3).map((q) => c.adicionar(q.t, q.v)).filter((r) => r !== null)
      expect(reps).toHaveLength(3)
      expect(reps[0].anguloMin).toBeCloseTo(base * 0.8, 0)
    }
  })
})

// Pessoa de lado, braço do lado da câmera, numa imagem 1000x1000.
function ladoRosca(cotovelo: number, bracoFrente: number): Point[] {
  const lm = vazio()
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
  const ombro = { x: 0.5, y: 0.35 }
  const c = { x: ombro.x + Math.sin(rad(bracoFrente)) * 0.15, y: ombro.y + Math.cos(rad(bracoFrente)) * 0.15 }
  // Antebraço sobe para frente, fechando o ângulo do cotovelo.
  const g = rad(180 - cotovelo + bracoFrente)
  set(LM.ombroDir, ombro.x, ombro.y)
  set(LM.cotoveloDir, c.x, c.y)
  set(LM.punhoDir, c.x + Math.sin(g) * 0.14, c.y + Math.cos(g) * 0.14)
  set(LM.quadrilDir, 0.5, 0.65)
  return lm
}

describe('rosca direta', () => {
  const ex = exercicioPorId('rosca-direta')
  const video = (bracoFrente: number): Quadro[] =>
    serie(170, 45, 3).map(({ t, v }) => {
      const lm = ladoRosca(v, bracoFrente * ((170 - v) / 125))
      return { t, lm, medidas: ex.medir({ lm, mundo: null, w: 1000, h: 1000 }) }
    })

  it('mede o cotovelo', () => {
    expect(ex.medir({ lm: ladoRosca(90, 0), mundo: null, w: 1000, h: 1000 })!.angulo).toBeCloseTo(90, 0)
  })

  it('conta as repetições e aprova o cotovelo parado', () => {
    const reps = encontrarReps(ex, video(0))
    expect(reps).toHaveLength(3)
    expect(reps[0].achados.find((a) => a.id === 'cotovelo')!.status).toBe('ok')
    expect(reps[0].achados.find((a) => a.id === 'topo')!.status).toBe('ok')
  })

  it('aponta o cotovelo indo para frente', () => {
    const reps = encontrarReps(ex, video(40))
    expect(reps).toHaveLength(3)
    expect(reps[0].achados.find((a) => a.id === 'cotovelo')!.status).toBe('alerta')
  })
})

describe('elevação pélvica', () => {
  const ex = exercicioPorId('ponte-lateral')
  // Deitado: ombro à esquerda no chão, joelho dobrado à direita e acima.
  function ponte(alturaQuadril: number): Point[] {
    const lm = vazio()
    const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
    set(LM.ombroDir, 0.2, 0.8)
    set(LM.joelhoDir, 0.7, 0.6)
    set(LM.quadrilDir, 0.45, 0.8 - alturaQuadril)
    return lm
  }
  const medir = (h: number) => ex.medir({ lm: ponte(h), mundo: null, w: 1000, h: 1000 })!.angulo

  it('quadril no chão fica abaixo de 180°, alinhado perto de 180° e arqueado passa de 180°', () => {
    expect(medir(0)).toBeLessThan(165)
    expect(medir(0.1)).toBeCloseTo(180, -1)
    expect(medir(0.2)).toBeGreaterThan(195)
  })
})

describe('polichinelo', () => {
  const ex = exercicioPorId('polichinelo')
  function frente(bracos: number, abertura: number): Point[] {
    const lm = vazio()
    const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
    set(LM.ombroEsq, 0.56, 0.3)
    set(LM.ombroDir, 0.44, 0.3)
    set(LM.quadrilEsq, 0.54, 0.55)
    set(LM.quadrilDir, 0.46, 0.55)
    set(LM.punhoEsq, 0.56 + Math.sin(rad(bracos)) * 0.25, 0.3 + Math.cos(rad(bracos)) * 0.25)
    set(LM.punhoDir, 0.44 - Math.sin(rad(bracos)) * 0.25, 0.3 + Math.cos(rad(bracos)) * 0.25)
    set(LM.tornozeloEsq, 0.5 + abertura, 0.9)
    set(LM.tornozeloDir, 0.5 - abertura, 0.9)
    return lm
  }
  const video = (ate: number, abre: number): Quadro[] =>
    serie(10, ate, 3, 1).map(({ t, v }) => {
      const lm = frente(v, 0.04 + ((v - 10) / (ate - 10)) * abre)
      return { t, lm, medidas: ex.medir({ lm, mundo: null, w: 1000, h: 1000 }) }
    })

  it('conta e aprova braços em cima com pernas abertas', () => {
    const reps = encontrarReps(ex, video(170, 0.1))
    expect(reps).toHaveLength(3)
    expect(reps[0].status).toBe('ok')
  })

  it('aponta braços baixos e pernas pouco abertas', () => {
    const reps = encontrarReps(ex, video(130, 0.01))
    expect(reps).toHaveLength(3)
    expect(reps[0].achados.find((a) => a.id === 'bracos')!.status).not.toBe('ok')
    expect(reps[0].achados.find((a) => a.id === 'pernas')!.status).toBe('alerta')
  })
})

describe('encolhimento', () => {
  const ex = exercicioPorId('encolhimento-frente')
  function frente(subida: number, pescoco: number): Point[] {
    const lm = vazio()
    const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.99 })
    set(LM.orelhaEsq, 0.52, 0.2)
    set(LM.orelhaDir, 0.48, 0.2)
    set(LM.ombroEsq, 0.6, 0.2 + pescoco - subida)
    set(LM.ombroDir, 0.4, 0.2 + pescoco - subida)
    return lm
  }

  it('conta pela subida dos ombros, com pescoço curto ou longo', () => {
    for (const pescoco of [0.08, 0.12]) {
      const quadros: Quadro[] = serie(0, pescoco * 0.3, 3).map(({ t, v }) => {
        const lm = frente(v, pescoco)
        return { t, lm, medidas: ex.medir({ lm, mundo: null, w: 1000, h: 1000 }) }
      })
      const reps = encontrarReps(ex, quadros)
      expect(reps).toHaveLength(3)
      expect(reps[0].achados.find((a) => a.id === 'subida')!.status).toBe('ok')
    }
  })
})
