import { supabase } from './cliente'
import { erroAmigavel, type Perfil } from './conta'

/** Muda quando os Termos de uso ou a Política de privacidade mudam: todo mundo aceita de novo. */
export const VERSAO_TERMOS = '2026-10-27'

/** Precisa aceitar (de novo) os termos. Antes do SQL novo rodar, o perfil não tem a coluna e ninguém é barrado. */
export const precisaAceitar = (p: Perfil) => p.papel !== 'admin' && 'termos_versao' in p && p.termos_versao !== VERSAO_TERMOS

/** Guarda o aceite dos termos e o consentimento para os dados de saúde (LGPD, art. 8º e 11). */
export async function aceitarTermos() {
  const { error } = await supabase.rpc('aceitar_termos', { versao: VERSAO_TERMOS })
  return error ? erroAmigavel(error) : null
}

export async function definirLembretes(id: string, ligado: boolean) {
  const { error } = await supabase.from('perfis').update({ lembretes_email: ligado }).eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Tudo o que o banco guarda da pessoa, num arquivo JSON (LGPD, art. 18: acesso e portabilidade). */
export async function baixarMeusDados(perfil: Perfil) {
  const [fichas, resultados, vitrine, aceites] = await Promise.all([
    supabase.from('fichas').select('*').eq('aluno_id', perfil.id),
    supabase.from('resultados').select('*').or(`aluno_id.eq.${perfil.id},enviado_por.eq.${perfil.id}`).order('feito_em'),
    supabase.from('vitrine').select('*').or(`enviado_por.eq.${perfil.id},aluno_id.eq.${perfil.id}`),
    supabase.from('aceites_termos').select('versao, aceito_em').eq('usuario_id', perfil.id).order('aceito_em'),
  ])
  const erro = fichas.error ?? resultados.error
  if (erro) return erroAmigavel(erro)
  const arquivo = {
    gerado_em: new Date().toISOString(),
    controlador: 'FormaCerta',
    conta: perfil,
    ficha: fichas.data ?? [],
    resultados: resultados.data ?? [],
    vitrine: vitrine.error ? [] : (vitrine.data ?? []),
    aceites_dos_termos: aceites.error ? [] : (aceites.data ?? []),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `meus-dados-formacerta-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return null
}
