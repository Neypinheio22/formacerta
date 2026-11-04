import { describe, expect, it } from 'vitest'
import { agoraBrasilia, comNome, conferir, dadosDe, dadosVazios, descreverRecorrencia, MODELOS, quandoBr, type Notificacao } from './notificacoes'

// 04/11/2026 12:43 UTC = 09:43 em Brasília
const AGORA = new Date('2026-11-04T12:43:00Z')

describe('notificações do personal', () => {
  it('usa o horário de Brasília', () => {
    expect(agoraBrasilia(AGORA)).toEqual({ data: '2026-11-04', hora: '09:43' })
    expect(quandoBr('2026-11-05T11:00:00Z', AGORA)).toBe('05/11 às 08:00')
    expect(quandoBr('2027-01-02T11:00:00Z', AGORA)).toBe('02/01/2027 às 08:00')
  })

  it('descreve a repetição em português', () => {
    expect(descreverRecorrencia({ frequencia: 'semanal', dias_semana: [5, 1, 3], dia_mes: null, hora: '07:30:00' })).toBe('Seg, Qua e Sex às 07:30')
    expect(descreverRecorrencia({ frequencia: 'diaria', dias_semana: [], dia_mes: null, hora: '06:00:00' })).toBe('Todo dia às 06:00')
    expect(descreverRecorrencia({ frequencia: 'mensal', dias_semana: [], dia_mes: 5, hora: '09:00:00' })).toBe('Todo dia 5 do mês às 09:00')
    expect(descreverRecorrencia({ frequencia: 'quinzenal', dias_semana: [2], dia_mes: null, hora: '18:00' })).toBe('A cada 2 semanas (Ter) às 18:00')
  })

  it('troca {nome} pelo primeiro nome', () => {
    expect(comNome('Oi, {nome}! Bom treino, {nome}.', 'Ana Souza')).toBe('Oi, Ana! Bom treino, Ana.')
  })

  it('confere antes de enviar', () => {
    const d = { ...dadosVazios('agendada', AGORA), titulo: 'Treino', texto: 'Hoje tem treino' }
    expect(conferir({ ...d, data: '2026-11-04', hora: '09:00' }, AGORA)).toMatch(/já passou/)
    expect(conferir({ ...d, data: '2026-11-04', hora: '10:00' }, AGORA)).toBeNull()
    expect(conferir({ ...d, todos: false, fichas: [] }, AGORA)).toMatch(/aluno/)
    const r = { ...dadosVazios('recorrente', AGORA), titulo: 'a', texto: 'b' }
    expect(conferir({ ...r, dias_semana: [] }, AGORA)).toMatch(/dias da semana/)
    expect(conferir({ ...r, frequencia: 'mensal', dia_mes: 0 }, AGORA)).toMatch(/dia do mês/)
    expect(conferir({ ...r, inicio: '2026-11-10', fim: '2026-11-01' }, AGORA)).toMatch(/encerramento/)
    expect(conferir(r, AGORA)).toBeNull()
  })

  it('tem os 10 modelos pedidos (5 financeiros e 5 de treino)', () => {
    expect(MODELOS.filter((m) => m.categoria === 'financeiro')).toHaveLength(5)
    expect(MODELOS.filter((m) => m.categoria === 'treino')).toHaveLength(5)
    for (const m of MODELOS) expect(m.texto.length).toBeLessThanOrEqual(1000)
  })

  it('abre uma agendada para editar com data e hora de Brasília', () => {
    const n = { id: 'x', tipo: 'agendada', categoria: '', titulo: 't', texto: 'x', todos: true, fichas: [], no_chat: false, enviar_em: '2026-11-05T11:00:00Z', frequencia: null, dias_semana: [], dia_mes: null, hora: null, inicio: null, fim: null, situacao: 'ativa' } as unknown as Notificacao
    const d = dadosDe(n)
    expect(d.data).toBe('2026-11-05')
    expect(d.hora).toBe('08:00')
  })
})
