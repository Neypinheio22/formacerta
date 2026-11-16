import { enderecoApp, supabase } from './cliente'
import { erroAmigavel } from './conta'

/** O que um aluno novo já fez no app (Administração → Alunos novos). */
export type AlunoNovo = {
  id: string
  nome: string
  email: string
  whatsapp: string
  situacao: 'pendente' | 'liberado' | 'bloqueado'
  criado_em: string
  ultimo_acesso: string | null
  email_confirmado: boolean
  personal: string | null
  termos: boolean
  dados: boolean
  avaliacoes: number
  ultima_avaliacao: string | null
  treinos: number
  treinos_feitos: number
  ultimo_treino: string | null
  mensagens: number
  comprou: boolean
  notificacoes: boolean
}

/** Lista os alunos que se cadastraram nos últimos `dias`. `null` = SQL ainda não rodado. */
export async function listarAlunosNovos(dias = 60): Promise<AlunoNovo[] | null> {
  const { data, error } = await supabase.rpc('admin_alunos_novos', { dias })
  if (error || !Array.isArray(data)) return null
  return (data as AlunoNovo[]).map((a) => ({
    ...a,
    avaliacoes: Number(a.avaliacoes ?? 0),
    treinos: Number(a.treinos ?? 0),
    treinos_feitos: Number(a.treinos_feitos ?? 0),
    mensagens: Number(a.mensagens ?? 0),
  }))
}

/** Manda de novo o e-mail de confirmação do cadastro. */
export async function reenviarConfirmacao(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: enderecoApp() } })
  if (!error) return null
  if (/rate|seconds|security purposes/i.test(error.message)) return 'Já foi enviado agora há pouco. Espere um minuto e tente de novo.'
  return erroAmigavel(error)
}

export type Etapa = { nome: string; feita: boolean }

/** As etapas do primeiro uso, na ordem em que o aluno costuma passar. */
export function etapasDoAluno(a: AlunoNovo): Etapa[] {
  return [
    { nome: 'Confirmou o e-mail', feita: a.email_confirmado },
    { nome: 'Entrou no app', feita: !!a.ultimo_acesso },
    { nome: 'Preencheu os dados', feita: a.dados },
    { nome: '1ª avaliação', feita: a.avaliacoes > 0 },
    { nome: 'Tem treino', feita: a.treinos > 0 },
    { nome: 'Fez treino', feita: a.treinos_feitos > 0 },
  ]
}

/** Último sinal de vida: acesso, avaliação ou treino feito, o que for mais recente. */
export function ultimaAtividade(a: AlunoNovo): string | null {
  const datas = [a.ultimo_acesso, a.ultima_avaliacao, a.ultimo_treino].filter((d): d is string => !!d)
  if (datas.length === 0) return null
  return datas.reduce((m, d) => (new Date(d) > new Date(m) ? d : m))
}

export function diasDesde(data: string, agora = new Date()): number {
  return Math.max(0, Math.floor((agora.getTime() - new Date(data).getTime()) / 86_400_000))
}

export type Situacao = { rotulo: string; tom: 'ok' | 'atencao' | 'alerta' }

/** Um resumo de uma palavra para o administrador saber quem precisa de um empurrão. */
export function situacaoDoAluno(a: AlunoNovo, agora = new Date()): Situacao {
  if (!a.email_confirmado) return { rotulo: 'Sem confirmar e-mail', tom: 'alerta' }
  if (a.situacao === 'pendente') return { rotulo: 'Aguardando liberação', tom: 'atencao' }
  if (a.situacao === 'bloqueado') return { rotulo: 'Bloqueado', tom: 'alerta' }
  if (!a.ultimo_acesso) return { rotulo: 'Nunca entrou', tom: 'alerta' }
  const ultima = ultimaAtividade(a)
  const dias = ultima ? diasDesde(ultima, agora) : 0
  if (dias >= 7) return { rotulo: `Parado há ${dias} dias`, tom: 'alerta' }
  if (a.avaliacoes === 0) return { rotulo: 'Falta a 1ª avaliação', tom: 'atencao' }
  return { rotulo: 'Ativo', tom: 'ok' }
}

/** Mensagem pronta de WhatsApp, conforme o ponto em que o aluno parou. */
export function mensagemParaAluno(a: AlunoNovo): string {
  const primeiro = (a.nome || '').trim().split(/\s+/)[0] || 'tudo bem'
  const oi = `Olá, ${primeiro}! Aqui é do FormaCerta.`
  if (!a.email_confirmado)
    return `${oi} Vi que você se cadastrou, mas falta confirmar o seu e-mail. Acabei de reenviar o link para ${a.email}. Abra o e-mail (confira também o spam/lixo eletrônico), toque no link e depois entre em formacerta.app.br.`
  if (!a.ultimo_acesso || a.avaliacoes === 0)
    return `${oi} Sua conta está pronta. Que tal fazer a sua primeira avaliação de postura? Entre em formacerta.app.br, toque em "Começar avaliação" e siga as 4 fotos. Leva uns 5 minutos. Qualquer dúvida, me chame aqui.`
  if (a.treinos > 0 && a.treinos_feitos === 0)
    return `${oi} Seu treino já está no app. Entre em formacerta.app.br, abra a aba Treino e toque em INICIAR TREINO. Qualquer dúvida, me chame aqui.`
  return `${oi} Passando para saber como estão os treinos. Precisa de ajuda com alguma coisa no app?`
}
