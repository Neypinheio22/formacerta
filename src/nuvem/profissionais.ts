import { supabase } from './cliente'
import { erroAmigavel, type Perfil } from './conta'
import { prepararFoto } from './vitrine'

/** Dados públicos do profissional na lista "Encontrar personal". */
export type ProfissionalHabilitado = {
  id: string
  nome: string
  registro: string
  cidade: string
  /** Especialidades separadas por vírgula. */
  especialidade: string
  /** Biografia curta: formação, experiência e como trabalha. */
  bio: string
  whatsapp: string
  /** Endereço público da foto do profissional (vazio: mostra a inicial). */
  foto_url?: string
  liberado_desde: string
}

/** Consulta oficial de registrados no Conselho Federal de Educação Física. */
export const CONSULTA_CONFEF = 'https://www.confef.org.br/confef/registrados/'

export async function listarProfissionais(): Promise<{ lista: ProfissionalHabilitado[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('profissionais_habilitados')
  return { lista: (data ?? []) as ProfissionalHabilitado[], erro: error ? erroAmigavel(error) : null }
}

export type DadosContato = { whatsapp: string; cidade: string; especialidade: string; bio: string; aparecer_na_lista: boolean }

export const BIO_MAXIMO = 600

/** "Idosos, hipertrofia; corrida" vira ["Idosos", "hipertrofia", "corrida"]. */
export const listaEspecialidades = (texto: string) =>
  texto
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8)

export async function salvarContato(id: string, d: DadosContato) {
  const { error } = await supabase
    .from('perfis')
    .update({ whatsapp: d.whatsapp.trim().slice(0, 20), cidade: d.cidade.trim().slice(0, 60), especialidade: d.especialidade.trim().slice(0, 200), bio: d.bio.trim().slice(0, BIO_MAXIMO), aparecer_na_lista: d.aparecer_na_lista })
    .eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Busca por nome, cidade ou especialidade, sem ligar para acento nem maiúscula. */
export function filtrarProfissionais(lista: ProfissionalHabilitado[], busca: string): ProfissionalHabilitado[] {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  const termos = norm(busca).split(/\s+/).filter(Boolean)
  if (!termos.length) return lista
  return lista.filter((p) => {
    const texto = norm(`${p.nome} ${p.cidade} ${p.especialidade} ${p.bio} ${p.registro}`)
    return termos.every((t) => texto.includes(t))
  })
}

const PASTA_FOTOS = 'fotos-perfil'

/** Envia a foto do profissional (diminuída e sem dados escondidos do arquivo) e guarda o endereço no perfil. */
export async function enviarFotoPerfil(id: string, arquivo: File): Promise<{ url: string | null; erro: string | null }> {
  try {
    const foto = await prepararFoto(arquivo)
    const caminho = `${id}/foto.jpg`
    const { error } = await supabase.storage.from(PASTA_FOTOS).upload(caminho, foto, { contentType: 'image/jpeg', upsert: true })
    if (error) throw error
    // O "?v=" faz o celular buscar a foto nova em vez da antiga guardada.
    const url = `${supabase.storage.from(PASTA_FOTOS).getPublicUrl(caminho).data.publicUrl}?v=${Date.now()}`
    const { error: e2 } = await supabase.from('perfis').update({ foto_url: url }).eq('id', id)
    if (e2) throw e2
    return { url, erro: null }
  } catch (e) {
    return { url: null, erro: erroAmigavel(e as { message?: string }) }
  }
}

export async function removerFotoPerfil(id: string) {
  await supabase.storage.from(PASTA_FOTOS).remove([`${id}/foto.jpg`])
  const { error } = await supabase.from('perfis').update({ foto_url: '' }).eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** O que ainda falta para o profissional aparecer na lista dos alunos (vazio: já aparece). */
export function faltaParaAparecer(p: Pick<Perfil, 'papel' | 'situacao' | 'registro'>, d: Pick<DadosContato, 'aparecer_na_lista'>): string[] {
  const falta: string[] = []
  if (p.papel === 'aluno') return ['Só contas de profissional aparecem na lista.']
  if (p.situacao !== 'liberado') falta.push('A conta ainda precisa ser liberada pelo administrador.')
  if (!p.registro.trim()) falta.push('Preencher e salvar o número do CREF.')
  if (!d.aparecer_na_lista) falta.push('Marcar a autorização para aparecer na lista.')
  return falta
}
