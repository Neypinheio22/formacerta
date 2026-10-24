import { supabase } from './cliente'
import { erroAmigavel } from './conta'

export type TipoFoto = 'evolucao' | 'uso'
export type SituacaoFoto = 'pendente' | 'aprovada' | 'recusada'

export const ROTULO_FOTO: Record<TipoFoto, string> = { evolucao: 'Evolução', uso: 'Usando o FormaCerta' }
export const ROTULO_SITUACAO_FOTO: Record<SituacaoFoto, string> = { pendente: 'Aguardando aprovação', aprovada: 'Na vitrine', recusada: 'Recusada' }

export type FotoVitrine = {
  id: string
  enviado_por: string
  aluno_id: string | null
  nome: string
  legenda: string
  tipo: TipoFoto
  foto: string
  foto_antes: string | null
  situacao: SituacaoFoto
  autorizacao_em: string
  criado_em: string
  /** Endereços temporários para mostrar as imagens (a pasta é privada). */
  url?: string
  url_antes?: string
}

const PASTA = 'vitrine'
const LADO_MAXIMO = 1080

/** Diminui a foto antes de enviar: fica leve e tira a localização e outros dados escondidos do arquivo. */
export async function prepararFoto(arquivo: File): Promise<Blob> {
  const img = await createImageBitmap(arquivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não deu para ler a foto.'))), 'image/jpeg', 0.85))
}

async function subir(meuId: string, foto: Blob) {
  const caminho = `${meuId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(PASTA).upload(caminho, foto, { contentType: 'image/jpeg' })
  if (error) throw error
  return caminho
}

export type NovaFoto = {
  meuId: string
  alunoId: string | null
  nome: string
  legenda: string
  tipo: TipoFoto
  foto: Blob
  antes: Blob | null
}

/** Envia a foto. Ela entra como "aguardando aprovação" e só aparece na vitrine depois que o administrador aprova. */
export async function enviarFoto(n: NovaFoto) {
  const subidas: string[] = []
  try {
    const foto = await subir(n.meuId, n.foto)
    subidas.push(foto)
    const antes = n.tipo === 'evolucao' && n.antes ? await subir(n.meuId, n.antes) : null
    if (antes) subidas.push(antes)
    const { error } = await supabase.from('vitrine').insert({
      enviado_por: n.meuId,
      aluno_id: n.alunoId,
      nome: n.nome.trim().slice(0, 60),
      legenda: n.legenda.trim().slice(0, 200),
      tipo: n.tipo,
      foto,
      foto_antes: antes,
      autorizacao_em: new Date().toISOString(),
    })
    if (error) throw error
    return null
  } catch (e) {
    if (subidas.length) await supabase.storage.from(PASTA).remove(subidas)
    return erroAmigavel(e as { message?: string })
  }
}

async function comEnderecos(fotos: FotoVitrine[]) {
  const caminhos = fotos.flatMap((f) => (f.foto_antes ? [f.foto, f.foto_antes] : [f.foto]))
  if (caminhos.length === 0) return fotos
  // Endereços valem 1 hora.
  const { data } = await supabase.storage.from(PASTA).createSignedUrls(caminhos, 3600)
  const url = new Map<string, string>()
  for (const d of data ?? []) if (d.path && d.signedUrl) url.set(d.path, d.signedUrl)
  return fotos.map((f) => ({ ...f, url: url.get(f.foto), url_antes: f.foto_antes ? url.get(f.foto_antes) : undefined }))
}

/** Fotos aprovadas, das mais novas para as mais antigas. */
export async function listarVitrine(limite = 30): Promise<{ fotos: FotoVitrine[]; erro: string | null }> {
  const { data, error } = await supabase.from('vitrine').select('*').eq('situacao', 'aprovada').order('criado_em', { ascending: false }).limit(limite)
  if (error) return { fotos: [], erro: erroAmigavel(error) }
  return { fotos: await comEnderecos(data as FotoVitrine[]), erro: null }
}

/** Fotos que eu enviei ou em que eu apareço (com a situação de cada uma). */
export async function listarMinhasFotos(meuId: string): Promise<{ fotos: FotoVitrine[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('vitrine')
    .select('*')
    .or(`enviado_por.eq.${meuId},aluno_id.eq.${meuId}`)
    .order('criado_em', { ascending: false })
  if (error) return { fotos: [], erro: erroAmigavel(error) }
  return { fotos: await comEnderecos(data as FotoVitrine[]), erro: null }
}

/** Administrador: todas as fotos de uma situação. */
export async function listarParaModerar(situacao: SituacaoFoto): Promise<{ fotos: FotoVitrine[]; erro: string | null }> {
  const { data, error } = await supabase.from('vitrine').select('*').eq('situacao', situacao).order('criado_em', { ascending: false }).limit(100)
  if (error) return { fotos: [], erro: erroAmigavel(error) }
  return { fotos: await comEnderecos(data as FotoVitrine[]), erro: null }
}

export async function moderarFoto(id: string, nova: SituacaoFoto) {
  const { error } = await supabase.rpc('admin_moderar_foto', { id_foto: id, nova })
  return error ? erroAmigavel(error) : null
}

/** Tira da vitrine e apaga as imagens. Não tem volta. */
export async function apagarFoto(f: FotoVitrine) {
  const imagens = f.foto_antes ? [f.foto, f.foto_antes] : [f.foto]
  const { error: e1 } = await supabase.storage.from(PASTA).remove(imagens)
  if (e1) return erroAmigavel(e1)
  const { error } = await supabase.from('vitrine').delete().eq('id', f.id)
  return error ? erroAmigavel(error) : null
}
