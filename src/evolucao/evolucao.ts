// Evolução do aluno: junta todas as avaliações guardadas na ficha (postura,
// flexibilidade, Adams, idoso, medidas do corpo, corrida e exercícios), separa
// cada número acompanhado e diz se melhorou ou piorou de uma avaliação para outra.

import { METRICAS, calcularImc, classificarCintura, classificarImc } from '../idoso/analise'
import { CIRCUNFERENCIAS, type AvaliacaoIdoso, type Circunferencia } from '../idoso/tipos'
import { EXERCICIOS } from '../movimento/exercicios'
import { VIEWS, type Status } from '../pose/types'
import { anguloAdams, classificarAdams } from '../testes/adams'
import { infoNivel, type NivelFlex } from '../testes/flexibilidade'
import type { Objetivo } from '../nuvem/fichas'
import type { ResultadoNuvem } from '../nuvem/resultados'

export type Grupo = 'corpo' | 'postura' | 'coluna' | 'funcional' | 'movimento'

export const GRUPOS: { id: Grupo; rotulo: string }[] = [
  { id: 'corpo', rotulo: 'Corpo e medidas' },
  { id: 'postura', rotulo: 'Postura' },
  { id: 'coluna', rotulo: 'Flexibilidade e coluna' },
  { id: 'funcional', rotulo: 'Testes funcionais' },
  { id: 'movimento', rotulo: 'Corrida e exercícios' },
]

/** Para que lado é melhor: número maior, menor, ou depende (só mostra se subiu ou desceu). */
export type Sentido = 'maior' | 'menor' | null

export type Leitura = { id: string; grupo: Grupo; rotulo: string; unidade: string; casas: number; sentido: Sentido; valor: number; status: Status }

/** O que vale para todas as avaliações do aluno: objetivo, altura, idade e sexo. */
export type Contexto = { objetivo: Objetivo; altura: number | null; idade: number | null; sexo: string | null }

/** Medidas do corpo anotadas pelo profissional (tipo "medidas"). */
export type DadosMedidas = {
  peso?: number | null
  /** % de gordura */
  gordura?: number | null
  /** Batimentos por minuto em repouso */
  fcRepouso?: number | null
  circ?: Partial<Record<Circunferencia, number>>
  observacoes?: string
}

export const PERIMETRIA = CIRCUNFERENCIAS.filter((c) => !('antiga' in c))

const MEMBROS = new Set<string>(['torax', 'bracoD', 'bracoE', 'antebracoD', 'antebracoE', 'coxaE', 'coxaD', 'braco', 'coxa'])
const PANTURRILHAS = new Set<string>(['panturrilhaE', 'panturrilhaD', 'panturrilha'])

/** Medidas do corpo: o lado bom depende do objetivo do aluno. */
export function sentidoCorpo(id: string, objetivo: Objetivo): Sentido {
  if (id === 'peso' || id === 'imc') return objetivo === 'emagrecer' ? 'menor' : objetivo === 'massa' ? 'maior' : null
  if (id === 'gordura' || id === 'fcRepouso' || id === 'cintura' || id === 'abdomen') return 'menor'
  if (id === 'quadril') return objetivo === 'emagrecer' ? 'menor' : null
  if (MEMBROS.has(id)) return objetivo === 'massa' ? 'maior' : null
  // Panturrilha fina indica perda de massa muscular, principalmente no idoso.
  if (PANTURRILHAS.has(id)) return objetivo === 'emagrecer' ? null : 'maior'
  return null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const lerGraus = (texto: unknown): number | null => {
  if (typeof texto !== 'string') return null
  const v = parseFloat(texto.replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(v) ? v : null
}

const statusNota = (nota: number): Status => (nota >= 80 ? 'ok' : nota >= 60 ? 'atencao' : 'alerta')

const ehStatus = (s: unknown): s is Status => s === 'ok' || s === 'atencao' || s === 'alerta'

function corpo(id: string, rotulo: string, unidade: string, casas: number, valor: number, ctx: Contexto, status: Status = 'ok'): Leitura {
  return { id, grupo: 'corpo', rotulo, unidade, casas, sentido: sentidoCorpo(id, ctx.objetivo), valor, status }
}

function sexoBio(s: string | null) {
  return s === 'feminino' || s === 'masculino' ? s : null
}

function leiturasMedidas(d: DadosMedidas, ctx: Contexto): Leitura[] {
  const saida: Leitura[] = []
  const peso = num(d.peso)
  if (peso !== null) {
    saida.push(corpo('peso', 'Peso', 'kg', 1, peso, ctx))
    const imc = calcularImc(peso, ctx.altura)
    if (imc !== null) saida.push(corpo('imc', 'IMC', '', 1, imc, ctx, classificarImc(imc, ctx.idade).status))
  }
  const gordura = num(d.gordura)
  if (gordura !== null) saida.push(corpo('gordura', 'Gordura corporal', '%', 1, gordura, ctx))
  const fc = num(d.fcRepouso)
  if (fc !== null) saida.push(corpo('fcRepouso', 'Frequência cardíaca em repouso', 'bpm', 0, fc, ctx))
  for (const c of CIRCUNFERENCIAS) {
    const cm = num(d.circ?.[c.id])
    if (cm === null) continue
    const status = c.id === 'cintura' ? (classificarCintura(cm, sexoBio(ctx.sexo))?.status ?? 'ok') : 'ok'
    saida.push(corpo(c.id, c.nome, 'cm', c.id === 'cintura' || c.id === 'abdomen' || c.id === 'quadril' ? 0 : 1, cm, ctx, status))
  }
  return saida
}

const CORPO_IDOSO = new Set<string>(['peso', 'imc', ...CIRCUNFERENCIAS.map((c) => c.id)])

function leiturasIdoso(a: AvaliacaoIdoso, ctx: Contexto): Leitura[] {
  const saida: Leitura[] = []
  for (const m of METRICAS) {
    const valor = m.valor(a)
    if (valor === null || !Number.isFinite(valor)) continue
    const doCorpo = CORPO_IDOSO.has(m.id)
    saida.push({
      id: m.id,
      grupo: doCorpo ? 'corpo' : 'funcional',
      rotulo: m.rotulo,
      unidade: m.unidade,
      casas: m.casas,
      // Nas medidas do corpo vale o objetivo do aluno; nos testes, o sentido do próprio teste.
      sentido: doCorpo ? sentidoCorpo(m.id, ctx.objetivo) : m.maiorMelhor === null ? null : m.maiorMelhor ? 'maior' : 'menor',
      valor,
      status: m.status(a),
    })
  }
  return saida
}

const nomeVista = (v: unknown) => VIEWS.find((x) => x.id === v)?.label.toLowerCase() ?? String(v)

/** Os números de uma avaliação guardada no banco. Avaliações com dados faltando só pulam o que falta. */
export function leituras(r: ResultadoNuvem, ctx: Contexto): Leitura[] {
  const d = (r.dados ?? {}) as Record<string, unknown>
  const c: Contexto = { ...ctx, altura: ctx.altura ?? r.altura_cm, idade: ctx.idade ?? r.idade, sexo: ctx.sexo ?? r.sexo }
  try {
    switch (r.tipo) {
      case 'medidas':
        return leiturasMedidas(d as DadosMedidas, c)
      case 'idoso': {
        const a = d as unknown as AvaliacaoIdoso
        if (!a.anamnese || !a.antropometria) return []
        return leiturasIdoso({ ...a, antropometria: { ...a.antropometria, circ: a.antropometria.circ ?? {} }, testes: a.testes ?? {}, berg: a.berg ?? [] }, c)
      }
      case 'postura': {
        const saida: Leitura[] = []
        const nota = num(d.score)
        if (nota !== null) saida.push({ id: 'postura', grupo: 'postura', rotulo: 'Nota da postura', unidade: 'pontos', casas: 0, sentido: 'maior', valor: nota, status: statusNota(nota) })
        for (const v of (Array.isArray(d.views) ? d.views : []) as { view?: string; findings?: { id?: string; title?: string; value?: string; status?: Status }[] }[]) {
          for (const f of v.findings ?? []) {
            const valor = lerGraus(f.value)
            if (valor === null || !f.id) continue
            const pct = f.value?.includes('%')
            saida.push({
              id: `postura:${v.view}:${f.id}`,
              grupo: 'postura',
              rotulo: `${f.title} (${nomeVista(v.view)})`,
              unidade: pct ? '%' : '°',
              casas: pct ? 0 : 1,
              // Os números da postura são desvios: quanto menor, mais alinhado.
              sentido: 'menor',
              valor,
              status: ehStatus(f.status) ? f.status : 'ok',
            })
          }
        }
        return saida
      }
      case 'flexibilidade': {
        const alcance = num(d.alcance)
        if (alcance === null) return []
        const nivel = typeof d.nivel === 'string' ? (d.nivel as NivelFlex) : null
        const status = nivel ? (infoNivel(nivel)?.status ?? 'ok') : 'ok'
        return [{ id: 'flexibilidade', grupo: 'coluna', rotulo: 'Flexibilidade (alcance das mãos)', unidade: '%', casas: 0, sentido: 'maior', valor: alcance, status }]
      }
      case 'adams': {
        const ang = anguloAdams({ atr: num(d.atr), escoliometro: num(d.escoliometro) })
        if (ang === null) return []
        return [{ id: 'adams', grupo: 'coluna', rotulo: 'Teste de Adams (rotação do tronco)', unidade: '°', casas: 1, sentido: 'menor', valor: ang, status: classificarAdams(ang).status }]
      }
      case 'corrida': {
        const nota = num(d.score)
        if (nota === null || d.falha) return []
        const vista = d.vista === 'tras' ? 'de trás' : 'de lado'
        return [{ id: `corrida:${d.vista}`, grupo: 'movimento', rotulo: `Nota da corrida (${vista})`, unidade: 'pontos', casas: 0, sentido: 'maior', valor: nota, status: statusNota(nota) }]
      }
      case 'exercicio': {
        const nota = num(d.score)
        if (nota === null) return []
        const nome = EXERCICIOS.find((e) => e.id === d.exercicio)?.nome ?? 'Exercício'
        return [{ id: `exercicio:${d.exercicio}`, grupo: 'movimento', rotulo: `Execução: ${nome}`, unidade: 'pontos', casas: 0, sentido: 'maior', valor: nota, status: statusNota(nota) }]
      }
    }
  } catch {
    /* avaliação com formato antigo ou incompleto */
  }
  return []
}

export type Tendencia = 'melhorou' | 'piorou' | 'manteve' | 'subiu' | 'desceu'

export const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  melhorou: 'Melhorou',
  piorou: 'Piorou',
  manteve: 'Manteve',
  subiu: 'Subiu',
  desceu: 'Desceu',
}

export type Variacao = { diferenca: number; tendencia: Tendencia }

export function variacao(antes: number, depois: number, casas: number, sentido: Sentido): Variacao {
  const diferenca = Math.round((depois - antes) * 10 ** casas) / 10 ** casas
  if (diferenca === 0) return { diferenca: 0, tendencia: 'manteve' }
  if (sentido === null) return { diferenca, tendencia: diferenca > 0 ? 'subiu' : 'desceu' }
  return { diferenca, tendencia: (diferenca > 0) === (sentido === 'maior') ? 'melhorou' : 'piorou' }
}

export type PontoSerie = { date: string; valor: number; status: Status; resultadoId: string }

export type Serie = Omit<Leitura, 'valor' | 'status'> & {
  /** Do mais antigo para o mais novo. */
  pontos: PontoSerie[]
  /** Última avaliação comparada com a anterior. */
  vsAnterior: Variacao | null
  /** Última avaliação comparada com a primeira. */
  vsPrimeira: Variacao | null
}

/** Uma série por número acompanhado, na ordem dos grupos. */
export function evolucao(resultados: ResultadoNuvem[], ctx: Contexto): Serie[] {
  const series = new Map<string, Serie>()
  const ordem = [...resultados].sort((a, b) => a.feito_em.localeCompare(b.feito_em))
  for (const r of ordem) {
    for (const l of leituras(r, ctx)) {
      const { valor, status, ...info } = l
      const s = series.get(l.id) ?? { ...info, pontos: [], vsAnterior: null, vsPrimeira: null }
      // A informação mais nova vale (o objetivo pode ter mudado o sentido).
      Object.assign(s, info)
      s.pontos.push({ date: r.feito_em, valor, status, resultadoId: r.id })
      series.set(l.id, s)
    }
  }
  const lista = [...series.values()]
  for (const s of lista) {
    const n = s.pontos.length
    if (n < 2) continue
    s.vsAnterior = variacao(s.pontos[n - 2].valor, s.pontos[n - 1].valor, s.casas, s.sentido)
    s.vsPrimeira = variacao(s.pontos[0].valor, s.pontos[n - 1].valor, s.casas, s.sentido)
  }
  const g = GRUPOS.map((x) => x.id)
  return lista.sort((a, b) => g.indexOf(a.grupo) - g.indexOf(b.grupo))
}

export type Placar = { melhorou: number; piorou: number; manteve: number }

/** Quantos itens melhoraram, pioraram ou ficaram iguais (só os que têm lado bom definido). */
export function placar(series: Serie[], comparar: 'vsAnterior' | 'vsPrimeira'): Placar {
  const p: Placar = { melhorou: 0, piorou: 0, manteve: 0 }
  for (const s of series) {
    if (s.sentido === null) continue
    const t = s[comparar]?.tendencia
    if (t === 'melhorou' || t === 'piorou' || t === 'manteve') p[t]++
  }
  return p
}
