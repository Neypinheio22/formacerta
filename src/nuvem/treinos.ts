import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import type { Ficha } from './fichas'

/** Um exercício da ficha de treino, como o personal escreveu. */
export type ExercicioTreino = { nome: string; series: string; reps: string; obs: string }

export type Treino = {
  id: string
  ficha_id: string
  letra: string
  nome: string
  exercicios: ExercicioTreino[]
  atualizado_em: string
}

export type TreinoFeito = { id: string; ficha_id: string; treino_id: string | null; letra: string; feito_em: string }

export const exercicioVazio = (): ExercicioTreino => ({ nome: '', series: '3', reps: '10 a 12', obs: '' })

/** Ficha do aluno logado (a que o personal dele cuida), ou null. */
export async function minhaFicha(meuId: string): Promise<Ficha | null> {
  const { data } = await supabase.from('fichas').select('*').eq('aluno_id', meuId).maybeSingle()
  return (data as Ficha | null) ?? null
}

export async function listarTreinos(fichaId: string): Promise<{ treinos: Treino[]; erro: string | null }> {
  const { data, error } = await supabase.from('treinos').select('*').eq('ficha_id', fichaId).order('letra')
  return { treinos: (data ?? []) as Treino[], erro: error ? erroAmigavel(error) : null }
}

/** Cria ou atualiza o treino daquela letra. Linhas sem nome de exercício são descartadas. */
export async function salvarTreino(fichaId: string, t: { id?: string; letra: string; nome: string; exercicios: ExercicioTreino[] }) {
  const linha = {
    ficha_id: fichaId,
    letra: t.letra,
    nome: t.nome.trim().slice(0, 60),
    exercicios: t.exercicios
      .filter((e) => e.nome.trim())
      .map((e) => ({ nome: e.nome.trim().slice(0, 80), series: e.series.trim().slice(0, 10), reps: e.reps.trim().slice(0, 20), obs: e.obs.trim().slice(0, 200) })),
    atualizado_em: new Date().toISOString(),
  }
  const { error } = t.id ? await supabase.from('treinos').update(linha).eq('id', t.id) : await supabase.from('treinos').insert(linha)
  return error ? erroAmigavel(error) : null
}

export async function apagarTreino(id: string) {
  const { error } = await supabase.from('treinos').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Treinos feitos nos últimos dias (para a meta da semana e o próximo treino). */
export async function listarFeitos(fichaId: string, dias = 45): Promise<TreinoFeito[]> {
  const desde = new Date(Date.now() - dias * 86400000).toISOString()
  const { data } = await supabase.from('treinos_feitos').select('*').eq('ficha_id', fichaId).gte('feito_em', desde).order('feito_em', { ascending: false })
  return (data ?? []) as TreinoFeito[]
}

export async function marcarFeito(meuId: string, t: Treino) {
  const { error } = await supabase.from('treinos_feitos').insert({ ficha_id: t.ficha_id, treino_id: t.id, letra: t.letra, feito_por: meuId })
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
