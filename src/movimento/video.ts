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
const enxugar = (lm: Point[]): Point[] => lm.map((p) => ({ x: r3(p.x), y: r3(p.y), visibility: r3(p.visibility ?? 1) }))

/** Detecta o corpo e tira as medidas do exercício num quadro. */
export function analisarQuadro(detector: PoseLandmarker, ex: Exercicio, fonte: HTMLVideoElement, t: number): Quadro {
  const w = fonte.videoWidth
  const h = fonte.videoHeight
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

async function irPara(video: HTMLVideoElement, t: number) {
  const pronto = esperar(video, 'seeked')
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
  // No iPhone o vídeo só deixa pular para um ponto depois de tocar uma vez.
  await video.play().catch(() => {})
  video.pause()
  if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Vídeo sem duração')
  return video.duration
}

/**
 * Lê o vídeo quadro a quadro: pula para cada instante, espera a imagem
 * aparecer e mede o corpo nela. Não depende de tocar em tempo real, então
 * nenhum quadro é pulado mesmo num celular mais lento.
 */
export async function analisarVideo(
  detector: PoseLandmarker,
  ex: Exercicio,
  video: HTMLVideoElement,
  aoQuadro: (q: Quadro, progresso: number) => void,
  cancelado: () => boolean,
): Promise<Quadro[]> {
  const duracao = await prepararVideo(video)
  const passo = Math.max(1 / FPS_ANALISE, duracao / MAX_QUADROS)
  const quadros: Quadro[] = []
  for (let t = 0; t <= duracao && !cancelado(); t += passo) {
    await irPara(video, t)
    const q = analisarQuadro(detector, ex, video, t)
    quadros.push(q)
    aoQuadro(q, duracao ? t / duracao : 1)
  }
  return quadros
}
