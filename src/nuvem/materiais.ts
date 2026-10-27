import { supabase } from './cliente'
import { erroAmigavel } from './conta'

export type TipoMaterial = 'pdf' | 'video' | 'imagem' | 'link'

export type Material = {
  id: string
  profissional_id: string
  /** Null: vale para todos os alunos do profissional. */
  ficha_id: string | null
  titulo: string
  descricao: string
  tipo: TipoMaterial
  arquivo: string | null
  link: string | null
  criado_em: string
}

const PASTA = 'materiais'
export const TAMANHO_MAXIMO = 50 * 1024 * 1024

export function tipoDoArquivo(arquivo: File): TipoMaterial | null {
  if (arquivo.type === 'application/pdf') return 'pdf'
  if (arquivo.type.startsWith('video/')) return 'video'
  if (arquivo.type.startsWith('image/')) return 'imagem'
  return null
}

/** Materiais que a pessoa logada pode ver. Com fichaId, só os daquela ficha e os "para todos". */
export async function listarMateriais(fichaId?: string): Promise<{ materiais: Material[]; erro: string | null }> {
  let q = supabase.from('materiais').select('*').order('criado_em', { ascending: false })
  if (fichaId) q = q.or(`ficha_id.eq.${fichaId},ficha_id.is.null`)
  const { data, error } = await q
  return { materiais: (data ?? []) as Material[], erro: error ? erroAmigavel(error) : null }
}

export type NovoMaterial = { meuId: string; fichaId: string | null; titulo: string; descricao: string; arquivo: File | null; link: string }

export async function enviarMaterial(n: NovoMaterial) {
  let caminho: string | null = null
  try {
    let tipo: TipoMaterial = 'link'
    if (n.arquivo) {
      const t = tipoDoArquivo(n.arquivo)
      if (!t) return 'Envie um PDF, um vídeo ou uma imagem.'
      if (n.arquivo.size > TAMANHO_MAXIMO) return 'Arquivo maior que 50 MB. Para vídeos longos, mande o link do YouTube.'
      tipo = t
      const ext = n.arquivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      caminho = `${n.meuId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(PASTA).upload(caminho, n.arquivo, { contentType: n.arquivo.type })
      if (error) throw error
    }
    const link = n.link.trim()
    if (!n.arquivo && !/^https:\/\//i.test(link)) return 'Coloque um arquivo ou um link que comece com https://'
    const { error } = await supabase.from('materiais').insert({
      profissional_id: n.meuId,
      ficha_id: n.fichaId,
      titulo: n.titulo.trim().slice(0, 80),
      descricao: n.descricao.trim().slice(0, 300),
      tipo,
      arquivo: caminho,
      link: caminho ? null : link,
    })
    if (error) throw error
    return null
  } catch (e) {
    if (caminho) await supabase.storage.from(PASTA).remove([caminho])
    return erroAmigavel(e as { message?: string })
  }
}

export async function apagarMaterial(m: Material) {
  const { error } = await supabase.from('materiais').delete().eq('id', m.id)
  if (error) return erroAmigavel(error)
  if (m.arquivo) await supabase.storage.from(PASTA).remove([m.arquivo])
  return null
}

/** Endereço para abrir o material. Arquivos da pasta privada ganham um endereço que vale 1 hora. */
export async function enderecoMaterial(m: Material): Promise<string | null> {
  if (m.link) return m.link
  if (!m.arquivo) return null
  const { data } = await supabase.storage.from(PASTA).createSignedUrl(m.arquivo, 3600)
  return data?.signedUrl ?? null
}
