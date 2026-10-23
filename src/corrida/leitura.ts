import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { enxugar, irPara, prepararVideo } from '../movimento/video'
import { detectPose } from '../pose/detector'
import type { QuadroCorrida } from './tipos'

/** A corrida é rápida (um passo dura uns 0,3 s): lemos 30 quadros por segundo de vídeo. */
const FPS_CORRIDA = 30
const MAX_QUADROS = 1200

/** Lê o vídeo da corrida quadro a quadro, como no exercício por vídeo. */
export async function lerCorrida(
  detector: PoseLandmarker,
  video: HTMLVideoElement,
  aoQuadro: (q: QuadroCorrida, progresso: number) => void,
  cancelado: () => boolean,
): Promise<QuadroCorrida[]> {
  const duracao = await prepararVideo(video)
  const passo = Math.max(1 / FPS_CORRIDA, duracao / MAX_QUADROS)
  const quadros: QuadroCorrida[] = []
  for (let t = 0; t <= duracao && !cancelado(); t += passo) {
    await irPara(video, t)
    const lm = detectPose(detector, video)
    const q = { t, lm: lm ? enxugar(lm) : null }
    quadros.push(q)
    aoQuadro(q, duracao ? t / duracao : 1)
  }
  return quadros
}
