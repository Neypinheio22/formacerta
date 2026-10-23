import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { enxugar, percorrerVideo } from '../movimento/video'
import { detectPose } from '../pose/detector'
import type { QuadroCorrida } from './tipos'

/** A corrida é rápida (um passo dura uns 0,3 s): lemos 30 quadros por segundo de vídeo. */
const FPS_CORRIDA = 30

/** Lê o vídeo da corrida quadro a quadro, como no exercício por vídeo. */
export function lerCorrida(
  detector: PoseLandmarker,
  video: HTMLVideoElement,
  aoQuadro: (q: QuadroCorrida, progresso: number) => void,
  cancelado: () => boolean,
): Promise<QuadroCorrida[]> {
  return percorrerVideo(
    video,
    FPS_CORRIDA,
    (fonte, t) => {
      const lm = detectPose(detector, fonte)
      return { t, lm: lm ? enxugar(lm) : null }
    },
    aoQuadro,
    cancelado,
  )
}
