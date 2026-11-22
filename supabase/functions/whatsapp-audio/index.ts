// Entrega uma URL curta de reprodução somente ao administrador autenticado.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { baixarAudioMeta } from './audio.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const banco = createClient(URL, KEY, { auth: { persistSession: false } })
const permitidas = new Set([
  'https://formacerta.app.br',
  'https://www.formacerta.app.br',
  'https://treinar.formacerta.app.br',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

Deno.serve(async (req: Request) => {
  const origem = req.headers.get('origin') ?? ''
  const cors: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (permitidas.has(origem)) cors['Access-Control-Allow-Origin'] = origem
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ erro: 'Método não permitido' }, 405)
  try {
    const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return json({ erro: 'Entre na conta para ouvir o áudio' }, 401)
    const { data: autenticacao, error: erroAuth } = await banco.auth.getUser(token)
    if (erroAuth || !autenticacao.user) return json({ erro: 'Sessão inválida' }, 401)
    const { data: perfil, error: erroPerfil } = await banco.from('perfis').select('papel').eq('id', autenticacao.user.id).maybeSingle()
    if (erroPerfil || perfil?.papel !== 'admin') return json({ erro: 'Apenas o administrador pode ouvir áudios' }, 403)
    const body = await req.json().catch(() => ({}))
    const numero = Number((body as { mensagem_id?: unknown }).mensagem_id)
    if (!Number.isSafeInteger(numero) || numero <= 0) return json({ erro: 'Mensagem inválida' }, 400)
    const { data: mensagem, error: erroMensagem } = await banco.from('whatsapp_mensagens')
      .select('id, conversa_id, autor, midia_tipo, midia_id, midia_caminho')
      .eq('id', numero).maybeSingle()
    if (erroMensagem) throw erroMensagem
    if (!mensagem || mensagem.autor !== 'entrada' || mensagem.midia_tipo !== 'audio')
      return json({ erro: 'Áudio não está disponível neste atendimento' }, 404)

    let caminho = mensagem.midia_caminho as string | null
    // Recuperação quando a Meta ainda mantém a mídia, por exemplo após falha temporária no webhook.
    if (!caminho && mensagem.midia_id) {
      try {
        const audio = await baixarAudioMeta(mensagem.midia_id, Deno.env.get('WHATSAPP_TOKEN') ?? '')
        const extensoes: Record<string, string> = { 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr', 'audio/3gpp': '3gp', 'audio/opus': 'opus', 'audio/webm': 'webm', 'audio/x-m4a': 'm4a' }
        const local = `${mensagem.conversa_id}/${mensagem.id}.${extensoes[audio.tipo] || 'bin'}`
        const { error: uploadErro } = await banco.storage.from('whatsapp-audios')
          .upload(local, audio.dados, { contentType: audio.tipo, upsert: false })
        if (uploadErro && !/already exists|duplicate/i.test(uploadErro.message)) throw uploadErro
        const { error: updateErro } = await banco.from('whatsapp_mensagens')
          .update({ midia_caminho: local }).eq('id', mensagem.id)
        if (updateErro) throw updateErro
        caminho = local
      } catch (e) {
        console.error('Não foi possível recuperar áudio da Meta', e)
      }
    }
    if (!caminho) return json({ erro: 'Áudio indisponível. A Meta pode ter expirado a gravação; peça ao contato para reenviar.' }, 404)

    const { data: assinatura, error } = await banco.storage.from('whatsapp-audios')
      .createSignedUrl(caminho, 120)
    if (error || !assinatura?.signedUrl) return json({ erro: 'Não foi possível abrir este áudio' }, 404)
    return json({ url: assinatura.signedUrl })
  } catch (e) {
    console.error('whatsapp-audio', e)
    return json({ erro: 'Não foi possível carregar o áudio' }, 500)
  }
})
