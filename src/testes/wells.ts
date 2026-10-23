import { jointAngle } from '../pose/analysis'
import { LM, type Point, type Status } from '../pose/types'
import type { FotoTeste, Registro } from './historico'

export type Sexo = 'F' | 'M'

export type ClasseWells = 'Excelente' | 'Acima da média' | 'Média' | 'Abaixo da média' | 'Fraco'

export const CLASSES: ClasseWells[] = ['Excelente', 'Acima da média', 'Média', 'Abaixo da média', 'Fraco']

/** Pés na marca de 26 cm do banco, como na tabela de referência. */
export const MARCA_PADRAO = 26

type Faixa = { idade: [number, number]; minimos: [number, number, number, number] }

// Mínimo em cm para Excelente, Acima da média, Média e Abaixo da média.
// Tabela do Canadian Standardized Test of Fitness (adotada pelo ACSM),
// banco com a linha dos pés na marca de 26 cm.
const TABELA: Record<Sexo, Faixa[]> = {
  M: [
    { idade: [0, 19], minimos: [39, 34, 29, 24] },
    { idade: [20, 29], minimos: [40, 34, 30, 25] },
    { idade: [30, 39], minimos: [38, 33, 28, 23] },
    { idade: [40, 49], minimos: [35, 29, 24, 18] },
    { idade: [50, 59], minimos: [35, 28, 24, 16] },
    { idade: [60, 200], minimos: [33, 25, 20, 15] },
  ],
  F: [
    { idade: [0, 19], minimos: [43, 38, 34, 29] },
    { idade: [20, 29], minimos: [41, 37, 33, 28] },
    { idade: [30, 39], minimos: [41, 36, 32, 27] },
    { idade: [40, 49], minimos: [38, 34, 30, 25] },
    { idade: [50, 59], minimos: [39, 33, 30, 25] },
    { idade: [60, 200], minimos: [35, 31, 27, 23] },
  ],
}

export const STATUS_CLASSE: Record<ClasseWells, Status> = {
  Excelente: 'ok',
  'Acima da média': 'ok',
  Média: 'ok',
  'Abaixo da média': 'atencao',
  Fraco: 'alerta',
}

export function faixaEtaria(sexo: Sexo, idade: number) {
  const faixa = TABELA[sexo].find((f) => idade >= f.idade[0] && idade <= f.idade[1])!
  const [de, ate] = faixa.idade
  const rotulo = de === 0 ? `até ${ate} anos` : ate >= 200 ? `${de} anos ou mais` : `${de} a ${ate} anos`
  return { rotulo, minimos: faixa.minimos, foraDaTabela: idade < 15 || idade > 69 }
}

/** Converte a leitura de um banco com outra marca dos pés para a escala da tabela. */
export function ajustarMarca(cm: number, marcaPes: number) {
  return cm + (MARCA_PADRAO - marcaPes)
}

export function classificarWells(cm: number, sexo: Sexo, idade: number) {
  const { minimos, rotulo, foraDaTabela } = faixaEtaria(sexo, idade)
  const i = minimos.findIndex((m) => cm >= m)
  const classe = CLASSES[i === -1 ? 4 : i]
  const proxima = i === -1 ? 3 : i - 1
  const faltam = proxima >= 0 ? Math.max(0, minimos[proxima] - cm) : 0
  return {
    classe,
    status: STATUS_CLASSE[classe],
    faixa: rotulo,
    foraDaTabela,
    proximaClasse: proxima >= 0 ? CLASSES[proxima] : null,
    faltam,
    minimoMedia: minimos[2],
    limites: CLASSES.map((c, k) => ({
      classe: c,
      texto: k === 0 ? `${minimos[0]} cm ou mais` : k === 4 ? `menos de ${minimos[3]} cm` : `${minimos[k]} a ${minimos[k - 1] - 1} cm`,
    })),
  }
}

export const melhorTentativa = (tentativas: number[]) => Math.max(...tentativas)

export type MedidaFoto = { quadril: number; joelho: number; joelhosOk: boolean }

/**
 * Na foto lateral da posição final: ângulo entre tronco e coxa (quanto menor,
 * mais o quadril dobrou) e quanto o joelho está dobrado, que invalida o teste.
 */
export function medirFotoWells(lm: Point[], w: number, h: number): MedidaFoto {
  const vis = (i: number) => lm[i].visibility ?? 1
  const esq = [LM.ombroEsq, LM.quadrilEsq, LM.joelhoEsq, LM.tornozeloEsq]
  const dir = [LM.ombroDir, LM.quadrilDir, LM.joelhoDir, LM.tornozeloDir]
  const soma = (ids: number[]) => ids.reduce((s, i) => s + vis(i), 0)
  const [ombro, quadril, joelho, tornozelo] = (soma(esq) >= soma(dir) ? esq : dir).map((i) => ({ x: lm[i].x * w, y: lm[i].y * h }))
  const dobraJoelho = 180 - jointAngle(quadril, joelho, tornozelo)
  return { quadril: jointAngle(ombro, quadril, joelho), joelho: dobraJoelho, joelhosOk: dobraJoelho <= 15 }
}

export type RegistroWells = Registro & {
  sexo: Sexo
  idade: number
  marcaPes: number
  tentativas: number[]
  /** Melhor tentativa já convertida para a escala da tabela. */
  resultado: number
  classe: ClasseWells
  foto?: FotoTeste & MedidaFoto
}

export const CHAVE_WELLS = 'formacerta:wells'
