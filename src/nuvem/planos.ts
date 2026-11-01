import { supabase } from './cliente'
import { erroAmigavel, type Papel } from './conta'

export type Publico = 'aluno' | 'profissional'
export type Ciclo = 'mensal' | 'anual'
export type Forma = 'pix' | 'cartao' | 'boleto'
export type SituacaoAssinatura = 'teste' | 'aguardando' | 'ativa' | 'cancelada'
export type SituacaoPagamento = 'pendente' | 'pago' | 'cancelado'

export type Plano = {
  id: string
  publico: Publico
  nome: string
  descricao: string
  preco_mensal: number
  preco_anual: number
  /** Vazio = alunos ilimitados. */
  limite_alunos: number | null
  profissionais: number
  recursos: string[]
  destaque: boolean
  ativo: boolean
  ordem: number
}

export type ConfigCobranca = {
  comissao_pct: number
  dias_gratis: number
  gateway: 'nenhum' | 'asaas' | 'mercadopago' | 'stripe'
  /** Enquanto 'testadores', só o administrador e quem ele escolher veem os planos. */
  planos_para: 'testadores' | 'todos'
}

export type Assinatura = {
  id: string
  usuario_id: string
  plano_id: string
  ciclo: Ciclo
  situacao: SituacaoAssinatura
  valor: number
  valido_ate: string | null
  criado_em: string
}

export type Servico = {
  id: string
  profissional_id: string
  nome: string
  descricao: string
  preco: number
  ativo: boolean
  /** Item da lista da plataforma (vazio = serviço próprio do personal). */
  catalogo_id?: string | null
  /** Cobrado por mês. */
  mensal?: boolean
  /** Valor diferente do sugerido, aprovado pelo administrador. */
  preco_aprovado?: boolean
}

/** Trabalho que a plataforma oferece; cada personal liga e põe o preço dele. */
export type ItemCatalogo = {
  id: string
  grupo: 'avaliacao' | 'treino'
  nome: string
  descricao: string
  preco_min: number
  preco_max: number
  /** Preço do FormaCerta: o personal cobra este valor, a não ser que o administrador aprove outro. */
  preco_sugerido: number
  mensal: boolean
  ordem: number
  ativo: boolean
}

/** Pedido do personal para cobrar outro valor ou criar um serviço fora da lista. */
export type PedidoPreco = {
  id: string
  profissional_id: string
  catalogo_id: string | null
  nome: string
  mensal: boolean
  valor: number
  motivo: string
  situacao: 'pendente' | 'aprovado' | 'recusado'
  resposta: string
  criado_em: string
}

export type Pagamento = {
  id: string
  pagador_id: string
  recebedor_id: string | null
  tipo: 'assinatura' | 'avaliacao'
  assinatura_id: string | null
  descricao: string
  valor: number
  comissao: number
  forma: Forma
  situacao: SituacaoPagamento
  criado_em: string
  pago_em: string | null
  /** Cobrança do Mercado Pago, quando já foi gerada. */
  pix_copia_cola: string | null
  pix_qr: string | null
  link_pagamento: string | null
}

export type Cobranca = { pix_copia_cola?: string; pix_qr?: string | null; link?: string | null }

export const ROTULO_FORMA: Record<Forma, string> = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto' }
export const ROTULO_ASSINATURA: Record<SituacaoAssinatura, string> = {
  teste: 'Teste grátis',
  aguardando: 'Aguardando pagamento',
  ativa: 'Ativa',
  cancelada: 'Cancelada',
}
export const ROTULO_PAGAMENTO: Record<SituacaoPagamento, string> = { pendente: 'Pendente', pago: 'Pago', cancelado: 'Cancelado' }

// Os mesmos planos do banco, para a tela abrir antes de o banco responder (ou sem internet).
export const PLANOS_PADRAO: Plano[] = [
  {
    id: 'aluno-gratis',
    publico: 'aluno',
    nome: 'Grátis',
    descricao: 'Para conhecer o app.',
    preco_mensal: 0,
    preco_anual: 0,
    limite_alunos: null,
    profissionais: 1,
    recursos: ['Avaliação de postura com IA', 'Histórico no seu celular', 'Testes de flexibilidade e coluna'],
    destaque: false,
    ativo: true,
    ordem: 1,
  },
  {
    id: 'aluno-pro',
    publico: 'aluno',
    nome: 'Aluno Pro',
    descricao: 'Tudo liberado para treinar certo.',
    preco_mensal: 24.9,
    preco_anual: 249,
    limite_alunos: null,
    profissionais: 1,
    recursos: ['Todos os testes: corrida, exercício em vídeo, idoso', 'Resultados guardados na nuvem', 'Evolução em gráficos', 'Relatório em PDF', 'Seu personal acompanha de longe'],
    destaque: true,
    ativo: true,
    ordem: 2,
  },
  {
    id: 'personal-gratis',
    publico: 'profissional',
    nome: 'Grátis',
    descricao: 'Para testar com os primeiros alunos.',
    preco_mensal: 0,
    preco_anual: 0,
    limite_alunos: 2,
    profissionais: 1,
    recursos: ['Até 2 alunos', 'Avaliação de postura e testes', 'Histórico dos alunos'],
    destaque: false,
    ativo: true,
    ordem: 1,
  },
  {
    id: 'personal-essencial',
    publico: 'profissional',
    nome: 'Essencial',
    descricao: 'Para quem está começando a atender.',
    preco_mensal: 49.9,
    preco_anual: 499,
    limite_alunos: 15,
    profissionais: 1,
    recursos: ['Até 15 alunos', 'Todos os testes e avaliações', 'Relatório com a sua logo e CREF', 'Venda de avaliações pelo app'],
    destaque: false,
    ativo: true,
    ordem: 2,
  },
  {
    id: 'personal-pro',
    publico: 'profissional',
    nome: 'Pro',
    descricao: 'O mais escolhido: sem limite de alunos.',
    preco_mensal: 89.9,
    preco_anual: 899,
    limite_alunos: null,
    profissionais: 1,
    recursos: ['Alunos ilimitados', 'Tudo do Essencial', 'Modo estúdio com vários celulares', 'Vídeos de referência para os alunos', 'Suporte prioritário'],
    destaque: true,
    ativo: true,
    ordem: 3,
  },
  {
    id: 'personal-estudio',
    publico: 'profissional',
    nome: 'Estúdio',
    descricao: 'Para estúdios e equipes.',
    preco_mensal: 249,
    preco_anual: 2490,
    limite_alunos: null,
    profissionais: 5,
    recursos: ['Até 5 profissionais', 'Alunos ilimitados', 'Tudo do Pro', 'Painel da equipe'],
    destaque: false,
    ativo: true,
    ordem: 4,
  },
]

export const CONFIG_PADRAO: ConfigCobranca = { comissao_pct: 10, dias_gratis: 30, gateway: 'nenhum', planos_para: 'testadores' }

/** Público dos planos que a pessoa vê. O administrador vê os do personal. */
export const publicoDe = (papel: Papel): Publico => (papel === 'aluno' ? 'aluno' : 'profissional')

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const emReais = (v: number) => real.format(v).replace(/ /g, ' ')

export const precoDo = (p: Plano, ciclo: Ciclo) => (ciclo === 'anual' ? p.preco_anual : p.preco_mensal)

/** Quanto sai por mês no plano anual. */
export const mensalNoAnual = (p: Plano) => Math.round((p.preco_anual / 12) * 100) / 100

/** Quanto economiza no ano pagando anual em vez de mensal. */
export const economiaAnual = (p: Plano) => Math.max(0, Math.round((p.preco_mensal * 12 - p.preco_anual) * 100) / 100)

/** Divisão de uma avaliação vendida pelo personal: a parte do FormaCerta e o que fica com ele. */
export function dividir(valor: number, comissaoPct: number) {
  const comissao = Math.round(valor * comissaoPct) / 100
  return { comissao, liquido: Math.round((valor - comissao) * 100) / 100 }
}

/** A assinatura que vale agora (a mais nova que não foi cancelada). */
export const assinaturaAtual = (lista: Assinatura[]) => lista.find((a) => a.situacao !== 'cancelada') ?? null

/** "1.234,5" ou "49.90" vira número. */
export function lerReais(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, '')
  if (!limpo) return null
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const n = Number(normal)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

const numeros = <T extends Record<string, unknown>>(linha: T, campos: (keyof T)[]) => {
  const r = { ...linha }
  for (const c of campos) if (r[c] !== null && r[c] !== undefined) (r as Record<keyof T, unknown>)[c] = Number(r[c])
  return r
}

/** Se esta pessoa já pode ver os planos (administrador, testador ou liberado para todos). */
export async function planosLiberados(): Promise<boolean> {
  const { data, error } = await supabase.rpc('planos_liberados')
  return !error && data === true
}

export async function listarTestadores(): Promise<string[]> {
  const { data } = await supabase.from('testadores_planos').select('usuario_id')
  return (data ?? []).map((t) => t.usuario_id as string)
}

export async function adicionarTestador(id: string) {
  const { error } = await supabase.from('testadores_planos').insert({ usuario_id: id })
  return error ? erroAmigavel(error) : null
}

export async function tirarTestador(id: string) {
  const { error } = await supabase.from('testadores_planos').delete().eq('usuario_id', id)
  return error ? erroAmigavel(error) : null
}

export async function listarPlanos(): Promise<{ planos: Plano[]; erro: string | null }> {
  const { data, error } = await supabase.from('planos').select('*').order('ordem')
  if (error || !data?.length) return { planos: PLANOS_PADRAO, erro: error ? erroAmigavel(error) : null }
  return { planos: data.map((p) => numeros(p as Plano, ['preco_mensal', 'preco_anual'])), erro: null }
}

export async function lerConfig(): Promise<ConfigCobranca> {
  const { data } = await supabase.from('config_cobranca').select('comissao_pct, dias_gratis, gateway, planos_para').maybeSingle()
  return data ? numeros(data as ConfigCobranca, ['comissao_pct', 'dias_gratis']) : CONFIG_PADRAO
}

export async function minhasAssinaturas(meuId: string): Promise<Assinatura[]> {
  const { data } = await supabase.from('assinaturas').select('*').eq('usuario_id', meuId).order('criado_em', { ascending: false })
  return (data ?? []).map((a) => numeros(a as Assinatura, ['valor']))
}

export async function escolherPlano(plano: string, ciclo: Ciclo, forma: Forma) {
  const { error } = await supabase.rpc('escolher_plano', { plano, ciclo, forma })
  return error ? erroAmigavel(error) : null
}

export async function cancelarAssinatura() {
  const { error } = await supabase.rpc('cancelar_assinatura')
  return error ? erroAmigavel(error) : null
}

/** Personal: as avaliações que ele vende. Aluno: as do personal dele (pelas regras do banco). */
export async function listarServicos(): Promise<Servico[]> {
  const { data } = await supabase.from('servicos').select('*').order('criado_em')
  return (data ?? []).map((s) => numeros(s as Servico, ['preco']))
}

export async function listarCatalogo(): Promise<ItemCatalogo[]> {
  const { data } = await supabase.from('catalogo_servicos').select('*').eq('ativo', true).order('ordem')
  return (data ?? []).map((i) => numeros(i as ItemCatalogo, ['preco_min', 'preco_max', 'preco_sugerido']))
}

/** Personal: os pedidos dele. Administrador: todos. */
export async function listarPedidosPreco(): Promise<PedidoPreco[]> {
  const { data } = await supabase.from('pedidos_preco').select('*').order('criado_em', { ascending: false }).limit(200)
  return (data ?? []).map((p) => numeros(p as PedidoPreco, ['valor']))
}

export async function pedirPreco(p: Pick<PedidoPreco, 'profissional_id' | 'catalogo_id' | 'nome' | 'mensal' | 'valor' | 'motivo'>) {
  const { error } = await supabase.from('pedidos_preco').insert(p)
  return error ? erroAmigavel(error) : null
}

export async function desistirPedido(id: string) {
  const { error } = await supabase.from('pedidos_preco').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

export async function decidirPreco(pedido: string, aprovar: boolean, resposta = '') {
  const { error } = await supabase.rpc('admin_decidir_preco', { pedido, aprovar, resposta })
  return error ? erroAmigavel(error) : null
}

export async function mudarSugerido(item: string, valor: number) {
  const { error } = await supabase.rpc('admin_mudar_sugerido', { item, valor })
  return error ? erroAmigavel(error) : null
}

/** "R$ 120,00" ou "R$ 150,00/mês". */
export const precoServico = (s: Pick<Servico, 'preco' | 'mensal'>) => `${emReais(s.preco)}${s.mensal ? '/mês' : ''}`

export async function salvarServico(s: { id?: string; profissional_id: string; nome: string; descricao: string; preco: number; ativo: boolean; catalogo_id?: string | null; mensal?: boolean }) {
  const { error } = s.id ? await supabase.from('servicos').update(s).eq('id', s.id) : await supabase.from('servicos').insert(s)
  return error ? erroAmigavel(error) : null
}

export async function apagarServico(id: string) {
  const { error } = await supabase.from('servicos').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

export async function comprarAvaliacao(servico: string, forma: Forma): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await supabase.rpc('comprar_avaliacao', { servico, forma })
  return error ? { id: null, erro: erroAmigavel(error) } : { id: data as string, erro: null }
}

export async function lerPagamento(id: string): Promise<Pagamento | null> {
  const { data } = await supabase.from('pagamentos').select('*').eq('id', id).maybeSingle()
  return data ? numeros(data as Pagamento, ['valor', 'comissao']) : null
}

/** Pagamento pendente de uma assinatura (quando não está no teste grátis). */
export async function pagamentoDaAssinatura(assinatura: string): Promise<Pagamento | null> {
  const { data } = await supabase.from('pagamentos').select('*').eq('assinatura_id', assinatura).eq('situacao', 'pendente').maybeSingle()
  return data ? numeros(data as Pagamento, ['valor', 'comissao']) : null
}

/** Gera o Pix ou a página de pagamento no Mercado Pago. */
export async function cobrar(pagamento: string, forma: Forma): Promise<{ cobranca: Cobranca | null; erro: string | null }> {
  const { data, error } = await supabase.functions.invoke('mercado-pago', { body: { pagamento, forma } })
  if (error) {
    const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    return { cobranca: null, erro: corpo?.erro ?? erroAmigavel(error) }
  }
  return { cobranca: data as Cobranca, erro: null }
}

export async function listarPagamentos(): Promise<Pagamento[]> {
  const { data } = await supabase.from('pagamentos').select('*').order('criado_em', { ascending: false }).limit(200)
  return (data ?? []).map((p) => numeros(p as Pagamento, ['valor', 'comissao']))
}

// Administrador.
export async function salvarPlano(p: Plano) {
  const { id, ...mudancas } = p
  const { error } = await supabase.from('planos').update(mudancas).eq('id', id)
  return error ? erroAmigavel(error) : null
}

export async function salvarConfig(c: Partial<Pick<ConfigCobranca, 'comissao_pct' | 'dias_gratis' | 'planos_para' | 'gateway'>>) {
  const { error } = await supabase.from('config_cobranca').update({ ...c, atualizado_em: new Date().toISOString() }).eq('id', true)
  return error ? erroAmigavel(error) : null
}

export async function definirPagamento(id: string, nova: SituacaoPagamento) {
  const { error } = await supabase.rpc('admin_definir_pagamento', { pagamento: id, nova })
  return error ? erroAmigavel(error) : null
}
