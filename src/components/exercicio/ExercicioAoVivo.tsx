import { useEffect, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { gravar, manterTelaAcesa } from '../../estudio/gravador'
import { avaliarRep, montarResultado } from '../../movimento/analise'
import { ContadorReps } from '../../movimento/contador'
import { exercicioPorId } from '../../movimento/exercicios'
import type { Fase, Quadro, Repeticao, ResultadoExercicio } from '../../movimento/tipos'
import { analisarQuadro } from '../../movimento/video'
import { loadDetector } from '../../pose/detector'
import { drawSkeleton } from '../../pose/draw'
import { speak } from '../../voz'
import type { ConfigExercicio } from './ExercicioInicio'

type Props = ConfigExercicio & { onCancel: () => void; onDone: (r: ResultadoExercicio) => void }

type Estado = 'pronto' | 'contagem' | 'gravando' | 'finalizando'

const CONTAGEM = 5

const NOME_FASE: Record<Fase, string> = { aguardando: 'Fique na posição inicial', 'em-cima': 'Posição inicial', descendo: 'Descendo', subindo: 'Subindo' }

const NUMEROS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze']

export function ExercicioAoVivo({ exercicio, alvo, onCancel, onDone }: Props) {
  const ex = exercicioPorId(exercicio)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessao = useRef<{ inicio: number; quadros: Quadro[]; contador: ContadorReps; reps: number; parar?: () => Promise<{ video: Blob; inicio: number }> } | null>(null)

  const [detector, setDetector] = useState<PoseLandmarker | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [estado, setEstado] = useState<Estado>('pronto')
  const [countdown, setCountdown] = useState(CONTAGEM)
  const [angulo, setAngulo] = useState<number | null>(null)
  const [fase, setFase] = useState<Fase>('aguardando')
  const [reps, setReps] = useState(0)
  const [ultima, setUltima] = useState<Repeticao | null>(null)

  useEffect(() => {
    loadDetector().then(setDetector, () => setLoadError(true))
  }, [])

  async function finalizar() {
    const s = sessao.current
    if (!s) return
    sessao.current = null
    setEstado('finalizando')
    const video = videoRef.current!
    let blob: Blob | undefined
    let quadros = s.quadros
    try {
      const g = await s.parar?.()
      if (g) {
        blob = g.video
        // Alinha os quadros com o começo real do vídeo gravado.
        const ajuste = (s.inicio - g.inicio) / 1000
        quadros = quadros.map((q) => ({ ...q, t: Math.max(0, q.t + ajuste) }))
      }
    } catch {
      /* fica sem o vídeo, mas com a análise */
    }
    speak('Pronto')
    onDone(montarResultado(ex, quadros, video.videoWidth, video.videoHeight, blob))
  }
  const finalizarRef = useRef(finalizar)
  useEffect(() => {
    finalizarRef.current = finalizar
  })

  // Câmera e análise quadro a quadro.
  useEffect(() => {
    if (!detector) return
    let stream: MediaStream | null = null
    let frame = 0
    let cancelado = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        })
      } catch {
        setCameraError('Não foi possível abrir a câmera. Libere o acesso no navegador ou envie um vídeo da galeria.')
        return
      }
      if (cancelado) return stream.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play().catch(() => {})

      const loop = () => {
        if (cancelado) return
        frame = requestAnimationFrame(loop)
        const canvas = overlayRef.current
        if (video.readyState < 2 || !canvas || !detector) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const s = sessao.current
        const q = analisarQuadro(detector, ex, video, s ? (Date.now() - s.inicio) / 1000 : 0)
        const ctx = canvas.getContext('2d')!
        if (q.lm) drawSkeleton(ctx, q.lm, canvas.width, canvas.height)
        else ctx.clearRect(0, 0, canvas.width, canvas.height)
        setAngulo(q.medidas ? Math.round(q.medidas.angulo) : null)
        if (!s) return

        s.quadros.push(q)
        const bruta = s.contador.adicionar(q.t, q.medidas?.angulo)
        setFase(s.contador.fase)
        if (!bruta) return
        s.reps += 1
        const rep = avaliarRep(ex, s.reps, bruta, s.quadros)
        setReps(s.reps)
        setUltima(rep)
        const erro = rep.achados.find((a) => a.status === 'alerta') ?? rep.achados.find((a) => a.status === 'atencao')
        speak([NUMEROS[s.reps] ?? String(s.reps), erro?.fala].filter(Boolean).join('. '))
        if (s.reps >= alvo) setTimeout(() => finalizarRef.current(), 1200)
      }
      loop()
    }
    start()

    return () => {
      cancelado = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing, detector, ex, alvo])

  // Contagem regressiva com voz, depois começa a gravar.
  useEffect(() => {
    if (estado !== 'contagem') return
    if (countdown === 0) {
      let parar: (() => Promise<{ video: Blob; inicio: number }>) | undefined
      try {
        if (streamRef.current && typeof MediaRecorder !== 'undefined') parar = gravar(streamRef.current).parar
      } catch {
        /* navegador sem gravação: analisa mesmo assim */
      }
      sessao.current = { inicio: Date.now(), quadros: [], contador: new ContadorReps(ex.cima, ex.baixo), reps: 0, parar }
      setEstado('gravando')
      speak('Vai')
      return
    }
    if (countdown <= 3) speak(String(countdown))
    const id = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(id)
  }, [estado, countdown, ex])

  // Tela acesa enquanto o celular está apoiado.
  useEffect(() => {
    let soltar = () => {}
    manterTelaAcesa().then((f) => (soltar = f))
    return () => soltar()
  }, [])

  function comecar() {
    speak(`Comece em ${CONTAGEM} segundos. ${ex.nome}, ${alvo} repetições.`)
    setReps(0)
    setUltima(null)
    setCountdown(CONTAGEM)
    setEstado('contagem')
  }

  const espelhar = facing === 'user'
  const gravando = estado === 'gravando'
  const corpoOk = angulo !== null

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onCancel} disabled={estado === 'finalizando'}>
          ← Sair
        </button>
        <span className="passo">
          {ex.nome} · {ex.vista}
        </span>
      </header>

      <p className="dica-sec">{ex.dica}</p>

      {loadError && <p className="camera-erro">Não foi possível carregar a análise. Verifique a internet e recarregue a página.</p>}
      {!loadError && !detector && <p className="carregando">Preparando a análise de movimento…</p>}

      {detector && (
        <div className="camera">
          <div className={`camera-frame ${gravando ? 'gravando' : ''}`}>
            {cameraError ? (
              <p className="camera-erro">{cameraError}</p>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className={espelhar ? 'espelho' : ''} />
                <canvas ref={overlayRef} className={espelhar ? 'espelho' : ''} />
                <span className={`pill ${corpoOk ? 'pill-ok' : 'pill-aviso'}`}>
                  {!corpoOk ? 'Afaste-se até aparecer o corpo inteiro' : gravando ? `${NOME_FASE[fase]} · ${ex.articulacao} ${angulo}°` : `${ex.articulacao} ${angulo}°`}
                </span>
                {estado === 'contagem' && <span className="contagem">{countdown}</span>}
                {(gravando || estado === 'finalizando') && (
                  <span className="contador-reps">
                    {reps}
                    <small>/{alvo}</small>
                  </span>
                )}
              </>
            )}
          </div>

          {ultima && (
            <p className={`retorno-rep chip-${ultima.status}`}>
              Rep {ultima.n}:{' '}
              {ultima.status === 'ok' ? 'boa!' : (ultima.achados.find((a) => a.status === 'alerta') ?? ultima.achados.find((a) => a.status === 'atencao'))?.detail}
            </p>
          )}

          {!cameraError && (
            <div className="gravar-estudio">
              {gravando ? (
                <button className="disparo parar" onClick={finalizar} aria-label="Parar">
                  <span />
                </button>
              ) : (
                <button className="disparo" onClick={comecar} disabled={estado !== 'pronto'} aria-label="Começar">
                  <span />
                </button>
              )}
              <span className="dica-sec">
                {estado === 'pronto' && 'Toque para começar. Você terá 5 segundos para se posicionar.'}
                {estado === 'contagem' && 'Vá para a posição inicial…'}
                {gravando && `Faça ${alvo} repetições. Paramos sozinhos ao terminar.`}
                {estado === 'finalizando' && 'Montando o resultado…'}
              </span>
              {estado === 'pronto' && (
                <button className="botao-sec" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
                  Virar câmera
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
