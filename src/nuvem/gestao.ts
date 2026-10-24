import { supabase } from './cliente'
import { erroAmigavel, type Perfil, type Situacao } from './conta'

/** Administrador: todos os perfis. Profissional: só os próprios alunos (pelas regras do banco). */
export async function listarPerfis(): Promise<{ perfis: Perfil[]; erro: string | null }> {
  const { data, error } = await supabase.from('perfis').select('*').order('criado_em', { ascending: false })
  return { perfis: (data ?? []) as Perfil[], erro: error ? erroAmigavel(error) : null }
}

export async function definirSituacao(id: string, nova: Situacao) {
  const { error } = await supabase.rpc('admin_definir_situacao', { usuario: id, nova })
  return error ? erroAmigavel(error) : null
}

/** Apaga a conta e todos os resultados dela. Não tem volta. */
export async function excluirConta(id: string) {
  const { error } = await supabase.rpc('admin_excluir', { usuario: id })
  return error ? erroAmigavel(error) : null
}

export async function excluirMinhaConta() {
  const { error } = await supabase.rpc('excluir_minha_conta')
  return error ? erroAmigavel(error) : null
}

/** O profissional cria a conta do aluno, que já entra liberado. */
export async function cadastrarAluno(dados: { nome: string; email: string; senha: string }) {
  const { data, error } = await supabase.functions.invoke('cadastrar-aluno', { body: dados })
  if (error) {
    // A função devolve { erro } com a explicação; o cliente só mostra "non-2xx".
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    return corpo?.erro ?? erroAmigavel(error)
  }
  return (data as { erro?: string } | null)?.erro ?? null
}

export async function salvarMeuPerfil(id: string, mudancas: { nome: string; registro: string }) {
  const { error } = await supabase.from('perfis').update(mudancas).eq('id', id)
  return error ? erroAmigavel(error) : null
}
