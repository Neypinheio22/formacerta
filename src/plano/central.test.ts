import { describe, expect, it } from 'vitest'
import type { ResultadoNuvem } from '../nuvem/resultados'
import { encurtar, montarCentral } from './central'

function nuvem(tipo: ResultadoNuvem['tipo'], dados: Record<string, unknown>, feito_em = '2026-10-25T12:00:00Z'): ResultadoNuvem {
  return { id: `${tipo}-${feito_em}`, tipo, feito_em, apelido: 'Ana', aluno_id: null, ficha_id: 'f', enviado_por: 'p', idade: null, sexo: null, altura_cm: null, dados }
}

const ombro = { id: 'ombros', title: 'Ombros', value: '4,0°', status: 'atencao', detail: '', exercises: [], correcao: 'ombroElevado', lado: 'direito' }

describe('Central de Inteligência', () => {
  const testes = [
    nuvem('postura', { score: 70, views: [{ view: 'frente', findings: [ombro] }] }),
    nuvem('flexibilidade', { nivel: 'Muito limitada', joelhosOk: true, joelho: 0 }),
    nuvem('corrida', { score: 90, vista: 'lado', achados: [{ title: 'Cadência', value: '172 passos/min', status: 'ok', exercises: [] }] }),
  ]

  it('um cartão por área, com a cor e o achado principal', () => {
    const c = montarCentral(testes)
    const area = (id: string) => c.cartoes.find((x) => x.id === id)!
    expect(c.cartoes.map((x) => x.id)).toEqual(['postura', 'mobilidade', 'corrida', 'flexibilidade', 'coluna'])
    expect(area('postura')).toMatchObject({ status: 'atencao', achado: 'Ombro elevado (frente, 4,0°)' })
    expect(area('flexibilidade').status).toBe('alerta')
    expect(area('corrida')).toMatchObject({ status: 'ok', achado: 'Adequado (90 de 100 pontos)' })
    expect(area('mobilidade')).toMatchObject({ status: null })
    expect(area('mobilidade').achado).toContain('Grave')
    expect(c.revisao).toBeNull()
  })

  it('a cor que o professor definiu vale até chegar teste novo na área', () => {
    const estrategia = nuvem('estrategia', { areas: { postura: 'ok', flexibilidade: 'atencao' }, texto: 'Foco em mobilidade.', profissional: 'Romildo' }, '2026-10-26T12:00:00Z')
    let c = montarCentral([...testes, estrategia])
    expect(c.revisao).toMatchObject({ texto: 'Foco em mobilidade.', profissional: 'Romildo' })
    expect(c.cartoes.find((x) => x.id === 'postura')).toMatchObject({ status: 'ok', statusApp: 'atencao', ajustado: true })
    expect(c.testesNovos).toBe(false)

    c = montarCentral([...testes, estrategia, nuvem('postura', { score: 60, views: [{ view: 'frente', findings: [ombro] }] }, '2026-10-27T12:00:00Z')])
    expect(c.cartoes.find((x) => x.id === 'postura')).toMatchObject({ status: 'alerta', ajustado: false })
    expect(c.cartoes.find((x) => x.id === 'flexibilidade')?.status).toBe('atencao')
    expect(c.testesNovos).toBe(true)
  })

  it('encurta o ponto de atenção para caber no cartão', () => {
    expect(encurtar('Flexibilidade limitada: mãos na altura dos joelhos. Encurtamento dos posteriores da coxa.')).toBe('Flexibilidade limitada: mãos na altura dos joelhos')
    expect(encurtar('a '.repeat(60)).length).toBeLessThanOrEqual(70)
  })
})
