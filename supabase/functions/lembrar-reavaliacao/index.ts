// Lembrete de reavaliação. Chamada todo dia às 8h (Brasília) pelo pg_cron.
// Procura os testes cuja data de refazer (resultados.reavaliar_em) chegou e
// manda um e-mail ao aluno e um ao profissional dele, com todos os testes do
// dia. Cada resultado só é lembrado uma vez (lembrete_em), então chamar de
// novo não repete e-mail. Teste que já foi refeito não gera lembrete.
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP = Deno.env.get('APP_URL') ?? 'https://formacerta.app.br/'
const SUPORTE = 'ney.comercial@gmail.com'
// Lembretes atrasados há mais que isso não são mandados (evita e-mail velho).
const JANELA_DIAS = 7

const ROTULO: Record<string, string> = {
  postura: 'Avaliação de postura',
  corrida: 'Avaliação da corrida',
  exercicio: 'Exercício em vídeo',
  flexibilidade: 'Teste de Flexibilidade',
  adams: 'Teste de Adams (coluna)',
  idoso: 'Avaliação funcional do idoso',
  medidas: 'Peso e medidas do corpo',
}

type Linha = {
  id: string
  tipo: string
  feito_em: string
  reavaliar_em: string
  apelido: string
  aluno_id: string | null
  ficha_id: string | null
  enviado_por: string
  dados: Record<string, unknown>
}

type Perfil = { id: string; email: string; nome: string; papel: string; situacao: string; profissional_id: string | null; lembretes_email: boolean }

type Item = { aluno: string; teste: string; data: string }

const ok = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const menosDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

const dataBr = (dia: string) => dia.split('-').reverse().join('/')

function nomeTeste(r: Linha) {
  if (r.tipo === 'corrida') return `${ROTULO.corrida} (${r.dados?.vista === 'tras' ? 'de trás' : 'de lado'})`
  return ROTULO[r.tipo] ?? 'Avaliação'
}

function emailHtml(nome: string, itens: Item[], profissional: boolean) {
  const primeiro = escapar(nome.trim().split(' ')[0] || 'Olá')
  const linhas = itens
    .map((i) => `<li style="margin:4px 0">${profissional ? `<strong>${escapar(i.aluno)}</strong>: ` : ''}${escapar(i.teste)} <span style="color:#555">(desde ${dataBr(i.data)})</span></li>`)
    .join('')
  const texto = profissional
    ? 'Chegou a data de reavaliar estes alunos, conforme o plano de ação de cada teste:'
    : 'Chegou a hora de refazer estes testes, conforme o seu plano de ação:'
  const dica = profissional
    ? 'No app, em "Reavaliações", você vê a lista completa e avisa cada aluno pelo WhatsApp com um toque.'
    : 'Refazer os testes mostra o quanto você evoluiu e ajusta o seu treino. Combine com o seu personal.'
  return `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#111;max-width:520px">
      <p>Oi, ${primeiro}!</p>
      <p>${texto}</p>
      <ul style="padding-left:18px">${linhas}</ul>
      <p>${dica}</p>
      <p><a href="${APP}" style="background:#36f294;color:#020b16;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Abrir o FormaCerta</a></p>
      <p style="color:#777;font-size:12px">Você recebe este e-mail porque tem conta no FormaCerta. Para parar os lembretes, desmarque a opção em "Minha conta".
      Dúvidas: ${SUPORTE}.</p>
    </div>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ erro: 'Método não permitido' }, 405)

  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return ok({ enviados: 0, motivo: 'RESEND_API_KEY não configurada' })
  // Remetente: domínio verificado no Resend. Para trocar, crie o segredo EMAIL_REMETENTE no Supabase.
  const remetente = Deno.env.get('EMAIL_REMETENTE') || 'FormaCerta <lembrete@belezudis.com.br>'

  const banco = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const hoje = hojeBrasil()

  const { data: vencidos, error } = await banco
    .from('resultados')
    .select('id, tipo, feito_em, reavaliar_em, apelido, aluno_id, ficha_id, enviado_por, dados')
    .is('lembrete_em', null)
    .lte('reavaliar_em', hoje)
    .gte('reavaliar_em', menosDias(hoje, JANELA_DIAS))
    .limit(500)
  if (error) return ok({ erro: error.message }, 500)
  if (!vencidos?.length) return ok({ enviados: 0 })

  const perfis = new Map<string, Perfil | null>()
  async function perfil(id: string | null) {
    if (!id) return null
    if (!perfis.has(id)) {
      const { data } = await banco.from('perfis').select('id, email, nome, papel, situacao, profissional_id, lembretes_email').eq('id', id).maybeSingle()
      perfis.set(id, (data as Perfil | null) ?? null)
    }
    return perfis.get(id)!
  }

  // Um e-mail por pessoa, com todos os testes dela (ou dos alunos dela).
  const caixas = new Map<string, { nome: string; profissional: boolean; itens: Item[] }>()
  const anotar = (p: Perfil | null, profissional: boolean, item: Item) => {
    if (!p || !p.email || p.situacao !== 'liberado' || p.lembretes_email === false) return
    const k = `${p.email}|${profissional}`
    const c = caixas.get(k) ?? { nome: p.nome || p.email, profissional, itens: [] }
    if (!c.itens.some((i) => i.aluno === item.aluno && i.teste === item.teste)) c.itens.push(item)
    caixas.set(k, c)
  }

  for (const r of vencidos as Linha[]) {
    // Já refez o mesmo teste depois? Então não lembra.
    let q = banco.from('resultados').select('id', { count: 'exact', head: true }).eq('tipo', r.tipo).gt('feito_em', r.feito_em)
    if (r.ficha_id) q = q.eq('ficha_id', r.ficha_id)
    else if (r.aluno_id) q = q.eq('aluno_id', r.aluno_id)
    else q = q.eq('enviado_por', r.enviado_por).eq('apelido', r.apelido)
    if (r.tipo === 'corrida' && typeof r.dados?.vista === 'string') q = q.eq('dados->>vista', r.dados.vista)
    if (r.tipo === 'exercicio' && typeof r.dados?.exercicio === 'string') q = q.eq('dados->>exercicio', r.dados.exercicio)
    const { count } = await q
    if (count) continue

    const ficha = r.ficha_id ? (await banco.from('fichas').select('nome, aluno_id, profissional_id').eq('id', r.ficha_id).maybeSingle()).data : null
    const aluno = await perfil(ficha?.aluno_id ?? r.aluno_id)
    const quemEnviou = await perfil(r.enviado_por)
    const profissionalId =
      ficha?.profissional_id ?? (quemEnviou && quemEnviou.papel !== 'aluno' && quemEnviou.id !== aluno?.id ? quemEnviou.id : (aluno?.profissional_id ?? null))
    const item = { aluno: ficha?.nome || aluno?.nome || r.apelido || 'Aluno', teste: nomeTeste(r), data: r.reavaliar_em }

    anotar(aluno, false, item)
    if (profissionalId && profissionalId !== aluno?.id) anotar(await perfil(profissionalId), true, item)
  }

  // Marca antes de mandar: se a função rodar duas vezes ao mesmo tempo, não repete.
  await banco
    .from('resultados')
    .update({ lembrete_em: new Date().toISOString() })
    .in(
      'id',
      (vencidos as Linha[]).map((r) => r.id),
    )

  let enviados = 0
  const falhas: string[] = []
  for (const [k, c] of caixas) {
    const para = k.split('|')[0]
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: remetente,
        to: [para],
        reply_to: SUPORTE,
        subject: c.profissional
          ? `Reavaliação: ${c.itens.length === 1 ? c.itens[0].aluno : `${new Set(c.itens.map((i) => i.aluno)).size} alunos`} no FormaCerta`
          : 'Chegou a hora da sua reavaliação no FormaCerta',
        html: emailHtml(c.nome, c.itens, c.profissional),
      }),
    })
    if (r.ok) enviados++
    else falhas.push(`${r.status}`)
    // O plano grátis do Resend aceita 2 e-mails por segundo.
    await new Promise((p) => setTimeout(p, 600))
  }

  return ok({ resultados: vencidos.length, enviados, falhas: falhas.length })
})
