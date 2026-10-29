import { describe, expect, it } from 'vitest'
import type { ResultadoNuvem } from '../nuvem/resultados'
import { SERIE_SUGERIDA } from '../treino/sugerida'
import { ajustarSerie, classificarGordura, classificarRce, gorduraDeurenberg, gorduraMarinha, medidasRecentes, meuCorpo, perfilTreino } from './corpo'

const base = { alturaCm: 165, idade: 30, sexo: 'feminino', peso: 68, gordura: null, circ: {} }

describe('meu corpo hoje', () => {
  it('gordura pela fórmula da Marinha (homem e mulher)', () => {
    expect(gorduraMarinha('masculino', 180, 90, 38)).toBeCloseTo(19.8, 0)
    expect(gorduraMarinha('feminino', 165, 75, 33, 100)).toBeCloseTo(29.4, 0)
    expect(gorduraMarinha('feminino', 165, 75, 33)).toBeNull()
  })

  it('gordura aproximada pelo IMC só para adultos', () => {
    expect(gorduraDeurenberg(25, 30, 'feminino')).toBe(31.5)
    expect(gorduraDeurenberg(25, 15, 'feminino')).toBeNull()
  })

  it('faixas de gordura e cintura/altura', () => {
    expect(classificarGordura(20, 'masculino')).toEqual({ status: 'ok', faixa: 'Na média' })
    expect(classificarGordura(27, 'masculino').status).toBe('atencao')
    expect(classificarGordura(40, 'feminino').status).toBe('alerta')
    expect(classificarRce(0.45).status).toBe('ok')
    expect(classificarRce(0.62).status).toBe('alerta')
  })

  it('sem fita: IMC e gordura aproximada; com fita: Marinha e cintura/altura', () => {
    const so = meuCorpo(base)
    expect(so.map((i) => i.id)).toEqual(['imc', 'gordura'])
    expect(so[1].como).toContain('Aproximada')
    const fita = meuCorpo({ ...base, circ: { cintura: 75, quadril: 100, pescoco: 33 } })
    expect(fita.map((i) => i.id)).toEqual(['imc', 'gordura', 'rce'])
    expect(fita[1].como).toContain('Marinha')
    expect(fita[2].valor).toBe(0.45)
  })

  it('gordura anotada vale mais que a estimada', () => {
    const g = meuCorpo({ ...base, gordura: 22 }).find((i) => i.id === 'gordura')!
    expect(g.valor).toBe(22)
  })

  it('sem altura ou peso não inventa número', () => {
    expect(meuCorpo({ ...base, peso: null, alturaCm: null })).toEqual([])
  })

  it('junta as medidas mais recentes de cada número', () => {
    const r = (feito_em: string, dados: object) => ({ tipo: 'medidas', feito_em, dados }) as unknown as ResultadoNuvem
    const m = medidasRecentes([r('2026-09-01T12:00:00Z', { peso: 80, circ: { pescoco: 38 } }), r('2026-10-01T12:00:00Z', { peso: 78, circ: { cintura: 90 } })])
    expect(m).toMatchObject({ peso: 78, circ: { cintura: 90, pescoco: 38 }, em: '2026-10-01T12:00:00Z' })
  })
})

describe('série sugerida pelo corpo e pelo objetivo', () => {
  it('peso alto: sem saltos e com cardio leve', () => {
    const p = perfilTreino(meuCorpo({ ...base, peso: 95 }), 'saude')
    expect(p.baixoImpacto).toBe(true)
    expect(p.cardio).toContain('leve')
    const [a] = ajustarSerie(SERIE_SUGERIDA, p)
    expect(a.exercicios[0].nome).toBe('Marcha no lugar')
    expect(a.exercicios.at(-1)!.nome).toBe('Cardio')
  })

  it('força: menos repetições; emagrecer: mais repetições e cardio', () => {
    const corpoOk = meuCorpo(base)
    const [forca] = ajustarSerie(SERIE_SUGERIDA, perfilTreino(corpoOk, 'forca'))
    expect(forca.exercicios[1]).toMatchObject({ nome: 'Agachamento', series: '4', reps: '6 a 8' })
    expect(forca.exercicios[2].reps).toBe('6 a 8 cada perna')
    const [emag] = ajustarSerie(SERIE_SUGERIDA, perfilTreino(corpoOk, 'emagrecer'))
    expect(emag.exercicios[1].reps).toBe('12 a 15')
    expect(emag.exercicios.at(-1)!.nome).toBe('Cardio')
    expect(emag.exercicios[0].nome).toBe('Polichinelo')
  })

  it('sem objetivo e corpo sem alerta: série igual', () => {
    expect(ajustarSerie(SERIE_SUGERIDA, perfilTreino(meuCorpo(base), ''))).toBe(SERIE_SUGERIDA)
  })
})
