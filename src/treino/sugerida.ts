// Série sugerida pelo app para quem ainda não tem treino montado por um
// personal. É geral, para iniciantes sem dor ou lesão, e todos os exercícios
// estão no catálogo da câmera (o app conta as repetições e corrige).
// O treino de verdade é o personal quem monta: a tela sempre mostra o aviso.

import type { Treino } from '../nuvem/treinos'

const ex = (nome: string, series: string, reps: string, obs = '') => ({ nome, series, reps, obs })

export const SERIE_SUGERIDA: Treino[] = [
  {
    id: 'sugerida-A',
    ficha_id: '',
    letra: 'A',
    nome: 'Pernas e abdômen',
    atualizado_em: '',
    exercicios: [
      ex('Polichinelo', '2', '30 segundos', 'Aquecimento, ritmo leve'),
      ex('Agachamento', '3', '10 a 12', 'Desça só até onde não sentir dor'),
      ex('Afundo (avanço)', '3', '8 a 10 cada perna', 'Apoie a mão na parede se precisar'),
      ex('Elevação pélvica (ponte)', '3', '12', 'Segure 1 s lá em cima'),
      ex('Abdominal supra', '3', '12 a 15'),
    ],
  },
  {
    id: 'sugerida-B',
    ficha_id: '',
    letra: 'B',
    nome: 'Braços, costas e ombros',
    atualizado_em: '',
    exercicios: [
      ex('Polichinelo', '2', '30 segundos', 'Aquecimento, ritmo leve'),
      ex('Flexão de braço', '3', '8 a 12', 'Com os joelhos no chão, se precisar'),
      ex('Remada curvada', '3', '12', 'Halter leve ou garrafas de água'),
      ex('Desenvolvimento com halter', '3', '10 a 12', 'Carga leve'),
      ex('Rosca direta', '3', '12'),
      ex('Mergulho no banco', '3', '8 a 10'),
      ex('Elevação de pernas deitado', '3', '10 a 12'),
    ],
  },
]

export const AVISO_SUGERIDA =
  'Esta é uma série geral para começar, pensada para quem não sente dor e não tem lesão. Ela não substitui um profissional de Educação Física (CREF): procure um personal qualificado para avaliar você e montar o seu treino.'
