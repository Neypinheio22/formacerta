import { supabase } from './cliente'
import { erroAmigavel } from './conta'

export type Objetivo =
  | ''
  | 'emagrecer'
  | 'massa'
  | 'definir'
  | 'saude'
  | 'condicionamento'
  | 'forca'
  | 'postura'
  | 'mobilidade'
  | 'desempenho'
  | 'reabilitacao'

/** Os objetivos mais procurados por quem começa a treinar, com uma linha de explicação. */
export const OBJETIVOS: { id: Objetivo; rotulo: string; texto: string }[] = [
  { id: 'emagrecer', rotulo: 'Emagrecer', texto: 'Perder peso e gordura, com treino e cardio.' },
  { id: 'massa', rotulo: 'Ganhar massa muscular', texto: 'Aumentar os músculos (hipertrofia).' },
  { id: 'definir', rotulo: 'Definir o corpo', texto: 'Perder gordura sem perder músculo.' },
  { id: 'saude', rotulo: 'Saúde e qualidade de vida', texto: 'Sair do sedentarismo, mais disposição e menos estresse.' },
  { id: 'condicionamento', rotulo: 'Condicionamento', texto: 'Mais fôlego e resistência no dia a dia.' },
  { id: 'forca', rotulo: 'Força', texto: 'Levantar mais peso e ficar mais forte.' },
  { id: 'postura', rotulo: 'Postura e dores', texto: 'Corrigir a postura e aliviar dores nas costas.' },
  { id: 'mobilidade', rotulo: 'Mobilidade e flexibilidade', texto: 'Mexer o corpo com mais facilidade e amplitude.' },
  { id: 'desempenho', rotulo: 'Desempenho no esporte', texto: 'Render mais na corrida, no futebol ou em outro esporte.' },
  { id: 'reabilitacao', rotulo: 'Reabilitação', texto: 'Voltar a treinar depois de lesão ou cirurgia, com liberação médica.' },
]

export const rotuloObjetivo = (o: Objetivo) => OBJETIVOS.find((x) => x.id === o)?.rotulo ?? ''

/** Ficha do aluno no banco: dados pessoais e, ligadas a ela, todas as avaliações. */
export type Ficha = {
  id: string
  /** Null quando o aluno entrou sozinho e ainda não tem personal. */
  profissional_id: string | null
  aluno_id: string | null
  nome: string
  /** AAAA-MM-DD */
  nascimento: string | null
  sexo: 'feminino' | 'masculino' | 'outro' | null
  altura_cm: number | null
  telefone: string
  objetivo: Objetivo
  saude: string
  observacoes: string
  consentimento_em: string | null
  /** Meta de treinos por semana escolhida pelo profissional (null: número de treinos da ficha). */
  treinos_semana?: number | null
  /** Quando o próprio aluno mudou os dados pessoais pela conta dele. */
  aluno_atualizou_em?: string | null
  criado_em: string
  atualizado_em: string
}

export type DadosFicha = Pick<Ficha, 'nome' | 'nascimento' | 'sexo' | 'altura_cm' | 'telefone' | 'objetivo' | 'saude' | 'observacoes' | 'consentimento_em'>

export const fichaVazia = (nome = ''): DadosFicha => ({
  nome,
  nascimento: null,
  sexo: null,
  altura_cm: null,
  telefone: '',
  objetivo: '',
  saude: '',
  observacoes: '',
  consentimento_em: null,
})

/** Idade completa hoje (ou na data dada), pela data de nascimento. */
export function idadeDe(nascimento: string | null, em = new Date()): number | null {
  if (!nascimento) return null
  const [a, m, d] = nascimento.split('-').map(Number)
  if (!a || !m || !d) return null
  let idade = em.getFullYear() - a
  if (em.getMonth() + 1 < m || (em.getMonth() + 1 === m && em.getDate() < d)) idade--
  return idade >= 0 && idade < 130 ? idade : null
}

/** Profissional: as próprias fichas. Aluno: a ficha dele. Administrador: todas. */
export async function listarFichas(): Promise<{ fichas: Ficha[]; erro: string | null }> {
  const { data, error } = await supabase.from('fichas').select('*').order('nome')
  return { fichas: (data ?? []) as Ficha[], erro: error ? erroAmigavel(error) : null }
}

export async function criarFicha(profissionalId: string, dados: DadosFicha): Promise<{ ficha: Ficha | null; erro: string | null }> {
  const { data, error } = await supabase
    .from('fichas')
    .insert({ ...dados, nome: dados.nome.trim(), profissional_id: profissionalId })
    .select()
    .single()
  return { ficha: (data as Ficha | null) ?? null, erro: error ? erroAmigavel(error) : null }
}

export async function editarFicha(id: string, dados: DadosFicha) {
  const { error } = await supabase
    .from('fichas')
    .update({ ...dados, nome: dados.nome.trim(), atualizado_em: new Date().toISOString() })
    .eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Aluno: preenche os próprios dados pessoais. Cria a ficha se ainda não tiver. */
export async function salvarMeusDados(d: Pick<DadosFicha, 'nascimento' | 'sexo' | 'altura_cm' | 'telefone' | 'objetivo' | 'saude'>) {
  const { error } = await supabase.rpc('salvar_meus_dados', {
    p_nascimento: d.nascimento,
    p_sexo: d.sexo,
    p_altura: d.altura_cm,
    p_telefone: d.telefone.trim(),
    p_objetivo: d.objetivo,
    p_saude: d.saude.trim(),
  })
  return error ? erroAmigavel(error) : null
}

/** Apaga a ficha e todas as avaliações guardadas nela. Não tem volta. */
export async function apagarFicha(id: string) {
  const { error } = await supabase.from('fichas').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Ficha com o mesmo nome, ignorando maiúsculas e espaços. */
export function fichaPeloNome(fichas: Ficha[], nome: string): Ficha | undefined {
  const n = nome.trim().toLocaleLowerCase('pt-BR')
  return n ? fichas.find((f) => f.nome.trim().toLocaleLowerCase('pt-BR') === n) : undefined
}
