import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import { semTabela } from './rotinas'

export type TipoNotificacao = 'agora' | 'agendada' | 'recorrente'
export type Categoria = '' | 'financeiro' | 'treino'
export type Frequencia = 'diaria' | 'semanal' | 'quinzenal' | 'mensal'
export type SituacaoNotificacao = 'ativa' | 'pausada' | 'enviada' | 'cancelada' | 'encerrada'

/** O que o personal criou: um envio na hora, um agendamento ou uma recorrência. */
export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  categoria: Categoria
  titulo: string
  texto: string
  todos: boolean
  fichas: string[]
  no_chat: boolean
  enviar_em: string | null
  frequencia: Frequencia | null
  dias_semana: number[]
  dia_mes: number | null
  /** HH:MM:SS (Brasília) */
  hora: string | null
  /** AAAA-MM-DD */
  inicio: string | null
  fim: string | null
  situacao: SituacaoNotificacao
  proximo_envio: string | null
  ultimo_envio: string | null
  envios: number
  criado_em: string
  /** Quantos avisos já foram entregues (somando todos os envios). */
  entregues: number
  lidas: number
  /** Quantos alunos recebem hoje (com conta no app). */
  alunos: number
}

/** O que vai para salvar_notificacao. data/hora em horário de Brasília. */
export type DadosNotificacao = {
  id?: string
  tipo: TipoNotificacao
  categoria: Categoria
  titulo: string
  texto: string
  todos: boolean
  fichas: string[]
  no_chat: boolean
  data: string
  hora: string
  frequencia: Frequencia
  dias_semana: number[]
  dia_mes: number
  inicio: string
  fim: string
}

/** Aviso que chegou para o aluno. */
export type Aviso = {
  id: string
  categoria: Categoria
  titulo: string
  texto: string
  criado_em: string
  lida_em: string | null
  profissional_nome: string | null
  profissional_foto: string | null
}

export const TEXTO_MAXIMO = 1000
export const TITULO_MAXIMO = 80

export const FALTA_SQL = 'Falta rodar no Supabase o arquivo notificacoes-do-personal.sql para as notificações funcionarem.'

// ---------- Modelos prontos ----------

export type Modelo = {
  id: string
  categoria: Exclude<Categoria, ''>
  rotulo: string
  titulo: string
  texto: string
  /** Como costuma ser usado (só sugestão: o personal escolhe). */
  sugestao?: Partial<Pick<DadosNotificacao, 'tipo' | 'frequencia' | 'dia_mes' | 'dias_semana' | 'hora'>>
}

export const CATEGORIAS: { id: Exclude<Categoria, ''>; rotulo: string; emoji: string }[] = [
  { id: 'financeiro', rotulo: 'Financeiro', emoji: '💰' },
  { id: 'treino', rotulo: 'Treinamento', emoji: '🏋️' },
]

export const MODELOS: Modelo[] = [
  {
    id: 'mensalidade',
    categoria: 'financeiro',
    rotulo: 'Lembrete de mensalidade',
    titulo: 'Lembrete de mensalidade',
    texto: 'Oi, {nome}! Passando para lembrar da sua mensalidade deste mês. Qualquer dúvida, é só me chamar.',
    sugestao: { tipo: 'recorrente', frequencia: 'mensal', dia_mes: 5, hora: '09:00' },
  },
  {
    id: 'vencimento',
    categoria: 'financeiro',
    rotulo: 'Vencimento próximo',
    titulo: 'Sua mensalidade vence em breve',
    texto: 'Oi, {nome}! Sua mensalidade vence daqui a 3 dias. Se já pagou, pode desconsiderar esta mensagem. Obrigado!',
  },
  {
    id: 'atraso',
    categoria: 'financeiro',
    rotulo: 'Pagamento em atraso',
    titulo: 'Mensalidade em aberto',
    texto: 'Oi, {nome}, tudo bem? Ainda não encontrei o pagamento da sua mensalidade, que já venceu. Consegue verificar para não interromper seus treinos?',
  },
  {
    id: 'confirmacao',
    categoria: 'financeiro',
    rotulo: 'Confirmação de pagamento',
    titulo: 'Pagamento recebido ✅',
    texto: 'Pagamento recebido, {nome}! Obrigado pela confiança. Bora treinar! 💪',
    sugestao: { tipo: 'agora' },
  },
  {
    id: 'renovacao',
    categoria: 'financeiro',
    rotulo: 'Renovação da consultoria',
    titulo: 'Hora de renovar a consultoria',
    texto: 'Oi, {nome}! Sua consultoria está chegando ao fim do período. Vamos renovar para continuar evoluindo? Me chama aqui que eu te explico.',
  },
  {
    id: 'horario',
    categoria: 'treino',
    rotulo: 'Horário de treino',
    titulo: 'Hoje tem treino! 💪',
    texto: 'Bom dia, {nome}! Hoje tem treino. Separe a garrafinha de água e vamos com tudo!',
    sugestao: { tipo: 'recorrente', frequencia: 'semanal', dias_semana: [1, 3, 5], hora: '07:00' },
  },
  {
    id: 'programado',
    categoria: 'treino',
    rotulo: 'Treino programado',
    titulo: 'Seu treino está pronto',
    texto: '{nome}, seu treino de hoje já está no app, na aba Treino. Qualquer dúvida na execução, me chama. Bom treino!',
  },
  {
    id: 'retorno',
    categoria: 'treino',
    rotulo: 'Retorno aos exercícios',
    titulo: 'Senti sua falta!',
    texto: 'Oi, {nome}! Senti sua falta nos treinos. Que tal voltar hoje, nem que seja um treino leve? Estou aqui para ajudar.',
  },
  {
    id: 'ficha',
    categoria: 'treino',
    rotulo: 'Ficha atualizada',
    titulo: 'Ficha de treino atualizada',
    texto: '{nome}, atualizei sua ficha de treino! Abra a aba Treino para ver os exercícios novos.',
    sugestao: { tipo: 'agora' },
  },
  {
    id: 'avaliacao',
    categoria: 'treino',
    rotulo: 'Avaliação física',
    titulo: 'Hora da reavaliação',
    texto: 'Oi, {nome}! Está chegando a hora da sua avaliação física. Vamos marcar? Assim a gente vê o quanto você evoluiu.',
  },
]

// ---------- Datas (sempre no horário de Brasília) ----------

const FUSO = 'America/Sao_Paulo'
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const partes = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  )
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` }
}

/** Hoje (AAAA-MM-DD) e a hora agora (HH:MM) em Brasília. */
export const agoraBrasilia = (agora = new Date()) => partes(agora)

/** "05/11 às 08:00" (com o ano se não for este ano). */
export function quandoBr(iso: string, agora = new Date()): string {
  const { data, hora } = partes(new Date(iso))
  const [a, m, d] = data.split('-')
  const ano = a !== partes(agora).data.slice(0, 4) ? `/${a}` : ''
  return `${d}/${m}${ano} às ${hora}`
}

export const dataBr = (iso: string) => iso.split('-').reverse().join('/')

/** "Seg, Qua e Sex às 07:30", "Todo dia 5 às 09:00"… */
export function descreverRecorrencia(n: Pick<Notificacao, 'frequencia' | 'dias_semana' | 'dia_mes' | 'hora'>): string {
  const hora = (n.hora ?? '').slice(0, 5)
  const dias = [...(n.dias_semana ?? [])].sort((a, b) => a - b).map((d) => DIAS_CURTOS[d])
  const lista = dias.length > 1 ? `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}` : (dias[0] ?? '')
  if (n.frequencia === 'diaria') return `Todo dia às ${hora}`
  if (n.frequencia === 'mensal') return `Todo dia ${n.dia_mes} do mês às ${hora}`
  if (n.frequencia === 'quinzenal') return `A cada 2 semanas (${lista}) às ${hora}`
  if (dias.length === 7) return `Todo dia às ${hora}`
  return `${lista} às ${hora}`
}

/** Troca {nome} pelo primeiro nome, como o aluno vai ver. */
export const comNome = (texto: string, nome: string) => texto.replaceAll('{nome}', nome.trim().split(' ')[0] || 'aluno')

export function dadosVazios(tipo: TipoNotificacao, agora = new Date()): DadosNotificacao {
  const { data } = agoraBrasilia(agora)
  return {
    tipo,
    categoria: '',
    titulo: '',
    texto: '',
    todos: true,
    fichas: [],
    no_chat: false,
    data,
    hora: '08:00',
    frequencia: 'semanal',
    dias_semana: [1, 3, 5],
    dia_mes: 5,
    inicio: data,
    fim: '',
  }
}

/** Para editar uma notificação programada. */
export function dadosDe(n: Notificacao): DadosNotificacao {
  const base = dadosVazios(n.tipo)
  const envio = n.enviar_em ? partes(new Date(n.enviar_em)) : null
  return {
    ...base,
    id: n.id,
    categoria: n.categoria,
    titulo: n.titulo,
    texto: n.texto,
    todos: n.todos,
    fichas: n.fichas ?? [],
    no_chat: n.no_chat,
    data: envio?.data ?? base.data,
    hora: n.tipo === 'recorrente' ? (n.hora ?? '08:00').slice(0, 5) : (envio?.hora ?? base.hora),
    frequencia: n.frequencia ?? 'semanal',
    dias_semana: n.dias_semana?.length ? n.dias_semana : base.dias_semana,
    dia_mes: n.dia_mes ?? 5,
    inicio: n.inicio ?? base.inicio,
    fim: n.fim ?? '',
  }
}

/** Confere antes de mandar ao banco. Devolve a mensagem do problema ou null. */
export function conferir(d: DadosNotificacao, agora = new Date()): string | null {
  if (!d.todos && !d.fichas.length) return 'Escolha pelo menos um aluno.'
  if (!d.titulo.trim()) return 'Escreva o título.'
  if (!d.texto.trim()) return 'Escreva a mensagem.'
  if (d.tipo === 'agendada') {
    if (!d.data || !d.hora) return 'Escolha a data e o horário.'
    const { data, hora } = agoraBrasilia(agora)
    if (`${d.data} ${d.hora}` < `${data} ${hora}`) return 'Esse horário já passou. Escolha outro.'
  }
  if (d.tipo === 'recorrente') {
    if (!d.hora) return 'Escolha o horário.'
    if ((d.frequencia === 'semanal' || d.frequencia === 'quinzenal') && !d.dias_semana.length) return 'Escolha os dias da semana.'
    if (d.frequencia === 'mensal' && !(d.dia_mes >= 1 && d.dia_mes <= 31)) return 'Escolha o dia do mês (1 a 31).'
    if (d.fim && d.inicio && d.fim < d.inicio) return 'A data de encerramento vem antes do início.'
  }
  return null
}

// ---------- Banco ----------

export async function listarNotificacoes(): Promise<{ lista: Notificacao[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('minhas_notificacoes')
  if (error) return { lista: [], erro: semTabela(error.message) || /function/i.test(error.message) ? FALTA_SQL : erroAmigavel(error) }
  return {
    lista: ((data ?? []) as Notificacao[]).map((n) => ({ ...n, entregues: Number(n.entregues), lidas: Number(n.lidas), alunos: Number(n.alunos) })),
    erro: null,
  }
}

export async function salvarNotificacao(d: DadosNotificacao): Promise<{ enviados: number; erro: string | null }> {
  const dados = {
    ...d,
    titulo: d.titulo.trim().slice(0, TITULO_MAXIMO),
    texto: d.texto.trim().slice(0, TEXTO_MAXIMO),
    fichas: d.todos ? [] : d.fichas,
    fim: d.fim || null,
  }
  const { data, error } = await supabase.rpc('salvar_notificacao', { dados })
  if (error) return { enviados: 0, erro: semTabela(error.message) ? FALTA_SQL : erroAmigavel(error) }
  return { enviados: Number((data as { enviados?: number })?.enviados ?? 0), erro: null }
}

export type AcaoNotificacao = 'pausar' | 'retomar' | 'cancelar' | 'excluir' | 'enviar_agora'

export async function mudarNotificacao(id: string, acao: AcaoNotificacao) {
  const { error } = await supabase.rpc('mudar_notificacao', { notificacao: id, acao })
  return error ? erroAmigavel(error) : null
}

/** Agendadas e recorrentes ainda valendo (o número no sino do personal). */
export async function contarProgramadas(meuId: string): Promise<number> {
  const { count, error } = await supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('profissional_id', meuId).in('situacao', ['ativa', 'pausada'])
  return error ? 0 : (count ?? 0)
}

export async function listarAvisos(): Promise<{ lista: Aviso[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('meus_avisos')
  if (error) return { lista: [], erro: semTabela(error.message) || /function/i.test(error.message) ? null : erroAmigavel(error) }
  return { lista: (data ?? []) as Aviso[], erro: null }
}

/** Avisos do personal que o aluno ainda não abriu (o número no sino do aluno). */
export async function contarAvisosNovos(meuId: string): Promise<number> {
  const { count, error } = await supabase.from('notificacoes_recebidas').select('id', { count: 'exact', head: true }).eq('aluno_id', meuId).is('lida_em', null)
  return error ? 0 : (count ?? 0)
}

export async function marcarAvisosLidos() {
  await supabase.rpc('marcar_avisos_lidos')
  window.dispatchEvent(new Event('formacerta:avisos-lidos'))
}
