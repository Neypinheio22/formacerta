import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import { semTabela } from './rotinas'

// Exercícios favoritos do profissional, pelo nome sem acento. Enquanto o SQL
// da biblioteca de exercícios não roda, ficam guardados só neste aparelho.

const LOCAL = 'formacerta:exercicios-favoritos'

function locais(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function guardarLocais(chaves: string[]) {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(chaves))
  } catch {
    // Sem espaço no aparelho: o favorito vale só até fechar o app.
  }
}

/** Favoritos do profissional. soNoAparelho: falta rodar biblioteca-de-exercicios.sql. */
export async function listarFavoritos(): Promise<{ chaves: string[]; soNoAparelho: boolean; erro: string | null }> {
  const { data, error } = await supabase.from('exercicios_favoritos').select('chave')
  if (error) {
    if (semTabela(error.message)) return { chaves: locais(), soNoAparelho: true, erro: null }
    return { chaves: locais(), soNoAparelho: false, erro: erroAmigavel(error) }
  }
  return { chaves: (data ?? []).map((d) => d.chave as string), soNoAparelho: false, erro: null }
}

/** Marca ou desmarca o favorito. */
export async function mudarFavorito(chave: string, favorito: boolean, soNoAparelho: boolean): Promise<string | null> {
  if (soNoAparelho) {
    const atual = new Set(locais())
    if (favorito) atual.add(chave)
    else atual.delete(chave)
    guardarLocais([...atual])
    return null
  }
  const { error } = favorito
    ? await supabase.from('exercicios_favoritos').upsert({ chave }, { onConflict: 'profissional_id,chave', ignoreDuplicates: true })
    : await supabase.from('exercicios_favoritos').delete().eq('chave', chave)
  return error ? erroAmigavel(error) : null
}
