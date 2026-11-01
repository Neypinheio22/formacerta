import { describe, expect, it } from 'vitest'
import { andamento, iconePadrao, rotuloTipo, tipoDaRotina, nomeSugerido, ordenarRotinas, resumoAerobico, rotinaAtual, somarSemanas, type RotinaBase } from './rotinas'

const hoje = new Date(2026, 9, 30, 10)

const r = (id: string, inicio: string | null, fim: string | null, situacao: RotinaBase['situacao'] = 'ativa', criado_em = '2026-10-01T10:00:00Z'): RotinaBase => ({ id, nome: id, inicio, fim, situacao, criado_em })

describe('rotinaAtual', () => {
  it('pega a ativa que vale hoje, ignorando arquivadas e excluídas', () => {
    const lista = [r('velha', '2026-08-01', '2026-09-30', 'arquivada'), r('atual', '2026-10-01', '2026-11-30'), r('lixo', '2026-10-20', null, 'excluida')]
    expect(rotinaAtual(lista, hoje)?.id).toBe('atual')
  })

  it('com duas valendo, fica com a que começou por último', () => {
    expect(rotinaAtual([r('a', '2026-09-01', '2026-12-01'), r('b', '2026-10-15', '2026-12-01')], hoje)?.id).toBe('b')
  })

  it('vencida continua valendo até o personal renovar', () => {
    expect(rotinaAtual([r('vencida', '2026-08-01', '2026-09-30')], hoje)?.id).toBe('vencida')
  })

  it('prefere a que vale hoje à vencida mais nova', () => {
    expect(rotinaAtual([r('vale', '2026-09-01', null), r('vencida', '2026-10-01', '2026-10-10')], hoje)?.id).toBe('vale')
  })

  it('só futuras: a que começa primeiro', () => {
    expect(rotinaAtual([r('dez', '2026-12-01', null), r('nov', '2026-11-03', null)], hoje)?.id).toBe('nov')
  })

  it('sem ativas: nenhuma', () => {
    expect(rotinaAtual([r('x', null, null, 'arquivada')], hoje)).toBeNull()
  })
})

describe('andamento', () => {
  it('mostra a situação pelas datas', () => {
    expect(andamento(r('a', '2026-10-01', '2026-12-01'), hoje).rotulo).toBe('Em andamento')
    expect(andamento(r('a', '2026-10-01', '2026-11-03'), hoje)).toEqual({ rotulo: 'Vence em 4 dias', tom: 'atencao' })
    expect(andamento(r('a', '2026-10-01', '2026-10-30'), hoje).rotulo).toBe('Vence hoje')
    expect(andamento(r('a', '2026-09-01', '2026-10-29'), hoje).rotulo).toBe('Vencida')
    expect(andamento(r('a', '2026-10-31', null), hoje).rotulo).toBe('Começa amanhã')
    expect(andamento(r('a', null, null, 'arquivada'), hoje).rotulo).toBe('Arquivada')
  })
})

describe('outros', () => {
  it('nome sugerido no padrão do Romildo', () => {
    expect(nomeSugerido(hoje)).toBe('TREINO NOVO 2026/10')
  })

  it('soma semanas na validade', () => {
    expect(somarSemanas('2026-10-30', 8)).toBe('2026-12-25')
  })

  it('ícone pelo objetivo', () => {
    expect(iconePadrao('Emagrecimento')).toBe('cardio')
    expect(iconePadrao('Condicionamento físico')).toBe('cardio')
    expect(iconePadrao('Hipertrofia')).toBe('geral')
  })

  it('ícones antigos caem num equivalente', () => {
    expect(tipoDaRotina('forca')).toBe('geral')
    expect(tipoDaRotina('emagrecer')).toBe('cardio')
    expect(tipoDaRotina('pernas')).toBe('pernas')
    expect(tipoDaRotina('', 'Reabilitação')).toBe('reabilitacao')
    expect(rotuloTipo('pernas')).toBe('Inferiores')
    expect(rotuloTipo('core')).toBe('Abdômen')
  })

  it('atual no topo da lista', () => {
    const lista = [r('arq', '2026-08-01', null, 'arquivada'), r('atual', '2026-10-01', null), r('futura', '2026-12-01', null)]
    expect(ordenarRotinas(lista, hoje).map((x) => x.id)).toEqual(['atual', 'futura', 'arq'])
  })

  it('resume o aeróbico', () => {
    expect(resumoAerobico({ tipo: 'Esteira', duracao_min: 30, intensidade: 'Moderada (fala com esforço)', vezes_semana: 3 })).toBe('Esteira · 30 min · Moderada · 3x por semana')
  })
})
