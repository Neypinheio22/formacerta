import { describe, expect, it } from 'vitest'
import { dividirChamada, relogio, resumoGanhos, segundosParaAtender, segundosRestantes, type Chamada } from './video'

const base: Chamada = {
  id: '1',
  aluno_id: 'a',
  profissional_id: 'p',
  aluno_nome: 'Ana',
  profissional_nome: 'Romildo',
  profissional_foto: null,
  minutos: 30,
  valor: 60,
  comissao: 6,
  taxa: 2.69,
  situacao: 'feita',
  chamando_em: null,
  inicio_em: null,
  fim_em: null,
  nota: null,
  repassado_em: null,
  criado_em: '2026-11-02T12:00:00Z',
}

describe('chamada de vídeo', () => {
  it('personal recebe o preço menos 10% e a taxa de R$ 2,69', () => {
    expect(dividirChamada(60, 10, 2.69)).toEqual({ comissao: 6, taxa: 2.69, liquido: 51.31 })
    expect(dividirChamada(35, 10, 2.69).liquido).toBe(28.81)
    expect(dividirChamada(100, 10, 2.69).liquido).toBe(87.31)
  })

  it('resumo conta só as chamadas feitas e o que falta repassar', () => {
    const lista: Chamada[] = [base, { ...base, id: '2', repassado_em: '2026-11-02' }, { ...base, id: '3', situacao: 'credito', taxa: 0 }]
    const r = resumoGanhos(lista)
    expect(r.feitas).toBe(2)
    expect(r.bruto).toBe(120)
    expect(r.taxas).toBe(5.38)
    expect(r.liquido).toBe(102.62)
    expect(r.aReceber).toBe(51.31)
  })

  it('tempo da chamada e tempo para atender', () => {
    const inicio = Date.parse('2026-11-02T12:00:00Z')
    expect(segundosRestantes({ inicio_em: '2026-11-02T12:00:00Z', minutos: 30 }, inicio + 60_000)).toBe(29 * 60)
    expect(segundosRestantes({ inicio_em: '2026-11-02T12:00:00Z', minutos: 15 }, inicio + 20 * 60_000)).toBe(0)
    expect(segundosParaAtender({ chamando_em: '2026-11-02T12:00:00Z' }, inicio + 30_000)).toBe(90)
    expect(relogio(90)).toBe('1:30')
    expect(relogio(5)).toBe('0:05')
  })
})
