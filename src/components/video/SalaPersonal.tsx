import { Maximize2, Mic, MicOff, PhoneOff, RefreshCcw, Users, Video, VideoOff, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { emReais } from '../../nuvem/planos'
import { disponibilidade, encerrarVideo, relogio, segundosParaAtender, segundosRestantes, type Chamada, type RegrasVideo } from '../../nuvem/video'
import { abrirCamera, iniciarLigacao, novaTrilhaVideo, type EstadoLigacao, type Ligacao } from '../../video/ligacao'
import { useAgora, useToque } from './ganchos'

type Props = {
  meuId: string
  /** Alunos na sala agora. */
  sala: Chamada[]
  /** Alunos chamando para entrar. */
  fila: Chamada[]
  regras: RegrasVideo
  erro: string | null
  onResponder: (id: string, aceitar: boolean) => void
  onAtualizar: () => void
}

type Quadro = {
  chamada: Chamada
  local: MediaStream
  foco: boolean
  mudo: boolean
  agora: number
  onFoco: () => void
  onMudo: () => void
  onEncerrar: () => void
  onLigacao: (l: Ligacao | null) => void
}

/** Um aluno da sala: a imagem dele, o nome e o tempo que falta. */
function QuadroAluno({ chamada, local, foco, mudo, agora, onFoco, onMudo, onEncerrar, onLigacao }: Quadro) {
  const video = useRef<HTMLVideoElement>(null)
  const [estado, setEstado] = useState<EstadoLigacao>('conectando')
  const restante = segundosRestantes(chamada, agora)

  useEffect(() => {
    let vivo = true
    let lig: Ligacao | null = null
    const parar = new AbortController()
    iniciarLigacao(
      chamada.id,
      'personal',
      {
        aoEstado: (e) => vivo && setEstado(e),
        aoRemoto: (s) => {
          if (vivo && video.current) video.current.srcObject = s
        },
      },
      parar.signal,
      local,
    )
      .then((l) => {
        if (!vivo) return l.fechar()
        lig = l
        onLigacao(l)
      })
      .catch(() => {})
    return () => {
      vivo = false
      parar.abort()
      lig?.fechar()
      onLigacao(null)
    }
    // onLigacao muda a cada render; a ligação só depende da chamada e da câmera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamada.id, local])

  // Acabou o tempo deste aluno: sai da sala sozinho (uma vez só).
  const saiu = useRef(false)
  useEffect(() => {
    if (restante > 0 || saiu.current) return
    saiu.current = true
    onEncerrar()
  }, [restante, onEncerrar])

  return (
    <div className={`sala-quadro ${foco ? 'foco' : ''}`}>
      <video ref={video} autoPlay playsInline muted={mudo} onClick={onFoco} />
      <div className="sala-quadro-topo">
        <strong>{chamada.aluno_nome.split(' ')[0]}</strong>
        <span className={`chamada-tempo ${restante <= 60 ? 'acabando' : ''}`}>{relogio(restante)}</span>
      </div>
      {estado !== 'conectado' && <span className="sala-quadro-estado">{estado === 'reconectando' ? 'Reconectando…' : 'Conectando…'}</span>}
      <div className="sala-quadro-botoes">
        <button aria-label={foco ? 'Voltar para a grade' : `Ver ${chamada.aluno_nome} em destaque`} onClick={onFoco}>
          <Maximize2 size={16} />
        </button>
        <button aria-label={mudo ? `Ouvir ${chamada.aluno_nome}` : `Silenciar ${chamada.aluno_nome}`} onClick={onMudo}>
          {mudo ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button className="sair" aria-label={`Encerrar a chamada de ${chamada.aluno_nome}`} onClick={onEncerrar}>
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * Sala de treino do personal: até 5 alunos ao mesmo tempo, cada um no seu
 * quadro. Toque num aluno para ver em destaque; silencie quem estiver com
 * barulho; quem chega toca dentro da própria sala.
 */
export function SalaPersonal({ meuId, sala, fila, regras, erro, onResponder, onAtualizar }: Props) {
  const [local, setLocal] = useState<MediaStream | null>(null)
  const [semCamera, setSemCamera] = useState(false)
  const [frente, setFrente] = useState(true)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [foco, setFoco] = useState<string | null>(null)
  const [mudos, setMudos] = useState<Set<string>>(new Set())
  const [vagas, setVagas] = useState(1)
  const meu = useRef<HTMLVideoElement>(null)
  const ligacoes = useRef(new Map<string, Ligacao>())
  const agora = useAgora(true)
  useToque(fila.length > 0)

  // Uma câmera só para todos os alunos.
  useEffect(() => {
    let vivo = true
    let aberta: MediaStream | null = null
    abrirCamera(true)
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop())
        aberta = s
        setLocal(s)
      })
      .catch(() => setSemCamera(true))
    disponibilidade(meuId).then((d) => vivo && setVagas(d?.vagas ?? 1))
    return () => {
      vivo = false
      aberta?.getTracks().forEach((t) => t.stop())
    }
  }, [meuId])

  useEffect(() => {
    if (meu.current && local) meu.current.srcObject = local
  }, [local])

  const encerrar = useCallback(
    async (c: Chamada) => {
      await encerrarVideo(c.id)
      onAtualizar()
    },
    [onAtualizar],
  )

  async function encerrarTodos() {
    if (!confirm(`Encerrar a chamada de ${sala.length === 1 ? sala[0].aluno_nome : `todos os ${sala.length} alunos`}?`)) return
    await Promise.all(sala.map((c) => encerrarVideo(c.id)))
    onAtualizar()
  }

  async function virar() {
    if (!local) return
    let trilha: MediaStreamTrack
    try {
      trilha = await novaTrilhaVideo(!frente)
    } catch {
      return
    }
    const velha = local.getVideoTracks()[0]
    trilha.enabled = velha?.enabled ?? true
    await Promise.all([...ligacoes.current.values()].map((l) => l.trocarVideo(trilha)))
    if (velha) {
      local.removeTrack(velha)
      velha.stop()
    }
    local.addTrack(trilha)
    setFrente(!frente)
  }

  const destaque = sala.some((c) => c.id === foco) ? foco : null

  return (
    <div className={`sala-tela ${destaque ? 'com-foco' : ''}`}>
      <header className="sala-topo">
        <strong>
          <Users size={16} /> Sala de treino
        </strong>
        <span className="sala-topo-direita">
          <span className="chip">
            {sala.length}/{Math.max(vagas, sala.length)} aluno{vagas > 1 ? 's' : ''}
          </span>
          <video ref={meu} className="sala-meu" autoPlay playsInline muted aria-label="Sua câmera" />
        </span>
      </header>

      {fila.map((c) => (
        <div key={c.id} className="sala-chegando">
          <span>
            <Video size={16} className="verde pulsando" /> <b>{c.aluno_nome}</b> quer entrar · {c.minutos} min · você recebe {emReais(Math.max(0, c.valor - c.comissao - regras.taxa_video))} ·{' '}
            {relogio(segundosParaAtender(c, agora))}
          </span>
          <span className="acoes-linha">
            <button className="botao" onClick={() => onResponder(c.id, true)}>
              Atender
            </button>
            <button className="botao-sec" onClick={() => onResponder(c.id, false)}>
              Agora não
            </button>
          </span>
        </div>
      ))}
      {erro && <p className="mensagem erro">{erro}</p>}
      {semCamera && <p className="mensagem erro">Libere a câmera e o microfone para o FormaCerta nas configurações do navegador.</p>}

      <div className={`sala-grade n-${sala.length}`}>
        {local &&
          sala.map((c) => (
            <QuadroAluno
              key={c.id}
              chamada={c}
              local={local}
              foco={destaque === c.id}
              mudo={mudos.has(c.id)}
              agora={agora}
              onFoco={() => setFoco(destaque === c.id ? null : c.id)}
              onMudo={() =>
                setMudos((m) => {
                  const n = new Set(m)
                  if (n.has(c.id)) n.delete(c.id)
                  else n.add(c.id)
                  return n
                })
              }
              onEncerrar={() => encerrar(c)}
              onLigacao={(l) => {
                if (l) ligacoes.current.set(c.id, l)
                else ligacoes.current.delete(c.id)
              }}
            />
          ))}
      </div>

      <div className="chamada-botoes">
        <button
          className={`redondo ${mic ? '' : 'desligado'}`}
          aria-label={mic ? 'Desligar microfone' : 'Ligar microfone'}
          onClick={() => {
            local?.getAudioTracks().forEach((t) => (t.enabled = !mic))
            setMic(!mic)
          }}
        >
          {mic ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        <button
          className={`redondo ${cam ? '' : 'desligado'}`}
          aria-label={cam ? 'Desligar câmera' : 'Ligar câmera'}
          onClick={() => {
            local?.getVideoTracks().forEach((t) => (t.enabled = !cam))
            setCam(!cam)
          }}
        >
          {cam ? <Video size={22} /> : <VideoOff size={22} />}
        </button>
        <button className="redondo" aria-label="Virar a câmera" onClick={virar}>
          <RefreshCcw size={22} />
        </button>
        <button className="redondo encerrar" aria-label="Encerrar a sala" onClick={encerrarTodos}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  )
}
