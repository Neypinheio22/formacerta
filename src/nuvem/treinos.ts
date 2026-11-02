import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import type { Ficha } from './fichas'
import { limparLinha, linhasDe, linhaVazia, linhaVaziaDe, type LinhaSerie } from '../treino/linhas'
import { intensidadeDoEsforco, limparCargas, type CargaExercicio, type Execucao, type Feedback } from '../treino/execucao'

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
  /** Grupos musculares ou objetivo do treino ("Peito, Tríceps"). Vazio antes do SQL do gerenciamento. */
  foco?: string
  exercicios: ExercicioTreino[]
  atualizado_em: string
}

/** O que o aluno conta ao terminar o treino. */
export type Retorno = { inicio: string; fim: string; intensidade: string; comentario: string }

export type TreinoFeito = Execucao & { ficha_id: string }

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

/** Colunas que só existem depois do SQL do gerenciamento de treinos. */
const semColuna = (msg: string) => /column|coluna|schema cache/i.test(msg)

/** Feedback pronto para o banco: a intensidade antiga sai do esforço, para o Retorno dos treinos continuar valendo. */
function linhaFeedback(f: Feedback) {
  return {
    dificuldade: f.dificuldade,
    esforco: f.esforco,
    dor: f.dor,
    dor_local: f.dor ? f.dor_local.slice(0, 120) : '',
    dor_nivel: f.dor ? f.dor_nivel : null,
    comentario: f.comentario.trim().slice(0, 500),
    ...(f.esforco !== null ? { intensidade: intensidadeDoEsforco(f.esforco) } : {}),
    avaliado_em: new Date().toISOString(),
  }
}

/**
 * Guarda o treino concluído: início, fim, cargas anotadas e o feedback do
 * aluno. Banco sem as colunas novas: guarda o que der (retorno antigo ou só o
 * treino feito).
 */
export async function marcarFeito(meuId: string, t: Treino, retorno?: Retorno, extra?: { cargas?: CargaExercicio[]; feedback?: Feedback }) {
  const base = { ficha_id: t.ficha_id, treino_id: t.id, letra: t.letra, feito_por: meuId }
  const antigo = retorno ? { inicio: retorno.inicio, fim: retorno.fim, intensidade: retorno.intensidade.slice(0, 30), comentario: retorno.comentario.trim().slice(0, 500) } : {}
  const novo = { ...(extra?.cargas ? { cargas: limparCargas(extra.cargas) } : {}), ...(extra?.feedback ? linhaFeedback(extra.feedback) : {}) }
  let { error } = await supabase.from('treinos_feitos').insert({ ...base, ...antigo, ...novo })
  if (error && Object.keys(novo).length && semColuna(error.message)) ({ error } = await supabase.from('treinos_feitos').insert({ ...base, ...antigo, ...(novo.intensidade ? { intensidade: novo.intensidade } : {}), ...('comentario' in novo ? { comentario: novo.comentario } : {}) }))
  // Banco ainda sem as colunas do retorno: guarda pelo menos o treino feito.
  if (error && retorno && semColuna(error.message)) ({ error } = await supabase.from('treinos_feitos').insert(base))
  return error ? erroAmigavel(error) : null
}

/** O aluno avalia depois um treino que já concluiu (botão Avaliar). */
export async function avaliarTreino(id: string, f: Feedback) {
  const { error } = await supabase.from('treinos_feitos').update(linhaFeedback(f)).eq('id', id)
  if (error && semColuna(error.message)) return 'Falta rodar no Supabase o arquivo gerenciamento-de-treinos.sql para guardar a avaliação.'
  return error ? erroAmigavel(error) : null
}

/** Observação do personal sobre um treino feito (o aluno também vê). */
export async function anotarObservacao(id: string, texto: string) {
  const t = texto.trim().slice(0, 500)
  const { error } = await supabase
    .from('treinos_feitos')
    .update({ obs_personal: t, obs_personal_em: t ? new Date().toISOString() : null })
    .eq('id', id)
  if (error && semColuna(error.message)) return 'Falta rodar no Supabase o arquivo gerenciamento-de-treinos.sql para guardar a observação.'
  return error ? erroAmigavel(error) : null
}

/** Todas as vezes que estes treinos foram feitos (histórico da rotina), mais novas primeiro. */
export async function listarFeitosDosTreinos(ids: string[]): Promise<TreinoFeito[]> {
  if (!ids.length) return []
  const { data } = await supabase.from('treinos_feitos').select('*').in('treino_id', ids).order('feito_em', { ascending: false }).limit(1000)
  return (data ?? []) as TreinoFeito[]
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
