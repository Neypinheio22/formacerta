// Rotinas de treino: qual vale hoje para o aluno, situação pelas datas e as
// opções de objetivo, nível, ícone e aeróbico. As contas ficam aqui, separadas
// das telas, para dar para testar.

import { diaLocal } from './semana'

export type Situacao = 'ativa' | 'arquivada' | 'excluida'
export type Nivel = '' | 'iniciante' | 'intermediario' | 'avancado'

export type RotinaBase = {
  id: string
  nome: string
  /** AAAA-MM-DD */
  inicio: string | null
  /** AAAA-MM-DD: validade da rotina. */
  fim: string | null
  situacao: Situacao
  criado_em: string
}

export const OBJETIVOS_ROTINA = [
  'Hipertrofia',
  'Emagrecimento',
  'Condicionamento físico',
  'Força',
  'Definição',
  'Resistência muscular',
  'Saúde e qualidade de vida',
  'Mobilidade e flexibilidade',
  'Postura',
  'Reabilitação',
  'Desempenho esportivo',
] as const

export const NIVEIS: { id: Exclude<Nivel, ''>; rotulo: string }[] = [
  { id: 'iniciante', rotulo: 'Iniciante' },
  { id: 'intermediario', rotulo: 'Intermediário' },
  { id: 'avancado', rotulo: 'Avançado' },
]

export const rotuloNivel = (n: string) => NIVEIS.find((x) => x.id === n)?.rotulo ?? ''

/** Tipo de exercício da rotina, que também escolhe o ícone do cartão. O desenho de cada um fica na tela. */
export const ICONES_ROTINA = [
  { id: 'geral', rotulo: 'Corpo todo' },
  { id: 'superiores', rotulo: 'Superiores' },
  { id: 'pernas', rotulo: 'Inferiores' },
  { id: 'core', rotulo: 'Abdômen' },
  { id: 'cardio', rotulo: 'Cardio' },
  { id: 'mobilidade', rotulo: 'Mobilidade' },
  { id: 'reabilitacao', rotulo: 'Reabilitação' },
] as const

export type IconeRotina = (typeof ICONES_ROTINA)[number]['id']

// Ícones que saíram da lista (30/10): as rotinas guardadas com eles caem num equivalente.
const ICONES_ANTIGOS: Record<string, IconeRotina> = { forca: 'geral', emagrecer: 'cardio' }

/** Tipo que combina com o objetivo, quando o personal não escolhe um. */
export function iconePadrao(objetivo: string): IconeRotina {
  const o = objetivo.toLowerCase()
  if (o.includes('emagrec') || o.includes('defini') || o.includes('condicion') || o.includes('resist') || o.includes('esport')) return 'cardio'
  if (o.includes('mobil') || o.includes('postura')) return 'mobilidade'
  if (o.includes('reabil')) return 'reabilitacao'
  return 'geral'
}

/** Tipo da rotina: o escolhido (trocando os antigos pelo equivalente) ou o que combina com o objetivo. */
export function tipoDaRotina(icone: string, objetivo = ''): IconeRotina {
  if (ICONES_ROTINA.some((i) => i.id === icone)) return icone as IconeRotina
  return ICONES_ANTIGOS[icone] ?? iconePadrao(objetivo)
}

export const rotuloTipo = (icone: string, objetivo = '') => ICONES_ROTINA.find((i) => i.id === tipoDaRotina(icone, objetivo))!.rotulo

/** Divisões prontas: AB, ABC, ABCD, ABCDE. */
export const DIVISOES = ['A', 'AB', 'ABC', 'ABCD', 'ABCDE'] as const

/** Nome sugerido para uma rotina nova: "TREINO NOVO 2026/10". */
export function nomeSugerido(hoje = new Date()): string {
  return `TREINO NOVO ${hoje.getFullYear()}/${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

/** Data (AAAA-MM-DD) somando semanas, para os atalhos de validade. */
export function somarSemanas(dia: string, semanas: number): string {
  const d = new Date(`${dia}T12:00:00`)
  d.setDate(d.getDate() + semanas * 7)
  return diaLocal(d)
}

/** "30/10/2026" a partir de AAAA-MM-DD, sem pular de dia pelo fuso. */
export function dataDia(dia: string | null): string {
  if (!dia) return ''
  const [a, m, d] = dia.split('-')
  return `${d}/${m}/${a}`
}

/** Dias inteiros de "de" até "ate" (AAAA-MM-DD). */
function diasEntre(de: string, ate: string): number {
  return Math.round((new Date(`${ate}T12:00:00`).getTime() - new Date(`${de}T12:00:00`).getTime()) / 86400000)
}

export type Andamento = { rotulo: string; tom: 'ok' | 'atencao' | 'alerta' | 'neutro' }

/** Situação da rotina pelas datas: em andamento, vence logo, vencida, começa depois. */
export function andamento(r: Pick<RotinaBase, 'inicio' | 'fim' | 'situacao'>, hoje = new Date()): Andamento {
  if (r.situacao === 'arquivada') return { rotulo: 'Arquivada', tom: 'neutro' }
  if (r.situacao === 'excluida') return { rotulo: 'Excluída', tom: 'alerta' }
  const dia = diaLocal(hoje)
  if (r.inicio && r.inicio > dia) {
    const n = diasEntre(dia, r.inicio)
    return { rotulo: n === 1 ? 'Começa amanhã' : `Começa em ${n} dias`, tom: 'neutro' }
  }
  if (r.fim && r.fim < dia) return { rotulo: 'Vencida', tom: 'alerta' }
  if (r.fim) {
    const n = diasEntre(dia, r.fim)
    if (n <= 7) return { rotulo: n === 0 ? 'Vence hoje' : n === 1 ? 'Vence amanhã' : `Vence em ${n} dias`, tom: 'atencao' }
  }
  return { rotulo: 'Em andamento', tom: 'ok' }
}

/**
 * Rotina que o aluno segue hoje, entre as ativas: a que já começou e ainda vale
 * (a mais nova, se houver mais de uma). Sem nenhuma assim, a que começou por
 * último mesmo vencida (o aluno não fica sem treino até o personal renovar), e
 * só então a que ainda vai começar.
 */
export function rotinaAtual<T extends RotinaBase>(rotinas: T[], hoje = new Date()): T | null {
  const dia = diaLocal(hoje)
  const ativas = rotinas.filter((r) => r.situacao === 'ativa')
  const maisNova = (a: T, b: T) => (b.inicio ?? '').localeCompare(a.inicio ?? '') || b.criado_em.localeCompare(a.criado_em)
  const comecou = ativas.filter((r) => !r.inicio || r.inicio <= dia).sort(maisNova)
  return comecou.find((r) => !r.fim || r.fim >= dia) ?? comecou[0] ?? [...ativas].sort(maisNova).reverse()[0] ?? null
}

/** Ordem da lista: ativas primeiro (a atual no topo), depois as mais novas. */
export function ordenarRotinas<T extends RotinaBase>(rotinas: T[], hoje = new Date()): T[] {
  const atual = rotinaAtual(rotinas, hoje)
  return [...rotinas].sort((a, b) => Number(b.id === atual?.id) - Number(a.id === atual?.id) || (b.inicio ?? b.criado_em).localeCompare(a.inicio ?? a.criado_em) || b.criado_em.localeCompare(a.criado_em))
}

export const TIPOS_AEROBICO = ['Caminhada', 'Corrida', 'Esteira', 'Bicicleta', 'Bike ergométrica', 'Elíptico', 'Escada', 'Remo', 'Natação', 'Pular corda', 'HIIT'] as const

export const INTENSIDADES_AEROBICO = ['Leve (conversa fácil)', 'Moderada (fala com esforço)', 'Intensa (difícil falar)', 'Intervalado (forte e leve)'] as const

/** Resumo de uma linha: "Esteira · 30 min · Moderada · 3x por semana". */
export function resumoAerobico(a: { tipo: string; duracao_min: number | null; intensidade: string; vezes_semana: number | null }): string {
  return [a.tipo, a.duracao_min && `${a.duracao_min} min`, a.intensidade.replace(/\s*\(.*\)$/, ''), a.vezes_semana && `${a.vezes_semana}x por semana`].filter(Boolean).join(' · ')
}
