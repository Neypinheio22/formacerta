import { describe, expect, it } from 'vitest'
import type { ResultadoNuvem } from '../nuvem/resultados'
import { evolucao, leituras, placar, sentidoCorpo, variacao, type Contexto } from './evolucao'

const ctx: Contexto = { objetivo: 'emagrecer', altura: 170, idade: 40, sexo: 'feminino' }

let n = 0
const res = (tipo: ResultadoNuvem['tipo'], feito_em: string, dados: Record<string, unknown>): ResultadoNuvem => ({
  id: `r${++n}`,
  tipo,
  feito_em,
  apelido: '',
  aluno_id: null,
  ficha_id: 'f1',
  enviado_por: 'p1',
  idade: null,
  sexo: null,
  altura_cm: null,
  dados,
})

describe('variacao', () => {
  it('diz se melhorou ou piorou pelo lado bom do número', () => {
    expect(variacao(80, 72.5, 1, 'menor')).toEqual({ diferenca: -7.5, tendencia: 'melhorou' })
    expect(variacao(10, 14, 0, 'menor')).toEqual({ diferenca: 4, tendencia: 'piorou' })
    expect(variacao(10, 14, 0, 'maior').tendencia).toBe('melhorou')
    expect(variacao(10, 10.04, 1, 'maior').tendencia).toBe('manteve')
    expect(variacao(30, 32, 0, null).tendencia).toBe('subiu')
  })
})

describe('sentidoCorpo', () => {
  it('peso e braço dependem do objetivo; cintura menor é sempre melhor', () => {
    expect(sentidoCorpo('peso', 'emagrecer')).toBe('menor')
    expect(sentidoCorpo('peso', 'massa')).toBe('maior')
    expect(sentidoCorpo('peso', 'saude')).toBeNull()
    expect(sentidoCorpo('bracoD', 'massa')).toBe('maior')
    expect(sentidoCorpo('cintura', 'massa')).toBe('menor')
  })
})

describe('leituras', () => {
  it('medidas do corpo calculam o IMC com a altura da ficha', () => {
    const l = leituras(res('medidas', '2026-10-01T10:00:00Z', { peso: 72.3, circ: { cintura: 84 } }), ctx)
    expect(l.map((x) => x.id)).toEqual(['peso', 'imc', 'cintura'])
    expect(l[1].valor).toBe(25)
    expect(l[2].status).toBe('atencao')
  })

  it('postura: nota e cada desvio por vista', () => {
    const l = leituras(res('postura', '2026-10-01T10:00:00Z', { score: 70, views: [{ view: 'frente', findings: [{ id: 'ombros-frente', title: 'Altura dos ombros', value: '4,2°', status: 'atencao' }] }] }), ctx)
    expect(l).toHaveLength(2)
    expect(l[1]).toMatchObject({ rotulo: 'Altura dos ombros (frente)', valor: 4.2, sentido: 'menor', status: 'atencao' })
  })

  it('Adams usa o escoliômetro quando tem', () => {
    expect(leituras(res('adams', '2026-10-01T10:00:00Z', { atr: 3, escoliometro: 8 }), ctx)[0]).toMatchObject({ valor: 8, status: 'alerta' })
  })

  it('idoso: testes funcionais e medidas do corpo na mesma série das medidas', () => {
    const idoso = {
      anamnese: { idade: 70, sexo: 'feminino' },
      antropometria: { peso: 65, estatura: 160, circ: { cintura: 90 } },
      testes: { levantar: { valor: 12, observacao: '' } },
      berg: Array(14).fill(null),
    }
    const l = leituras(res('idoso', '2026-10-01T10:00:00Z', idoso), ctx)
    expect(l.find((x) => x.id === 'cintura')?.grupo).toBe('corpo')
    expect(l.find((x) => x.id === 'levantar')).toMatchObject({ grupo: 'funcional', sentido: 'maior', valor: 12 })
  })

  it('dados quebrados não derrubam a tela', () => {
    expect(leituras(res('idoso', '2026-10-01T10:00:00Z', { x: 1 }), ctx)).toEqual([])
    expect(leituras(res('postura', '2026-10-01T10:00:00Z', { views: 'x' }), ctx)).toEqual([])
  })
})

describe('evolucao', () => {
  it('junta avaliações de tipos diferentes e compara com a anterior e a primeira', () => {
    const series = evolucao(
      [
        res('medidas', '2026-10-20T10:00:00Z', { peso: 78 }),
        res('medidas', '2026-09-01T10:00:00Z', { peso: 82 }),
        res('idoso', '2026-10-01T10:00:00Z', { anamnese: { idade: 70, sexo: 'feminino' }, antropometria: { peso: 80, estatura: 170, circ: {} }, testes: {}, berg: [] }),
        res('flexibilidade', '2026-09-01T10:00:00Z', { alcance: 30, nivel: 'Moderada' }),
        res('flexibilidade', '2026-10-20T10:00:00Z', { alcance: 20, nivel: 'Limitada' }),
      ],
      ctx,
    )
    const peso = series.find((s) => s.id === 'peso')!
    expect(peso.pontos.map((p) => p.valor)).toEqual([82, 80, 78])
    expect(peso.vsAnterior).toEqual({ diferenca: -2, tendencia: 'melhorou' })
    expect(peso.vsPrimeira).toEqual({ diferenca: -4, tendencia: 'melhorou' })
    expect(series.find((s) => s.id === 'flexibilidade')!.vsAnterior!.tendencia).toBe('piorou')
    expect(series[0].grupo).toBe('corpo')
    expect(placar(series, 'vsPrimeira')).toEqual({ melhorou: 2, piorou: 1, manteve: 0 })
  })
})
