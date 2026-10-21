import { useEffect, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { bodyVisible } from '../pose/analysis'
import { detectPose } from '../pose/detector'
import { drawSkeleton } from '../pose/draw'
import type { Point, ViewId } from '../pose/types'
import { speak } from '../voz'

export type Capture = { image: string; width: number; height: number; landmarks: Point[] | null }

type Props = {
  view: ViewId
  detector: PoseLandmarker
  onCapture: (c: Capture) => void
}

const LARGURA_MAX = 960

/** Reduz a foto e detecta o corpo nela. A foto guardada nunca é espelhada. */
function captureFrom(detector: PoseLandmarker, source: HTMLVideoElement | HTMLImageElement, w: number, h: number): Capture {
  const escala = Math.min(1, LARGURA_MAX / w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * escala)
  canvas.height = Math.round(h * escala)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return {
    image: canvas.toDataURL('image/jpeg', 0.8),
    width: canvas.width,
    height: canvas.height,
    landmarks: detectPose(detector, canvas),
  }
}

export function CameraCapture({ view, detector, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [timer, setTimer] = useState(10)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let frame = 0
    let cancelado = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        setCameraError('Não foi possível abrir a câmera. Libere o acesso no navegador ou envie uma foto da galeria.')
        return
      }
      if (cancelado) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current!
      video.srcObject = stream
      await video.play().catch(() => {})

      const loop = () => {
        if (cancelado) return
        const canvas = overlayRef.current
        if (video.readyState >= 2 && canvas) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const lm = detectPose(detector, video)
          const ctx = canvas.getContext('2d')!
          if (lm) drawSkeleton(ctx, lm, canvas.width, canvas.height)
          else ctx.clearRect(0, 0, canvas.width, canvas.height)
          setVisible(!!lm && bodyVisible(view, lm))
        }
        frame = requestAnimationFrame(loop)
      }
      loop()
    }
    start()

    return () => {
      cancelado = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing, detector, view])

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      const video = videoRef.current!
      speak('Pronto')
      onCapture(captureFrom(detector, video, video.videoWidth, video.videoHeight))
      setCountdown(null)
      return
    }
    if (countdown <= 3) speak(String(countdown))
    const id = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown, detector, onCapture])

  function startCountdown() {
    speak(`Foto em ${timer} segundos. Fique parado.`)
    setCountdown(timer)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.onload = () => {
      onCapture(captureFrom(detector, img, img.naturalWidth, img.naturalHeight))
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
    e.target.value = ''
  }

  const espelhar = facing === 'user'

  return (
    <div className="camera">
      <div className="camera-frame">
        {cameraError ? (
          <p className="camera-erro">{cameraError}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className={espelhar ? 'espelho' : ''} />
            <canvas ref={overlayRef} className={espelhar ? 'espelho' : ''} />
            <span className={`pill ${visible ? 'pill-ok' : 'pill-aviso'}`}>
              {visible ? 'Corpo inteiro visível' : 'Afaste-se até aparecer da cabeça aos pés'}
            </span>
            {countdown !== null && <span className="contagem">{countdown}</span>}
          </>
        )}
      </div>

      <div className="camera-controles">
        <label className="botao-sec">
          Galeria
          <input type="file" accept="image/*" onChange={onFile} hidden />
        </label>
        {!cameraError && (
          <button className="disparo" onClick={startCountdown} disabled={countdown !== null} aria-label="Tirar foto">
            <span />
          </button>
        )}
        {!cameraError && (
          <button className="botao-sec" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
            Virar
          </button>
        )}
      </div>

      {!cameraError && (
        <div className="timer">
          Temporizador:
          {[5, 10, 15].map((s) => (
            <button key={s} className={s === timer ? 'ativo' : ''} onClick={() => setTimer(s)}>
              {s} s
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
