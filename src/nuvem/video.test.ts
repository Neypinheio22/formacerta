import { describe, expect, it } from 'vitest'
import { alunoPodeDesmarcar, conferirHorarios, creditosPorPersonal, diasParaVencer, dividirChamada, horaBr, horaDeChamar, porDia, relogio, resumoGanhos, segundosParaAtender, segundosRestantes, type Chamada } from './video'

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

describe('créditos com validade e agenda', () => {
  const base = {
    aluno_id: 'a',
    profissional_id: 'p',
    aluno_nome: 'Carla',
    profissional_nome: 'Romildo Bernardo',
    profissional_foto: null,
    valor: 50,
    comissao: 5,
    taxa: 0,
    chamando_em: null,
    inicio_em: null,
    fim_em: null,
    nota: null,
    repassado_em: null,
    criado_em: '2026-11-01T10:00:00Z',
  }
  const agora = Date.parse('2026-11-03T12:00:00Z')

  it('junta os créditos por personal com o vencimento mais próximo', () => {
    const lista = [
      { ...base, id: '1', minutos: 30, situacao: 'credito' as const, vence_em: '2026-12-20T00:00:00Z' },
      { ...base, id: '2', minutos: 15, situacao: 'credito' as const, vence_em: '2026-11-08T00:00:00Z' },
      { ...base, id: '3', minutos: 30, situacao: 'feita' as const, vence_em: '2026-11-04T00:00:00Z' },
      { ...base, id: '4', minutos: 30, situacao: 'credito' as const, aluno_id: 'outro', vence_em: null },
    ]
    const g = creditosPorPersonal(lista, 'a')
    expect(g).toHaveLength(1)
    expect(g[0].quantidade).toBe(2)
    expect(g[0].minutos).toEqual([30, 15])
    expect(g[0].vence_em).toBe('2026-11-08T00:00:00Z')
    expect(diasParaVencer(g[0], agora)).toBe(5)
    expect(diasParaVencer({ vence_em: null }, agora)).toBeNull()
  })

  it('confere os horários da agenda', () => {
    expect(conferirHorarios([{ dia_semana: 1, inicio: '18:00', fim: '21:00' }])).toBeNull()
    expect(conferirHorarios([{ dia_semana: 1, inicio: '21:00', fim: '18:00' }])).toMatch(/Segunda/)
    expect(
      conferirHorarios([
        { dia_semana: 2, inicio: '18:00', fim: '20:00' },
        { dia_semana: 2, inicio: '19:30', fim: '21:00' },
      ]),
    ).toMatch(/sobrep/)
  })

  it('libera a chamada 10 minutos antes e o aluno desmarca até 2 horas antes', () => {
    const a = { inicio: '2026-11-03T12:30:00Z', minutos: 30 }
    expect(horaDeChamar(a, agora)).toBe(false)
    expect(horaDeChamar(a, Date.parse('2026-11-03T12:21:00Z'))).toBe(true)
    expect(horaDeChamar(a, Date.parse('2026-11-03T13:01:00Z'))).toBe(false)
    expect(alunoPodeDesmarcar(a, agora)).toBe(false)
    expect(alunoPodeDesmarcar({ inicio: '2026-11-03T15:00:00Z' }, agora)).toBe(true)
  })

  it('junta os horários livres por dia no horário de Brasília', () => {
    const dias = porDia([new Date('2026-11-04T01:30:00Z'), new Date('2026-11-04T12:00:00Z'), new Date('2026-11-04T12:30:00Z')])
    expect(dias).toHaveLength(2)
    expect(dias[1].horas).toHaveLength(2)
    expect(horaBr(dias[0].horas[0])).toBe('22:30')
  })
})
