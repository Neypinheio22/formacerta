import { describe, expect, it } from 'vitest'
import { limparLinha, linhasDe, linhaVaziaDe, repsDe, resumoLinha } from './linhas'

describe('linhas do exercício', () => {
  it('converte o exercício antigo (séries, repetições e dica)', () => {
    expect(linhasDe({ series: '3', reps: '10 a 12', obs: '60 s descanso' })).toEqual([
      { tipo: 'reps_carga', serie: '3x10 a 12' },
      { tipo: 'observacoes', texto: '60 s descanso' },
    ])
    expect(linhasDe({ series: '', reps: '', obs: '' })).toEqual([])
  })

  it('usa as linhas quando existem', () => {
    const linhas = [{ tipo: 'cadencia' as const, texto: '2 s concêntrica' }]
    expect(linhasDe({ series: '3', reps: '10', obs: '', linhas })).toBe(linhas)
  })

  it('guarda só os campos do tipo, sem espaços', () => {
    expect(limparLinha({ tipo: 'reps_carga', serie: ' 4x8 ', carga: '52/59/64', texto: 'sobra', intervalo: '' })).toEqual({ tipo: 'reps_carga', serie: '4x8', carga: '52/59/64' })
    expect(linhaVaziaDe({ tipo: 'reps_carga', texto: 'não conta' })).toBe(true)
    expect(linhaVaziaDe({ tipo: 'cadencia', texto: '2 s' })).toBe(false)
  })

  it('tira a faixa de repetições da série', () => {
    expect(repsDe({ linhas: [{ tipo: 'observacoes', texto: 'x' }, { tipo: 'reps_carga', serie: '4x8' }] })).toBe('8')
    expect(repsDe({ linhas: [{ tipo: 'reps_carga', serie: '3X10 a 12' }] })).toBe('10 a 12')
    expect(repsDe({ series: '3', reps: '15' })).toBe('15')
  })

  it('resume a linha para o aluno', () => {
    expect(resumoLinha({ tipo: 'reps_carga', serie: '4x8', carga: '52/59/64', intervalo: '60 s' })).toEqual({ rotulo: 'Repetições e carga', texto: '4x8 · 52/59/64 kg · intervalo 60 s' })
    expect(resumoLinha({ tipo: 'cadencia', texto: '2 s concêntrica todas rep' }).texto).toBe('2 s concêntrica todas rep')
    expect(resumoLinha({ tipo: 'reps_carga', serie: '3x12', carga: 'elástico' }).texto).toBe('3x12 · elástico')
  })
})
