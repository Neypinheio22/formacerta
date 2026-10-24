// O profissional liberado cria a conta de um aluno. Precisa da chave de serviço
// (criar usuário com senha), por isso roda aqui e não no celular.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: quem, error: erroQuem } = await admin.auth.getUser(token)
  if (erroQuem || !quem.user) return resposta({ erro: 'Entre na sua conta de novo.' }, 401)

  const { data: eu } = await admin.from('perfis').select('papel, situacao').eq('id', quem.user.id).maybeSingle()
  if (!eu || eu.situacao !== 'liberado' || (eu.papel !== 'profissional' && eu.papel !== 'admin'))
    return resposta({ erro: 'Só profissionais liberados podem cadastrar alunos.' }, 403)

  let dados: { nome?: string; email?: string; senha?: string }
  try {
    dados = await req.json()
  } catch {
    return resposta({ erro: 'Dados inválidos' }, 400)
  }
  const nome = (dados.nome ?? '').trim().slice(0, 120)
  const email = (dados.email ?? '').trim().toLowerCase()
  const senha = dados.senha ?? ''
  if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta({ erro: 'Preencha o nome e um e-mail válido.' }, 400)
  if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha))
    return resposta({ erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' }, 400)

  const { data: novo, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, papel: 'aluno' },
  })
  if (error || !novo.user) {
    const jaExiste = /already|registered|exists/i.test(error?.message ?? '')
    return resposta({ erro: jaExiste ? 'Este e-mail já tem cadastro no FormaCerta.' : 'Não deu para criar a conta. Tente de novo.' }, 400)
  }

  const { error: erroPerfil } = await admin
    .from('perfis')
    .update({ situacao: 'liberado', profissional_id: quem.user.id })
    .eq('id', novo.user.id)
  if (erroPerfil) return resposta({ erro: 'A conta foi criada, mas não deu para ligar ao seu perfil. Avise o administrador.' }, 500)

  return resposta({ id: novo.user.id })
})
