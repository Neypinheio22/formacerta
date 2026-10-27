import { describe, expect, it } from 'vitest'
import { cargaPara, doExercicio, estimar1RM, exercicios, melhorPorDia, projetar, proximaCarga, type Serie } from './carga'

const s = (date: string, kg: number, reps: number, exercicio = 'Supino reto'): Serie => ({ id: date + kg + reps, date, exercicio, kg, reps })

describe('carga máxima estimada', () => {
  it('1 repetição é a própria carga', () => expect(estimar1RM(100, 1)).toBe(100))
  it('100 kg x 10 dá cerca de 133 kg', () => expect(estimar1RM(100, 10)).toBeCloseTo(133.3, 0))
  it('a conta de volta devolve a carga original', () => expect(cargaPara(estimar1RM(60, 8), 8)).toBeCloseTo(60, 5))
})

describe('próxima carga', () => {
  const faixa = { min: 8, max: 12 }
  it('passou do topo da faixa: sobe', () => {
    const r = proximaCarga(s('2026-10-01', 40, 12), faixa, 2)
    expect(r.tipo).toBe('subir')
    expect(r.kg).toBe(42)
  })
  it('dentro da faixa: mantém e tenta mais uma', () => {
    const r = proximaCarga(s('2026-10-01', 40, 9), faixa, 2)
    expect(r).toMatchObject({ tipo: 'manter', kg: 40 })
  })
  it('abaixo da faixa: baixa', () => {
    const r = proximaCarga(s('2026-10-01', 40, 5), faixa, 2)
    expect(r.tipo).toBe('baixar')
    expect(r.kg).toBeLessThan(40)
  })
  it('carga alta sobe cerca de 2,5%', () => expect(proximaCarga(s('2026-10-01', 100, 12), faixa, 2.5).kg).toBe(102.5))
})

describe('projeção', () => {
  it('precisa de 3 dias de treino', () => expect(projetar([s('2026-10-01', 40, 10), s('2026-10-08', 42, 10)])).toBeNull())
  it('segue o ritmo dos treinos', () => {
    const p = projetar([s('2026-10-01', 40, 10), s('2026-10-08', 41, 10), s('2026-10-15', 42, 10)])!
    expect(p.porSemana).toBeGreaterThan(0)
    expect(p.semanas).toHaveLength(4)
  })
  it('não promete mais que 3% por semana', () => {
    const p = projetar([s('2026-10-01', 20, 10), s('2026-10-08', 40, 10), s('2026-10-15', 60, 10)])!
    expect(p.porSemana).toBeCloseTo(estimar1RM(60, 10) * 0.03, 5)
  })
  it('usa a melhor série de cada dia', () => {
    expect(melhorPorDia([s('2026-10-01T10:00', 40, 10), s('2026-10-01T10:05', 40, 8)])).toHaveLength(1)
  })
})

it('agrupa o exercício sem ligar para maiúsculas', () => {
  const lista = [s('2026-10-01', 40, 10, 'Supino reto'), s('2026-10-02', 40, 10, 'supino reto '), s('2026-10-02', 80, 10, 'Leg press')]
  expect(exercicios(lista)).toHaveLength(2)
  expect(doExercicio(lista, 'SUPINO RETO')).toHaveLength(2)
})
