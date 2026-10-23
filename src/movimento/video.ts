import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { detectPoseCompleta } from '../pose/detector'
import type { Point } from '../pose/types'
import type { Exercicio } from './exercicios'
import type { Quadro } from './tipos'

/** Quadros por segundo analisados num vídeo enviado. */
export const FPS_ANALISE = 15
/** Limite de quadros, para um vídeo longo não travar o celular. */
const MAX_QUADROS = 1200

const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Guarda só o necessário de cada ponto, para o resultado ficar leve. */
export const enxugar = (lm: Point[]): Point[] => lm.map((p) => ({ x: r3(p.x), y: r3(p.y), visibility: r3(p.visibility ?? 1) }))

/** Detecta o corpo e tira as medidas do exercício num quadro. `w` e `h` são o tamanho original do vídeo. */
export function analisarQuadro(detector: PoseLandmarker, ex: Exercicio, fonte: HTMLVideoElement | HTMLCanvasElement, t: number, w?: number, h?: number): Quadro {
  w ??= fonte instanceof HTMLVideoElement ? fonte.videoWidth : fonte.width
  h ??= fonte instanceof HTMLVideoElement ? fonte.videoHeight : fonte.height
  const pose = detectPoseCompleta(detector, fonte)
  if (!pose) return { t, lm: null, medidas: null }
  return { t, lm: enxugar(pose.lm), medidas: ex.medir({ lm: pose.lm, mundo: pose.mundo, w, h }) }
}

function esperar(video: HTMLVideoElement, evento: string, limite = 4000) {
  return new Promise<void>((ok) => {
    const fim = () => {
      clearTimeout(id)
      video.removeEventListener(evento, fim)
      ok()
    }
    const id = setTimeout(fim, limite)
    video.addEventListener(evento, fim)
  })
}

export async function irPara(video: HTMLVideoElement, t: number, limite = 1500) {
  const pronto = esperar(video, 'seeked', limite)
  video.currentTime = t
  await pronto
}

/** Carrega o vídeo e descobre a duração (vídeos gravados no Chrome às vezes vêm sem ela). */
export async function prepararVideo(video: HTMLVideoElement): Promise<number> {
  if (video.readyState < 1) await Promise.race([esperar(video, 'loadedmetadata', 15000), esperar(video, 'error', 15000)])
  if (video.readyState < 1) throw new Error('Formato de vídeo não suportado')
  if (!Number.isFinite(video.duration)) {
    const pronta = esperar(video, 'durationchange')
    video.currentTime = 1e9
    await pronta
  }
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Vídeo sem duração')
  return video.duration
}

/** Lado maior da imagem analisada. Vídeo 4K do iPhone fica leve sem perder os pontos do corpo. */
const LADO_ANALISE = 640

/**
 * Percorre o vídeo e chama `medir` em cada quadro, com uma cópia reduzida da
 * imagem. Devolve os quadros em intervalos iguais de 1/fps segundos de vídeo.
 *
 * Toca o vídeo devagar e mede cada quadro que aparece na tela. Pular de quadro
 * em quadro (o jeito antigo) trava no iPhone: o Safari demora segundos para
 * cada pulo em vídeo HEVC. A velocidade se ajusta ao celular: se a análise de
 * um quadro demora, o vídeo toca mais devagar para não perder quadros.
 */
export async function percorrerVideo<Q extends { t: number }>(
  video: HTMLVideoElement,
  fps: number,
  medir: (fonte: HTMLCanvasElement, t: number) => Q,
  aoQuadro: (q: Q, progresso: number) => void,
  cancelado: () => boolean,
): Promise<Q[]> {
  const duracao = await prepararVideo(video)
  const escala = Math.min(1, LADO_ANALISE / Math.max(video.videoWidth, video.videoHeight))
  const tela = document.createElement('canvas')
  tela.width = Math.round(video.videoWidth * escala)
  tela.height = Math.round(video.videoHeight * escala)
  const ctx = tela.getContext('2d', { willReadFrequently: true })!
  const lidos: Q[] = []
  const ler = (t: number) => {
    ctx.drawImage(video, 0, 0, tela.width, tela.height)
    const q = medir(tela, t)
    lidos.push(q)
    aoQuadro(q, duracao ? Math.min(1, t / duracao) : 1)
  }

  // iPhone com iOS antigo não tem requestVideoFrameCallback: aí só dá para pular.
  const tocou = 'requestVideoFrameCallback' in video ? await tocando(video, duracao, fps, ler, cancelado) : false
  if (!tocou) {
    lidos.length = 0
    // No iPhone o vídeo só deixa pular para um ponto depois de tocar uma vez.
    await video.play().catch(() => {})
    video.pause()
    const passo = Math.max(1 / fps, duracao / MAX_QUADROS)
    for (let t = 0; t <= duracao && !cancelado(); t += passo) {
      await irPara(video, t)
      ler(t)
    }
    return lidos
  }
  return igualar(lidos, fps, duracao)
}

/** Lê tocando o vídeo. Devolve false se o navegador não deixou tocar (aí pulamos quadro a quadro). */
function tocando(video: HTMLVideoElement, duracao: number, fps: number, ler: (t: number) => void, cancelado: () => boolean): Promise<boolean> {
  return new Promise((ok) => {
    let ultimo = -1
    let lidos = 0
    let mediaMs = 40
    let semQuadro = 0
    let fim = false
    const terminar = (resultado: boolean) => {
      if (fim) return
      fim = true
      clearInterval(vigia)
      video.removeEventListener('ended', aoAcabar)
      video.pause()
      ok(resultado)
    }
    const aoAcabar = () => terminar(true)
    const aoQuadro: VideoFrameRequestCallback = (_agora, meta) => {
      if (fim) return
      if (cancelado()) return terminar(true)
      const t = meta.mediaTime
      if (t > ultimo) {
        const inicio = performance.now()
        ler(t)
        ultimo = t
        lidos++
        semQuadro = 0
        mediaMs = mediaMs * 0.8 + (performance.now() - inicio) * 0.2
        // Quantos quadros por segundo o celular consegue analisar, com folga.
        const capacidade = (1000 / mediaMs) * 0.7
        video.playbackRate = Math.min(1, Math.max(0.1, capacidade / fps))
      }
      if (t >= duracao - 0.05) return terminar(true)
      video.requestVideoFrameCallback(aoQuadro)
    }
    // Se o vídeo parar sozinho (o iPhone às vezes pausa), tenta tocar de novo.
    const vigia = setInterval(() => {
      if (fim) return
      if (cancelado()) return terminar(true)
      semQuadro++
      if (semQuadro >= 2) video.play().catch(() => {})
      if (semQuadro >= 6) terminar(lidos > 0)
    }, 1000)
    video.addEventListener('ended', aoAcabar)
    video.requestVideoFrameCallback(aoQuadro)
    video.muted = true
    video.playbackRate = 0.25
    irPara(video, 0)
      .then(() => video.play())
      .catch(() => terminar(false))
  })
}

/** Reamostra em intervalos iguais (as contas de ritmo e repetição precisam disso), pegando o quadro lido mais perto. */
export function igualar<Q extends { t: number }>(lidos: Q[], fps: number, duracao: number): Q[] {
  if (lidos.length < 2) return lidos
  const passo = Math.max(1 / fps, duracao / MAX_QUADROS)
  const fimT = lidos[lidos.length - 1].t
  const r: Q[] = []
  let j = 0
  for (let t = lidos[0].t; t <= fimT + 1e-6; t += passo) {
    while (j + 1 < lidos.length && Math.abs(lidos[j + 1].t - t) <= Math.abs(lidos[j].t - t)) j++
    r.push({ ...lidos[j], t })
  }
  return r
}

/** Lê o vídeo e mede o corpo em cada quadro, a 15 quadros por segundo de vídeo. */
export function analisarVideo(
  detector: PoseLandmarker,
  ex: Exercicio,
  video: HTMLVideoElement,
  aoQuadro: (q: Quadro, progresso: number) => void,
  cancelado: () => boolean,
): Promise<Quadro[]> {
  const w = video.videoWidth
  const h = video.videoHeight
  return percorrerVideo(video, FPS_ANALISE, (fonte, t) => analisarQuadro(detector, ex, fonte, t, w || fonte.width, h || fonte.height), aoQuadro, cancelado)
}
