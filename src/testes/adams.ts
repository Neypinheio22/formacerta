import { LM, type Point, type Status } from '../pose/types'
import type { Mascara } from '../pose/detector'
import type { Lado } from '../pose/recomendacoes'
import type { FotoTeste, Registro } from './historico'

/** De onde a câmera vê a pessoa inclinada: por trás (padrão do teste) ou pela frente, olhando ao longo das costas. */
export type VistaAdams = 'costas' | 'frente'

export type Contorno = { x: number; y: number }[]

export type ResultadoAdams = {
  /** Ângulo de rotação do tronco estimado, em graus (equivale à leitura do escoliômetro). */
  atr: number
  /** Lado das costas mais alto (gibosidade), do ponto de vista da pessoa. */
  lado: Lado | null
  /** Pontos mais altos de cada lado e linha do meio, em pixels da máscara. */
  picos: { xEsq: number; yEsq: number; xDir: number; yDir: number; xMeio: number }
  contorno: Contorno
  largura: number
  altura: number
  /** O tronco parece inclinado o suficiente (ombros perto da altura do quadril). Null quando não deu para achar os pontos do corpo. */
  flexaoOk: boolean | null
}

const LIMIAR = 0.5

function mediana(xs: number[]) {
  const v = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : NaN
}

/**
 * Teste de Adams pela foto: com a pessoa inclinada para frente, mede a borda de
 * cima do contorno das costas e compara o ponto mais alto do lado esquerdo com
 * o do lado direito. A inclinação da linha entre os dois picos estima o ângulo
 * de rotação do tronco (ATR), como o escoliômetro faz apoiado nas costas.
 */
export function analisarAdams(m: Mascara, lm: Point[] | null, vista: VistaAdams): ResultadoAdams | null {
  const { dados, largura: W, altura: H } = m
  const eixo = lm ? eixoPelosPontos(lm, W, H) : eixoPeloContorno(m)
  if (!eixo) return null
  const { xMeio, meia } = eixo

  // Primeira linha (de cima para baixo) com corpo em cada coluna.
  const x0 = Math.max(0, Math.floor(xMeio - meia))
  const x1 = Math.min(W - 1, Math.ceil(xMeio + meia))
  const topo = new Map<number, number>()
  for (let x = x0; x <= x1; x++) {
    let y = 0
    while (y < H && dados[y * W + x] < LIMIAR) y++
    topo.set(x, y < H ? y : NaN)
  }
  const janela = Math.max(2, Math.round(meia / 25))
  const suave = (x: number) => mediana(Array.from({ length: 2 * janela + 1 }, (_, k) => topo.get(x - janela + k) ?? NaN))

  function pico(sinal: -1 | 1) {
    let melhor = { x: NaN, y: Infinity }
    for (let d = Math.round(0.2 * meia); d <= Math.round(0.9 * meia); d++) {
      const x = Math.round(xMeio + sinal * d)
      const y = suave(x)
      if (y < melhor.y) melhor = { x, y }
    }
    return melhor
  }
  const esqImg = pico(-1)
  const dirImg = pico(1)
  if (!Number.isFinite(esqImg.y) || !Number.isFinite(dirImg.y)) return null

  const atr = (Math.atan2(Math.abs(esqImg.y - dirImg.y), Math.abs(dirImg.x - esqImg.x)) * 180) / Math.PI
  // Por trás, a esquerda da foto é a esquerda da pessoa; pela frente, é a direita.
  const ladoImg = esqImg.y < dirImg.y ? 'esquerdo' : 'direito'
  const lado: Lado | null = esqImg.y === dirImg.y ? null : vista === 'costas' ? ladoImg : ladoImg === 'esquerdo' ? 'direito' : 'esquerdo'

  const passo = Math.max(1, Math.round((x1 - x0) / 80))
  const contorno: Contorno = []
  for (let x = x0; x <= x1; x += passo) {
    const y = suave(x)
    if (!Number.isNaN(y)) contorno.push({ x, y })
  }

  return {
    atr,
    lado,
    picos: { xEsq: esqImg.x, yEsq: esqImg.y, xDir: dirImg.x, yDir: dirImg.y, xMeio },
    contorno,
    largura: W,
    altura: H,
    flexaoOk: eixo.flexaoOk,
  }
}

/** Meio e meia largura das costas pelos ombros e quadris. */
function eixoPelosPontos(lm: Point[], W: number, H: number): { xMeio: number; meia: number; flexaoOk: boolean | null } {
  const P = (i: number) => ({ x: lm[i].x * W, y: lm[i].y * H })
  const ombros = [P(LM.ombroEsq), P(LM.ombroDir)]
  const quadris = [P(LM.quadrilEsq), P(LM.quadrilDir)]
  const yOmbros = (ombros[0].y + ombros[1].y) / 2
  const yQuadris = (quadris[0].y + quadris[1].y) / 2
  return {
    xMeio: [...ombros, ...quadris].reduce((s, p) => s + p.x, 0) / 4,
    meia: Math.max(Math.abs(ombros[0].x - ombros[1].x), Math.abs(quadris[0].x - quadris[1].x), 0.08 * W) / 2,
    flexaoOk: yOmbros >= yQuadris - 0.12 * H,
  }
}

/**
 * Sem os pontos do corpo: as costas inclinadas são a parte de cima do recorte.
 * Mede a largura do recorte um pouco abaixo do topo, acima de onde os braços
 * soltos alargam a silhueta.
 */
function eixoPeloContorno({ dados, largura: W, altura: H }: Mascara) {
  const linhaTem = (y: number) => {
    let esq = -1, dir = -1
    for (let x = 0; x < W; x++) {
      if (dados[y * W + x] >= LIMIAR) {
        if (esq < 0) esq = x
        dir = x
      }
    }
    return esq < 0 ? null : { esq, dir }
  }
  let topo = 0
  while (topo < H && !linhaTem(topo)) topo++
  let base = H - 1
  while (base > topo && !linhaTem(base)) base--
  if (base - topo < H * 0.1) return null
  const faixa = linhaTem(Math.round(topo + (base - topo) * 0.12))
  if (!faixa || faixa.dir - faixa.esq < W * 0.05) return null
  return { xMeio: (faixa.esq + faixa.dir) / 2, meia: (faixa.dir - faixa.esq) / 2, flexaoOk: null }
}

/**
 * Pontos de corte usados na triagem escolar com escoliômetro:
 * abaixo de 5° é normal, de 5° a 7° pede reavaliação e 7° ou mais pede
 * encaminhamento para avaliação médica (Bunnell).
 */
export function classificarAdams(atr: number): { status: Status; titulo: string; texto: string } {
  if (atr >= 7)
    return {
      status: 'alerta',
      titulo: 'Assimetria importante',
      texto: 'Sinal compatível com rotação vertebral. Encaminhe para avaliação médica (ortopedista), que pode pedir raio-X.',
    }
  if (atr >= 5)
    return {
      status: 'atencao',
      titulo: 'Assimetria leve',
      texto: 'Vale acompanhar: repita o teste em 3 a 6 meses ou antes se a diferença aumentar.',
    }
  return { status: 'ok', titulo: 'Sem assimetria relevante', texto: 'As costas estão simétricas na flexão do tronco.' }
}

export type RegistroAdams = Registro & {
  vista: VistaAdams
  /** ATR medido na foto. Pode faltar quando só o escoliômetro foi usado. */
  atr: number | null
  lado: Lado | null
  /** Leitura do escoliômetro físico, se o personal usou. */
  escoliometro: number | null
  foto?: FotoTeste & { resultado: ResultadoAdams }
}

/** Valor que vale para a classificação: o escoliômetro tem prioridade sobre a foto. */
export const anguloAdams = (r: Pick<RegistroAdams, 'atr' | 'escoliometro'>) => r.escoliometro ?? r.atr

export const CHAVE_ADAMS = 'formacerta:adams'
