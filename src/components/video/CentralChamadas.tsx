import { Mic, MicOff, PhoneOff, RefreshCcw, Star, Video, VideoOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import { emReais } from '../../nuvem/planos'
import {
  atenderVideo,
  avaliarVideo,
  desistirVideo,
  encerrarVideo,
  lerRegrasVideo,
  minhasChamadas,
  relogio,
  REGRAS_PADRAO,
  segundosParaAtender,
  segundosRestantes,
  type Chamada,
  type RegrasVideo,
} from '../../nuvem/video'
import { iniciarLigacao, type EstadoLigacao, type Ligacao } from '../../video/ligacao'

/** Toque de chamada simples, feito pelo próprio navegador. */
function useToque(tocando: boolean) {
  useEffect(() => {
    if (!tocando) return
    let ctx: AudioContext | null = null
    try {
      ctx = new AudioContext()
    } catch {
      ctx = null
    }
    const tocar = () => {
      navigator.vibrate?.([400, 200, 400])
      if (!ctx) return
      for (const [i, f] of [880, 660].entries()) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.value = f
        g.gain.value = 0.15
        o.connect(g).connect(ctx.destination)
        o.start(ctx.currentTime + i * 0.25)
        o.stop(ctx.currentTime + i * 0.25 + 0.2)
      }
    }
    tocar()
    const vez = setInterval(tocar, 1800)
    return () => {
      clearInterval(vez)
      ctx?.close()
    }
  }, [tocando])
}

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const vez = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(vez)
  }, [ativo])
  return agora
}

const ROTULO_LIGACAO: Record<EstadoLigacao, string> = {
  'abrindo-camera': 'Abrindo a câmera…',
  conectando: 'Conectando…',
  conectado: '',
  reconectando: 'Reconectando…',
  erro: '',
}

/** A chamada em andamento: imagem do outro em tela cheia, a sua no canto e o tempo que falta. */
function TelaChamada({ chamada, souAluno, onFim }: { chamada: Chamada; souAluno: boolean; onFim: () => void }) {
  const remoto = useRef<HTMLVideoElement>(null)
  const meu = useRef<HTMLVideoElement>(null)
  const ligacao = useRef<Ligacao | null>(null)
  const [estado, setEstado] = useState<EstadoLigacao>('abrindo-camera')
  const [detalhe, setDetalhe] = useState('')
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const agora = useAgora(true)
  const restante = segundosRestantes(chamada, agora)
  const outro = souAluno ? chamada.profissional_nome : chamada.aluno_nome

  useEffect(() => {
    let vivo = true
    const parar = new AbortController()
    iniciarLigacao(chamada.id, souAluno ? 'aluno' : 'personal', {
      aoEstado: (e, d) => {
        if (!vivo) return
        setEstado(e)
        setDetalhe(d ?? '')
      },
      aoRemoto: (s) => {
        if (vivo && remoto.current) remoto.current.srcObject = s
      },
      aoLocal: (s) => {
        if (vivo && meu.current) meu.current.srcObject = s
      },
    }, parar.signal)
      .then((l) => {
        if (!vivo) return l.fechar()
        ligacao.current = l
        if (meu.current) meu.current.srcObject = l.local
      })
      .catch(() => {})
    return () => {
      vivo = false
      parar.abort()
      ligacao.current?.fechar()
      ligacao.current = null
    }
  }, [chamada.id, souAluno])

  const encerrar = useCallback(async () => {
    ligacao.current?.fechar()
    ligacao.current = null
    await encerrarVideo(chamada.id)
    onFim()
  }, [chamada.id, onFim])

  // Acabou o tempo pago: encerra sozinha.
  useEffect(() => {
    if (restante <= 0) encerrar()
  }, [restante, encerrar])

  return (
    <div className="chamada-tela">
      <video ref={remoto} className="chamada-remoto" autoPlay playsInline />
      <video ref={meu} className="chamada-meu" autoPlay playsInline muted />
      <header className="chamada-topo">
        <strong>{outro}</strong>
        <span className={`chamada-tempo ${restante <= 60 ? 'acabando' : ''}`}>{relogio(restante)}</span>
      </header>
      {estado !== 'conectado' && <p className="chamada-estado">{detalhe || ROTULO_LIGACAO[estado]}</p>}
      {restante <= 60 && restante > 0 && <p className="chamada-aviso">Falta menos de 1 minuto</p>}
      <div className="chamada-botoes">
        <button
          className={`redondo ${mic ? '' : 'desligado'}`}
          aria-label={mic ? 'Desligar microfone' : 'Ligar microfone'}
          onClick={() => {
            ligacao.current?.ligarMicrofone(!mic)
            setMic(!mic)
          }}
        >
          {mic ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        <button
          className={`redondo ${cam ? '' : 'desligado'}`}
          aria-label={cam ? 'Desligar câmera' : 'Ligar câmera'}
          onClick={() => {
            ligacao.current?.ligarCamera(!cam)
            setCam(!cam)
          }}
        >
          {cam ? <Video size={22} /> : <VideoOff size={22} />}
        </button>
        <button className="redondo" aria-label="Virar a câmera" onClick={() => ligacao.current?.virarCamera()}>
          <RefreshCcw size={22} />
        </button>
        <button className="redondo encerrar" aria-label="Encerrar chamada" onClick={encerrar}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  )
}

type Aviso = { tipo: 'nao-atendeu' | 'recusou' | 'nota' | 'fim-personal'; chamada: Chamada }

/**
 * Fica por cima de qualquer tela: toca no celular do personal quando um aluno
 * chama, mostra "Chamando…" para o aluno e abre a chamada quando ela começa.
 */
export function CentralChamadas({ perfil }: { perfil: Perfil }) {
  const [ativa, setAtiva] = useState<Chamada | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [regras, setRegras] = useState<RegrasVideo>(REGRAS_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [nota, setNota] = useState(0)
  const anterior = useRef<Chamada | null>(null)
  const aluno = perfil.papel === 'aluno'

  const ler = useCallback(async () => {
    const lista = await minhasChamadas()
    const minhas = lista.filter((c) => c.aluno_id === perfil.id || c.profissional_id === perfil.id)
    const agora = minhas.find((c) => c.situacao === 'em_andamento') ?? minhas.find((c) => c.situacao === 'chamando') ?? null
    const antes = anterior.current
    // A chamada que estava na tela mudou de situação.
    if (antes && antes.id !== agora?.id) {
      const nova = minhas.find((c) => c.id === antes.id)
      if (antes.situacao === 'chamando' && nova?.situacao === 'credito' && aluno)
        setAviso({ tipo: segundosParaAtender(antes) > 3 ? 'recusou' : 'nao-atendeu', chamada: antes })
      if (antes.situacao === 'em_andamento' && nova?.situacao === 'feita') setAviso({ tipo: aluno ? 'nota' : 'fim-personal', chamada: nova })
    }
    anterior.current = agora
    setAtiva(agora)
  }, [perfil.id, aluno])

  useEffect(() => {
    lerRegrasVideo().then(setRegras)
  }, [])

  // Com chamada na tela olha a cada 3 segundos; o personal a cada 5 (para tocar); o aluno a cada 20.
  useEffect(() => {
    ler()
    const vez = setInterval(ler, ativa ? 3000 : aluno ? 20000 : 5000)
    window.addEventListener('formacerta:chamada', ler)
    return () => {
      clearInterval(vez)
      window.removeEventListener('formacerta:chamada', ler)
    }
  }, [ler, ativa, aluno])

  const souAlunoDaAtiva = ativa?.aluno_id === perfil.id
  const tocando = ativa?.situacao === 'chamando' && !souAlunoDaAtiva
  useToque(tocando)
  const agora = useAgora(ativa?.situacao === 'chamando')

  async function responder(aceitar: boolean) {
    if (!ativa) return
    setErro(null)
    const e = await atenderVideo(ativa.id, aceitar)
    if (e) setErro(e)
    ler()
  }

  async function desistir() {
    if (!ativa) return
    await desistirVideo(ativa.id)
    anterior.current = null
    ler()
  }

  if (ativa?.situacao === 'em_andamento')
    return (
      <TelaChamada
        key={ativa.id}
        chamada={ativa}
        souAluno={souAlunoDaAtiva}
        onFim={() => {
          anterior.current = { ...ativa }
          ler()
        }}
      />
    )

  if (ativa?.situacao === 'chamando') {
    const falta = segundosParaAtender(ativa, agora)
    const liquido = Math.max(0, ativa.valor - ativa.comissao - regras.taxa_video)
    return (
      <div className="chamada-fundo">
        <section className="cartao chamada-cartao">
          {tocando ? (
            <>
              <Video size={40} className="verde pulsando" />
              <h2>{ativa.aluno_nome} está chamando por vídeo</h2>
              <p className="dica-sec">
                Chamada de {ativa.minutos} min. Você recebe {emReais(liquido)} (já sem a comissão e a taxa de {emReais(regras.taxa_video)}).
              </p>
              <p className="chamada-tempo">Atenda em {relogio(falta)}</p>
              <div className="acoes-linha">
                <button className="botao" onClick={() => responder(true)}>
                  <Video size={18} /> Atender
                </button>
                <button className="botao-sec" onClick={() => responder(false)}>
                  <PhoneOff size={18} /> Recusar
                </button>
              </div>
            </>
          ) : (
            <>
              {ativa.profissional_foto ? <img className="personal-foto grande" src={ativa.profissional_foto} alt="" /> : <Video size={40} className="verde pulsando" />}
              <h2>Chamando {ativa.profissional_nome.split(' ')[0]}…</h2>
              <p className="dica-sec">Chamada de {ativa.minutos} min. Se não atender em {relogio(falta)}, sua chamada continua guardada.</p>
              <button className="botao-sec" onClick={desistir}>
                Cancelar
              </button>
            </>
          )}
          {erro && <p className="mensagem erro">{erro}</p>}
        </section>
      </div>
    )
  }

  if (aviso) {
    const fechar = () => {
      setAviso(null)
      setNota(0)
    }
    const primeiro = aviso.chamada.profissional_nome.split(' ')[0]
    return (
      <div className="chamada-fundo">
        <section className="cartao chamada-cartao">
          {aviso.tipo === 'nota' ? (
            <>
              <h2>Como foi o treino com {primeiro}?</h2>
              <div className="estrelas" role="radiogroup" aria-label="Nota">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={nota === n} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} className={n <= nota ? 'acesa' : ''} onClick={() => setNota(n)}>
                    <Star size={30} />
                  </button>
                ))}
              </div>
              <button
                className="botao"
                disabled={!nota}
                onClick={async () => {
                  await avaliarVideo(aviso.chamada.id, nota)
                  fechar()
                }}
              >
                Enviar nota
              </button>
              <button className="link" onClick={fechar}>
                Agora não
              </button>
            </>
          ) : aviso.tipo === 'fim-personal' ? (
            <>
              <h2>Chamada encerrada</h2>
              <p className="dica-sec">
                Chamada com {aviso.chamada.aluno_nome} de {aviso.chamada.minutos} min. Você recebe {emReais(Math.max(0, aviso.chamada.valor - aviso.chamada.comissao - aviso.chamada.taxa))}.
              </p>
              <button className="botao" onClick={fechar}>
                Ok
              </button>
            </>
          ) : (
            <>
              <h2>{aviso.tipo === 'recusou' ? `${primeiro} não pode atender agora` : `${primeiro} não atendeu`}</h2>
              <p className="dica-sec">Fique tranquilo: sua chamada continua guardada. Combine um horário no chat e chame de novo.</p>
              <button className="botao" onClick={fechar}>
                Ok
              </button>
            </>
          )}
        </section>
      </div>
    )
  }

  return null
}
