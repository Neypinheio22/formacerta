import { describe, expect, it } from 'vitest'
import { alinhar, diferencaRelogio } from './relogio'

describe('diferencaRelogio', () => {
  it('usa a amostra com a ida e volta mais curta', () => {
    // Controle está 5000 ms à frente. Primeira amostra teve atraso assimétrico.
    const d = diferencaRelogio([
      { enviado: 1000, controle: 6300, recebido: 1400 },
      { enviado: 2000, controle: 7020, recebido: 2040 },
    ])
    expect(d).toBe(5000)
  })

  it('sem amostras não ajusta nada', () => {
    expect(diferencaRelogio([])).toBe(0)
  })
})

describe('alinhar', () => {
  it('começa no último início e termina no primeiro fim', () => {
    const r = alinhar([
      { inicio: 10_000, duracao: 8000 },
      { inicio: 10_120, duracao: 7900 },
      { inicio: 10_050, duracao: 8100 },
    ])
    expect(r.desloca).toEqual([0.12, 0, 0.07])
    expect(r.duracao).toBeCloseTo(7.88)
  })

  it('lista vazia', () => {
    expect(alinhar([])).toEqual({ desloca: [], duracao: 0 })
  })
})
