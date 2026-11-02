import { describe, expect, it } from 'vitest'
import {
  compararPeriodos,
  exerciciosAnotados,
  focoSugerido,
  haQuanto,
  historicoDoTreino,
  intensidadeDoEsforco,
  lerNumero,
  limparCargas,
  mover,
  pontosDoExercicio,
  progressoDoExercicio,
  reletrar,
  resumoDoPeriodo,
  seriesPrevistas,
  ultimaCarga,
  variacao,
  type Execucao,
} from './execucao'

// Segunda-feira, 2 de novembro de 2026, meio-dia.
const HOJE = new Date(2026, 10, 2, 12)
const dia = (d: number, m = 10) => new Date(2026, m, d, 9).toISOString()

const ex = (id: string, treino: string, feito: string, extra: Partial<Execucao> = {}): Execucao => ({ id, treino_id: treino, letra: 'A', feito_em: feito, ...extra })

describe('histórico do treino', () => {
  const lista = [ex('1', 'a', dia(20, 9)), ex('2', 'a', dia(28, 9)), ex('3', 'b', dia(2))]

  it('conta as vezes e acha a última', () => {
    const h = historicoDoTreino('a', lista, HOJE)
    expect(h.vezes).toBe(2)
    expect(h.ultima).toBe(dia(28, 9))
    expect(h.lista[0].id).toBe('2')
  })

  it('realizado na semana, pendente e não iniciado', () => {
    expect(historicoDoTreino('b', lista, HOJE).status).toBe('realizado')
    expect(historicoDoTreino('a', lista, HOJE).status).toBe('pendente')
    expect(historicoDoTreino('c', lista, HOJE).status).toBe('nao_iniciado')
  })

  it('diz há quanto tempo', () => {
    expect(haQuanto(dia(2), HOJE)).toBe('hoje')
    expect(haQuanto(dia(1), HOJE)).toBe('ontem')
    expect(haQuanto(dia(28, 9), HOJE)).toBe('há 5 dias')
  })
})

describe('anotar cargas', () => {
  it('séries previstas pela linha do personal', () => {
    expect(seriesPrevistas({ linhas: [{ tipo: 'reps_carga', serie: '4x8' }] })).toBe(4)
    expect(seriesPrevistas({ series: '5', reps: '10' })).toBe(5)
    expect(seriesPrevistas({ linhas: [{ tipo: 'observacoes' }] })).toBe(3)
  })

  it('lê números com vírgula e ignora o resto', () => {
    expect(lerNumero('42,5')).toBe(42.5)
    expect(lerNumero('40kg')).toBe(40)
    expect(lerNumero('')).toBeNull()
  })

  it('tira séries e exercícios vazios', () => {
    expect(
      limparCargas([
        { nome: 'Supino', series: [{ kg: 40, reps: 10 }, { kg: null, reps: null }] },
        { nome: 'Remada', series: [{ kg: null, reps: null }] },
      ]),
    ).toEqual([{ nome: 'Supino', series: [{ kg: 40, reps: 10 }] }])
  })

  it('acha a última carga anotada do exercício', () => {
    const l = [ex('1', 'a', dia(20, 9), { cargas: [{ nome: 'Supino reto', series: [{ kg: 40, reps: 10 }] }] }), ex('2', 'a', dia(28, 9), { cargas: [{ nome: 'supino reto', series: [{ kg: 42, reps: 8 }] }] })]
    expect(ultimaCarga(l, 'Supino Reto')?.series[0].kg).toBe(42)
    expect(ultimaCarga(l, 'Agachamento')).toBeNull()
  })
})

describe('evolução', () => {
  const l = [
    ex('1', 'a', dia(1, 9), { cargas: [{ nome: 'Supino', series: [{ kg: 40, reps: 10 }, { kg: 40, reps: 8 }] }], esforco: 6 }),
    ex('2', 'a', dia(20, 9), { cargas: [{ nome: 'Supino', series: [{ kg: 45, reps: 10 }] }, { nome: 'Remada', series: [{ kg: 30, reps: 12 }] }], esforco: 8 }),
    ex('3', 'a', dia(1), { cargas: [{ nome: 'Supino', series: [{ kg: 50, reps: 8 }] }], esforco: 7, dor: true }),
  ]

  it('pontos do exercício em ordem de data', () => {
    const p = pontosDoExercicio(l, 'supino')
    expect(p.map((x) => x.cargaMax)).toEqual([40, 45, 50])
    expect(p[0].reps).toBe(18)
    expect(p[0].volume).toBe(720)
  })

  it('progresso da primeira para a última', () => {
    const pr = progressoDoExercicio(pontosDoExercicio(l, 'Supino'))!
    expect(pr.difCarga).toBe(10)
    expect(pr.pctRm).toBeGreaterThan(0)
  })

  it('exercícios mais anotados primeiro', () => {
    expect(exerciciosAnotados(l)).toEqual(['Supino', 'Remada'])
  })

  it('resumo de um período', () => {
    const r = resumoDoPeriodo(l, '2026-10-15', '2026-11-02')
    expect(r.execucoes).toBe(2)
    expect(r.esforco).toBe(7.5)
    expect(r.dores).toBe(1)
    expect(r.volume).toBe(45 * 10 + 30 * 12 + 50 * 8)
  })

  it('compara os últimos dias com os anteriores', () => {
    const c = compararPeriodos(l, 30, HOJE)
    expect(c.atual.execucoes).toBe(2)
    expect(c.anterior.execucoes).toBe(1)
    expect(c.atualDe).toBe('2026-10-04')
    expect(c.anteriorAte).toBe('2026-10-03')
    expect(variacao(c.atual.execucoes, c.anterior.execucoes)).toBe(100)
    expect(variacao(5, 0)).toBeNull()
  })
})

describe('feedback, foco e ordem', () => {
  it('intensidade antiga a partir do esforço', () => {
    expect(intensidadeDoEsforco(1)).toBe('Muito leve')
    expect(intensidadeDoEsforco(5)).toBe('Moderada')
    expect(intensidadeDoEsforco(10)).toBe('Muito intensa')
  })

  it('sugere o foco pelos exercícios do catálogo', () => {
    expect(focoSugerido([{ nome: 'Supino reto' }, { nome: 'Supino inclinado' }, { nome: 'Exercício inventado' }])).toEqual(['Peito'])
  })

  it('move e reletra os treinos', () => {
    const l = [{ letra: 'A', n: 1 }, { letra: 'B', n: 2 }, { letra: 'C', n: 3 }]
    const novo = reletrar(mover(l, 2, -1))
    expect(novo.map((t) => `${t.letra}${t.n}`)).toEqual(['A1', 'B3', 'C2'])
    expect(mover(l, 0, -1)).toBe(l)
  })
})
