import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import { semTabela } from './rotinas'

export type TipoOrientacao = 'orientacao' | 'recomendacao' | 'observacao'

export const TIPOS_ORIENTACAO: { id: TipoOrientacao; rotulo: string; exemplo: string }[] = [
  { id: 'orientacao', rotulo: 'Orientação geral', exemplo: 'Ex.: aqueça 10 min na esteira antes de começar.' },
  { id: 'recomendacao', rotulo: 'Recomendação', exemplo: 'Ex.: beba 500 ml de água durante o treino.' },
  { id: 'observacao', rotulo: 'Observação individual', exemplo: 'Ex.: evitar agachamento profundo por causa do joelho direito.' },
]

export const rotuloOrientacao = (t: string) => TIPOS_ORIENTACAO.find((x) => x.id === t)?.rotulo ?? 'Orientação'

/** Orientação, recomendação ou observação que o personal deixa para um aluno. */
export type Orientacao = {
  id: string
  ficha_id: string
  tipo: TipoOrientacao
  texto: string
  /** Só o personal vê. */
  so_personal: boolean
  fixada: boolean
  criado_em: string
  atualizado_em: string
}

export type DadosOrientacao = Pick<Orientacao, 'tipo' | 'texto' | 'so_personal' | 'fixada'>

const FALTA_SQL = 'Falta rodar no Supabase o arquivo gerenciamento-de-treinos.sql para as orientações funcionarem.'

/** Fixadas primeiro, depois as mais novas. O aluno não recebe as que são só do personal. */
export async function listarOrientacoes(fichaId: string): Promise<{ lista: Orientacao[]; erro: string | null }> {
  const { data, error } = await supabase.from('orientacoes').select('*').eq('ficha_id', fichaId).order('fixada', { ascending: false }).order('criado_em', { ascending: false })
  if (error) return { lista: [], erro: semTabela(error.message) ? FALTA_SQL : erroAmigavel(error) }
  return { lista: (data ?? []) as Orientacao[], erro: null }
}

export async function salvarOrientacao(fichaId: string, id: string | undefined, d: DadosOrientacao) {
  const linha = { tipo: d.tipo, texto: d.texto.trim().slice(0, 1000), so_personal: d.so_personal, fixada: d.fixada, atualizado_em: new Date().toISOString() }
  const { error } = id ? await supabase.from('orientacoes').update(linha).eq('id', id) : await supabase.from('orientacoes').insert({ ...linha, ficha_id: fichaId })
  if (error) return semTabela(error.message) ? FALTA_SQL : erroAmigavel(error)
  return null
}

export async function apagarOrientacao(id: string) {
  const { error } = await supabase.from('orientacoes').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}
