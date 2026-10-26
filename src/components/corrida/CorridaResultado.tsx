import { EnviarResultado } from '../conta/EnviarResultado'
import { ROTULO_NIVEL, planoCorrida } from '../../plano/plano'
import { PlanoAcao } from '../plano/PlanoAcao'
import { useEffect, useRef, useState } from 'react'
import type { AchadoCorrida, QuadroCorrida, ResultadoCorrida, VistaCorrida } from '../../corrida/tipos'
import { desenharCorredor, useUrlDoArquivo } from './desenho'

type Props = { resultado: ResultadoCorrida; onVoltar: () => void; onOutraVista: (v: VistaCorrida) => void }

const ROTULO = ROTULO_NIVEL
const VELOCIDADES = [1, 0.5, 0.25]

function scoreText(score: number) {
  if (score >= 85) return 'Corrida muito boa'
  if (score >= 65) return 'Alguns pontos para ajustar'
  return 'Vale trabalhar a técnica'
}

/** Quadro mais perto do instante t (os quadros estão em ordem de tempo). */
function quadroEm(quadros: QuadroCorrida[], t: number): QuadroCorrida | null {
  let lo = 0
  let hi = quadros.length - 1
  if (hi < 0) return null
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (quadros[mid].t < t) lo = mid + 1
    else hi = mid
  }
  const antes = quadros[lo - 1]
  return antes && t - antes.t < quadros[lo].t - t ? antes : quadros[lo]
}

export function CorridaResultado({ resultado, onVoltar, onOutraVista }: Props) {
  const { achados, quadros } = resultado
  const url = useUrlDoArquivo(resultado.video)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [tocando, setTocando] = useState(false)
  const [velocidade, setVelocidade] = useState(resultado.fator > 1 ? 1 : 0.25)

  // Desenha o esqueleto já calculado na análise, sincronizado com o vídeo.
  useEffect(() => {
    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      const v = videoRef.current
      const c = overlayRef.current
      if (!v || !c || v.readyState < 2) return
      c.width = v.videoWidth
      c.height = v.videoHeight
      desenharCorredor(c.getContext('2d')!, quadroEm(quadros, v.currentTime)?.lm ?? null, c.width, c.height)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [quadros])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = velocidade
  }, [velocidade])

  function verNoVideo(t: number) {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = t
    v.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function alternar() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const outra: VistaCorrida = resultado.vista === 'lado' ? 'tras' : 'lado'
  const data = new Date(resultado.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const corrigir = achados.filter((a) => a.status !== 'ok')
  const plano = planoCorrida(resultado)

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
        <span className="passo">{data}</span>
      </header>

      {resultado.falha ? (
        <section className="cartao">
          <h1>Não deu para avaliar</h1>
          <p className="dica">{resultado.falha}</p>
        </section>
      ) : (
        <section className="placar">
          <div className="anel" style={{ '--p': resultado.score } as React.CSSProperties}>
            <span>{resultado.score}</span>
          </div>
          <div>
            <h1>{scoreText(resultado.score)}</h1>
            <p className="dica">
              Corrida {resultado.vista === 'lado' ? 'de lado' : 'de trás'} · {resultado.local === 'esteira' ? 'esteira' : 'rua'} · {resultado.passos} passos analisados
            </p>
          </div>
        </section>
      )}

      {resultado.aviso && <p className="dica-sec">{resultado.aviso}</p>}

      <p className="aviso-triagem">
        <strong>Triagem, não diagnóstico.</strong> A análise aponta o que vale observar na técnica. Ela não substitui a avaliação de um profissional de educação física,
        fisioterapeuta ou médico. Em caso de dor, pare e procure um profissional.
      </p>

      {url && (
        <section className="cartao">
          <h2>Sua corrida, quadro a quadro</h2>
          <div className="player">
            <div className="camera-frame">
              <video
                ref={videoRef}
                src={url}
                playsInline
                muted
                loop
                preload="auto"
                onPlay={() => setTocando(true)}
                onPause={() => setTocando(false)}
                onLoadedMetadata={(e) => (e.currentTarget.playbackRate = velocidade)}
              />
              <canvas ref={overlayRef} />
            </div>
            <div className="player-controles">
              <button className="botao-play" onClick={alternar} aria-label={tocando ? 'Pausar' : 'Tocar'}>
                {tocando ? '❚❚' : '▶'}
              </button>
              <div className="timer esquerda sem-margem">
                {VELOCIDADES.map((s) => (
                  <button key={s} className={s === velocidade ? 'ativo' : ''} onClick={() => setVelocidade(s)}>
                    {s === 1 ? 'Normal' : `${s}x`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {achados.length > 0 && (
        <section className="cartao">
          <h2>O que medimos</h2>
          <ul className="achados">
            {achados.map((a) => (
              <Achado key={a.id} a={a} onVer={url && a.momento != null ? () => verNoVideo(a.momento!) : undefined} />
            ))}
          </ul>
        </section>
      )}

      {plano && <PlanoAcao plano={plano} />}

      {!resultado.falha && corrigir.length === 0 && (
        <section className="cartao">
          <h2>Nada para corrigir nesta vista</h2>
          <p className="dica-sec">Continue assim. Para a avaliação completa, grave também {outra === 'lado' ? 'de lado' : 'de trás'}.</p>
        </section>
      )}

      <button className="botao grande" onClick={() => onOutraVista(outra)}>
        Avaliar {outra === 'lado' ? 'de lado' : 'de trás'} também
      </button>
      <button className="botao-sec" onClick={() => onOutraVista(resultado.vista)}>
        Gravar de novo
      </button>

      {!resultado.falha && <EnviarResultado tipo="corrida" id={resultado.id} feitoEm={resultado.date} resultado={resultado} altura={resultado.altura} />}

      <p className="aviso-legal">
        Os limites usados são valores de referência da literatura para corredores recreativos e podem ser ajustados pelo seu personal. A medida em 2D tem margem de erro de
        alguns graus.
      </p>
    </div>
  )
}

function Achado({ a, onVer }: { a: AchadoCorrida; onVer?: () => void }) {
  return (
    <li>
      <div className="achado-topo">
        <strong>{a.title}</strong>
        <span className={`chip chip-${a.status}`}>{ROTULO[a.status]}</span>
      </div>
      <span className="achado-detalhe">
        {a.detail} <span className="valor">{a.value}</span>
      </span>
      {a.musculos && (a.musculos.alongar.length > 0 || a.musculos.fortalecer.length > 0) && (
        <div className="musculos">
          {a.musculos.alongar.length > 0 && (
            <p>
              <span className="rotulo-musculo">Alongar</span> {a.musculos.alongar.join(', ')}
            </p>
          )}
          {a.musculos.fortalecer.length > 0 && (
            <p>
              <span className="rotulo-musculo forte">Fortalecer</span> {a.musculos.fortalecer.join(', ')}
            </p>
          )}
        </div>
      )}
      {a.exercises.length > 0 && (
        <ul className="exercicios">
          {a.exercises.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {onVer && a.status !== 'ok' && (
        <button className="ver-video" onClick={onVer}>
          Ver no vídeo
        </button>
      )}
    </li>
  )
}
