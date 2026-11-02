import { describe, expect, it } from 'vitest'
import { PLANOS_PADRAO, assinaturaAtual, assinaturaVencida, avisoDoPlano, paraRenovar, dividir, economiaAnual, emReais, lerReais, mensalNoAnual, type Assinatura, type Direitos } from './planos'
import { travadoNoPro } from '../components/planos/useDireitos'
import type { Perfil } from './conta'

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

  it('plano vencido não vale e aparece para renovar', () => {
    const a = (situacao: Assinatura['situacao'], id: string) => ({ id, situacao }) as Assinatura
    expect(assinaturaAtual([a('vencida', '1')])).toBeNull()
    expect(assinaturaVencida([a('vencida', '1')])?.id).toBe('1')
    expect(assinaturaVencida([a('ativa', '2'), a('vencida', '1')])).toBeNull()
    expect(assinaturaVencida([a('cancelada', '3'), a('vencida', '1')])?.id).toBe('1')
  })

  const base: Direitos = {
    papel: 'aluno',
    travado: true,
    plano_id: 'aluno-pro',
    plano_nome: 'Aluno Pro',
    pago: true,
    cortesia: false,
    situacao: 'ativa',
    ciclo: 'mensal',
    valido_ate: null,
    dias_restantes: 10,
    pro: true,
    pro_pelo_personal: false,
    alunos: 0,
    limite_alunos: null,
    vende_servicos: true,
    ultima_situacao: 'ativa',
    ultimo_plano_id: 'aluno-pro',
    ultimo_plano_nome: 'Aluno Pro',
    ultimo_ciclo: 'mensal',
    ultimo_valido_ate: null,
  }

  it('avisa 3 dias antes de vencer e depois que venceu', () => {
    expect(avisoDoPlano(base)).toBeNull()
    expect(avisoDoPlano({ ...base, dias_restantes: 3 })?.titulo).toBe('Seu plano Aluno Pro vence em 3 dias')
    expect(avisoDoPlano({ ...base, dias_restantes: 1 })?.titulo).toBe('Seu plano Aluno Pro vence amanhã')
    expect(avisoDoPlano({ ...base, dias_restantes: 2, situacao: 'teste' })?.titulo).toBe('Seu teste grátis acaba em 2 dias')
    expect(avisoDoPlano({ ...base, dias_restantes: 2, cortesia: true })).toBeNull()
    const venceu = avisoDoPlano({ ...base, pago: false, situacao: null, dias_restantes: null, ultima_situacao: 'vencida' })
    expect(venceu?.tipo).toBe('venceu')
    expect(avisoDoPlano({ ...base, papel: 'admin', dias_restantes: 1 })).toBeNull()
    expect(avisoDoPlano(null)).toBeNull()
  })

  it('só trava o Aluno Pro com certeza (sem resposta do banco, libera)', () => {
    const aluno = { papel: 'aluno' } as Perfil
    expect(travadoNoPro(aluno, null)).toBe(false)
    expect(travadoNoPro(aluno, { ...base, pro: false })).toBe(true)
    expect(travadoNoPro(aluno, { ...base, pro: false, travado: false })).toBe(false)
    expect(travadoNoPro(aluno, base)).toBe(false)
    expect(travadoNoPro({ papel: 'profissional' } as Perfil, { ...base, pro: false })).toBe(false)
  })

  it('dá para renovar perto do fim, no fim do teste e depois de vencer', () => {
    const daqui = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()
    const a = (x: Partial<Assinatura>) => ({ id: 'a', situacao: 'ativa', valor: 24.9, valido_ate: daqui(20), ...x }) as Assinatura
    expect(paraRenovar([a({})])).toBeNull()
    expect(paraRenovar([a({ valido_ate: daqui(2) })])?.id).toBe('a')
    expect(paraRenovar([a({ situacao: 'teste', valido_ate: daqui(1) })])?.id).toBe('a')
    expect(paraRenovar([a({ situacao: 'vencida', valido_ate: daqui(-5) })])?.id).toBe('a')
    expect(paraRenovar([a({ valido_ate: daqui(2), cortesia: true })])).toBeNull()
    expect(paraRenovar([a({ valor: 0, valido_ate: null })])).toBeNull()
  })
})
