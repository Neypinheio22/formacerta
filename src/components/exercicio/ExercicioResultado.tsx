import { useEffect, useMemo, useRef, useState } from 'react'
import { exercicioPorId, type Exercicio } from '../../movimento/exercicios'
import type { Quadro, Repeticao, ResultadoExercicio } from '../../movimento/tipos'
import { drawSkeleton } from '../../pose/draw'
import type { Status } from '../../pose/types'

type Props = { resultado: ResultadoExercicio; onVoltar: () => void; onRefazer: () => void }

const ROTULO: Record<Status, string> = { ok: 'Bom', atencao: 'Atenção', alerta: 'Corrigir' }
const VELOCIDADES = [1, 0.5, 0.25]

function scoreText(score: number) {
  if (score >= 85) return 'Execução muito boa'
  if (score >= 65) return 'Alguns pontos para ajustar'
  return 'Vale focar na técnica'
}

/** Quadro mais perto do instante t (os quadros estão em ordem de tempo). */
function quadroEm(quadros: Quadro[], t: number): Quadro | null {
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

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function ExercicioResultado({ resultado, onVoltar, onRefazer }: Props) {
  const ex = exercicioPorId(resultado.exercicio)
  const { reps, resumo, quadros } = resultado
  const url = useMemo(() => (resultado.video ? URL.createObjectURL(resultado.video) : null), [resultado.video])
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [tempo, setTempo] = useState(0)
  const [tocando, setTocando] = useState(false)
  const [velocidade, setVelocidade] = useState(1)
  const [aberta, setAberta] = useState<number | null>(null)

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  // Desenha o esqueleto já calculado na análise, sincronizado com o vídeo.
  useEffect(() => {
    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      const v = videoRef.current
      const c = overlayRef.current
      if (!v || !c || v.readyState < 2) return
      setTempo(v.currentTime)
      c.width = v.videoWidth
      c.height = v.videoHeight
      const q = quadroEm(quadros, v.currentTime)
      const ctx = c.getContext('2d')!
      if (q?.lm) drawSkeleton(ctx, q.lm, c.width, c.height)
      else ctx.clearRect(0, 0, c.width, c.height)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [quadros])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = velocidade
  }, [velocidade])

  function irPara(t: number, tocar = false) {
    const v = videoRef.current
    setTempo(t)
    if (!v) return
    v.currentTime = t
    if (tocar) v.play().catch(() => {})
  }

  function verRep(r: Repeticao) {
    setAberta(aberta === r.n ? null : r.n)
    setVelocidade(0.5)
    irPara(r.inicio, true)
  }

  function alternar() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const exercicios = [...new Set(resumo.flatMap((f) => f.exercises))]
  const data = new Date(resultado.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
        <span className="passo">{data}</span>
      </header>

      {reps.length === 0 ? (
        <section className="cartao">
          <h1>Nenhuma repetição encontrada</h1>
          <p className="dica">
            O app precisa ver o corpo inteiro e o movimento completo, saindo da posição inicial e voltando. Confira se o celular está {ex.vista.toLowerCase()} para você, como
            pede o exercício, e se não cortou os pés ou a cabeça.
          </p>
        </section>
      ) : (
        <section className="placar">
          <div className="anel" style={{ '--p': resultado.score } as React.CSSProperties}>
            <span>{resultado.score}</span>
          </div>
          <div>
            <h1>{scoreText(resultado.score)}</h1>
            <p className="dica">
              {ex.nome} · {reps.length} repetiç{reps.length > 1 ? 'ões' : 'ão'} · {reps.filter((r) => r.status === 'ok').length} sem correção
            </p>
          </div>
        </section>
      )}

      <section className="cartao">
        <h2>O movimento, quadro a quadro</h2>
        {url && (
          <div className="player">
            <div className="camera-frame">
              <video
                ref={videoRef}
                src={url}
                playsInline
                muted
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
              <span className="player-tempo">{fmt(tempo)}</span>
            </div>
          </div>
        )}
        <Grafico ex={ex} resultado={resultado} tempo={tempo} onIr={(t) => irPara(t)} />
        <p className="dica-sec">
          Linha verde: ângulo do {ex.articulacao.toLowerCase()} em cada instante. Cada faixa é uma repetição; toque nela para ver no vídeo.
        </p>
      </section>

      {reps.length > 0 && (
        <section className="cartao">
          <h2>Cada repetição</h2>
          <ul className="reps">
            {reps.map((r) => (
              <li key={r.n}>
                <button className={aberta === r.n ? 'ativo' : ''} onClick={() => verRep(r)}>
                  <strong>Rep {r.n}</strong>
                  <span className="achado-detalhe">
                    {ex.articulacao} {Math.round(r.anguloMin)}° no fundo · {(r.fim - r.inicio).toFixed(1).replace('.', ',')} s
                  </span>
                  <span className={`chip chip-${r.status}`}>{ROTULO[r.status]}</span>
                </button>
                {aberta === r.n && (
                  <ul className="achados">
                    {r.achados.map((a) => (
                      <li key={a.id}>
                        <div className="achado-topo">
                          <strong>{a.title}</strong>
                          <span className={`chip chip-${a.status}`}>{ROTULO[a.status]}</span>
                        </div>
                        <span className="achado-detalhe">
                          {a.detail} <span className="valor">{a.value}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {resumo.length > 0 && (
        <section className="cartao">
          <h2>Resumo da série</h2>
          <ul className="achados">
            {resumo.map((f) => (
              <li key={f.id}>
                <div className="achado-topo">
                  <strong>{f.title}</strong>
                  <span className={`chip chip-${f.status}`}>{ROTULO[f.status]}</span>
                </div>
                <span className="achado-detalhe">
                  {f.detail} <span className="valor">{f.repsComProblema ? `Em ${f.value}.` : 'Certo em todas.'}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exercicios.length > 0 && (
        <section className="cartao">
          <h2>Para melhorar a técnica</h2>
          <ul className="exercicios">
            {exercicios.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}

      <button className="botao grande" onClick={onRefazer}>
        Fazer de novo
      </button>

      <p className="aviso-legal">
        A análise é automática e serve como orientação. Ela não substitui a avaliação de um profissional de educação física ou de saúde. Em caso de dor, pare e procure um
        profissional.
      </p>
    </div>
  )
}

const LARG = 320
const ALT = 150
const ESQ = 30
const BASE = 18

const COR: Record<Status, string> = { ok: 'var(--verde)', atencao: 'var(--laranja)', alerta: 'var(--vermelho)' }

/** Ângulo principal ao longo do tempo, com as repetições marcadas. */
function Grafico({ ex, resultado, tempo, onIr }: { ex: Exercicio; resultado: ResultadoExercicio; tempo: number; onIr: (t: number) => void }) {
  const { quadros, reps } = resultado
  const duracao = Math.max(resultado.duracao, 0.1)
  const angulos = quadros.flatMap((q) => (q.medidas ? [q.medidas.angulo] : []))
  const minA = Math.max(0, Math.floor(Math.min(ex.meta - 15, ...angulos) / 10) * 10)
  const maxA = 185
  const x = (t: number) => ESQ + (t / duracao) * (LARG - ESQ - 4)
  const y = (a: number) => 6 + ((maxA - a) / (maxA - minA)) * (ALT - BASE - 6)

  // Linha quebrada onde a pessoa saiu do quadro.
  let d = ''
  let novo = true
  for (const q of quadros) {
    if (!q.medidas) {
      novo = true
      continue
    }
    d += `${novo ? 'M' : 'L'}${x(q.t).toFixed(1)} ${y(q.medidas.angulo).toFixed(1)} `
    novo = false
  }

  function clicar(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * LARG
    onIr(Math.min(duracao, Math.max(0, ((px - ESQ) / (LARG - ESQ - 4)) * duracao)))
  }

  return (
    <svg className="grafico" viewBox={`0 0 ${LARG} ${ALT}`} onClick={clicar} role="img" aria-label={`Ângulo do ${ex.articulacao.toLowerCase()} ao longo do vídeo`}>
      {reps.map((r) => (
        <g key={r.n}>
          <rect x={x(r.inicio)} y={4} width={Math.max(2, x(r.fim) - x(r.inicio))} height={ALT - BASE - 2} fill={COR[r.status]} opacity={0.14} rx={3} />
          <text x={(x(r.inicio) + x(r.fim)) / 2} y={ALT - 5} textAnchor="middle" fill={COR[r.status]} fontSize={9} fontWeight={700}>
            {r.n}
          </text>
        </g>
      ))}
      <line x1={ESQ} x2={LARG - 4} y1={y(ex.meta)} y2={y(ex.meta)} stroke="var(--texto-sec)" strokeDasharray="3 3" strokeWidth={0.8} />
      <text x={ESQ - 4} y={y(ex.meta) + 3} textAnchor="end" fill="var(--texto-sec)" fontSize={8}>
        {ex.meta}°
      </text>
      <text x={ESQ - 4} y={y(180) + 3} textAnchor="end" fill="var(--texto-sec)" fontSize={8}>
        180°
      </text>
      <path d={d} fill="none" stroke="var(--verde)" strokeWidth={1.6} strokeLinejoin="round" />
      <line x1={x(tempo)} x2={x(tempo)} y1={2} y2={ALT - BASE + 2} stroke="var(--texto)" strokeWidth={1} />
    </svg>
  )
}
