import { describe, expect, it } from 'vitest'
import { PLANOS_PADRAO, assinaturaAtual, dividir, economiaAnual, emReais, lerReais, mensalNoAnual, type Assinatura } from './planos'

const pro = PLANOS_PADRAO.find((p) => p.id === 'personal-pro')!

describe('planos', () => {
  it('mostra o preço em reais', () => {
    expect(emReais(89.9)).toBe('R$ 89,90')
    expect(emReais(2490)).toBe('R$ 2.490,00')
  })

  it('anual sai com 2 meses grátis', () => {
    expect(economiaAnual(pro)).toBe(179.8)
    expect(mensalNoAnual(pro)).toBe(74.92)
  })

  it('divide a avaliação entre o personal e o FormaCerta', () => {
    expect(dividir(120, 10)).toEqual({ comissao: 12, liquido: 108 })
    expect(dividir(149.9, 10)).toEqual({ comissao: 14.99, liquido: 134.91 })
  })

  it('lê o preço digitado de vários jeitos', () => {
    expect(lerReais('120')).toBe(120)
    expect(lerReais('120,50')).toBe(120.5)
    expect(lerReais('R$ 1.234,56')).toBe(1234.56)
    expect(lerReais('49.90')).toBe(49.9)
    expect(lerReais('')).toBeNull()
  })

  it('a assinatura que vale é a mais nova não cancelada', () => {
    const a = (situacao: Assinatura['situacao'], id: string) => ({ id, situacao }) as Assinatura
    expect(assinaturaAtual([a('cancelada', '1'), a('teste', '2')])?.id).toBe('2')
    expect(assinaturaAtual([a('cancelada', '1')])).toBeNull()
  })
})
