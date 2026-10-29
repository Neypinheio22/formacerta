// "Meu corpo hoje": com altura, peso, idade, sexo e (se tiver) as medidas da
// fita, o app calcula IMC, gordura estimada e relação cintura/altura, e diz
// como ajustar a série sugerida: baixo impacto quando o corpo pede, e séries
// e repetições pelo objetivo do aluno. São estimativas para orientar o
// treino, não diagnóstico.

import { calcularImc, classificarImc } from '../idoso/analise'
import type { Circunferencia } from '../idoso/tipos'
import type { DadosMedidas } from '../evolucao/evolucao'
import type { Objetivo } from '../nuvem/fichas'
import type { ResultadoNuvem } from '../nuvem/resultados'
import type { ExercicioTreino, Treino } from '../nuvem/treinos'
import type { Status } from '../pose/types'

export type Sexo = 'feminino' | 'masculino'

export type DadosCorpo = {
  alturaCm: number | null
  idade: number | null
  sexo: string | null
  peso: number | null
  /** % de gordura medida (bioimpedância, adipômetro), quando o aluno tem. */
  gordura: number | null
  circ: Partial<Record<Circunferencia, number>>
}

export type ItemCorpo = {
  id: 'imc' | 'gordura' | 'rce'
  rotulo: string
  valor: number
  unidade: string
  status: Status
  /** Classificação curta: "Peso adequado", "Acima do ideal"... */
  faixa: string
  /** Como foi calculado, em uma frase. */
  como: string
  /** O que é e por que importa. */
  explicacao: string
}

const sexoBio = (s: string | null): Sexo | null => (s === 'feminino' || s === 'masculino' ? s : null)
const umaCasa = (n: number) => Math.round(n * 10) / 10

/** Gordura pela fórmula da Marinha dos EUA (Hodgdon e Beckett), com medidas em cm. */
export function gorduraMarinha(sexo: Sexo, alturaCm: number, cinturaCm: number, pescocoCm: number, quadrilCm?: number | null): number | null {
  if (sexo === 'masculino') {
    if (cinturaCm <= pescocoCm) return null
    return umaCasa(495 / (1.0324 - 0.19077 * Math.log10(cinturaCm - pescocoCm) + 0.15456 * Math.log10(alturaCm)) - 450)
  }
  if (!quadrilCm || cinturaCm + quadrilCm <= pescocoCm) return null
  return umaCasa(495 / (1.29579 - 0.35004 * Math.log10(cinturaCm + quadrilCm - pescocoCm) + 0.221 * Math.log10(alturaCm)) - 450)
}

/** Gordura aproximada só pelo IMC, idade e sexo (Deurenberg, 1991). Só para adultos. */
export function gorduraDeurenberg(imc: number, idade: number, sexo: Sexo): number | null {
  if (idade < 18) return null
  return umaCasa(1.2 * imc + 0.23 * idade - 10.8 * (sexo === 'masculino' ? 1 : 0) - 5.4)
}

/** Faixas de gordura do American Council on Exercise (ACE), por sexo. */
export function classificarGordura(pct: number, sexo: Sexo): { status: Status; faixa: string } {
  const [essencial, atleta, fitness, media] = sexo === 'masculino' ? [6, 14, 18, 25] : [14, 21, 25, 32]
  if (pct < essencial) return { status: 'atencao', faixa: 'Muito baixa' }
  if (pct < atleta) return { status: 'ok', faixa: 'Atleta' }
  if (pct < fitness) return { status: 'ok', faixa: 'Boa forma' }
  if (pct < media) return { status: 'ok', faixa: 'Na média' }
  if (pct < media + 5) return { status: 'atencao', faixa: 'Acima do ideal' }
  return { status: 'alerta', faixa: 'Alta' }
}

/** Relação cintura/altura: acima de 0,5 o risco para a saúde aumenta, em qualquer sexo. */
export function classificarRce(rce: number): { status: Status; faixa: string } {
  if (rce < 0.5) return { status: 'ok', faixa: 'Adequada' }
  if (rce < 0.6) return { status: 'atencao', faixa: 'Risco aumentado' }
  return { status: 'alerta', faixa: 'Risco alto' }
}

/** Junta as medidas mais recentes: cada número vem da última vez em que foi anotado. */
export function medidasRecentes(resultados: ResultadoNuvem[]): { peso: number | null; gordura: number | null; circ: Partial<Record<Circunferencia, number>>; em: string | null } {
  const lista = resultados.filter((r) => r.tipo === 'medidas').sort((a, b) => b.feito_em.localeCompare(a.feito_em))
  const saida: { peso: number | null; gordura: number | null; circ: Partial<Record<Circunferencia, number>>; em: string | null } = { peso: null, gordura: null, circ: {}, em: lista[0]?.feito_em ?? null }
  for (const r of lista) {
    const d = (r.dados ?? {}) as DadosMedidas
    if (saida.peso === null && typeof d.peso === 'number') saida.peso = d.peso
    if (saida.gordura === null && typeof d.gordura === 'number') saida.gordura = d.gordura
    for (const [k, v] of Object.entries(d.circ ?? {})) {
      if (typeof v === 'number' && saida.circ[k as Circunferencia] === undefined) saida.circ[k as Circunferencia] = v
    }
  }
  return saida
}

/** IMC, gordura e cintura/altura, só o que dá para calcular com os dados que existem. */
export function meuCorpo(d: DadosCorpo): ItemCorpo[] {
  const itens: ItemCorpo[] = []
  const sexo = sexoBio(d.sexo)
  const imc = calcularImc(d.peso, d.alturaCm)
  if (imc !== null) {
    const c = classificarImc(imc, d.idade)
    itens.push({
      id: 'imc',
      rotulo: 'IMC',
      valor: imc,
      unidade: '',
      status: c.status,
      faixa: c.rotulo,
      como: 'Peso dividido pela altura ao quadrado.',
      explicacao:
        'Mostra se o peso combina com a altura. Não separa músculo de gordura: quem tem muito músculo pode ter IMC alto e estar bem. Por isso o app olha também a gordura e a cintura.',
    })
  }

  const cintura = d.circ.cintura ?? d.circ.abdomen ?? null
  let gordura: { valor: number; como: string } | null = null
  if (d.gordura !== null) gordura = { valor: d.gordura, como: 'Valor que você anotou (balança de bioimpedância ou adipômetro).' }
  else if (sexo && d.alturaCm && d.circ.pescoco) {
    // A Marinha mede o homem na altura do umbigo e a mulher na parte mais fina.
    const c = sexo === 'masculino' ? (d.circ.abdomen ?? d.circ.cintura) : (d.circ.cintura ?? d.circ.abdomen)
    const v = c ? gorduraMarinha(sexo, d.alturaCm, c, d.circ.pescoco, d.circ.quadril) : null
    if (v !== null && v > 2 && v < 70) gordura = { valor: v, como: 'Estimada pelas medidas da fita (fórmula da Marinha dos EUA).' }
  }
  if (!gordura && sexo && imc !== null && d.idade !== null) {
    const v = gorduraDeurenberg(imc, d.idade, sexo)
    if (v !== null && v > 2 && v < 70) gordura = { valor: v, como: 'Aproximada pelo IMC, idade e sexo. Meça cintura, pescoço e quadril para um número mais certo.' }
  }
  if (gordura && sexo) {
    const c = classificarGordura(gordura.valor, sexo)
    itens.push({
      id: 'gordura',
      rotulo: 'Gordura corporal',
      valor: gordura.valor,
      unidade: '%',
      status: c.status,
      faixa: c.faixa,
      como: gordura.como,
      explicacao: 'Quanto do seu peso é gordura. É o número que mais mostra se o treino e a alimentação estão funcionando, mais que o peso na balança.',
    })
  }

  if (cintura && d.alturaCm) {
    const rce = Math.round((cintura / d.alturaCm) * 100) / 100
    const c = classificarRce(rce)
    itens.push({
      id: 'rce',
      rotulo: 'Cintura / altura',
      valor: rce,
      unidade: '',
      status: c.status,
      faixa: c.faixa,
      como: 'Medida da cintura dividida pela altura.',
      explicacao: 'Mostra a gordura na barriga, a que mais pesa para coração e diabetes. A regra é simples: a cintura deve ter menos da metade da sua altura (menos de 0,50).',
    })
  }
  return itens
}

// ---------- Ajuste da série sugerida ----------

export type PerfilTreino = {
  /** Trocar saltos e impacto por exercícios mais leves para as articulações. */
  baixoImpacto: boolean
  /** Cardio para pôr no fim do treino, quando o objetivo ou o corpo pedem. */
  cardio: string | null
  /** Séries e repetições dos exercícios principais, pelo objetivo. */
  series: string | null
  reps: string | null
  descanso: string | null
  /** Frases curtas que explicam ao aluno por que a série mudou. */
  motivos: string[]
}

const DOSE: Partial<Record<Objetivo, { series: string; reps: string; descanso: string; texto: string }>> = {
  emagrecer: { series: '3', reps: '12 a 15', descanso: '30 a 45 s', texto: 'Para emagrecer: mais repetições e descanso curto, para gastar mais energia.' },
  definir: { series: '3', reps: '10 a 15', descanso: '45 s', texto: 'Para definir: repetições moderadas e descanso curto, para manter o músculo e queimar gordura.' },
  condicionamento: { series: '3', reps: '15 a 20', descanso: '30 s', texto: 'Para condicionamento: mais repetições e pouco descanso, para ganhar fôlego.' },
  massa: { series: '4', reps: '8 a 12', descanso: '60 a 90 s', texto: 'Para ganhar massa: 8 a 12 repetições com carga que canse no fim da série.' },
  forca: { series: '4', reps: '6 a 8', descanso: '90 s a 2 min', texto: 'Para força: menos repetições, mais carga e descanso maior.' },
}

/** Como a série sugerida deve mudar, pelo corpo e pelo objetivo do aluno. */
export function perfilTreino(itens: ItemCorpo[], objetivo: Objetivo): PerfilTreino {
  const motivos: string[] = []
  const imc = itens.find((i) => i.id === 'imc')
  const gordura = itens.find((i) => i.id === 'gordura')
  const rce = itens.find((i) => i.id === 'rce')
  const baixoImpacto = (imc?.valor ?? 0) >= 30 || gordura?.status === 'alerta' || ((imc?.valor ?? 0) >= 27 && rce?.status === 'alerta')
  if (baixoImpacto) motivos.push('Pelo seu peso e medidas, os saltos viraram exercícios de baixo impacto, para poupar joelhos e coluna.')

  const pedeCardio = baixoImpacto || objetivo === 'emagrecer' || objetivo === 'definir' || objetivo === 'condicionamento' || gordura?.status === 'atencao'
  const cardio = pedeCardio ? (baixoImpacto ? 'Caminhada leve ou bicicleta, 15 a 20 minutos' : 'Caminhada rápida ou bicicleta, 20 minutos') : null
  if (cardio) motivos.push('Entrou cardio no fim do treino, que ajuda a baixar a gordura e melhora o fôlego.')

  const dose = DOSE[objetivo]
  if (dose) motivos.push(dose.texto)
  return { baixoImpacto, cardio, series: dose?.series ?? null, reps: dose?.reps ?? null, descanso: dose?.descanso ?? null, motivos }
}

const AQUECIMENTO = 'Polichinelo'

const TROCA_BAIXO_IMPACTO: Record<string, Partial<ExercicioTreino>> = {
  Polichinelo: { nome: 'Marcha no lugar', obs: 'Aquecimento sem saltos, elevando bem os joelhos' },
  'Flexão de braço': { obs: 'Na parede ou com os joelhos no chão' },
  'Afundo (avanço)': { obs: 'Passo curto, com a mão apoiada na parede' },
  Agachamento: { obs: 'Agache até sentar numa cadeira e levante' },
}

/** A série sugerida já ajustada. Treino montado pelo personal não passa por aqui. */
export function ajustarSerie(treinos: Treino[], p: PerfilTreino): Treino[] {
  if (!p.baixoImpacto && !p.cardio && !p.reps) return treinos
  return treinos.map((t) => {
    const exercicios = t.exercicios.map((e) => {
      const aquecimento = e.nome === AQUECIMENTO
      let novo = { ...e }
      if (!aquecimento && p.reps && p.series) novo = { ...novo, series: p.series, reps: /cada perna/.test(e.reps) ? `${p.reps} cada perna` : p.reps }
      if (p.baixoImpacto && TROCA_BAIXO_IMPACTO[e.nome]) novo = { ...novo, ...TROCA_BAIXO_IMPACTO[e.nome] }
      if (!aquecimento && p.descanso && !novo.obs) novo = { ...novo, obs: `Descanso de ${p.descanso}` }
      return novo
    })
    if (p.cardio) exercicios.push({ nome: 'Cardio', series: '1', reps: p.cardio, obs: 'No fim do treino, num ritmo em que ainda dá para conversar' })
    return { ...t, exercicios }
  })
}

/** "Meu corpo hoje" a partir da ficha e das medidas guardadas. */
export function corpoDaFicha(
  ficha: { altura_cm: number | null; sexo: string | null },
  medidas: ResultadoNuvem[],
  idade: number | null,
): ItemCorpo[] {
  const m = medidasRecentes(medidas)
  return meuCorpo({ alturaCm: ficha.altura_cm, idade, sexo: ficha.sexo, peso: m.peso, gordura: m.gordura, circ: m.circ })
}
