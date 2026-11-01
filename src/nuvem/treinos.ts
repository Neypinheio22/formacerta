import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import type { Ficha } from './fichas'
import { limparLinha, linhasDe, linhaVazia, linhaVaziaDe, type LinhaSerie } from '../treino/linhas'

/**
 * Um exercício da ficha de treino, como o personal escreveu. Os treinos novos
 * usam as linhas (série/rep, carga, intervalo, cadência...); séries,
 * repetições e dica ficam para os treinos guardados antes delas.
 */
export type ExercicioTreino = { nome: string; series: string; reps: string; obs: string; linhas?: LinhaSerie[] }

export type Treino = {
  id: string
  ficha_id: string
  /** Rotina de que o treino faz parte (vazio antes do SQL das rotinas). */
  rotina_id?: string
  letra: string
  nome: string
  exercicios: ExercicioTreino[]
  atualizado_em: string
}

/** O que o aluno conta ao terminar o treino. */
export type Retorno = { inicio: string; fim: string; intensidade: string; comentario: string }

export type TreinoFeito = { id: string; ficha_id: string; treino_id: string | null; letra: string; feito_em: string } & Partial<Retorno>

export const INTENSIDADES = ['Muito leve', 'Leve', 'Moderada', 'Intensa', 'Muito intensa'] as const

/** Treinos antigos (séries, repetições e dica) abrem já convertidos em linhas. */
export const comLinhas = (exercicios: ExercicioTreino[]) => exercicios.map((e) => ({ ...e, linhas: linhasDe(e) }))

export const exercicioVazio = (): ExercicioTreino => ({ nome: '', series: '', reps: '', obs: '', linhas: [linhaVazia()] })

/** Exercício pronto para guardar: só linhas preenchidas e séries/repetições copiadas da primeira linha. */
export function limparExercicio(e: ExercicioTreino): ExercicioTreino {
  const linhas = linhasDe(e)
    .filter((l) => !linhaVaziaDe(l))
    .slice(0, 20)
    .map(limparLinha)
  const serie = linhas.find((l) => l.serie)?.serie ?? ''
  const [series, ...reps] = serie.split(/x|×/i)
  return {
    nome: e.nome.trim().slice(0, 80),
    series: reps.length ? series.trim().slice(0, 10) : '',
    reps: (reps.length ? reps.join('x') : series).trim().slice(0, 20),
    obs: (linhas.find((l) => l.tipo === 'observacoes')?.texto ?? '').slice(0, 200),
    linhas,
  }
}

/** Ficha do aluno logado (a que o personal dele cuida), ou null. */
export async function minhaFicha(meuId: string): Promise<Ficha | null> {
  const { data } = await supabase.from('fichas').select('*').eq('aluno_id', meuId).maybeSingle()
  return (data as Ficha | null) ?? null
}

export async function listarTreinos(fichaId: string): Promise<{ treinos: Treino[]; erro: string | null }> {
  const { data, error } = await supabase.from('treinos').select('*').eq('ficha_id', fichaId).order('letra')
  return { treinos: (data ?? []) as Treino[], erro: error ? erroAmigavel(error) : null }
}

/** Treinos feitos nos últimos dias (para a meta da semana e o próximo treino). */
export async function listarFeitos(fichaId: string, dias = 45): Promise<TreinoFeito[]> {
  const desde = new Date(Date.now() - dias * 86400000).toISOString()
  const { data } = await supabase.from('treinos_feitos').select('*').eq('ficha_id', fichaId).gte('feito_em', desde).order('feito_em', { ascending: false })
  return (data ?? []) as TreinoFeito[]
}

/** Guarda o treino concluído com início, fim, intensidade e comentário do aluno. */
export async function marcarFeito(meuId: string, t: Treino, retorno?: Retorno) {
  const base = { ficha_id: t.ficha_id, treino_id: t.id, letra: t.letra, feito_por: meuId }
  const extra = retorno ? { inicio: retorno.inicio, fim: retorno.fim, intensidade: retorno.intensidade.slice(0, 30), comentario: retorno.comentario.trim().slice(0, 500) } : {}
  let { error } = await supabase.from('treinos_feitos').insert({ ...base, ...extra })
  // Banco ainda sem as colunas do retorno: guarda pelo menos o treino feito.
  if (error && retorno && /column|coluna|schema cache/i.test(error.message)) ({ error } = await supabase.from('treinos_feitos').insert(base))
  return error ? erroAmigavel(error) : null
}

/** Meta de treinos por semana na ficha. Null volta ao padrão (número de treinos). */
export async function definirMetaSemana(fichaId: string, meta: number | null) {
  const { error } = await supabase.from('fichas').update({ treinos_semana: meta }).eq('id', fichaId)
  return error ? erroAmigavel(error) : null
}

// No aparelho: dias marcados como treinados por quem não tem ficha de personal.
const CHAVE_DIAS = 'formacerta:dias-treino'

export function diasMarcados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DIAS) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function marcarDia(dia: string) {
  try {
    const dias = diasMarcados()
    if (!dias.includes(dia)) localStorage.setItem(CHAVE_DIAS, JSON.stringify([...dias, dia].slice(-120)))
  } catch {
    // Sem espaço no aparelho: só não guarda.
  }
}
