import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Point } from './types'

const asset = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href

let pending: Promise<PoseLandmarker> | null = null
let lastTimestamp = 0

/**
 * Carrega o modelo uma vez só. Ele roda no próprio aparelho: as fotos do
 * cliente não saem do celular para fazer a análise.
 */
export function loadDetector(): Promise<PoseLandmarker> {
  pending ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(asset('mediapipe/wasm'))
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: asset('models/pose_landmarker_full.task'), delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
    })
    try {
      return await PoseLandmarker.createFromOptions(vision, options('GPU'))
    } catch {
      return await PoseLandmarker.createFromOptions(vision, options('CPU'))
    }
  })()
  pending.catch(() => (pending = null))
  return pending
}

/** Detecta os pontos do corpo num quadro de vídeo, foto ou canvas. */
export function detectPose(detector: PoseLandmarker, source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Point[] | null {
  // O modo VIDEO exige carimbos de tempo sempre crescentes.
  lastTimestamp = Math.max(lastTimestamp + 1, performance.now())
  const result = detector.detectForVideo(source, lastTimestamp)
  return result.landmarks[0] ?? null
}
