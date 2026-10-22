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

type Fonte = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement

/**
 * Pontos na imagem (0 a 1) e também em 3D (metros, centro no quadril). O 3D
 * mede o ângulo do joelho mesmo quando a pessoa está de frente para a câmera.
 */
export function detectPoseCompleta(detector: PoseLandmarker, source: Fonte): { lm: Point[]; mundo: Point[] | null } | null {
  // O modo VIDEO exige carimbos de tempo sempre crescentes.
  lastTimestamp = Math.max(lastTimestamp + 1, performance.now())
  const result = detector.detectForVideo(source, lastTimestamp)
  const lm = result.landmarks[0]
  return lm ? { lm, mundo: result.worldLandmarks[0] ?? null } : null
}

/** Detecta os pontos do corpo num quadro de vídeo, foto ou canvas. */
export function detectPose(detector: PoseLandmarker, source: Fonte): Point[] | null {
  return detectPoseCompleta(detector, source)?.lm ?? null
}
