// Notificação no celular (Web Push). Chamada pelo banco (mandar_push) quando
// chega mensagem no chat, quando o aluno chama por vídeo, 15 minutos antes do
// treino agendado e quando o personal manda uma notificação (tipo aviso). Também entrega a chave pública para o app se inscrever
// ({ acao: 'chave' }). Confere tudo no banco e não repete a mesma notificação
// (push_enviados), então chamar de novo não manda nada. Publicada sem login
// (verify_jwt false). As chaves VAPID são criadas aqui na primeira vez e ficam
// na tabela push_chaves, que só o servidor lê.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { enviarPush, gerarChavesVapid, type ChavesVapid, type Inscricao } from './webpush.ts'

const CONTATO = 'mailto:ney.comercial@gmail.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ok = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Banco = SupabaseClient
type Aviso = { titulo: string; corpo: string; url: string; tag: string; tipo: string }

const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const primeiro = (nome: string | null | undefined) => (nome || '').trim().split(' ')[0] || 'Alguém'

async function chaves(banco: Banco): Promise<ChavesVapid> {
  const { data } = await banco.from('push_chaves').select('publica, privada').eq('id', true).maybeSingle()
  if (data) return { publica: data.publica as string, privada: data.privada as JsonWebKey }
  const novas = await gerarChavesVapid()
  // Duas chamadas ao mesmo tempo: fica a primeira gravada.
  await banco.from('push_chaves').upsert({ id: true, publica: novas.publica, privada: novas.privada }, { onConflict: 'id', ignoreDuplicates: true })
  const { data: gravada } = await banco.from('push_chaves').select('publica, privada').eq('id', true).single()
  return { publica: gravada!.publica as string, privada: gravada!.privada as JsonWebKey }
}

/** Marca como avisado. Devolve false se já tinha sido avisado. */
async function primeiraVez(banco: Banco, chave: string) {
  const { data } = await banco.from('push_enviados').upsert({ chave }, { onConflict: 'chave', ignoreDuplicates: true }).select('chave')
  return !!data?.length
}

async function nomeDe(banco: Banco, id: string) {
  const { data } = await banco.from('perfis').select('nome, email').eq('id', id).maybeSingle()
  return (data?.nome as string) || ((data?.email as string) ?? '').split('@')[0]
}

async function mandar(banco: Banco, para: string, aviso: Aviso, urgente = false) {
  const { data } = await banco.from('push_inscricoes').select('endpoint, p256dh, auth').eq('usuario_id', para)
  if (!data?.length) return 0
  const k = await chaves(banco)
  let entregues = 0
  for (const i of data as Inscricao[]) {
    try {
      const status = await enviarPush(i, aviso, k, { contato: CONTATO, ttl: urgente ? 120 : 6 * 3600, urgencia: urgente ? 'high' : 'normal' })
      if (status === 404 || status === 410) await banco.from('push_inscricoes').delete().eq('endpoint', i.endpoint)
      else if (status >= 200 && status < 300) entregues++
    } catch (_) {
      // Um celular com problema não impede os outros.
    }
  }
  return entregues
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return ok({ erro: 'Método não permitido' }, 405)
  let pedido: { acao?: string; tipo?: string; id?: string } = {}
  try {
    pedido = await req.json()
  } catch {
    return ok({ erro: 'Dados inválidos' }, 400)
  }

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  if (pedido.acao === 'chave') return ok({ publica: (await chaves(banco)).publica })

  const id = String(pedido.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return ok({ erro: 'Dados inválidos' }, 400)
  const recente = (iso: string, minutos: number) => Date.now() - new Date(iso).getTime() < minutos * 60_000

  if (pedido.tipo === 'mensagem') {
    const { data: m } = await banco.from('mensagens').select('id, autor_id, texto, criado_em, conversa_id').eq('id', id).maybeSingle()
    if (!m || !recente(m.criado_em as string, 3)) return ok({ enviados: 0 })
    const { data: c } = await banco.from('conversas').select('aluno_id, profissional_id').eq('id', m.conversa_id).maybeSingle()
    if (!c) return ok({ enviados: 0 })
    const para = m.autor_id === c.aluno_id ? (c.profissional_id as string) : (c.aluno_id as string)
    if (!(await primeiraVez(banco, `mensagem:${id}`))) return ok({ enviados: 0 })
    const texto = String(m.texto)
    const n = await mandar(banco, para, {
      tipo: 'mensagem',
      titulo: `Mensagem de ${primeiro(await nomeDe(banco, m.autor_id as string))}`,
      corpo: texto.length > 140 ? `${texto.slice(0, 137)}…` : texto,
      url: './?abrir=conversas',
      tag: `conversa-${m.conversa_id}`,
    })
    return ok({ enviados: n })
  }

  if (pedido.tipo === 'chamada') {
    const { data: ch } = await banco.from('chamadas_video').select('id, aluno_id, profissional_id, minutos, situacao, chamando_em').eq('id', id).maybeSingle()
    if (!ch || ch.situacao !== 'chamando' || !ch.chamando_em || !recente(ch.chamando_em as string, 2)) return ok({ enviados: 0 })
    if (!(await primeiraVez(banco, `chamada:${id}:${ch.chamando_em}`))) return ok({ enviados: 0 })
    const n = await mandar(
      banco,
      ch.profissional_id as string,
      {
        tipo: 'chamada',
        titulo: `${primeiro(await nomeDe(banco, ch.aluno_id as string))} está chamando por vídeo`,
        corpo: `Treino de ${ch.minutos} min. Toque para atender (você tem 2 minutos).`,
        url: './?abrir=chamada',
        tag: `chamada-${id}`,
      },
      true,
    )
    return ok({ enviados: n })
  }

  if (pedido.tipo === 'lembrete') {
    const { data: a } = await banco.from('agendamentos_video').select('id, aluno_id, profissional_id, inicio, minutos, situacao').eq('id', id).maybeSingle()
    if (!a || a.situacao !== 'marcado' || new Date(a.inicio as string).getTime() < Date.now() - 5 * 60_000) return ok({ enviados: 0 })
    if (!(await primeiraVez(banco, `lembrete:${id}`))) return ok({ enviados: 0 })
    const [aluno, personal] = await Promise.all([nomeDe(banco, a.aluno_id as string), nomeDe(banco, a.profissional_id as string)])
    const h = hora(a.inicio as string)
    const n =
      (await mandar(banco, a.aluno_id as string, {
        tipo: 'lembrete',
        titulo: `Treino por vídeo às ${h}`,
        corpo: `Com ${primeiro(personal)}, ${a.minutos} min. Na hora, abra o chat e toque em "Chamar por vídeo".`,
        url: './?abrir=conversas',
        tag: `agenda-${id}`,
      })) +
      (await mandar(banco, a.profissional_id as string, {
        tipo: 'lembrete',
        titulo: `Treino por vídeo às ${h}`,
        corpo: `Com ${primeiro(aluno)}, ${a.minutos} min. Deixe o app aberto para atender.`,
        url: './?abrir=inicio',
        tag: `agenda-${id}`,
      }))
    return ok({ enviados: n })
  }

  if (pedido.tipo === 'aviso') {
    // Notificação que o personal mandou (na hora, agendada ou recorrente).
    const { data: r } = await banco.from('notificacoes_recebidas').select('id, notificacao_id, profissional_id, aluno_id, titulo, texto, criado_em').eq('id', id).maybeSingle()
    if (!r || !recente(r.criado_em as string, 10)) return ok({ enviados: 0 })
    if (!(await primeiraVez(banco, `aviso:${id}`))) return ok({ enviados: 0 })
    const personal = r.profissional_id ? primeiro(await nomeDe(banco, r.profissional_id as string)) : 'Seu personal'
    const texto = String(r.texto)
    const n = await mandar(banco, r.aluno_id as string, {
      tipo: 'aviso',
      titulo: `${personal}: ${r.titulo}`,
      corpo: texto.length > 180 ? `${texto.slice(0, 177)}…` : texto,
      url: './?abrir=avisos',
      tag: `aviso-${r.notificacao_id ?? id}`,
    })
    return ok({ enviados: n })
  }

  return ok({ erro: 'Tipo desconhecido' }, 400)
})
