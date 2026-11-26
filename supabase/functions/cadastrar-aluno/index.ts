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

  let dados: { nome?: string; email?: string; senha?: string; fichaId?: string }
  try {
    dados = await req.json()
  } catch {
    return resposta({ erro: 'Dados inválidos' }, 400)
  }
  const nome = typeof dados?.nome === 'string' ? dados.nome.trim().slice(0, 120) : ''
  const email = typeof dados?.email === 'string' ? dados.email.trim().toLowerCase() : ''
  const senha = typeof dados?.senha === 'string' ? dados.senha : ''
  const fichaId = dados?.fichaId
  if (typeof fichaId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(fichaId))
    return resposta({ erro: 'Atualize a página e abra a ficha do aluno para criar o acesso.' }, 400)
  if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta({ erro: 'Preencha o nome e um e-mail válido.' }, 400)
  if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha))
    return resposta({ erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' }, 400)

  const profissional = quem.user.id
  const { data: ficha, error: erroFicha } = await admin.from('fichas')
    .select('id, aluno_id, nome').eq('id', fichaId).eq('profissional_id', profissional).maybeSingle()
  if (erroFicha) return resposta({ erro: 'Não deu para consultar a ficha. Tente de novo.' }, 500)
  if (!ficha) return resposta({ erro: 'Esta ficha não está disponível para sua conta.' }, 404)
  if (ficha.aluno_id) return resposta({ erro: 'Esta ficha já tem uma conta vinculada.' }, 409)

  const { data: reservado, error: erroReserva } = await admin.rpc('email_admin')
  if (erroReserva) return resposta({ erro: 'Não deu para validar o e-mail. Tente de novo.' }, 500)
  if (email === reservado) return resposta({ erro: 'Use o e-mail do aluno.' }, 400)

  const { data: novo, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    app_metadata: { ficha_cadastro: ficha.id, profissional_cadastro: profissional },
    user_metadata: { nome: ficha.nome, papel: 'aluno' },
  })
  let alunoId: string | undefined = novo?.user?.id
  if (error || !alunoId) {
    if (!/already|registered|exists/i.test(error?.message ?? ''))
      return resposta({ erro: 'Não deu para criar a conta. Tente de novo.' }, 400)
    const { data: pendente, error: erroPendente } = await admin.rpc('aluno_com_cadastro_pendente', {
      p_email: email, p_ficha: ficha.id, p_profissional: profissional,
    })
    if (erroPendente) return resposta({ erro: 'Não deu para verificar o cadastro existente. Tente de novo.' }, 500)
    if (typeof pendente !== 'string' || !pendente) return resposta({ erro: 'Este e-mail já tem cadastro no FormaCerta.' }, 409)
    alunoId = pendente
  }

  const { error: erroVinculo } = await admin.rpc('finalizar_cadastro_aluno', {
    p_aluno: alunoId, p_ficha: ficha.id, p_profissional: profissional,
  })
  if (erroVinculo) return resposta({ erro: 'A conta foi criada, mas a ficha ainda não foi vinculada. Tente de novo com o mesmo e-mail.' }, 500)

  return resposta({ id: alunoId, retomado: !novo?.user })
})
