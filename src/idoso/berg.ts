// Escala de Equilíbrio de Berg (versão brasileira, Miyamoto et al., 2004):
// 14 itens de 0 a 4, total de 56 pontos.

import type { Status } from '../pose/types'

export type ItemBerg = {
  titulo: string
  instrucao: string
  /** Tempo do item em segundos, para o cronômetro. */
  tempo?: number
  /** Descrição das notas, da 4 até a 0. */
  notas: [string, string, string, string, string]
}

export const ITENS_BERG: ItemBerg[] = [
  {
    titulo: 'Sentado para em pé',
    instrucao: 'Por favor, levante-se. Tente não usar as mãos para se apoiar.',
    notas: [
      'Levanta sem usar as mãos e fica estável sozinho',
      'Levanta sozinho usando as mãos',
      'Levanta usando as mãos, após várias tentativas',
      'Precisa de ajuda mínima para levantar ou se equilibrar',
      'Precisa de ajuda moderada ou máxima para levantar',
    ],
  },
  {
    titulo: 'Em pé sem apoio',
    instrucao: 'Por favor, fique em pé por 2 minutos sem se apoiar.',
    tempo: 120,
    notas: [
      'Fica em pé com segurança por 2 minutos',
      'Fica 2 minutos com supervisão',
      'Fica 30 segundos sem apoio',
      'Precisa de várias tentativas para ficar 30 segundos sem apoio',
      'Não consegue ficar 30 segundos sem apoio',
    ],
  },
  {
    titulo: 'Sentado sem apoio nas costas',
    instrucao: 'Sente-se de braços cruzados, pés no chão, sem encostar as costas, por 2 minutos.',
    tempo: 120,
    notas: [
      'Fica sentado com segurança e firmeza por 2 minutos',
      'Fica 2 minutos sob supervisão',
      'Fica sentado 30 segundos',
      'Fica sentado 10 segundos',
      'Não consegue ficar sentado sem apoio por 10 segundos',
    ],
  },
  {
    titulo: 'Em pé para sentado',
    instrucao: 'Por favor, sente-se.',
    notas: [
      'Senta com segurança, usando pouco as mãos',
      'Controla a descida usando as mãos',
      'Usa a parte de trás das pernas contra a cadeira para controlar a descida',
      'Senta sozinho, mas sem controlar a descida',
      'Precisa de ajuda para sentar',
    ],
  },
  {
    titulo: 'Transferências',
    instrucao: 'Passe de uma cadeira com braços para outra sem braços, e volte.',
    notas: [
      'Passa com segurança, usando pouco as mãos',
      'Passa com segurança, usando as mãos',
      'Passa com orientação verbal e/ou supervisão',
      'Precisa de uma pessoa para ajudar',
      'Precisa de duas pessoas para ajudar ou supervisionar',
    ],
  },
  {
    titulo: 'Em pé com os olhos fechados',
    instrucao: 'Fique parado em pé e feche os olhos por 10 segundos.',
    tempo: 10,
    notas: [
      'Fica 10 segundos com segurança',
      'Fica 10 segundos com supervisão',
      'Fica 3 segundos',
      'Não mantém os olhos fechados 3 segundos, mas fica em pé',
      'Precisa de ajuda para não cair',
    ],
  },
  {
    titulo: 'Em pé com os pés juntos',
    instrucao: 'Junte os pés e fique em pé sem se apoiar por 1 minuto.',
    tempo: 60,
    notas: [
      'Junta os pés sozinho e fica 1 minuto com segurança',
      'Junta os pés sozinho e fica 1 minuto com supervisão',
      'Junta os pés sozinho, mas não fica 30 segundos',
      'Precisa de ajuda para juntar os pés, mas fica 15 segundos',
      'Precisa de ajuda para juntar os pés e não fica 15 segundos',
    ],
  },
  {
    titulo: 'Alcançar à frente com o braço esticado',
    instrucao: 'Levante o braço a 90° e estique os dedos para a frente o máximo que puder. Meça com uma régua na altura dos dedos.',
    notas: [
      'Alcança mais de 25 cm com segurança',
      'Alcança mais de 12,5 cm com segurança',
      'Alcança mais de 5 cm com segurança',
      'Alcança, mas precisa de supervisão',
      'Perde o equilíbrio ao tentar ou precisa de apoio',
    ],
  },
  {
    titulo: 'Pegar um objeto do chão',
    instrucao: 'Pegue o chinelo que está na frente dos seus pés.',
    notas: [
      'Pega o chinelo com facilidade e segurança',
      'Pega o chinelo, mas precisa de supervisão',
      'Não pega, mas chega a 2 a 5 cm do chinelo e mantém o equilíbrio sozinho',
      'Não pega e precisa de supervisão enquanto tenta',
      'Não consegue tentar ou precisa de ajuda para não cair',
    ],
  },
  {
    titulo: 'Virar e olhar para trás',
    instrucao: 'Vire e olhe para trás por cima do ombro esquerdo; depois, por cima do direito.',
    notas: [
      'Olha para trás dos dois lados, transferindo bem o peso',
      'Olha para trás só de um lado; do outro transfere menos o peso',
      'Vira só para os lados, mas mantém o equilíbrio',
      'Precisa de supervisão para virar',
      'Precisa de ajuda para não perder o equilíbrio ou cair',
    ],
  },
  {
    titulo: 'Girar 360 graus',
    instrucao: 'Dê uma volta completa, pare, e dê outra volta para o outro lado.',
    tempo: 4,
    notas: [
      'Gira 360° com segurança em até 4 segundos para cada lado',
      'Gira 360° com segurança só para um lado em até 4 segundos',
      'Gira 360° com segurança, mas devagar',
      'Precisa de supervisão ou orientação verbal',
      'Precisa de ajuda enquanto gira',
    ],
  },
  {
    titulo: 'Pés alternados no degrau',
    instrucao: 'Coloque um pé de cada vez no degrau (ou banquinho), alternando, até cada pé tocar 4 vezes.',
    tempo: 20,
    notas: [
      'Fica em pé sozinho e faz os 8 toques em 20 segundos com segurança',
      'Faz os 8 toques sozinho em mais de 20 segundos',
      'Faz 4 toques sem ajuda, com supervisão',
      'Faz mais de 2 toques com ajuda mínima',
      'Precisa de ajuda para não cair ou não consegue tentar',
    ],
  },
  {
    titulo: 'Em pé com um pé à frente',
    instrucao: 'Coloque um pé bem à frente do outro (calcanhar encostado nos dedos) e fique 30 segundos.',
    tempo: 30,
    notas: [
      'Põe um pé imediatamente à frente do outro sozinho e fica 30 segundos',
      'Põe um pé um pouco à frente do outro sozinho e fica 30 segundos',
      'Dá um pequeno passo sozinho e fica 30 segundos',
      'Precisa de ajuda para dar o passo, mas fica 15 segundos',
      'Perde o equilíbrio ao dar o passo ou ao ficar em pé',
    ],
  },
  {
    titulo: 'Em pé sobre uma perna',
    instrucao: 'Fique em pé sobre uma perna o máximo que puder, sem se apoiar.',
    tempo: 10,
    notas: [
      'Levanta a perna sozinho e fica mais de 10 segundos',
      'Levanta a perna sozinho e fica de 5 a 10 segundos',
      'Levanta a perna sozinho e fica 3 segundos ou mais',
      'Tenta levantar, não fica 3 segundos, mas fica em pé sozinho',
      'Não consegue tentar ou precisa de ajuda para não cair',
    ],
  },
]

export const MAXIMO_BERG = 56

export function totalBerg(notas: (number | null)[]) {
  const feitas = notas.filter((n): n is number => n !== null)
  return { total: feitas.reduce((a, b) => a + b, 0), faltam: ITENS_BERG.length - feitas.length }
}

/** Risco de queda pela pontuação total. */
export function classificarBerg(total: number): { status: Status; rotulo: string } {
  if (total >= 45) return { status: 'ok', rotulo: 'Baixo risco de queda' }
  if (total >= 41) return { status: 'atencao', rotulo: 'Risco de queda aumentado' }
  if (total >= 21) return { status: 'alerta', rotulo: 'Risco moderado: marcha com auxílio' }
  return { status: 'alerta', rotulo: 'Alto risco de queda' }
}

export const FAIXAS_BERG = [
  { faixa: '45 a 56', rotulo: 'Baixo risco de queda' },
  { faixa: '41 a 44', rotulo: 'Risco de queda aumentado' },
  { faixa: '21 a 40', rotulo: 'Risco moderado: marcha com auxílio' },
  { faixa: '0 a 20', rotulo: 'Alto risco de queda' },
]
