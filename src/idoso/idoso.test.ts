import { describe, expect, it } from 'vitest'
import { calcularImc, classificarImc, comparar, menorPanturrilha, pontosDeAtencao, resumo, textoCompartilhar } from './analise'
import { classificarBerg, totalBerg } from './berg'
import { classificar, grupoIdade, teste } from './testes'
import { novaAvaliacao, type AvaliacaoIdoso } from './tipos'

function avaliacao(m: Partial<AvaliacaoIdoso> = {}): AvaliacaoIdoso {
  const a = novaAvaliacao()
  return { ...a, avaliado: 'João Silva', anamnese: { ...a.anamnese, idade: 72, sexo: 'masculino' }, ...m }
}

describe('IMC', () => {
  it('calcula com uma casa', () => {
    expect(calcularImc(80, 174)).toBe(26.4)
    expect(calcularImc(null, 170)).toBeNull()
  })
  it('usa os cortes do idoso a partir de 60 anos', () => {
    expect(classificarImc(26.4, 72).rotulo).toBe('Peso adequado')
    expect(classificarImc(26.4, 40).rotulo).toBe('Sobrepeso')
    expect(classificarImc(21, 70).rotulo).toBe('Baixo peso')
  })
})

describe('Berg', () => {
  it('soma os 14 itens', () => {
    expect(totalBerg(Array(14).fill(4))).toEqual({ total: 56, faltam: 0 })
    expect(totalBerg([4, 3, null, ...Array(11).fill(null)])).toEqual({ total: 7, faltam: 12 })
  })
  it('classifica o risco de queda', () => {
    expect(classificarBerg(48).status).toBe('ok')
    expect(classificarBerg(43).status).toBe('atencao')
    expect(classificarBerg(30).status).toBe('alerta')
  })
})

describe('testes do Senior Fitness Test', () => {
  it('escolhe o grupo de idade', () => {
    expect(grupoIdade(55)).toBe(0)
    expect(grupoIdade(72)).toBe(2)
    expect(grupoIdade(99)).toBe(6)
  })
  it('compara com a faixa da idade e do sexo', () => {
    const t = teste('levantar')
    expect(classificar(t, 14, 72, 'masculino')?.rotulo).toBe('Dentro do esperado')
    expect(classificar(t, 10, 72, 'masculino')?.rotulo).toBe('Abaixo do esperado')
    expect(classificar(t, 19, 72, 'masculino')?.rotulo).toBe('Acima do esperado')
    expect(classificar(t, 7, 72, 'masculino')?.status).toBe('alerta')
  })
  it('no TUG menos tempo é melhor', () => {
    const t = teste('tug')
    expect(classificar(t, 5, 72, 'feminino')?.rotulo).toBe('Dentro do esperado')
    expect(classificar(t, 4, 72, 'feminino')?.rotulo).toBe('Acima do esperado')
    expect(classificar(t, 8, 72, 'feminino')?.rotulo).toBe('Abaixo do esperado')
    expect(classificar(t, 10, 72, 'feminino')?.status).toBe('alerta')
  })
  it('caminhada de 6 minutos em metros', () => {
    expect(classificar(teste('caminhada'), 520, 72, 'masculino')?.rotulo).toBe('Dentro do esperado')
  })
  it('sem idade e sexo só avisa o risco', () => {
    expect(classificar(teste('levantar'), 14, null, null)).toBeNull()
    expect(classificar(teste('levantar'), 6, null, null)?.status).toBe('alerta')
  })
})

describe('resultado final', () => {
  const inicial = avaliacao({
    date: '2026-08-01T10:00:00Z',
    antropometria: { peso: 80, estatura: 174, circ: { cintura: 100 } },
    berg: [4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2],
    testes: { marcha: { valor: 70, observacao: '' }, caminhada: { valor: 450, observacao: '' }, levantar: { valor: 10, observacao: '' } },
  })
  const reavaliacao = avaliacao({
    date: '2026-10-01T10:00:00Z',
    anamnese: { ...inicial.anamnese, quedas: 1 },
    antropometria: { peso: 78, estatura: 174, circ: { cintura: 96 } },
    berg: [4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2],
    testes: { marcha: { valor: 82, observacao: '' }, caminhada: { valor: 520, observacao: '' }, levantar: { valor: 14, observacao: '' } },
  })

  it('monta o resumo como o do Romildo', () => {
    const r = resumo(reavaliacao)
    expect(r.map((l) => `${l.rotulo}: ${l.valor}`)).toEqual([
      'IMC: 25,8',
      'Equilíbrio Berg: 48/56',
      'Levantar e sentar: 14 repetições',
      'Marcha estacionária: 82 passos',
      'Caminhada 6 min: 520 m',
    ])
  })

  it('compara inicial e reavaliação', () => {
    const c = Object.fromEntries(comparar(inicial, reavaliacao).map((x) => [x.metrica.id, x]))
    expect(c.berg.diferenca).toBe(2)
    expect(c.berg.melhorou).toBe(true)
    expect(c.caminhada.diferenca).toBe(70)
    expect(c.cintura.melhorou).toBe(true)
    expect(c.peso.melhorou).toBeNull()
  })

  it('perimetria dos dois lados entra na evolução e a panturrilha mais fina dá o alerta', () => {
    const a = { ...inicial, antropometria: { ...inicial.antropometria, circ: { bracoD: 30, bracoE: 29, panturrilhaE: 30, panturrilhaD: 33 } } }
    const b = { ...reavaliacao, antropometria: { ...reavaliacao.antropometria, circ: { bracoD: 31, bracoE: 29.5, panturrilhaE: 32, panturrilhaD: 33 } } }
    const c = Object.fromEntries(comparar(a, b).map((x) => [x.metrica.id, x]))
    expect(c.bracoD.diferenca).toBe(1)
    expect(c.panturrilhaE.diferenca).toBe(2)
    expect(menorPanturrilha(a)).toBe(30)
    const p = pontosDeAtencao(a).find((x) => x.area === 'capacidade')!
    expect(p.pontos.some((x) => x.texto.startsWith('Panturrilha com 30 cm'))).toBe(true)
  })

  it('aponta os pontos de atenção por área', () => {
    const p = Object.fromEntries(pontosDeAtencao(inicial).map((x) => [x.area, x]))
    expect(p.equilibrio.status).toBe('atencao')
    expect(p.equilibrio.pontos.map((x) => x.texto)).toEqual(['Itens do Berg com nota 2 ou menos: em pé sobre uma perna.'])
    expect(p.capacidade.status).toBe('atencao')
    expect(p.flexibilidade.avaliado).toBe(false)
    const q = Object.fromEntries(pontosDeAtencao(reavaliacao).map((x) => [x.area, x]))
    expect(q.equilibrio.pontos.some((x) => x.texto.includes('1 queda'))).toBe(true)
  })

  it('gera o texto para compartilhar', () => {
    const t = textoCompartilhar(reavaliacao, inicial)
    expect(t).toContain('AVALIAÇÃO FUNCIONAL — JOÃO SILVA')
    expect(t).toContain('Caminhada 6 min: 450 → 520 (+70)')
  })
})
