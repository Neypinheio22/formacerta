import { useEffect, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { bodyVisible } from '../../pose/analysis'
import { detectPose, loadDetector } from '../../pose/detector'
import { drawSkeleton } from '../../pose/draw'
import type { Canal } from '../../estudio/conexao'
import { abrirCamera, enviarVideo, gravar, manterTelaAcesa, type Gravacao } from '../../estudio/gravador'
import { diferencaRelogio, type Amostra } from '../../estudio/relogio'
import { nomeAngulo, type Angulo, type EstadoCamera, type Mensagem } from '../../estudio/tipos'

type Props = {
  canal: Canal
  angulo: Angulo
  /** Versão menor, usada quando o celular de controle também grava. */
  compacto?: boolean
}

const TEXTO: Record<EstadoCamera, string> = {
  pronta: 'Pronta. Aguardando o controle.',
  'sem-camera': 'Câmera bloqueada. Libere o acesso no navegador.',
  gravando: 'Gravando',
  enviando: 'Enviando o vídeo para o controle…',
}

/**
 * Um celular câmera do estúdio: mostra a imagem para enquadrar e grava
 * quando o celular de controle mandar, no mesmo instante que os outros.
 */
export function PainelCamera({ canal, angulo, compacto }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [lado, setLado] = useState<'user' | 'environment'>('environment')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [estado, setEstado] = useState<EstadoCamera>('pronta')
  const [progresso, setProgresso] = useState(0)
  const [visivel, setVisivel] = useState(false)
  const [detector, setDetector] = useState<PoseLandmarker | null>(null)
  const [ultima, setUltima] = useState<Gravacao | null>(null)
  const [armada, setArmada] = useState(false)
  const estadoRef = useRef(estado)
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  useEffect(() => {
    if (!compacto) loadDetector().then(setDetector, () => {})
  }, [compacto])

  // Abre a câmera.
  useEffect(() => {
    let s: MediaStream | null = null
    let cancelado = false
    abrirCamera(lado).then(
      (novo) => {
        if (cancelado) return novo.getTracks().forEach((t) => t.stop())
        s = novo
        setStream(novo)
      },
      () => setEstado('sem-camera'),
    )
    return () => {
      cancelado = true
      s?.getTracks().forEach((t) => t.stop())
    }
  }, [lado])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !stream) return
    v.srcObject = stream
    v.play().catch(() => {})
  }, [stream])

  useEffect(() => {
    let solta = () => {}
    manterTelaAcesa().then((f) => (solta = f))
    return () => solta()
  }, [])

  // Esqueleto para ajudar a enquadrar. Para de analisar assim que a gravação é marcada,
  // para o celular estar livre e começar na hora certa.
  useEffect(() => {
    if (!detector || !stream || armada || estado === 'gravando') {
      overlayRef.current?.getContext('2d')?.clearRect(0, 0, 9999, 9999)
      return
    }
    let frame = 0
    let ultimo = 0
    const loop = (agora: number) => {
      frame = requestAnimationFrame(loop)
      const video = videoRef.current
      const canvas = overlayRef.current
      if (!video || !canvas || video.readyState < 2 || agora - ultimo < 100) return
      ultimo = agora
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const lm = detectPose(detector, video)
      const ctx = canvas.getContext('2d')!
      if (lm) drawSkeleton(ctx, lm, canvas.width, canvas.height)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
      setVisivel(!!lm && bodyVisible(angulo === 'lateral' ? 'lateral-direita' : angulo, lm))
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [detector, stream, armada, estado, angulo])

  // Conversa com o controle.
  useEffect(() => {
    if (!stream) return
    let diferenca = 0
    const amostras: Amostra[] = []
    let gravacao: ReturnType<typeof gravar> | null = null
    let take = ''
    let espera = 0
    let pingId = 0

    const mudar = (e: EstadoCamera) => {
      if (e === 'pronta') setArmada(false)
      setEstado(e)
      canal.enviar({ t: 'estado', estado: e })
    }

    // Acerta o relógio com o do controle, para todos começarem juntos.
    const sincronizar = () => {
      for (let i = 0; i < 6; i++) setTimeout(() => canal.enviar({ t: 'ping', id: ++pingId, enviado: Date.now() }), i * 120)
    }

    canal.aoReceber(async (m: Mensagem) => {
      if (m.t === 'pong') {
        amostras.push({ enviado: m.enviado, controle: m.controle, recebido: Date.now() })
        if (amostras.length > 12) amostras.shift()
        diferenca = diferencaRelogio(amostras)
      } else if (m.t === 'gravar') {
        take = m.take
        setArmada(true)
        clearTimeout(espera)
        espera = window.setTimeout(
          () => {
            gravacao = gravar(stream)
            mudar('gravando')
          },
          Math.max(0, m.em - diferenca - Date.now()),
        )
      } else if (m.t === 'parar' && m.take === take) {
        clearTimeout(espera)
        if (!gravacao) return mudar('pronta')
        const g = await gravacao.parar()
        gravacao = null
        setUltima(g)
        mudar('enviando')
        await enviarVideo(canal, take, g, g.inicio + diferenca, setProgresso)
      } else if (m.t === 'recebido' && m.take === take) {
        mudar('pronta')
      } else if (m.t === 'cancelar') {
        clearTimeout(espera)
        await gravacao?.parar()
        gravacao = null
        mudar('pronta')
      }
    })

    canal.enviar({ t: 'ola', angulo, aparelho: navigator.userAgent })
    canal.enviar({ t: 'estado', estado: estadoRef.current })
    sincronizar()
    const resync = setInterval(() => estadoRef.current === 'pronta' && sincronizar(), 15000)
    return () => {
      clearInterval(resync)
      clearTimeout(espera)
      gravacao?.parar()
    }
  }, [canal, stream, angulo])

  function baixar() {
    if (!ultima) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(ultima.video)
    a.download = `formacerta-${angulo}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${ultima.video.type.includes('mp4') ? 'mp4' : 'webm'}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10000)
  }

  const espelhar = lado === 'user'

  return (
    <div className={`painel-camera ${compacto ? 'compacto' : ''}`}>
      <div className={`camera-frame ${estado === 'gravando' ? 'gravando' : ''}`}>
        {estado === 'sem-camera' ? (
          <p className="camera-erro">{TEXTO['sem-camera']}</p>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className={espelhar ? 'espelho' : ''} />
            <canvas ref={overlayRef} className={espelhar ? 'espelho' : ''} />
            <span className="selo-angulo">{nomeAngulo(angulo)}</span>
            {estado === 'gravando' ? (
              <span className="pill pill-rec">● Gravando</span>
            ) : (
              detector && (
                <span className={`pill ${visivel ? 'pill-ok' : 'pill-aviso'}`}>
                  {visivel ? 'Corpo inteiro visível' : 'Ajuste até aparecer da cabeça aos pés'}
                </span>
              )
            )}
          </>
        )}
      </div>
      {estado !== 'gravando' && estado !== 'sem-camera' && (
        <p className="dica-sec estado-camera">
          {estado === 'enviando' ? `${TEXTO.enviando} ${Math.round(progresso * 100)}%` : TEXTO[estado]}
        </p>
      )}
      {!compacto && (
        <div className="acoes">
          <button className="botao-sec" onClick={() => setLado(lado === 'user' ? 'environment' : 'user')} disabled={estado === 'gravando'}>
            Virar câmera
          </button>
          <button className="botao-sec" onClick={baixar} disabled={!ultima}>
            Baixar último vídeo
          </button>
        </div>
      )}
    </div>
  )
}
