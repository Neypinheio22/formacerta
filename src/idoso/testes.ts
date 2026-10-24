// Bateria de testes do Senior Fitness Test (Rikli e Jones, 2013), com as faixas
// normais (do percentil 25 ao 75) por sexo e idade, de 60 a 94 anos.

import type { Status } from '../pose/types'
import type { IdTeste, Sexo } from './tipos'

export type Area = 'equilibrio' | 'mobilidade' | 'flexibilidade' | 'capacidade'

export const ROTULO_AREA: Record<Area, string> = {
  equilibrio: 'Equilíbrio',
  mobilidade: 'Mobilidade',
  flexibilidade: 'Flexibilidade',
  capacidade: 'Capacidade funcional',
}

/** Como o teste é medido na tela. */
export type Modo = 'contagem' | 'cronometro' | 'distancia' | 'medida'

export type DefTeste = {
  id: IdTeste
  nome: string
  /** Rótulo curto para o resumo e os gráficos. */
  curto: string
  mede: string
  areas: Area[]
  modo: Modo
  /** Duração do teste em segundos (contagem e distância). */
  duracao?: number
  unidade: string
  material: string
  passos: string[]
  /** Maior valor é melhor (falso no TUG, onde menos tempo é melhor). */
  maiorMelhor: boolean
  /** Faixa normal [pior, melhor] por grupo de idade: 60–64, 65–69, … 90–94. */
  normas: Record<Sexo, [number, number][]>
  /** Valor que indica risco de perder a independência (Rikli e Jones). */
  risco?: number
  /** Termo de busca do vídeo explicativo. */
  busca: string
}

const jardas = (faixas: [number, number][]) => faixas.map(([a, b]) => [Math.round(a * 0.9144), Math.round(b * 0.9144)] as [number, number])
const polegadas = (faixas: [number, number][]) => faixas.map(([a, b]) => [Math.round(a * 2.54), Math.round(b * 2.54)] as [number, number])

export const TESTES: DefTeste[] = [
  {
    id: 'levantar',
    nome: 'Levantar e sentar da cadeira (30 s)',
    curto: 'Levantar e sentar',
    mede: 'Força das pernas',
    areas: ['capacidade'],
    modo: 'contagem',
    duracao: 30,
    unidade: 'repetições',
    material: 'Cadeira sem braços (43 cm de altura) encostada na parede e cronômetro.',
    passos: [
      'Sentado no meio da cadeira, costas retas, pés no chão afastados na largura do quadril.',
      'Braços cruzados no peito, mãos nos ombros.',
      'Ao sinal, levanta até ficar totalmente em pé e senta de novo, o máximo de vezes em 30 segundos.',
      'Conte cada vez que a pessoa fica em pé. Se no fim do tempo estiver mais da metade do caminho para cima, conta.',
    ],
    maiorMelhor: true,
    normas: {
      feminino: [[12, 17], [11, 16], [10, 15], [10, 15], [9, 14], [8, 13], [4, 11]],
      masculino: [[14, 19], [12, 18], [12, 17], [11, 17], [10, 15], [8, 14], [7, 12]],
    },
    risco: 8,
    busca: 'teste de sentar e levantar da cadeira 30 segundos idoso',
  },
  {
    id: 'flexaoBraco',
    nome: 'Flexão de cotovelo (30 s)',
    curto: 'Flexão de cotovelo',
    mede: 'Força dos braços',
    areas: ['capacidade'],
    modo: 'contagem',
    duracao: 30,
    unidade: 'repetições',
    material: 'Cadeira sem braços e halter: 2 kg para mulheres, 4 kg para homens.',
    passos: [
      'Sentado, costas retas, halter na mão do lado dominante, braço esticado ao lado do corpo.',
      'Ao sinal, dobra o cotovelo girando a palma para cima até o fim e volta a esticar o braço inteiro.',
      'O braço de cima fica parado, colado ao corpo. Conte quantas vezes em 30 segundos.',
    ],
    maiorMelhor: true,
    normas: {
      feminino: [[13, 19], [12, 18], [12, 17], [11, 17], [10, 16], [10, 15], [8, 13]],
      masculino: [[16, 22], [15, 21], [14, 21], [13, 19], [13, 19], [11, 17], [10, 14]],
    },
    risco: 11,
    busca: 'teste de flexão de cotovelo 30 segundos idoso senior fitness test',
  },
  {
    id: 'marcha',
    nome: 'Marcha estacionária (2 min)',
    curto: 'Marcha estacionária',
    mede: 'Resistência aeróbica',
    areas: ['capacidade', 'mobilidade'],
    modo: 'contagem',
    duracao: 120,
    unidade: 'passos',
    material: 'Fita na parede na altura do meio da coxa (entre a patela e a crista ilíaca) e cronômetro.',
    passos: [
      'Em pé ao lado da parede, com a fita marcando a altura que o joelho precisa alcançar.',
      'Ao sinal, marcha no lugar o mais rápido possível, por 2 minutos.',
      'Conte só quando o joelho direito chega à altura da fita.',
      'Pode apoiar a mão na parede se precisar. Se o joelho não chegar à altura, peça para diminuir o ritmo, sem parar o cronômetro.',
    ],
    maiorMelhor: true,
    normas: {
      feminino: [[75, 107], [73, 107], [68, 101], [68, 100], [60, 90], [55, 85], [44, 72]],
      masculino: [[87, 115], [86, 116], [80, 110], [73, 109], [71, 103], [59, 91], [52, 86]],
    },
    risco: 65,
    busca: 'teste de marcha estacionária 2 minutos idoso',
  },
  {
    id: 'caminhada',
    nome: 'Caminhada de 6 minutos',
    curto: 'Caminhada 6 min',
    mede: 'Resistência aeróbica',
    areas: ['capacidade'],
    modo: 'distancia',
    duracao: 360,
    unidade: 'm',
    material: 'Percurso plano marcado (por exemplo, um retângulo de 45 m ou um corredor de 30 m), cones e cronômetro.',
    passos: [
      'Explique que é para caminhar o mais rápido possível, sem correr, por 6 minutos.',
      'A cada volta completa no percurso, toque no contador.',
      'Pode parar para descansar e voltar a andar; o cronômetro não para.',
      'No fim, meça os metros da última volta incompleta.',
    ],
    maiorMelhor: true,
    normas: {
      feminino: jardas([[545, 660], [500, 635], [480, 615], [435, 585], [385, 540], [340, 510], [275, 440]]),
      masculino: jardas([[610, 735], [560, 700], [545, 680], [470, 640], [445, 605], [380, 570], [305, 500]]),
    },
    risco: 320,
    busca: 'teste de caminhada de 6 minutos idoso',
  },
  {
    id: 'tug',
    nome: 'Levantar, caminhar e sentar (TUG 2,44 m)',
    curto: 'Levantar, caminhar e sentar',
    mede: 'Agilidade e equilíbrio em movimento',
    areas: ['mobilidade', 'equilibrio'],
    modo: 'cronometro',
    unidade: 's',
    material: 'Cadeira encostada na parede e um cone a 2,44 m da ponta da cadeira.',
    passos: [
      'Sentado, mãos nas coxas, um pé um pouco à frente do outro.',
      'Ao sinal, levanta, caminha o mais rápido possível (sem correr) até o cone, contorna e volta a sentar.',
      'Comece o cronômetro no sinal e pare quando a pessoa sentar.',
      'Faça 2 vezes e fique com o menor tempo.',
    ],
    maiorMelhor: false,
    normas: {
      feminino: [[6.0, 4.4], [6.4, 4.8], [7.1, 4.9], [7.4, 5.2], [8.7, 5.7], [9.6, 6.2], [11.5, 7.3]],
      masculino: [[5.6, 3.8], [5.9, 4.3], [6.2, 4.4], [7.2, 4.6], [7.6, 5.2], [8.9, 5.5], [10.0, 6.2]],
    },
    risco: 9,
    busca: 'teste levantar caminhar e sentar 2,44 m idoso TUG',
  },
  {
    id: 'sentarAlcancar',
    nome: 'Sentar e alcançar na cadeira',
    curto: 'Sentar e alcançar',
    mede: 'Flexibilidade da parte de trás das pernas',
    areas: ['flexibilidade'],
    modo: 'medida',
    unidade: 'cm',
    material: 'Cadeira de 43 cm e régua de 45 cm.',
    passos: [
      'Sentado na ponta da cadeira, uma perna esticada com o calcanhar no chão e o pé a 90°; a outra dobrada.',
      'Mãos uma sobre a outra, dedos médios juntos.',
      'Inclina o tronco devagar tentando alcançar os dedos do pé, sem dobrar o joelho, e segura 2 segundos.',
      'Meça a distância entre a ponta dos dedos da mão e a ponta do pé: negativo se não chega, positivo se passa.',
      'Faça 2 vezes e fique com o melhor.',
    ],
    maiorMelhor: true,
    normas: {
      feminino: polegadas([[-0.5, 5], [-0.5, 4.5], [-1, 4], [-1.5, 3.5], [-2, 3], [-2.5, 2.5], [-4.5, 1]]),
      masculino: polegadas([[-2.5, 4], [-3, 3], [-3, 3], [-4, 2], [-5.5, 1.5], [-5.5, 0.5], [-6.5, -0.5]]),
    },
    busca: 'teste sentar e alcançar na cadeira idoso',
  },
  {
    id: 'alcancarCostas',
    nome: 'Alcançar atrás das costas',
    curto: 'Alcançar atrás das costas',
    mede: 'Flexibilidade dos ombros',
    areas: ['flexibilidade'],
    modo: 'medida',
    unidade: 'cm',
    material: 'Régua de 45 cm.',
    passos: [
      'Em pé, uma mão passa por cima do ombro e desce pelas costas, a palma virada para as costas.',
      'A outra mão sobe por trás, pela cintura, com a palma para fora.',
      'Tenta encostar ou passar os dedos médios das duas mãos.',
      'Meça a distância entre os dedos médios: negativo se não encostam, positivo se passam.',
      'Faça 2 vezes e fique com o melhor.',
    ],
    maiorMelhor: true,
    normas: {
      feminino: polegadas([[-3, 1.5], [-3.5, 1.5], [-4, 1], [-5, 0.5], [-5.5, 0], [-7, -1], [-8, -1]]),
      masculino: polegadas([[-6.5, 0], [-7.5, -1], [-8, -1], [-9, -2], [-9.5, -2], [-9.5, -3], [-10.5, -4]]),
    },
    busca: 'teste alcançar atrás das costas idoso',
  },
]

export const teste = (id: IdTeste) => TESTES.find((t) => t.id === id)!

export const linkVideo = (t: DefTeste) => `https://www.youtube.com/results?search_query=${encodeURIComponent(t.busca)}`

/** Índice do grupo de idade das tabelas (abaixo de 60 usa o primeiro, acima de 94 o último). */
export const grupoIdade = (idade: number) => Math.min(6, Math.max(0, Math.floor((idade - 60) / 5)))

export const ROTULO_GRUPO = ['60 a 64', '65 a 69', '70 a 74', '75 a 79', '80 a 84', '85 a 89', '90 a 94']

export type Classe = { status: Status; rotulo: string; faixa: [number, number] | null }

/** Compara o resultado com a faixa normal da idade e do sexo. Sem idade e sexo, só o corte de risco. */
export function classificar(t: DefTeste, valor: number, idade: number | null, sexo: Sexo | null): Classe | null {
  const emRisco = t.risco !== undefined && (t.maiorMelhor ? valor < t.risco : valor > t.risco)
  if (idade === null || sexo === null) {
    if (emRisco) return { status: 'alerta', rotulo: 'Risco para a independência', faixa: null }
    return null
  }
  // As faixas vêm como [pior, melhor]; no TUG, [mais lento, mais rápido].
  const [pior, melhor] = t.normas[sexo][grupoIdade(idade)]
  const abaixo = t.maiorMelhor ? valor < pior : valor > pior
  const acima = t.maiorMelhor ? valor > melhor : valor < melhor
  const faixa: [number, number] = [pior, melhor]
  if (emRisco) return { status: 'alerta', rotulo: 'Risco para a independência', faixa }
  if (abaixo) return { status: 'atencao', rotulo: 'Abaixo do esperado', faixa }
  if (acima) return { status: 'ok', rotulo: 'Acima do esperado', faixa }
  return { status: 'ok', rotulo: 'Dentro do esperado', faixa }
}
