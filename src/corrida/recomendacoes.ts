import type { Lado } from './tipos'

export type RecomendacaoId =
  | 'cadencia'
  | 'overstriding'
  | 'pisada'
  | 'joelhoContato'
  | 'troncoTras'
  | 'troncoFrente'
  | 'oscilacao'
  | 'joelhoDentro'
  | 'quedaPelve'
  | 'cruzamento'

/** "mesmo": lado do achado (perna de apoio); "oposto": a outra. Sem lado vale para os dois. */
type Musculo = string | { nome: string; lado: 'mesmo' | 'oposto' }

type Recomendacao = { alongar: Musculo[]; fortalecer: Musculo[]; exercicios: string[] }

// Ponto de partida baseado na literatura de biomecânica da corrida (retreino de
// passada, cadência e controle do quadril). O personal pode ajustar.
const RECOMENDACOES: Record<RecomendacaoId, Recomendacao> = {
  cadencia: {
    alongar: [],
    fortalecer: ['Flexores do quadril (iliopsoas)', 'Panturrilha (gastrocnêmio e sóleo)'],
    exercicios: [
      'Correr com metrônomo 5 a 10% acima da cadência atual (2 a 3 treinos por semana)',
      'Skipping alto, passos curtos e rápidos (3x20 m)',
      'Pular corda (3x1 min)',
    ],
  },
  overstriding: {
    alongar: ['Flexores do quadril (iliopsoas e reto femoral)'],
    fortalecer: ['Glúteo máximo', 'Isquiotibiais'],
    exercicios: [
      'Aumentar a cadência 5 a 10% com metrônomo',
      'Educativo "pé embaixo do quadril": puxar o pé para trás antes de tocar o chão (3x20 m)',
      'Ponte unilateral (3x10 cada perna)',
      'Stiff unilateral com halter (3x8 cada perna)',
      'Alongamento do flexor do quadril, joelho no chão (3x30 s cada lado)',
    ],
  },
  pisada: {
    alongar: ['Panturrilha (gastrocnêmio e sóleo)'],
    fortalecer: ['Panturrilha (gastrocnêmio e sóleo)', 'Músculos do pé (intrínsecos)'],
    exercicios: [
      'Elevação de panturrilha unilateral no degrau (3x15 cada perna)',
      'Educativo de passos curtos aterrissando com o pé embaixo do corpo (3x20 m)',
      'Pular corda (3x1 min)',
    ],
  },
  joelhoContato: {
    alongar: [],
    fortalecer: ['Quadríceps (trabalho excêntrico)', 'Glúteo máximo'],
    exercicios: [
      'Descida lenta do degrau, uma perna (3x8 cada perna, 3 s descendo)',
      'Afundo / passada parada (3x10 cada perna)',
      'Saltitos baixos (pogo) aterrissando com o joelho levemente dobrado (3x20)',
    ],
  },
  troncoTras: {
    alongar: ['Flexores do quadril (iliopsoas e reto femoral)'],
    fortalecer: ['Abdômen (reto e oblíquos)', 'Glúteo máximo'],
    exercicios: [
      'Prancha frontal (3x30 s)',
      'Dead bug (3x10)',
      'Educativo da queda: corpo reto, inclinar a partir do tornozelo até sair correndo (5x)',
      'Alongamento do flexor do quadril, joelho no chão (3x30 s cada lado)',
    ],
  },
  troncoFrente: {
    alongar: ['Flexores do quadril (iliopsoas)', 'Peitoral'],
    fortalecer: ['Eretores da espinha e paravertebrais', 'Glúteo máximo', 'Abdômen'],
    exercicios: [
      'Perdigueiro / bird dog (3x10 cada lado)',
      'Ponte de glúteo (3x12)',
      'Alongamento do flexor do quadril, joelho no chão (3x30 s cada lado)',
      'Correr pensando em "crescer": olhar à frente, peito aberto',
    ],
  },
  oscilacao: {
    alongar: [],
    fortalecer: ['Panturrilha (gastrocnêmio e sóleo)', 'Glúteo máximo'],
    exercicios: [
      'Aumentar a cadência 5 a 10% com metrônomo',
      'Correr pensando em empurrar o chão para trás, não para cima',
      'Saltitos baixos e rápidos (pogo) (3x20)',
      'Skipping baixo (3x20 m)',
    ],
  },
  joelhoDentro: {
    alongar: [{ nome: 'Adutores do quadril', lado: 'mesmo' }],
    fortalecer: [
      { nome: 'Glúteo médio', lado: 'mesmo' },
      { nome: 'Glúteo máximo', lado: 'mesmo' },
      { nome: 'Rotadores externos do quadril', lado: 'mesmo' },
    ],
    exercicios: [
      'Abdução de quadril deitado de lado, com elástico (3x15)',
      'Caminhada lateral com mini band (3x10 passos cada lado)',
      'Agachamento unilateral na frente do espelho, joelho alinhado ao pé (3x8)',
      'Descida lateral do degrau (3x10 cada perna)',
    ],
  },
  quedaPelve: {
    alongar: [{ nome: 'Quadrado lombar', lado: 'oposto' }],
    fortalecer: [
      { nome: 'Glúteo médio', lado: 'mesmo' },
      { nome: 'Oblíquos e quadrado lombar', lado: 'oposto' },
    ],
    exercicios: [
      'Elevação da pelve no degrau (hip hike), uma perna (3x12 cada lado)',
      'Prancha lateral (3x20 s cada lado)',
      'Abdução de quadril deitado de lado (3x15)',
      'Equilíbrio numa perna só, quadril nivelado (3x30 s cada perna)',
    ],
  },
  cruzamento: {
    alongar: ['Adutores do quadril', 'Tensor da fáscia lata e banda iliotibial'],
    fortalecer: ['Glúteo médio', 'Abdutores do quadril'],
    exercicios: [
      'Educativo: correr com uma linha no chão entre os pés, sem pisar nela (3x30 m)',
      'Caminhada lateral com mini band (3x10 passos cada lado)',
      'Abdução de quadril deitado de lado (3x15)',
      'Alongamento de adutores sentado, borboleta (3x30 s)',
    ],
  },
}

const outro = (lado: Lado): Lado => (lado === 'esquerdo' ? 'direito' : 'esquerdo')

function nomear(m: Musculo, lado?: Lado) {
  if (typeof m === 'string') return m
  if (!lado) return m.nome
  return `${m.nome} (${m.lado === 'mesmo' ? lado : outro(lado)})`
}

/** Músculos e exercícios de um achado. `lado` é a perna de apoio quando o problema é de um lado só. */
export function recomendar(id: RecomendacaoId, lado?: Lado) {
  const r = RECOMENDACOES[id]
  return {
    musculos: { alongar: r.alongar.map((m) => nomear(m, lado)), fortalecer: r.fortalecer.map((m) => nomear(m, lado)) },
    exercises: r.exercicios,
  }
}
