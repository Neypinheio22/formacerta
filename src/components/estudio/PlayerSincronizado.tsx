import { useEffect, useMemo, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { detectPose, loadDetector } from '../../pose/detector'
import { drawSkeleton } from '../../pose/draw'
import { alinhar, formatarTempo } from '../../estudio/relogio'
import { nomeAngulo, type VideoAngulo } from '../../estudio/tipos'

type Props = { videos: VideoAngulo[] }

const VELOCIDADES = [1, 0.5, 0.25]
const TOLERANCIA = 0.08

/** Toca os ângulos lado a lado, alinhados no tempo, com câmera lenta e esqueleto opcional. */
export function PlayerSincronizado({ videos }: Props) {
  const refs = useRef<(HTMLVideoElement | null)[]>([])
  const telas = useRef<(HTMLCanvasElement | null)[]>([])
  const urls = useMemo(() => videos.map((v) => URL.createObjectURL(v.video)), [videos])
  const { desloca, duracao } = useMemo(() => alinhar(videos), [videos])
  const [tocando, setTocando] = useState(false)
  const [tempo, setTempo] = useState(0)
  const [velocidade, setVelocidade] = useState(1)
  const [esqueleto, setEsqueleto] = useState(false)
  const [detector, setDetector] = useState<PoseLandmarker | null>(null)

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])

  useEffect(() => {
    if (esqueleto && !detector) loadDetector().then(setDetector, () => setEsqueleto(false))
  }, [esqueleto, detector])

  const todos = () => refs.current.filter((v): v is HTMLVideoElement => !!v)

  function irPara(t: number) {
    setTempo(t)
    refs.current.forEach((v, i) => v && (v.currentTime = t + desloca[i]))
  }

  useEffect(() => {
    todos().forEach((v) => (v.playbackRate = velocidade))
  }, [velocidade])

  // Mantém todos juntos enquanto toca (o primeiro vídeo é o relógio).
  useEffect(() => {
    if (!tocando) return
    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      const lista = refs.current
      const mestre = lista[0]
      if (!mestre) return
      const t = mestre.currentTime - desloca[0]
      if (t >= duracao) {
        setTocando(false)
        todos().forEach((v) => v.pause())
        irPara(duracao)
        return
      }
      setTempo(t)
      lista.forEach((v, i) => {
        if (v && i > 0 && Math.abs(v.currentTime - (t + desloca[i])) > TOLERANCIA) v.currentTime = t + desloca[i]
      })
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [tocando, desloca, duracao])

  // Esqueleto por cima de cada vídeo.
  useEffect(() => {
    if (!esqueleto || !detector) {
      telas.current.forEach((c) => c?.getContext('2d')?.clearRect(0, 0, c.width, c.height))
      return
    }
    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      refs.current.forEach((v, i) => {
        const c = telas.current[i]
        if (!v || !c || v.readyState < 2) return
        c.width = v.videoWidth
        c.height = v.videoHeight
        const lm = detectPose(detector, v)
        const ctx = c.getContext('2d')!
        if (lm) drawSkeleton(ctx, lm, c.width, c.height)
        else ctx.clearRect(0, 0, c.width, c.height)
      })
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [esqueleto, detector])

  async function alternar() {
    if (tocando) {
      todos().forEach((v) => v.pause())
      setTocando(false)
      return
    }
    const inicio = tempo >= duracao - 0.05 ? 0 : tempo
    irPara(inicio)
    await Promise.all(todos().map((v) => v.play().catch(() => {})))
    setTocando(true)
  }

  return (
    <div className="player">
      <div className={`player-grade n${videos.length}`}>
        {videos.map((v, i) => (
          <div className="player-video" key={i}>
            <video
              ref={(el) => {
                refs.current[i] = el
              }}
              src={urls[i]}
              playsInline
              muted
              preload="auto"
              onLoadedMetadata={(e) => {
                const el = e.currentTarget
                el.playbackRate = velocidade
                el.currentTime = desloca[i]
              }}
            />
            <canvas
              ref={(el) => {
                telas.current[i] = el
              }}
            />
            <span className="selo-angulo">{nomeAngulo(v.angulo)}</span>
          </div>
        ))}
      </div>

      <div className="player-controles">
        <button className="botao-play" onClick={alternar} aria-label={tocando ? 'Pausar' : 'Tocar'}>
          {tocando ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={duracao}
          step={0.01}
          value={Math.min(tempo, duracao)}
          onChange={(e) => irPara(Number(e.target.value))}
          aria-label="Posição"
        />
        <span className="player-tempo">
          {formatarTempo(tempo)} / {formatarTempo(duracao)}
        </span>
      </div>

      <div className="timer">
        Velocidade:
        {VELOCIDADES.map((s) => (
          <button key={s} className={s === velocidade ? 'ativo' : ''} onClick={() => setVelocidade(s)}>
            {s === 1 ? 'Normal' : `${s}x`}
          </button>
        ))}
        <button className={esqueleto ? 'ativo' : ''} onClick={() => setEsqueleto(!esqueleto)}>
          Esqueleto
        </button>
      </div>
    </div>
  )
}
