import { useEffect, useRef, useState } from 'react'
import { analisarCorrida } from '../../corrida/analise'
import { lerCorrida } from '../../corrida/leitura'
import type { ConfigCorrida, ResultadoCorrida } from '../../corrida/tipos'
import { loadDetector } from '../../pose/detector'
import { desenharCorredor, useUrlDoArquivo } from './desenho'

type Props = { config: ConfigCorrida; arquivo: File; onCancel: () => void; onDone: (r: ResultadoCorrida) => void }

/** Lê o vídeo da corrida quadro a quadro, mostrando o esqueleto enquanto analisa. */
export function CorridaArquivo({ config, arquivo, onCancel, onDone }: Props) {
  const url = useUrlDoArquivo(arquivo)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelado = false
    ;(async () => {
      try {
        const detector = await loadDetector()
        const video = videoRef.current!
        const quadros = await lerCorrida(
          detector,
          video,
          (q, p) => {
            const canvas = overlayRef.current
            if (canvas) {
              canvas.width = video.videoWidth
              canvas.height = video.videoHeight
              desenharCorredor(canvas.getContext('2d')!, q.lm, canvas.width, canvas.height)
            }
            setProgresso(p)
          },
          () => cancelado,
        )
        if (cancelado) return
        if (quadros.length === 0) throw new Error('vazio')
        onDone(analisarCorrida(quadros, video.videoWidth, video.videoHeight, config, arquivo))
      } catch {
        if (!cancelado) setErro('Não foi possível ler este vídeo. Tente outro arquivo (MP4 ou MOV).')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [url, config, arquivo, onDone])

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onCancel}>
          ← Cancelar
        </button>
        <span className="passo">Corrida · {config.vista === 'lado' ? 'de lado' : 'de trás'}</span>
      </header>

      <h1>Analisando a corrida</h1>
      <p className="dica">Lendo quadro a quadro: achamos cada passo e medimos o corpo no momento em que o pé toca o chão.</p>

      {erro ? (
        <p className="camera-erro">{erro}</p>
      ) : (
        <>
          <div className="camera-frame">
            <video ref={videoRef} src={url ?? undefined} playsInline muted preload="auto" />
            <canvas ref={overlayRef} />
          </div>
          <div className="barra">
            <span style={{ width: `${Math.round(progresso * 100)}%` }} />
          </div>
          <p className="dica-sec">{Math.round(progresso * 100)}%</p>
        </>
      )}
    </div>
  )
}
