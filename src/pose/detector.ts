import { FilesetResolver, ImageSegmenter, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Point } from './types'

const asset = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, window.location.href).href

let pending: Promise<PoseLandmarker> | null = null
let pendingMascara: Promise<PoseLandmarker> | null = null
let pendingFoto: Promise<PoseLandmarker> | null = null
let pendingSegmentador: Promise<ImageSegmenter> | null = null
let lastTimestamp = 0

async function criar(modo: 'VIDEO' | 'IMAGE', mascara = false): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(asset('mediapipe/wasm'))
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: asset('models/pose_landmarker_full.task'), delegate },
    runningMode: modo,
    numPoses: 1,
    outputSegmentationMasks: mascara,
  })
  try {
    return await PoseLandmarker.createFromOptions(vision, options('GPU'))
  } catch {
    return await PoseLandmarker.createFromOptions(vision, options('CPU'))
  }
}

/**
 * Carrega o modelo uma vez só. Ele roda no próprio aparelho: as fotos do
 * cliente não saem do celular para fazer a análise.
 */
export function loadDetector(): Promise<PoseLandmarker> {
  pending ??= criar('VIDEO')
  pending.catch(() => (pending = null))
  return pending
}

/** Detector que também recorta o contorno do corpo (usado no Teste de Adams). */
export function loadDetectorComMascara(): Promise<PoseLandmarker> {
  pendingMascara ??= criar('IMAGE', true)
  pendingMascara.catch(() => (pendingMascara = null))
  return pendingMascara
}

/**
 * Detector para fotos paradas (galeria ou foto tirada). O modo VIDEO segue a
 * pessoa de um quadro para o outro e, numa foto nova, procura no lugar onde a
 * pessoa estava no vídeo: a primeira tentativa falha. Por isso fotos usam o
 * modo IMAGE, que procura a pessoa na imagem inteira toda vez.
 */
export function loadDetectorFoto(): Promise<PoseLandmarker> {
  pendingFoto ??= criar('IMAGE')
  pendingFoto.catch(() => (pendingFoto = null))
  return pendingFoto
}

/** Detecta os pontos do corpo numa foto parada. */
export async function detectarFoto(source: HTMLCanvasElement | HTMLImageElement): Promise<Point[] | null> {
  const detector = await loadDetectorFoto()
  return detector.detect(source).landmarks[0] ?? null
}

export type Mascara = { dados: Float32Array; largura: number; altura: number }

/** Pontos do corpo e contorno da pessoa numa foto (0 a 1 em cada pixel). */
export function detectarComMascara(detector: PoseLandmarker, source: HTMLCanvasElement | HTMLImageElement): { landmarks: Point[]; mascara: Mascara } | null {
  const result = detector.detect(source)
  const m = result.segmentationMasks?.[0]
  const landmarks = result.landmarks[0]
  const mascara = m ? { dados: new Float32Array(m.getAsFloat32Array()), largura: m.width, altura: m.height } : null
  result.segmentationMasks?.forEach((x) => x.close())
  return landmarks && mascara ? { landmarks, mascara } : null
}

/** Detecta os pontos do corpo num quadro de vídeo, foto ou canvas. */
export function detectPose(detector: PoseLandmarker, source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Point[] | null {
  // O modo VIDEO exige carimbos de tempo sempre crescentes.
  lastTimestamp = Math.max(lastTimestamp + 1, performance.now())
  const result = detector.detectForVideo(source, lastTimestamp)
  return result.landmarks[0] ?? null
}

/**
 * Recorte da pessoa sem precisar achar os pontos do corpo. Com a cabeça para
 * baixo (Teste de Adams) o detector de pose às vezes não acha a pessoa.
 */
export function loadSegmentador(): Promise<ImageSegmenter> {
  pendingSegmentador ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(asset('mediapipe/wasm'))
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: asset('models/selfie_segmenter.tflite'), delegate },
      runningMode: 'IMAGE' as const,
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    })
    try {
      return await ImageSegmenter.createFromOptions(vision, options('GPU'))
    } catch {
      return await ImageSegmenter.createFromOptions(vision, options('CPU'))
    }
  })()
  pendingSegmentador.catch(() => (pendingSegmentador = null))
  return pendingSegmentador
}

export function segmentar(seg: ImageSegmenter, source: HTMLCanvasElement | HTMLImageElement): Mascara | null {
  const result = seg.segment(source)
  // O modelo de recorte devolve a chance de cada pixel ser pessoa na última máscara.
  const m = result.confidenceMasks?.[result.confidenceMasks.length - 1]
  const mascara = m ? { dados: new Float32Array(m.getAsFloat32Array()), largura: m.width, altura: m.height } : null
  result.close()
  return mascara
}
