// Central de Inteligência: o professor escolhe o aluno e vê, por área, a cor e o
// achado principal dos testes, os exercícios ligados aos achados e, embaixo,
// revisa a análise e define a estratégia. O app coleta, organiza e sugere;
// a decisão final é do profissional e fica guardada na ficha.

import type { ResultadoNuvem } from '../nuvem/resultados'
import type { Status } from '../pose/types'
import { analisar, piorStatus, planoDeNuvem, type Analise, type PlanoTeste, type TipoTeste } from './plano'

export type AreaId = 'postura' | 'mobilidade' | 'corrida' | 'flexibilidade' | 'coluna' | 'funcional'

export const AREAS: { id: AreaId; nome: string; tipos: TipoTeste[]; semTeste: string; sempre: boolean }[] = [
  { id: 'postura', nome: 'Avaliação postural', tipos: ['postura'], semTeste: 'Faça a avaliação de postura (4 fotos).', sempre: true },
  { id: 'mobilidade', nome: 'Mobilidade', tipos: ['exercicio'], semTeste: 'Grave um agachamento ou outro exercício em vídeo.', sempre: true },
  { id: 'corrida', nome: 'Corrida', tipos: ['corrida'], semTeste: 'Grave a corrida de lado e de trás.', sempre: true },
  { id: 'flexibilidade', nome: 'Flexibilidade', tipos: ['flexibilidade'], semTeste: 'Faça o Teste de Flexibilidade Digital.', sempre: true },
  { id: 'coluna', nome: 'Coluna (Adams)', tipos: ['adams'], semTeste: 'Faça o Teste de Adams Digital.', sempre: true },
  { id: 'funcional', nome: 'Capacidade funcional', tipos: ['idoso'], semTeste: '', sempre: false },
]

export type CartaoArea = {
  id: AreaId
  nome: string
  /** Null quando a área ainda não foi avaliada. */
  status: Status | null
  /** Cor sugerida pelo app, antes da revisão do professor. */
  statusApp: Status | null
  /** Achado principal, em uma linha. */
  achado: string
  planos: PlanoTeste[]
  ajustado: boolean
}

/** Decisão do professor, guardada como resultado do tipo "estrategia". */
export type Estrategia = {
  areas: Partial<Record<AreaId, Status>>
  texto: string
  profissional: string
}

export type Revisao = Estrategia & { data: string; id: string }

/** Primeira frase do ponto de atenção, curta para caber no cartão. */
export function encurtar(texto: string, max = 70) {
  const frase = texto.split(/(?<=[a-zà-ú)°%])\.\s/i)[0].replace(/\.$/, '')
  return frase.length <= max ? frase : `${frase.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

function achadoDe(planos: PlanoTeste[]): string {
  const ponto = planos.flatMap((p) => p.pontos).sort((a, b) => (a.status === 'alerta' ? -1 : b.status === 'alerta' ? 1 : 0))[0]
  if (ponto) return encurtar(ponto.texto)
  return planos.length === 1 ? `Adequado (${planos[0].resultado.toLowerCase()})` : 'Tudo adequado'
}

export function ultimaRevisao(resultados: ResultadoNuvem[]): Revisao | null {
  const r = resultados.filter((x) => x.tipo === 'estrategia').sort((a, b) => b.feito_em.localeCompare(a.feito_em))[0]
  if (!r) return null
  const d = r.dados as Partial<Estrategia>
  return { id: r.id, data: r.feito_em, areas: d.areas ?? {}, texto: typeof d.texto === 'string' ? d.texto : '', profissional: typeof d.profissional === 'string' ? d.profissional : '' }
}

export type Central = {
  analise: Analise | null
  cartoes: CartaoArea[]
  revisao: Revisao | null
  /** Há teste feito depois da última revisão do professor. */
  testesNovos: boolean
  status: Status | null
}

export function montarCentral(resultados: ResultadoNuvem[]): Central {
  const planos = resultados.map(planoDeNuvem).filter((p): p is PlanoTeste => p !== null)
  const analise = analisar(planos)
  const revisao = ultimaRevisao(resultados)
  const recentes = analise?.planos ?? []
  const cartoes: CartaoArea[] = AREAS.filter((a) => a.sempre || recentes.some((p) => a.tipos.includes(p.tipo))).map((a) => {
    const daArea = recentes.filter((p) => a.tipos.includes(p.tipo))
    const statusApp = daArea.length ? piorStatus(daArea.map((p) => p.status)) : null
    // Teste novo na área depois da revisão: volta a valer a cor do app até revisar de novo.
    const doProfessor = revisao && !daArea.some((p) => p.data > revisao.data) ? (revisao.areas[a.id] ?? null) : null
    const status = doProfessor ?? statusApp
    return {
      id: a.id,
      nome: a.nome,
      status,
      statusApp,
      achado: daArea.length ? achadoDe(daArea) : a.semTeste,
      planos: daArea,
      ajustado: doProfessor !== null && doProfessor !== statusApp,
    }
  })
  const testesNovos = !!revisao && recentes.some((p) => p.data > revisao.data)
  // Situação geral pelas cores dos cartões, já com o ajuste do professor.
  const avaliadas = cartoes.flatMap((c) => (c.status ? [c.status] : []))
  const status = avaliadas.length ? piorStatus(avaliadas) : null
  return { analise, cartoes, revisao, testesNovos, status }
}
