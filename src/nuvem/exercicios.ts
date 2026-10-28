import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import { tipoDoArquivo, type ExercicioProprio, type TipoMidia } from '../treino/comoFazer'

const PASTA = 'exercicios'
export const TAMANHO_MAXIMO = 50 * 1024 * 1024

/** Exercícios que a pessoa logada vê: os dela, os do personal dela e os do app. */
export async function listarExercicios(): Promise<{ exercicios: ExercicioProprio[]; erro: string | null }> {
  const { data, error } = await supabase.from('exercicios_proprios').select('*').order('nome')
  return { exercicios: (data ?? []) as ExercicioProprio[], erro: error ? erroAmigavel(error) : null }
}

export type NovoExercicio = {
  meuId: string
  /** Editando: o exercício como estava. */
  antes?: ExercicioProprio
  nome: string
  grupo: string
  descricao: string
  /** Foto ou vídeo novo. Sem arquivo e sem link, fica a mídia que já tinha (ou nenhuma). */
  arquivo: File | null
  link: string
  /** Tirar a foto ou o vídeo que já tinha. */
  semMidia?: boolean
  doApp: boolean
}

/** Cria ou atualiza o exercício. Trocar a foto ou o vídeo apaga o arquivo antigo. */
export async function salvarExercicio(n: NovoExercicio): Promise<string | null> {
  let caminho: string | null = null
  try {
    let tipo: TipoMidia | null = n.antes?.tipo ?? null
    let arquivo = n.antes?.arquivo ?? null
    let link = n.antes?.link ?? null
    if (n.semMidia) [tipo, arquivo, link] = [null, null, null]
    if (n.arquivo) {
      const t = tipoDoArquivo(n.arquivo)
      if (!t) return 'Envie uma foto ou um vídeo.'
      if (n.arquivo.size > TAMANHO_MAXIMO) return 'Arquivo maior que 50 MB. Grave um vídeo mais curto ou mande o link do YouTube.'
      const ext = n.arquivo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
      caminho = `${n.meuId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(PASTA).upload(caminho, n.arquivo, { contentType: n.arquivo.type })
      if (error) throw error
      ;[tipo, arquivo, link] = [t, caminho, null]
    } else if (n.link.trim()) {
      if (!/^https:\/\//i.test(n.link.trim())) return 'O link precisa começar com https://'
      ;[tipo, arquivo, link] = ['link', null, n.link.trim()]
    }
    const linha = {
      nome: n.nome.trim().slice(0, 80),
      grupo: n.grupo.trim().slice(0, 30),
      descricao: n.descricao.trim().slice(0, 500),
      tipo,
      arquivo,
      link,
      do_app: n.doApp,
    }
    const { error } = n.antes
      ? await supabase.from('exercicios_proprios').update(linha).eq('id', n.antes.id)
      : await supabase.from('exercicios_proprios').insert({ ...linha, profissional_id: n.meuId })
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return `Você já tem um exercício chamado "${linha.nome}". Edite o que já existe.`
      throw error
    }
    // Arquivo antigo que ficou sem uso.
    if (n.antes?.arquivo && n.antes.arquivo !== arquivo) await supabase.storage.from(PASTA).remove([n.antes.arquivo])
    return null
  } catch (e) {
    if (caminho) await supabase.storage.from(PASTA).remove([caminho])
    return erroAmigavel(e as { message?: string })
  }
}

export async function apagarExercicio(e: ExercicioProprio) {
  const { error } = await supabase.from('exercicios_proprios').delete().eq('id', e.id)
  if (error) return erroAmigavel(error)
  if (e.arquivo) await supabase.storage.from(PASTA).remove([e.arquivo])
  return null
}

/** Endereço da foto ou do vídeo. Arquivos da pasta privada ganham um endereço que vale 2 horas. */
export async function enderecoMidia(e: ExercicioProprio): Promise<string | null> {
  if (e.link) return e.link
  if (!e.arquivo) return null
  const { data } = await supabase.storage.from(PASTA).createSignedUrl(e.arquivo, 7200)
  return data?.signedUrl ?? null
}
