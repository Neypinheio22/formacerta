// Biblioteca de exercícios: os exercícios que o FormaCerta já traz, separados
// por grupo muscular e por categoria, mais as contas da tela (busca, filtros,
// favoritos e a junção com os exercícios que o personal cadastrou). As telas
// ficam em components/treino/BibliotecaExercicios.tsx.

import { comoFazerDe, idYoutube, nomeChave, type ExercicioProprio } from './comoFazer'

export const GRUPOS_MUSCULARES = [
  'Peito',
  'Costas',
  'Ombro',
  'Bíceps',
  'Tríceps',
  'Antebraço',
  'Trapézio',
  'Abdômen',
  'Lombar',
  'Quadríceps',
  'Posterior de coxa',
  'Glúteo',
  'Adutores e abdutores',
  'Panturrilha',
  'Corpo inteiro',
] as const

export const CATEGORIAS = ['Musculação', 'Peso do corpo', 'Funcional', 'Cardio', 'Mobilidade', 'Alongamento', 'Reabilitação'] as const

/** Grupos que os exercícios antigos usavam e o grupo novo que vale para eles. */
const GRUPO_ANTIGO: Record<string, string> = {
  abdominal: 'Abdômen',
  abdomen: 'Abdômen',
  pernas: 'Quadríceps',
  perna: 'Quadríceps',
  gluteo: 'Glúteo',
  panturrilha: 'Panturrilha',
  peito: 'Peito',
  cardio: 'Corpo inteiro',
  alongamento: '',
  mobilidade: '',
}

/** Grupo do jeito da lista nova ("Abdominal" vira "Abdômen"). */
export function grupoPadrao(g: string): string {
  const k = nomeChave(g)
  if (!k) return ''
  const certo = GRUPOS_MUSCULARES.find((x) => nomeChave(x) === k)
  if (certo) return certo
  return k in GRUPO_ANTIGO ? GRUPO_ANTIGO[k] : g.trim()
}

/** Categoria de um exercício antigo que só tinha grupo ("Mobilidade", "Cardio"...). */
export function categoriaDoGrupo(g: string): string {
  const k = nomeChave(g)
  return CATEGORIAS.find((c) => nomeChave(c) === k) ?? ''
}

type ItemCatalogo = { nome: string; grupo: (typeof GRUPOS_MUSCULARES)[number]; categoria: (typeof CATEGORIAS)[number]; camera?: boolean }

const m = (grupo: ItemCatalogo['grupo'], categoria: ItemCatalogo['categoria'], nomes: string[], camera: string[] = []): ItemCatalogo[] =>
  nomes.map((nome) => ({ nome, grupo, categoria, ...(camera.includes(nome) ? { camera: true } : {}) }))

/**
 * Exercícios do app. Os nomes seguem os de VIDEOS_APP (videosApp.ts) e os da
 * correção por câmera, para o vídeo e a câmera aparecerem sozinhos.
 */
export const CATALOGO: ItemCatalogo[] = [
  // Peito
  ...m('Peito', 'Musculação', [
    'Supino reto',
    'Supino reto com halteres',
    'Supino inclinado',
    'Supino inclinado com halteres',
    'Supino declinado',
    'Supino na máquina',
    'Crucifixo reto com halteres',
    'Crucifixo inclinado com halteres',
    'Crucifixo na máquina (peck deck)',
    'Crossover na polia alta',
    'Crossover na polia baixa',
    'Pullover com halter',
  ]),
  ...m('Peito', 'Peso do corpo', ['Flexão de braço', 'Flexão de braço com joelhos apoiados', 'Flexão de braço inclinada', 'Flexão de braço declinada', 'Mergulho nas paralelas'], ['Flexão de braço']),
  // Costas
  ...m('Costas', 'Musculação', [
    'Puxada na frente',
    'Puxada com triângulo',
    'Puxada supinada',
    'Remada curvada',
    'Remada curvada supinada',
    'Remada baixa',
    'Remada unilateral com halter (serrote)',
    'Remada cavalinho',
    'Remada na máquina',
    'Pulldown na polia (braços estendidos)',
    'Levantamento terra',
  ], ['Remada curvada']),
  ...m('Costas', 'Peso do corpo', ['Barra fixa', 'Barra fixa supinada', 'Remada invertida']),
  // Ombro
  ...m('Ombro', 'Musculação', [
    'Desenvolvimento com halteres',
    'Desenvolvimento com barra',
    'Desenvolvimento na máquina',
    'Desenvolvimento Arnold',
    'Elevação lateral',
    'Elevação lateral na polia',
    'Elevação frontal',
    'Crucifixo invertido',
    'Crucifixo invertido na máquina',
    'Face pull',
    'Remada alta',
  ], ['Desenvolvimento com halteres', 'Elevação lateral']),
  // Bíceps
  ...m('Bíceps', 'Musculação', [
    'Rosca direta',
    'Rosca direta com barra W',
    'Rosca alternada',
    'Rosca martelo',
    'Rosca concentrada',
    'Rosca Scott',
    'Rosca na polia',
    'Rosca inclinada com halteres',
  ], ['Rosca direta']),
  // Tríceps
  ...m('Tríceps', 'Musculação', [
    'Tríceps na polia',
    'Tríceps corda',
    'Tríceps francês',
    'Tríceps francês em pé',
    'Tríceps testa',
    'Tríceps coice',
    'Tríceps unilateral na polia',
    'Supino fechado',
  ], ['Tríceps francês em pé']),
  ...m('Tríceps', 'Peso do corpo', ['Mergulho no banco', 'Flexão diamante'], ['Mergulho no banco']),
  // Antebraço e trapézio
  ...m('Antebraço', 'Musculação', ['Rosca de punho', 'Rosca de punho invertida', 'Rosca inversa']),
  ...m('Trapézio', 'Musculação', ['Encolhimento de ombros', 'Encolhimento com barra'], ['Encolhimento de ombros']),
  ...m('Trapézio', 'Funcional', ['Caminhada do fazendeiro']),
  // Abdômen e lombar
  ...m('Abdômen', 'Peso do corpo', [
    'Abdominal supra',
    'Abdominal infra',
    'Elevação de pernas deitado',
    'Abdominal canivete',
    'Abdominal bicicleta',
    'Abdominal oblíquo',
    'Prancha',
    'Prancha lateral',
    'Dead bug',
    'Abdominal remador',
    'Elevação de pernas na barra',
  ], ['Abdominal supra', 'Elevação de pernas deitado']),
  ...m('Abdômen', 'Musculação', ['Abdominal na polia (crunch)', 'Abdominal na máquina']),
  ...m('Abdômen', 'Funcional', ['Abdominal com rodinha', 'Rotação russa (russian twist)', 'Pallof press']),
  ...m('Lombar', 'Musculação', ['Hiperextensão lombar (banco romano)', 'Bom dia (good morning)']),
  ...m('Lombar', 'Reabilitação', ['Bird dog (perdigueiro)', 'Superman']),
  // Pernas
  ...m('Quadríceps', 'Musculação', [
    'Agachamento livre',
    'Agachamento no Smith',
    'Agachamento hack',
    'Agachamento frontal',
    'Leg press 45',
    'Leg press horizontal',
    'Cadeira extensora',
    'Agachamento búlgaro',
    'Afundo (avanço)',
    'Passada',
  ], ['Agachamento livre', 'Afundo (avanço)']),
  ...m('Quadríceps', 'Peso do corpo', ['Agachamento sem peso', 'Agachamento na parede (isometria)', 'Subida no banco (step-up)']),
  ...m('Posterior de coxa', 'Musculação', ['Mesa flexora', 'Cadeira flexora', 'Flexora em pé', 'Stiff', 'Levantamento terra romeno']),
  ...m('Glúteo', 'Musculação', [
    'Elevação pélvica (ponte)',
    'Elevação pélvica com barra',
    'Glúteo na polia (coice)',
    'Glúteo na máquina',
    'Agachamento sumô',
    'Abdução de quadril na máquina',
  ], ['Elevação pélvica (ponte)']),
  ...m('Glúteo', 'Peso do corpo', ['Ponte unilateral', 'Coice de quatro apoios', 'Abdução de quadril deitado de lado', 'Ostra (clamshell)']),
  ...m('Adutores e abdutores', 'Musculação', ['Cadeira adutora', 'Cadeira abdutora']),
  ...m('Adutores e abdutores', 'Funcional', ['Caminhada lateral com elástico']),
  ...m('Panturrilha', 'Musculação', ['Panturrilha em pé', 'Panturrilha sentado', 'Panturrilha no leg press']),
  // Corpo inteiro e cardio
  ...m('Corpo inteiro', 'Funcional', ['Burpee', 'Kettlebell swing', 'Thruster', 'Agachamento com desenvolvimento', 'Arremesso de medicine ball', 'Escalador (mountain climber)', 'Corda naval']),
  ...m('Corpo inteiro', 'Cardio', ['Polichinelo', 'Corrida na esteira', 'Caminhada na esteira', 'Bicicleta ergométrica', 'Elíptico (transport)', 'Remo ergômetro', 'Pular corda', 'Corrida estacionária', 'Escada (simulador)'], ['Polichinelo']),
  // Mobilidade (lista do Romildo, 28/10/2026)
  ...m('Glúteo', 'Mobilidade', ['Mobilidade de quadril', 'Rotação interna e externa do quadril', '90/90 de quadril', 'Mobilidade dos flexores do quadril']),
  ...m('Adutores e abdutores', 'Mobilidade', ['Mobilidade de adutores']),
  ...m('Panturrilha', 'Mobilidade', ['Mobilidade de tornozelo', 'Joelho na parede']),
  ...m('Ombro', 'Mobilidade', ['Mobilidade de ombro', 'Rotação externa do ombro', 'Mobilidade escapular']),
  ...m('Costas', 'Mobilidade', ['Mobilidade torácica', 'Rotação torácica']),
  ...m('Lombar', 'Mobilidade', ['Gato e camelo (cat-cow)']),
  // Alongamento
  ...m('Posterior de coxa', 'Alongamento', ['Alongamento de posterior de coxa']),
  ...m('Quadríceps', 'Alongamento', ['Alongamento de quadríceps em pé']),
  ...m('Peito', 'Alongamento', ['Alongamento de peitoral na parede']),
  ...m('Lombar', 'Alongamento', ['Alongamento de lombar (joelhos no peito)', 'Postura da criança']),
  ...m('Glúteo', 'Alongamento', ['Alongamento de glúteo (figura 4)']),
  ...m('Panturrilha', 'Alongamento', ['Alongamento de panturrilha na parede']),
  // Reabilitação
  ...m('Ombro', 'Reabilitação', ['Rotação externa com elástico', 'Rotação interna com elástico']),
  ...m('Quadríceps', 'Reabilitação', ['Isometria de quadríceps', 'Elevação de perna estendida']),
  ...m('Panturrilha', 'Reabilitação', ['Equilíbrio unipodal']),
]

/** Um exercício da biblioteca: do app, do personal ou do app com a mídia que alguém cadastrou. */
export type ItemBiblioteca = {
  /** Nome sem acento: é por ele que a ficha liga ao exercício. */
  chave: string
  nome: string
  grupo: string
  categoria: string
  /** Veio do FormaCerta (catálogo ou cadastrado pelo administrador como "do app"). */
  doApp: boolean
  /** Exercício cadastrado no banco (do personal ou do app), quando tem. */
  proprio?: ExercicioProprio
  /** Foto, vídeo ou link que o aluno vai ver. */
  midia?: ExercicioProprio
  /** A câmera do app corrige este exercício. */
  camera: boolean
}

/**
 * Junta o catálogo com os exercícios do banco. Mesmo nome = mesmo exercício:
 * o cadastrado ganha o lugar (e a mídia), mas não some do catálogo.
 */
export function montarBiblioteca(lista: ExercicioProprio[], meuId: string): ItemBiblioteca[] {
  const porChave = new Map<string, ItemBiblioteca>()
  for (const c of CATALOGO) {
    const chave = nomeChave(c.nome)
    porChave.set(chave, { chave, nome: c.nome, grupo: c.grupo, categoria: c.categoria, doApp: true, camera: !!c.camera })
  }
  // Os do personal por último, para valerem mais que os do app de mesmo nome.
  const ordem = [...lista].sort((a, b) => Number(a.profissional_id === meuId) - Number(b.profissional_id === meuId))
  for (const e of ordem) {
    if (!e.do_app && e.profissional_id !== meuId) continue
    const chave = nomeChave(e.nome)
    const ja = porChave.get(chave)
    porChave.set(chave, {
      chave,
      nome: e.nome,
      grupo: grupoPadrao(e.grupo) || ja?.grupo || '',
      categoria: e.categoria || ja?.categoria || categoriaDoGrupo(e.grupo) || '',
      doApp: ja?.doApp ?? e.do_app,
      proprio: e,
      camera: ja?.camera ?? false,
    })
  }
  const itens = [...porChave.values()]
  for (const i of itens) i.midia = comoFazerDe(lista, i.nome, meuId)
  return itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** É do personal logado (dá para editar e excluir). */
export const ehMeu = (i: ItemBiblioteca, meuId: string) => i.proprio?.profissional_id === meuId

export type Aba = 'todos' | 'favoritos' | 'app' | 'meus'

export type Filtro = { aba: Aba; busca: string; grupo: string; categoria: string }

export const FILTRO_INICIAL: Filtro = { aba: 'todos', busca: '', grupo: '', categoria: '' }

/** Busca pelo nome sem ligar para acento; cada palavra digitada precisa aparecer. */
export function filtrar(itens: ItemBiblioteca[], f: Filtro, favoritos: Set<string>, meuId: string): ItemBiblioteca[] {
  const palavras = nomeChave(f.busca).split(' ').filter(Boolean)
  return itens.filter((i) => {
    if (f.aba === 'favoritos' && !favoritos.has(i.chave)) return false
    if (f.aba === 'app' && !i.doApp) return false
    if (f.aba === 'meus' && !ehMeu(i, meuId)) return false
    if (f.grupo && i.grupo !== f.grupo) return false
    if (f.categoria && i.categoria !== f.categoria) return false
    if (palavras.length) {
      const alvo = `${nomeChave(i.nome)} ${nomeChave(i.grupo)}`
      if (!palavras.every((p) => alvo.includes(p))) return false
    }
    return true
  })
}

/** Quantos exercícios há em cada grupo ou categoria (para os cartões de Grupos e Categorias). */
export function contar(itens: ItemBiblioteca[], campo: 'grupo' | 'categoria'): Map<string, number> {
  const n = new Map<string, number>()
  for (const i of itens) if (i[campo]) n.set(i[campo], (n.get(i[campo]) ?? 0) + 1)
  return n
}

/** Miniatura do YouTube para a lista (os Shorts também têm). */
export function miniaturaYoutube(link: string | null | undefined): string | null {
  const id = link ? idYoutube(link) : null
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null
}
