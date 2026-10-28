import { describe, expect, it } from 'vitest'
import type { Ficha } from '../nuvem/fichas'
import type { ResultadoNuvem } from '../nuvem/resultados'
import { dataReavaliacao, lembretes, mensagemLembrete, pendentes, textoSituacao } from './lembretes'

function nuvem(tipo: ResultadoNuvem['tipo'], dados: Record<string, unknown>, feito_em: string, ficha_id: string | null = 'f1'): ResultadoNuvem {
  return { id: `${tipo}-${feito_em}`, tipo, feito_em, apelido: 'Ana', aluno_id: null, ficha_id, enviado_por: 'p', idade: null, sexo: null, altura_cm: null, dados }
}

const ficha = { id: 'f1', nome: 'Ana Souza', aluno_id: 'a1', telefone: '85999990000' } as Ficha
const flexRuim = { nivel: 'Limitada', joelhosOk: true, joelho: 0 }
const flexBoa = { nivel: 'Boa', joelhosOk: true, joelho: 0 }
const hoje = new Date(2026, 10, 25, 9)

describe('lembrete de reavaliação', () => {
  it('data de reavaliação pelo plano de ação (30 dias para "precisa melhorar")', () => {
    expect(dataReavaliacao(nuvem('flexibilidade', flexRuim, '2026-10-26T12:00:00Z'))).toBe('2026-11-25')
    expect(dataReavaliacao(nuvem('estrategia', { texto: 'x' }, '2026-10-26T12:00:00Z'))).toBeNull()
  })

  it('peso e medidas: lembrete todo mês, e medir de novo troca o lembrete', () => {
    expect(dataReavaliacao(nuvem('medidas', { peso: 70 }, '2026-10-26T12:00:00Z'))).toBe('2026-11-25')
    const ls = lembretes([nuvem('medidas', { peso: 70 }, '2026-09-01T12:00:00Z'), nuvem('medidas', { peso: 69 }, '2026-10-26T12:00:00Z')], [ficha], hoje)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ teste: 'Peso e medidas do corpo', situacao: 'hoje' })
  })

  it('vence hoje, com nome e telefone da ficha', () => {
    const [l] = lembretes([nuvem('flexibilidade', flexRuim, '2026-10-26T12:00:00Z')], [ficha], hoje)
    expect(l).toMatchObject({ nome: 'Ana Souza', telefone: '85999990000', alunoId: 'a1', situacao: 'hoje', dias: 0 })
    expect(textoSituacao(l)).toBe('é hoje')
  })

  it('refazer o teste troca o lembrete antigo pelo novo', () => {
    const ls = lembretes([nuvem('flexibilidade', flexRuim, '2026-09-01T12:00:00Z'), nuvem('flexibilidade', flexBoa, '2026-11-20T12:00:00Z')], [ficha], hoje)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ situacao: 'futura', data: '2027-02-18' })
    expect(pendentes(ls)).toHaveLength(0)
  })

  it('atrasados primeiro e um lembrete por pessoa e teste', () => {
    const ls = lembretes(
      [
        nuvem('flexibilidade', flexRuim, '2026-10-20T12:00:00Z'),
        nuvem('adams', { atr: 2 }, '2026-10-20T12:00:00Z'),
        nuvem('flexibilidade', flexRuim, '2026-10-30T12:00:00Z', null),
      ],
      [ficha],
      hoje,
    )
    expect(ls.map((l) => [l.nome, l.situacao])).toEqual([
      ['Ana Souza', 'atrasada'],
      ['Ana', 'breve'],
      ['Ana Souza', 'futura'],
    ])
    expect(textoSituacao(ls[0])).toBe('venceu há 6 dias')
    expect(textoSituacao(ls[1])).toBe('em 4 dias')
  })

  it('mensagem do WhatsApp com o primeiro nome e os testes', () => {
    const m = mensagemLembrete('Ana Souza', ['Teste de Flexibilidade'], 'Romildo')
    expect(m).toContain('Oi, Ana!')
    expect(m).toContain('• Teste de Flexibilidade')
    expect(m).toContain('Romildo')
  })
})
