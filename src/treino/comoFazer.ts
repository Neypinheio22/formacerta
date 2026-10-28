// "Como fazer" de cada exercício da ficha: a foto ou o vídeo que o personal
// cadastrou, o do app (cadastrado pelo administrador) ou, sem nenhum dos dois,
// uma busca no YouTube pelo nome do exercício.

export type TipoMidia = 'imagem' | 'video' | 'link'

export type ExercicioProprio = {
  id: string
  profissional_id: string
  nome: string
  grupo: string
  descricao: string
  tipo: TipoMidia | null
  arquivo: string | null
  link: string | null
  do_app: boolean
  criado_em: string
}

/** Nome para comparar: sem acento, sem maiúscula e sem espaço sobrando. */
export const nomeChave = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Exercício cadastrado com o mesmo nome do que está na ficha. O do próprio
 * personal vale mais que o do app, e com foto ou vídeo vale mais que sem.
 */
export function acharExercicio(lista: ExercicioProprio[], nome: string, profissionalId?: string | null): ExercicioProprio | undefined {
  const n = nomeChave(nome)
  if (!n) return undefined
  const peso = (e: ExercicioProprio) => (e.tipo ? 0 : 4) + (profissionalId && e.profissional_id === profissionalId ? 0 : 1) + (e.do_app ? 2 : 0)
  return lista.filter((e) => nomeChave(e.nome) === n).sort((a, b) => peso(a) - peso(b))[0]
}

/** Código do vídeo em links do YouTube (watch, youtu.be, shorts, embed). */
export function idYoutube(link: string): string | null {
  try {
    const u = new URL(link)
    const host = u.hostname.replace(/^(www\.|m\.)/, '')
    let id: string | null = null
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0]
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** Busca no YouTube para quando ninguém cadastrou o vídeo do exercício. */
export const buscaYoutube = (nome: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nome.trim()} execução correta`)}`

/** Foto, vídeo ou link pelo tipo do arquivo escolhido. */
export function tipoDoArquivo(arquivo: { type: string }): TipoMidia | null {
  if (arquivo.type.startsWith('video/')) return 'video'
  if (arquivo.type.startsWith('image/')) return 'imagem'
  return null
}
