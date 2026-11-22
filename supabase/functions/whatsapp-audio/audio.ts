// Baixa áudios recebidos pelo webhook oficial da Meta para armazenamento privado.
const GRAPH = 'https://graph.facebook.com/v23.0'
const LIMITE_BYTES = 16 * 1024 * 1024

/** O endereço de download vem da própria Meta. Mesmo assim, não seguimos domínios arbitrários. */
export function dominioAudioConfiavel(endereco: string): boolean {
  try {
    const url = new URL(endereco)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    return host === 'lookaside.fbsbx.com' ||
      host === 'scontent.whatsapp.net' ||
      host === 'graph.facebook.com' ||
      host.endsWith('.fbcdn.net') ||
      host.endsWith('.fbsbx.com') ||
      host.endsWith('.whatsapp.net')
  } catch {
    return false
  }
}

export function tipoAudio(mime: string): string {
  const normal = mime.split(';')[0].trim().toLowerCase()
  if (['audio/ogg','audio/mpeg','audio/mp4','audio/amr','audio/aac','audio/3gpp','audio/opus','audio/webm','audio/x-m4a'].includes(normal)) return normal
  throw new Error('Formato de áudio não aceito: ' + normal.slice(0, 70))
}

export async function baixarAudioMeta(id: string, token: string): Promise<{ dados: Uint8Array; tipo: string }> {
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(id)) throw new Error('ID de áudio inválido')
  if (!token) throw new Error('Token de WhatsApp indisponível')
  const meta = await fetch(GRAPH + '/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + token } })
  if (!meta.ok) throw new Error('Meta não localizou o áudio: ' + meta.status)
  const info = await meta.json() as { url?: string; mime_type?: string; file_size?: number }
  if (!info.url || !dominioAudioConfiavel(info.url)) throw new Error('Endereço de áudio não autorizado')
  if (info.file_size && info.file_size > LIMITE_BYTES) throw new Error('Áudio maior que 16 MB')
  const resposta = await fetch(info.url, { headers: { Authorization: 'Bearer ' + token }, redirect: 'error' })
  if (!resposta.ok) throw new Error('Meta não permitiu baixar o áudio: ' + resposta.status)
  const tamanho = Number(resposta.headers.get('content-length') || 0)
  if (tamanho > LIMITE_BYTES) throw new Error('Áudio maior que 16 MB')
  const dados = new Uint8Array(await resposta.arrayBuffer())
  if (dados.byteLength === 0 || dados.byteLength > LIMITE_BYTES) throw new Error('Áudio vazio ou maior que 16 MB')
  const tipo = tipoAudio(info.mime_type || resposta.headers.get('content-type') || '')
  return { dados, tipo }
}
