// Biblioteca de treinos do personal: modelos de rotina guardados em pastas,
// prontos para virar a rotina de um ou de vários alunos. Também traz os
// modelos prontos do FormaCerta, para o personal já começar com alguma coisa.
// As contas ficam aqui, separadas das telas, para dar para testar.

import type { ExercicioTreino } from '../nuvem/treinos'
import type { LinhaSerie } from './linhas'
import type { Nivel } from './rotinas'
import { SERIE_SUGERIDA } from './sugerida'

export type TreinoModelo = { letra: string; nome: string; exercicios: ExercicioTreino[] }

export type Pasta = { id: string; nome: string; criado_em: string }

export type Modelo = {
  id: string
  pasta_id: string | null
  nome: string
  objetivo: string
  nivel: Nivel
  icone: string
  semanas: number | null
  treinos: TreinoModelo[]
  criado_em: string
  atualizado_em: string
  /** Modelo pronto do FormaCerta: não dá para editar nem apagar, só usar ou copiar. */
  doApp?: boolean
}

export type DadosModelo = Pick<Modelo, 'pasta_id' | 'nome' | 'objetivo' | 'nivel' | 'icone' | 'semanas' | 'treinos'>

/** Pasta que junta os modelos prontos do FormaCerta (não fica no banco). */
export const PASTA_APP = 'formacerta'

/** Atalhos de duração do modelo. */
export const SEMANAS_MODELO = [4, 6, 8, 12] as const

/** "4x10", com intervalo e observação, no formato de linhas da ficha. */
function ex(nome: string, serie: string, intervalo = '60 s', obs = ''): ExercicioTreino {
  const linhas: LinhaSerie[] = [{ tipo: 'reps_carga', serie, ...(intervalo ? { intervalo } : {}) }]
  if (obs) linhas.push({ tipo: 'observacoes', texto: obs })
  const [series, ...reps] = serie.split(/x/i)
  return { nome, series: reps.length ? series : '', reps: reps.length ? reps.join('x') : serie, obs, linhas }
}

/** Exercício por tempo (mobilidade, prancha, aquecimento). */
function exTempo(nome: string, serie: string, tempo: string, obs = ''): ExercicioTreino {
  const linhas: LinhaSerie[] = [{ tipo: 'reps_tempo', serie, tempo }]
  if (obs) linhas.push({ tipo: 'observacoes', texto: obs })
  return { nome, series: serie, reps: tempo, obs, linhas }
}

const app = (m: Omit<Modelo, 'pasta_id' | 'criado_em' | 'atualizado_em' | 'doApp'>): Modelo => ({ ...m, pasta_id: PASTA_APP, criado_em: '', atualizado_em: '', doApp: true })

/**
 * Modelos prontos do FormaCerta. Usam os exercícios que têm vídeo de como
 * fazer no app (videosApp.ts) e, sempre que dá, os que a câmera corrige.
 * São um ponto de partida: o personal ajusta para cada aluno.
 */
export const MODELOS_DO_APP: Modelo[] = [
  app({
    id: 'app-iniciante-ab',
    nome: 'Iniciante corpo todo (AB)',
    objetivo: 'Saúde e qualidade de vida',
    nivel: 'iniciante',
    icone: 'geral',
    semanas: 6,
    treinos: SERIE_SUGERIDA.map((t) => ({ letra: t.letra, nome: t.nome, exercicios: t.exercicios.map((e) => ex(e.nome, e.series ? `${e.series}x${e.reps}` : e.reps, '60 s', e.obs)) })),
  }),
  app({
    id: 'app-hipertrofia-abc',
    nome: 'Hipertrofia ABC',
    objetivo: 'Hipertrofia',
    nivel: 'intermediario',
    icone: 'geral',
    semanas: 8,
    treinos: [
      {
        letra: 'A',
        nome: 'Peito, ombro e tríceps',
        exercicios: [
          ex('Supino reto', '4x10', '90 s'),
          ex('Supino inclinado', '3x10', '90 s'),
          ex('Desenvolvimento com halteres', '3x10'),
          ex('Elevação lateral', '3x12'),
          ex('Tríceps na polia', '3x12'),
          ex('Tríceps francês', '3x12'),
        ],
      },
      {
        letra: 'B',
        nome: 'Costas e bíceps',
        exercicios: [
          ex('Puxada na frente', '4x10', '90 s'),
          ex('Remada baixa', '3x10'),
          ex('Remada curvada', '3x10'),
          ex('Encolhimento de ombros', '3x12'),
          ex('Rosca direta', '3x12'),
        ],
      },
      {
        letra: 'C',
        nome: 'Pernas',
        exercicios: [
          ex('Agachamento', '4x10', '90 s'),
          ex('Leg press 45', '4x12', '90 s'),
          ex('Cadeira extensora', '3x12'),
          ex('Mesa flexora', '3x12'),
          ex('Elevação pélvica', '3x12'),
          ex('Panturrilha em pé', '4x15', '45 s'),
        ],
      },
    ],
  }),
  app({
    id: 'app-emagrecimento-casa',
    nome: 'Emagrecimento em casa (AB)',
    objetivo: 'Emagrecimento',
    nivel: 'iniciante',
    icone: 'cardio',
    semanas: 6,
    treinos: [
      {
        letra: 'A',
        nome: 'Pernas e cardio',
        exercicios: [
          exTempo('Polichinelo', '3', '40 s', 'Ritmo forte, 20 s de descanso'),
          ex('Agachamento', '3x15', '30 s'),
          ex('Afundo (avanço)', '3x10 cada perna', '30 s'),
          ex('Elevação pélvica', '3x15', '30 s'),
          ex('Abdominal supra', '3x15', '30 s'),
        ],
      },
      {
        letra: 'B',
        nome: 'Superiores e cardio',
        exercicios: [
          exTempo('Polichinelo', '3', '40 s', 'Ritmo forte, 20 s de descanso'),
          ex('Flexão de braço', '3x10', '30 s', 'Com os joelhos no chão, se precisar'),
          ex('Mergulho no banco', '3x10', '30 s'),
          ex('Remada curvada', '3x12', '30 s', 'Halter leve ou garrafas de água'),
          ex('Elevação de pernas deitado', '3x12', '30 s'),
        ],
      },
    ],
  }),
  app({
    id: 'app-mobilidade-postura',
    nome: 'Mobilidade e postura',
    objetivo: 'Postura',
    nivel: 'iniciante',
    icone: 'mobilidade',
    semanas: 4,
    treinos: [
      {
        letra: 'A',
        nome: 'Coluna, ombro e quadril',
        exercicios: [
          exTempo('Gato e camelo (cat-cow)', '2', '40 s'),
          exTempo('Mobilidade torácica', '2', '40 s'),
          exTempo('Rotação torácica', '2', '30 s cada lado'),
          exTempo('Mobilidade escapular', '2', '40 s'),
          exTempo('Mobilidade de ombro', '2', '40 s'),
          exTempo('90/90 de quadril', '2', '40 s cada lado'),
          exTempo('Mobilidade dos flexores do quadril', '2', '30 s cada lado'),
          exTempo('Mobilidade de tornozelo', '2', '30 s cada lado'),
        ],
      },
    ],
  }),
  app({
    id: 'app-circuito-abdominais',
    nome: 'Circuito de abdominais',
    objetivo: 'Definição',
    nivel: 'intermediario',
    icone: 'core',
    semanas: 4,
    treinos: [
      {
        letra: 'A',
        nome: 'Circuito de abdominais',
        exercicios: [
          ex('Abdominal supra', '3x15', '', 'Circuito: emende os exercícios e descanse 60 s no fim de cada volta'),
          ex('Elevação de pernas deitado', '3x12', ''),
          exTempo('Prancha', '3', '30 s'),
          ex('Elevação pélvica', '3x15', ''),
        ],
      },
    ],
  }),
]

/** Letras da divisão do modelo: "ABC". */
export const divisaoDe = (m: Pick<Modelo, 'treinos'>) => m.treinos.map((t) => t.letra).join('')

export const exerciciosDe = (m: Pick<Modelo, 'treinos'>) => m.treinos.reduce((n, t) => n + t.exercicios.filter((e) => e.nome.trim()).length, 0)

/** "ABC · 17 exercícios · 8 semanas" */
export function resumoModelo(m: Pick<Modelo, 'treinos' | 'semanas'>): string {
  const n = exerciciosDe(m)
  return [divisaoDe(m) || 'Sem treinos', `${n} exercício${n === 1 ? '' : 's'}`, m.semanas && `${m.semanas} semana${m.semanas === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
}

/** Sem acento e em minúsculas, para buscar "rosca" e achar "Rosca Direta". */
export const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Busca pelo nome do modelo, objetivo, nome dos treinos ou de qualquer exercício. */
export function buscarModelos<T extends Modelo>(modelos: T[], busca: string): T[] {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean)
  if (!termos.length) return modelos
  return modelos.filter((m) => {
    const texto = semAcento([m.nome, m.objetivo, ...m.treinos.flatMap((t) => [t.nome, ...t.exercicios.map((e) => e.nome)])].join(' '))
    return termos.every((t) => texto.includes(t))
  })
}

/** Nome livre para uma cópia: "Hipertrofia ABC (cópia)", "(cópia 2)"... */
export function nomeDeCopia(nome: string, existentes: string[]): string {
  const base = nome.replace(/\s*\(cópia(?: \d+)?\)$/, '')
  const usados = new Set(existentes.map(semAcento))
  for (let i = 1; ; i++) {
    const n = `${base} (cópia${i === 1 ? '' : ` ${i}`})`.slice(0, 60)
    if (!usados.has(semAcento(n))) return n
  }
}

/** Nome de pasta: sem espaço sobrando, até 40 letras, e sem repetir outra pasta. */
export function validarPasta(nome: string, pastas: Pick<Pasta, 'id' | 'nome'>[], id?: string): string | null {
  const n = nome.trim()
  if (!n) return 'Dê um nome para a pasta.'
  if (n.length > 40) return 'Use até 40 letras.'
  if (pastas.some((p) => p.id !== id && semAcento(p.nome) === semAcento(n))) return 'Já existe uma pasta com esse nome.'
  return null
}

/** Ordem das pastas: alfabética, sem ligar para acento. */
export const ordenarPastas = <T extends Pick<Pasta, 'nome'>>(pastas: T[]) => [...pastas].sort((a, b) => semAcento(a.nome).localeCompare(semAcento(b.nome)))
