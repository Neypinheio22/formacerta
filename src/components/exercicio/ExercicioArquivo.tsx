import { useEffect, useMemo, useRef, useState } from 'react'
import { montarResultado } from '../../movimento/analise'
import { ContadorReps } from '../../movimento/contador'
import { exercicioPorId } from '../../movimento/exercicios'
import type { ResultadoExercicio } from '../../movimento/tipos'
import { analisarVideo, liberarVideo } from '../../movimento/video'
import { loadDetector } from '../../pose/detector'
import { drawSkeleton } from '../../pose/draw'
import type { ConfigExercicio } from './ExercicioInicio'

type Props = ConfigExercicio & { arquivo: File; onCancel: () => void; onDone: (r: ResultadoExercicio) => void }

/** Analisa um vídeo da galeria quadro a quadro, mostrando o esqueleto enquanto lê. */
export function ExercicioArquivo({ exercicio, arquivo, onCancel, onDone }: Props) {
  const ex = exercicioPorId(exercicio)
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [progresso, setProgresso] = useState(0)
  const [reps, setReps] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciado, setIniciado] = useState(false)

  // Já carrega o modelo enquanto a pessoa não toca em começar.
  useEffect(() => void loadDetector().catch(() => {}), [])

  function comecar() {
    if (videoRef.current) liberarVideo(videoRef.current)
    setIniciado(true)
  }

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  useEffect(() => {
    if (!iniciado) return
    let cancelado = false
    const contador = new ContadorReps(ex.cima, ex.baixo)
    let n = 0
    ;(async () => {
      try {
        const detector = await loadDetector()
        const video = videoRef.current!
        const quadros = await analisarVideo(
          detector,
          ex,
          video,
          (q, p) => {
            const canvas = overlayRef.current
            if (canvas) {
              canvas.width = video.videoWidth
              canvas.height = video.videoHeight
              const ctx = canvas.getContext('2d')!
              if (q.lm) drawSkeleton(ctx, q.lm, canvas.width, canvas.height)
              else ctx.clearRect(0, 0, canvas.width, canvas.height)
            }
            if (contador.adicionar(q.t, q.medidas?.angulo)) setReps(++n)
            setProgresso(p)
          },
          () => cancelado,
        )
        if (cancelado) return
        if (quadros.length === 0) throw new Error('vazio')
        onDone(montarResultado(ex, quadros, video.videoWidth, video.videoHeight, arquivo))
      } catch {
        if (!cancelado) setErro('Não foi possível ler este vídeo. Tente outro arquivo (MP4 ou MOV) ou grave pelo app.')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [ex, iniciado, arquivo, onDone])

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onCancel}>
          ← Cancelar
        </button>
        <span className="passo">
          {ex.nome} · {ex.vista}
        </span>
      </header>

      <h1>Analisando o vídeo</h1>
      <p className="dica">Lendo quadro a quadro: medimos o {ex.articulacao.toLowerCase()} e o resto do corpo em cada instante do movimento.</p>

      {erro ? (
        <p className="camera-erro">{erro}</p>
      ) : (
        <>
          <div className="camera-frame">
            <video ref={videoRef} src={url} playsInline muted preload="auto" />
            <canvas ref={overlayRef} />
            {!iniciado && (
              <button className="botao grande comecar-analise" onClick={comecar}>
                Começar análise
              </button>
            )}
            <span className="contador-reps">{reps}</span>
          </div>
          <div className="barra">
            <span style={{ width: `${Math.round(progresso * 100)}%` }} />
          </div>
          <p className="dica-sec">{Math.round(progresso * 100)}% · {reps} repetições encontradas até agora</p>
        </>
      )}
    </div>
  )
}
