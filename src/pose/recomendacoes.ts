import type { Finding } from './types'

export type CorrecaoId =
  | 'ombroElevado'
  | 'quadrilElevado'
  | 'cabecaInclinada'
  | 'troncoDeslocado'
  | 'joelhoValgo'
  | 'joelhoVaro'
  | 'cabecaAnteriorizada'
  | 'troncoAFrente'
  | 'troncoParaTras'
  | 'joelhoHiperestendido'
  | 'joelhoFlexionado'

export type Lado = 'esquerdo' | 'direito'

/**
 * Lado do músculo em relação ao lado indicado no achado:
 * "mesmo" é o lado do achado (lado mais alto, ou o joelho avaliado), "oposto" é o outro.
 * Sem lado, o músculo vale para os dois lados.
 */
type Musculo = { nome: string; lado?: 'mesmo' | 'oposto' }

export type Exercicio = { nome: string; dose: string; foco: 'alongar' | 'fortalecer' }

type Correcao = {
  alteracao: string
  alongar: Musculo[]
  fortalecer: Musculo[]
  exercicios: Exercicio[]
}

// Cadeias musculares de referência (Kendall e literatura de avaliação postural).
// É o ponto de partida: o personal pode ajustar conforme a avaliação presencial.
const CORRECOES: Record<CorrecaoId, Correcao> = {
  ombroElevado: {
    alteracao: 'Ombro elevado',
    alongar: [
      { nome: 'Trapézio superior', lado: 'mesmo' },
      { nome: 'Levantador da escápula', lado: 'mesmo' },
    ],
    fortalecer: [
      { nome: 'Trapézio inferior', lado: 'mesmo' },
      { nome: 'Serrátil anterior', lado: 'mesmo' },
    ],
    exercicios: [
      { nome: 'Alongamento do trapézio superior (orelha em direção ao ombro oposto)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Alongamento do levantador da escápula (olhar para a axila oposta)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Depressão escapular com elástico (puxar o ombro para baixo)', dose: '3x12', foco: 'fortalecer' },
      { nome: 'Y no banco inclinado ou deitado de bruços', dose: '3x10', foco: 'fortalecer' },
    ],
  },
  quadrilElevado: {
    alteracao: 'Quadril desnivelado',
    alongar: [
      { nome: 'Quadrado lombar', lado: 'mesmo' },
      { nome: 'Tensor da fáscia lata e abdutores', lado: 'oposto' },
    ],
    fortalecer: [
      { nome: 'Glúteo médio', lado: 'mesmo' },
      { nome: 'Oblíquos do abdômen', lado: 'oposto' },
    ],
    exercicios: [
      { nome: 'Alongamento lateral do tronco em pé (inclinar para o lado oposto)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Alongamento do tensor da fáscia lata (perna cruzada atrás)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Abdução de quadril deitado de lado', dose: '3x15', foco: 'fortalecer' },
      { nome: 'Prancha lateral', dose: '3x20 s cada lado', foco: 'fortalecer' },
    ],
  },
  cabecaInclinada: {
    alteracao: 'Cabeça inclinada para o lado',
    alongar: [
      { nome: 'Trapézio superior', lado: 'oposto' },
      { nome: 'Escalenos e esternocleidomastoideo', lado: 'oposto' },
    ],
    fortalecer: [
      { nome: 'Flexores laterais do pescoço', lado: 'mesmo' },
      { nome: 'Flexores profundos do pescoço' },
    ],
    exercicios: [
      { nome: 'Alongamento lateral do pescoço', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Inclinação lateral isométrica (mão resistindo na cabeça)', dose: '3x10 s', foco: 'fortalecer' },
      { nome: 'Retração do queixo (chin tuck)', dose: '3x10', foco: 'fortalecer' },
    ],
  },
  troncoDeslocado: {
    alteracao: 'Tronco deslocado para o lado',
    alongar: [{ nome: 'Quadrado lombar e oblíquos do lado para onde o tronco vai' }],
    fortalecer: [{ nome: 'Oblíquos e quadrado lombar do lado oposto ao deslocamento' }, { nome: 'Glúteo médio' }],
    exercicios: [
      { nome: 'Alongamento lateral do tronco em pé', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Prancha lateral', dose: '3x20 s cada lado', foco: 'fortalecer' },
      { nome: 'Perdigueiro (bird-dog)', dose: '3x10 cada lado', foco: 'fortalecer' },
    ],
  },
  joelhoValgo: {
    alteracao: 'Joelho para dentro (valgo)',
    alongar: [
      { nome: 'Adutores do quadril', lado: 'mesmo' },
      { nome: 'Tensor da fáscia lata', lado: 'mesmo' },
    ],
    fortalecer: [
      { nome: 'Glúteo médio', lado: 'mesmo' },
      { nome: 'Glúteo máximo e rotadores externos do quadril', lado: 'mesmo' },
    ],
    exercicios: [
      { nome: 'Alongamento dos adutores (borboleta sentado)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Ostra (clamshell) com mini band', dose: '3x15', foco: 'fortalecer' },
      { nome: 'Abdução de quadril deitado de lado', dose: '3x15', foco: 'fortalecer' },
      { nome: 'Agachamento com mini band nos joelhos', dose: '3x10', foco: 'fortalecer' },
    ],
  },
  joelhoVaro: {
    alteracao: 'Joelho para fora (varo)',
    alongar: [
      { nome: 'Trato iliotibial e tensor da fáscia lata', lado: 'mesmo' },
      { nome: 'Piriforme e rotadores externos do quadril', lado: 'mesmo' },
    ],
    fortalecer: [
      { nome: 'Adutores do quadril', lado: 'mesmo' },
      { nome: 'Rotadores internos do quadril', lado: 'mesmo' },
    ],
    exercicios: [
      { nome: 'Alongamento do piriforme (figura 4 deitado)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Liberação do trato iliotibial no rolo', dose: '1 min', foco: 'alongar' },
      { nome: 'Adução com bola entre os joelhos', dose: '3x15', foco: 'fortalecer' },
      { nome: 'Agachamento sumô leve', dose: '3x10', foco: 'fortalecer' },
    ],
  },
  cabecaAnteriorizada: {
    alteracao: 'Cabeça projetada para frente',
    alongar: [
      { nome: 'Esternocleidomastoideo e escalenos' },
      { nome: 'Suboccipitais' },
      { nome: 'Peitoral menor' },
    ],
    fortalecer: [{ nome: 'Flexores profundos do pescoço' }, { nome: 'Romboides e trapézio médio e inferior' }],
    exercicios: [
      { nome: 'Alongamento do peitoral na porta', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Alongamento dos suboccipitais (queixo ao peito)', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Retração do queixo (chin tuck)', dose: '3x10', foco: 'fortalecer' },
      { nome: 'Y-T-W deitado de bruços', dose: '2x8', foco: 'fortalecer' },
    ],
  },
  troncoAFrente: {
    alteracao: 'Ombros e tronco à frente (tendência a cifose)',
    alongar: [{ nome: 'Peitoral maior e menor' }, { nome: 'Grande dorsal' }, { nome: 'Reto abdominal (porção superior)' }],
    fortalecer: [{ nome: 'Extensores da coluna torácica' }, { nome: 'Romboides e trapézio médio e inferior' }],
    exercicios: [
      { nome: 'Extensão torácica no rolo', dose: '1 min', foco: 'alongar' },
      { nome: 'Alongamento do peitoral na porta', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Remada com elástico', dose: '3x12', foco: 'fortalecer' },
      { nome: 'Superman alternado', dose: '3x10', foco: 'fortalecer' },
    ],
  },
  troncoParaTras: {
    alteracao: 'Tronco inclinado para trás (postura relaxada / sway-back)',
    alongar: [{ nome: 'Isquiotibiais (posterior de coxa)' }, { nome: 'Oblíquo interno (porção superior)' }],
    fortalecer: [{ nome: 'Oblíquo externo e transverso do abdômen' }, { nome: 'Flexores do quadril (iliopsoas)' }, { nome: 'Extensores da coluna torácica' }],
    exercicios: [
      { nome: 'Alongamento de posterior de coxa', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Dead bug', dose: '3x10', foco: 'fortalecer' },
      { nome: 'Elevação de joelho em pé (marcha estática)', dose: '3x12 cada perna', foco: 'fortalecer' },
      { nome: 'Prancha frontal', dose: '3x30 s', foco: 'fortalecer' },
    ],
  },
  joelhoHiperestendido: {
    alteracao: 'Joelho hiperestendido (travado para trás)',
    alongar: [{ nome: 'Quadríceps' }, { nome: 'Panturrilha (gastrocnêmio e sóleo)' }],
    fortalecer: [{ nome: 'Isquiotibiais (posterior de coxa)' }, { nome: 'Glúteo máximo' }, { nome: 'Poplíteo' }],
    exercicios: [
      { nome: 'Alongamento do quadríceps em pé', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Alongamento da panturrilha na parede', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Flexão de joelho com elástico', dose: '3x12', foco: 'fortalecer' },
      { nome: 'Ponte de glúteo', dose: '3x12', foco: 'fortalecer' },
    ],
  },
  joelhoFlexionado: {
    alteracao: 'Joelhos flexionados em pé',
    alongar: [{ nome: 'Isquiotibiais (posterior de coxa)' }, { nome: 'Flexores do quadril (iliopsoas)' }, { nome: 'Panturrilha' }],
    fortalecer: [{ nome: 'Quadríceps' }, { nome: 'Glúteo máximo' }],
    exercicios: [
      { nome: 'Alongamento de posterior de coxa', dose: '3x30 s', foco: 'alongar' },
      { nome: 'Alongamento do flexor do quadril (afundo)', dose: '3x30 s cada lado', foco: 'alongar' },
      { nome: 'Extensão de joelho isométrica (toalha sob o joelho)', dose: '3x10 s', foco: 'fortalecer' },
      { nome: 'Ponte de glúteo', dose: '3x12', foco: 'fortalecer' },
    ],
  },
}

export type Recomendacao = {
  alteracao: string
  alongar: string[]
  fortalecer: string[]
  exercicios: Exercicio[]
}

const oposto = (l: Lado): Lado => (l === 'esquerdo' ? 'direito' : 'esquerdo')

function nomeMusculo(m: Musculo, lado?: Lado) {
  if (!m.lado || !lado) return m.nome
  return `${m.nome} (lado ${m.lado === 'mesmo' ? lado : oposto(lado)})`
}

/** Lista de exercícios curta, usada nas avaliações salvas (texto simples). */
export function exerciciosDe(id: CorrecaoId): string[] {
  return CORRECOES[id].exercicios.map((e) => `${e.nome} (${e.dose})`)
}

/** Músculos a alongar e fortalecer e exercícios para uma alteração encontrada. */
export function recomendacao(f: Finding): Recomendacao | null {
  if (f.status === 'ok' || !f.correcao) return null
  const c = CORRECOES[f.correcao]
  return {
    alteracao: c.alteracao,
    alongar: c.alongar.map((m) => nomeMusculo(m, f.lado)),
    fortalecer: c.fortalecer.map((m) => nomeMusculo(m, f.lado)),
    exercicios: c.exercicios,
  }
}

/** Junta as recomendações de todas as alterações sem repetir músculo nem exercício. */
export function planoCorretivo(findings: Finding[]) {
  const recs = findings.map(recomendacao).filter((r): r is Recomendacao => r !== null)
  const unico = (xs: string[]) => [...new Set(xs)]
  const exercicios = new Map<string, Exercicio>()
  for (const r of recs) for (const e of r.exercicios) exercicios.set(e.nome, e)
  const todos = [...exercicios.values()]
  return {
    alongar: unico(recs.flatMap((r) => r.alongar)),
    fortalecer: unico(recs.flatMap((r) => r.fortalecer)),
    exercicios: [...todos.filter((e) => e.foco === 'alongar'), ...todos.filter((e) => e.foco === 'fortalecer')],
  }
}
