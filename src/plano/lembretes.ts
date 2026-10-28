// Lembrete de reavaliação: a partir dos resultados guardados no banco, mostra
// quem está na hora de refazer cada teste. Só vale o teste mais recente de cada
// tipo da mesma pessoa: refazer o teste "apaga" o lembrete antigo.

import type { Ficha } from '../nuvem/fichas'
import type { ResultadoNuvem } from '../nuvem/resultados'
import { planoDeNuvem } from './plano'

export type Situacao = 'atrasada' | 'hoje' | 'breve' | 'futura'

export type Lembrete = {
  /** Chave da pessoa: ficha, conta do aluno ou apelido. */
  pessoa: string
  nome: string
  fichaId: string | null
  alunoId: string | null
  telefone: string
  teste: string
  /** AAAA-MM-DD */
  data: string
  /** Negativo: atrasada há tantos dias. */
  dias: number
  situacao: Situacao
}

/** Quantos dias antes o lembrete já aparece como "em breve". */
export const DIAS_AVISO = 7

const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function diasEntre(de: string, ate: string) {
  const [a, b] = [de, ate].map((s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

export function situacaoDe(dias: number): Situacao {
  if (dias < 0) return 'atrasada'
  if (dias === 0) return 'hoje'
  return dias <= DIAS_AVISO ? 'breve' : 'futura'
}

/** De quanto em quanto tempo o aluno se pesa e mede de novo. */
export const DIAS_MEDIDAS = 30
export const TESTE_MEDIDAS = 'Peso e medidas do corpo'

/** Quando refazer: pelo plano de ação do teste, ou todo mês para as medidas do corpo. */
function reavaliacao(r: ResultadoNuvem): { chave: string; teste: string; reavaliarEm: string } | null {
  if (r.tipo === 'medidas') {
    const d = new Date(r.feito_em)
    d.setDate(d.getDate() + DIAS_MEDIDAS)
    return { chave: 'medidas', teste: TESTE_MEDIDAS, reavaliarEm: d.toISOString() }
  }
  return planoDeNuvem(r)
}

/** Data de reavaliação de um resultado (AAAA-MM-DD), ou null se o teste não tem. */
export function dataReavaliacao(r: ResultadoNuvem): string | null {
  const p = reavaliacao(r)
  return p ? diaLocal(new Date(p.reavaliarEm)) : null
}

/** Todos os lembretes, do mais atrasado para o mais distante. */
export function lembretes(resultados: ResultadoNuvem[], fichas: Ficha[] = [], hoje = new Date()): Lembrete[] {
  const porFicha = new Map(fichas.map((f) => [f.id, f]))
  const porAluno = new Map(fichas.filter((f) => f.aluno_id).map((f) => [f.aluno_id!, f]))
  const recentes = new Map<string, Lembrete>()
  const feitos = new Map<string, string>()
  const dia = diaLocal(hoje)

  for (const r of resultados) {
    const p = reavaliacao(r)
    if (!p) continue
    const ficha = (r.ficha_id && porFicha.get(r.ficha_id)) || (r.aluno_id && porAluno.get(r.aluno_id)) || null
    const pessoa = ficha ? `f:${ficha.id}` : r.aluno_id ? `a:${r.aluno_id}` : `n:${r.enviado_por}:${r.apelido.trim().toLocaleLowerCase('pt-BR')}`
    const chave = `${pessoa}|${p.chave}`
    if ((feitos.get(chave) ?? '') >= r.feito_em) continue
    feitos.set(chave, r.feito_em)
    const data = diaLocal(new Date(p.reavaliarEm))
    const dias = diasEntre(dia, data)
    recentes.set(chave, {
      pessoa,
      nome: ficha?.nome || r.apelido || 'Aluno',
      fichaId: ficha?.id ?? r.ficha_id,
      alunoId: ficha?.aluno_id ?? r.aluno_id,
      telefone: ficha?.telefone ?? '',
      teste: p.teste,
      data,
      dias,
      situacao: situacaoDe(dias),
    })
  }
  return [...recentes.values()].sort((a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Só os que já venceram ou vencem nos próximos dias. */
export const pendentes = (ls: Lembrete[]) => ls.filter((l) => l.situacao !== 'futura')

export function textoSituacao(l: Pick<Lembrete, 'dias' | 'situacao'>): string {
  if (l.situacao === 'hoje') return 'é hoje'
  if (l.situacao === 'atrasada') return l.dias === -1 ? 'venceu ontem' : `venceu há ${-l.dias} dias`
  return l.dias === 1 ? 'amanhã' : `em ${l.dias} dias`
}

/** Mensagem pronta para o personal mandar ao aluno pelo WhatsApp. */
export function mensagemLembrete(nome: string, testes: string[], profissional = ''): string {
  const primeiro = nome.trim().split(' ')[0] || 'Olá'
  const lista = testes.map((t) => `• ${t}`).join('\n')
  return [
    `Oi, ${primeiro}! Chegou a hora da sua reavaliação no FormaCerta:`,
    lista,
    'Refazer os testes mostra o quanto você evoluiu e ajusta o seu treino. Vamos marcar?',
    ...(profissional ? [`${profissional}`] : []),
  ].join('\n\n')
}
