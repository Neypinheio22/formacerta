import { describe, expect, it } from 'vitest'
import { intensidadeComum, minutos, tempoMedio, textoDuracao } from './retorno'

describe('retorno do aluno', () => {
  it('conta os minutos do treino', () => {
    expect(minutos('2026-10-27T19:00:00Z', '2026-10-27T19:45:00Z')).toBe(45)
    expect(minutos('2026-10-27T19:45:00Z', '2026-10-27T19:00:00Z')).toBeNull()
    expect(minutos(undefined, '2026-10-27T19:00:00Z')).toBeNull()
  })

  it('escreve a duração', () => {
    expect(textoDuracao(0.1)).toBe('0 min 6 s')
    expect(textoDuracao(45)).toBe('45 min')
    expect(textoDuracao(65)).toBe('1 h 05 min')
  })

  it('faz a média sem treinos esquecidos abertos', () => {
    const f = (a: string, b: string) => ({ inicio: `2026-10-27T${a}:00Z`, fim: `2026-10-27T${b}:00Z` })
    expect(tempoMedio([f('10:00', '11:00'), f('10:00', '10:40'), f('01:00', '23:00'), {}])).toBe(50)
    expect(tempoMedio([])).toBeNull()
  })

  it('acha a intensidade mais comum', () => {
    expect(intensidadeComum([{ intensidade: 'Intensa' }, { intensidade: 'Moderada' }, { intensidade: 'Moderada' }, {}])).toBe('Moderada')
    expect(intensidadeComum([{ intensidade: 'Leve' }, { intensidade: 'Intensa' }])).toBe('Leve')
    expect(intensidadeComum([])).toBeNull()
  })
})
