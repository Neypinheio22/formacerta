import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import { limparExercicio, type ExercicioTreino, type Treino } from './treinos'
import type { Nivel, RotinaBase, Situacao } from '../treino/rotinas'

/** Rotina de treino do aluno: dados do cartão. Os treinos A, B, C... ficam na tabela treinos. */
export type Rotina = RotinaBase & {
  ficha_id: string
  objetivo: string
  nivel: Nivel
  icone: string
  excluida_em: string | null
  atualizado_em: string
}

export type DadosRotina = Pick<Rotina, 'nome' | 'inicio' | 'fim' | 'objetivo' | 'nivel' | 'icone'>

/** Treino como o editor da rotina guarda: com id quando já existia. */
export type TreinoRascunho = { id?: string; letra: string; nome: string; exercicios: ExercicioTreino[] }

export type Aerobico = {
  id: string
  ficha_id: string
  tipo: string
  duracao_min: number | null
  intensidade: string
  vezes_semana: number | null
  observacoes: string
  situacao: Situacao
  criado_em: string
}

export type DadosAerobico = Pick<Aerobico, 'tipo' | 'duracao_min' | 'intensidade' | 'vezes_semana' | 'observacoes'>

/** Banco ainda sem a tabela de rotinas (SQL não rodado). */
export const semTabela = (msg: string) => /does not exist|schema cache|relation|não existe/i.test(msg)

/** Todas as rotinas do aluno, inclusive arquivadas e excluídas (o aluno não recebe as excluídas). */
export async function listarRotinas(fichaId: string): Promise<{ rotinas: Rotina[]; erro: string | null; semTabela: boolean }> {
  const { data, error } = await supabase.from('rotinas').select('*').eq('ficha_id', fichaId).order('criado_em', { ascending: false })
  return { rotinas: (data ?? []) as Rotina[], erro: error ? erroAmigavel(error) : null, semTabela: !!error && semTabela(error.message) }
}

export async function listarTreinosDasRotinas(ids: string[]): Promise<Treino[]> {
  if (!ids.length) return []
  const { data } = await supabase.from('treinos').select('*').in('rotina_id', ids).order('letra')
  return (data ?? []) as Treino[]
}

function limparDados(d: DadosRotina) {
  return {
    nome: d.nome.trim().slice(0, 60),
    inicio: d.inicio || null,
    fim: d.fim || null,
    objetivo: d.objetivo.slice(0, 40),
    nivel: d.nivel,
    icone: d.icone.slice(0, 20),
    atualizado_em: new Date().toISOString(),
  }
}

/**
 * Cria ou atualiza a rotina e os treinos dela. Treinos tirados da divisão são
 * apagados só desta rotina; as outras rotinas do aluno ficam como estão.
 */
export async function salvarRotina(fichaId: string, rotinaId: string | undefined, dados: DadosRotina, treinos: TreinoRascunho[]): Promise<{ id: string | null; erro: string | null }> {
  const linha = limparDados(dados)
  const r = rotinaId
    ? await supabase.from('rotinas').update(linha).eq('id', rotinaId).select('id').single()
    : await supabase.from('rotinas').insert({ ...linha, ficha_id: fichaId }).select('id').single()
  if (r.error) return { id: null, erro: erroAmigavel(r.error) }
  const id = (r.data as { id: string }).id
  // Treino da divisão sem nenhum exercício não vai para o aluno.
  const validos = treinos.filter((t) => t.exercicios.some((e) => e.nome.trim()))

  if (rotinaId) {
    const ficam = validos.filter((t) => t.id).map((t) => t.id!)
    const { data: antes } = await supabase.from('treinos').select('id').eq('rotina_id', id)
    const sair = ((antes ?? []) as { id: string }[]).map((t) => t.id).filter((x) => !ficam.includes(x))
    if (sair.length) {
      const { error } = await supabase.from('treinos').delete().in('id', sair)
      if (error) return { id, erro: erroAmigavel(error) }
    }
  }

  for (const t of validos) {
    const dadosTreino = {
      ficha_id: fichaId,
      rotina_id: id,
      letra: t.letra,
      nome: t.nome.trim().slice(0, 60),
      exercicios: t.exercicios.filter((e) => e.nome.trim()).map(limparExercicio),
      atualizado_em: new Date().toISOString(),
    }
    const { error } = t.id ? await supabase.from('treinos').update(dadosTreino).eq('id', t.id) : await supabase.from('treinos').insert(dadosTreino)
    if (error) return { id, erro: erroAmigavel(error) }
  }
  return { id, erro: null }
}

/** Arquivar, excluir (vai para Excluídas) ou recuperar. Nada é apagado do banco. */
export async function mudarSituacao(id: string, situacao: Situacao) {
  const { error } = await supabase
    .from('rotinas')
    .update({ situacao, excluida_em: situacao === 'excluida' ? new Date().toISOString() : null, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  return error ? erroAmigavel(error) : null
}

export async function listarAerobicos(fichaId: string): Promise<{ lista: Aerobico[]; erro: string | null }> {
  const { data, error } = await supabase.from('aerobicos').select('*').eq('ficha_id', fichaId).order('criado_em', { ascending: false })
  return { lista: (data ?? []) as Aerobico[], erro: error && !semTabela(error.message) ? erroAmigavel(error) : null }
}

export async function salvarAerobico(fichaId: string, id: string | undefined, d: DadosAerobico) {
  const linha = {
    tipo: d.tipo.trim().slice(0, 40),
    duracao_min: d.duracao_min,
    intensidade: d.intensidade.slice(0, 40),
    vezes_semana: d.vezes_semana,
    observacoes: d.observacoes.trim().slice(0, 300),
    atualizado_em: new Date().toISOString(),
  }
  const { error } = id ? await supabase.from('aerobicos').update(linha).eq('id', id) : await supabase.from('aerobicos').insert({ ...linha, ficha_id: fichaId })
  return error ? erroAmigavel(error) : null
}

export async function mudarSituacaoAerobico(id: string, situacao: Situacao) {
  const { error } = await supabase.from('aerobicos').update({ situacao, atualizado_em: new Date().toISOString() }).eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Foto do aluno (a que ele pôs na conta), para o cabeçalho das rotinas. */
export async function fotoDoAluno(alunoId: string | null): Promise<string> {
  if (!alunoId) return ''
  const { data } = await supabase.from('perfis').select('foto_url').eq('id', alunoId).maybeSingle()
  return (data as { foto_url?: string } | null)?.foto_url ?? ''
}
