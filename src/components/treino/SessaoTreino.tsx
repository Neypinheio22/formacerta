import { Camera, Check, CheckCircle2, ChevronDown, ChevronUp, Link2, Medal, PlayCircle, Plus, RotateCcw, Timer, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { ExercicioId } from '../../movimento/tipos'
import type { ExercicioTreino, Retorno, Treino } from '../../nuvem/treinos'
import { dataCurta, numero } from '../../testes/formato'
import type { ExercicioProprio } from '../../treino/comoFazer'
import { feedbackVazio, lerNumero, limparCargas, seriesPrevistas, type CargaExercicio, type Feedback, type SerieFeita } from '../../treino/execucao'
import { linhasDe, repsDe, resumoLinha } from '../../treino/linhas'
import { hora, minutos, textoDuracao } from '../../treino/retorno'
import { alternarFeito, blocosDe, cargasPrescritas, descansoDe, intensidadeDaPse, letraNoBloco, lerSessao, nomeDoCombinado, textoCronometro, textoDescanso, type Anotacao, type Sessao } from '../../treino/sessao'
import { noCatalogo } from '../../treino/semana'
import { MidiaExercicio } from './ComoFazer'
import { CamposFeedback } from './Feedbacks'

const CHAVE = 'formacerta:sessao-treino'
/** Chaves da versão anterior (relógio ao abrir e cargas soltas): saem ao abrir a tela nova. */
const CHAVES_ANTIGAS = ['formacerta:inicio-treino', 'formacerta:cargas-do-treino']

function lerGuardada(treinoId: string): Sessao | null {
  try {
    return lerSessao(localStorage.getItem(CHAVE), treinoId)
  } catch {
    return null
  }
}

function guardar(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s))
    else localStorage.removeItem(CHAVE)
  } catch {
    // Sem armazenamento: o treino segue, só não volta se o app fechar.
  }
}

/** Há um treino em andamento neste aparelho (para não recarregar a ficha no meio dele). */
export const sessaoIniciada = (treinoId?: string | null) => !!treinoId && !!lerGuardada(treinoId)

/** Anotações prontas para guardar: séries com número e se o exercício foi marcado. */
export function cargasDaSessao(treino: Treino, s: Pick<Sessao, 'cargas' | 'feitos'>): CargaExercicio[] {
  return limparCargas(
    treino.exercicios.map((ex, i) => ({
      nome: ex.nome,
      series: (s.cargas[i] ?? []).map((a) => ({ kg: lerNumero(a.kg), reps: a.reps ? (lerNumero(a.reps) ?? null) : null })),
      feito: s.feitos.includes(i),
    })),
  )
}

const textoSeries = (series: SerieFeita[]) => series.map((x) => `${x.kg != null ? numero(x.kg, x.kg % 1 ? 1 : 0) : '–'}×${x.reps ?? '–'}`).join(', ')

/** Bipe curto e vibração no fim do descanso. */
function avisarFimDescanso() {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Sem vibração.
  }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.value = 0.15
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.35)
    o.onended = () => ctx.close()
  } catch {
    // Sem som.
  }
}

type Descanso = { fim: number; total: number; nome: string }

/** Barra do descanso: contagem regressiva, +15 s e pular. */
function BarraDescanso({ d, agora, onMais, onFechar }: { d: Descanso; agora: number; onMais: () => void; onFechar: () => void }) {
  const resta = Math.max(0, (d.fim - agora) / 1000)
  const acabou = resta <= 0
  return (
    <div className={`barra-descanso ${acabou ? 'acabou' : ''}`} role="timer" aria-live="polite">
      <span className="barra-descanso-progresso" style={{ width: `${Math.min(100, (1 - resta / d.total) * 100)}%` }} />
      <Timer size={20} />
      <span className="barra-descanso-texto">
        <b>{acabou ? 'Bora, próxima série!' : textoDescanso(resta)}</b>
        <small>{acabou ? d.nome : `Descanso · ${d.nome}`}</small>
      </span>
      {!acabou && (
        <button type="button" className="botao-sec" onClick={onMais} aria-label="Mais 15 segundos">
          +15 s
        </button>
      )}
      <button type="button" className="icone-fechar" onClick={onFechar} aria-label={acabou ? 'Fechar' : 'Pular descanso'}>
        <X size={18} />
      </button>
    </div>
  )
}

/** Prescrição do personal em etiquetas (séries, carga, descanso) e as instruções embaixo. */
function Prescricao({ ex }: { ex: ExercicioTreino }) {
  const linhas = linhasDe(ex)
  const numericas = linhas.filter((l) => !['observacoes', 'cadencia', 'exercicio'].includes(l.tipo))
  const notas = linhas.filter((l) => ['observacoes', 'cadencia', 'exercicio'].includes(l.tipo) && l.texto)
  return (
    <>
      {numericas.map((l, i) => {
        if (l.tipo === 'reps_carga' || l.tipo === 'reps_carga_tempo' || l.tipo === 'reps_tempo') {
          const itens: [string, string][] = []
          if (l.serie) itens.push(['Séries', l.serie])
          if (l.carga) itens.push(['Carga', /[a-z]/i.test(l.carga) ? l.carga : `${l.carga} kg`])
          if (l.tempo) itens.push(['Tempo', l.tempo])
          if (l.intervalo) itens.push(['Descanso', l.intervalo])
          return (
            <dl key={i} className="prescricao">
              {itens.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )
        }
        return (
          <p key={i} className="prescricao-texto">
            {resumoLinha(l).texto}
          </p>
        )
      })}
      {notas.map((l, i) => (
        <p key={`n${i}`} className="instrucao">
          <b>{l.tipo === 'observacoes' ? 'Instruções' : resumoLinha(l).rotulo}:</b> {l.texto}
        </p>
      ))}
    </>
  )
}

type PropsCartao = {
  ex: ExercicioTreino
  letra?: string
  executando: boolean
  feito: boolean
  /** Marcar/desmarcar (só no exercício sozinho; o combinado marca no bloco). */
  onMarcar?: () => void
  comoFazer?: ExercicioProprio
  anterior?: { feito_em: string; series: SerieFeita[] } | null
  anotacao?: Anotacao[]
  onAnotar?: (a: Anotacao[]) => void
  onDescanso: (segundos: number) => void
  onCamera: (id: ExercicioId) => void
}

/** Cartão de um exercício: nome, prescrição, vídeo e, durante o treino, carga e repetições de cada série. */
function CartaoExercicio({ ex, letra, executando, feito, onMarcar, comoFazer, anterior, anotacao, onAnotar, onDescanso, onCamera }: PropsCartao) {
  const [video, setVideo] = useState(false)
  const [aberto, setAberto] = useState(false)
  const naCamera = noCatalogo(EXERCICIOS, ex.nome)
  const n = seriesPrevistas(ex)
  const prescritas = cargasPrescritas(ex, 10)
  const reps = (repsDe(ex).match(/\d+/) ?? [''])[0]
  const linhas = anotacao?.length ? anotacao : Array.from({ length: n }, () => ({ kg: '', reps: '' }))
  const mudar = (i: number, campo: keyof Anotacao, v: string) => onAnotar?.(linhas.map((a, j) => (j === i ? { ...a, [campo]: v } : a)))
  const descanso = descansoDe(ex)

  // Feito e fechado: vira uma linha verde (toque para abrir de novo).
  if (executando && feito && !aberto)
    return (
      <li className="cartao-ex feito compacto">
        {onMarcar ? (
          <button type="button" className="check-ex marcado" onClick={onMarcar} aria-label={`Desmarcar ${ex.nome}`} aria-pressed>
            <Check size={18} strokeWidth={3} />
          </button>
        ) : (
          <span className="letra-bloco">{letra}</span>
        )}
        <button type="button" className="cartao-ex-reabrir" onClick={() => setAberto(true)}>
          <strong>{ex.nome}</strong>
          <ChevronDown size={16} />
        </button>
      </li>
    )

  return (
    <li className={`cartao-ex ${feito ? 'feito' : ''}`}>
      <div className="cartao-ex-topo">
        {executando && onMarcar && (
          <button type="button" className={`check-ex ${feito ? 'marcado' : ''}`} onClick={onMarcar} aria-label={feito ? `Desmarcar ${ex.nome}` : `Marcar ${ex.nome} como feito`} aria-pressed={feito}>
            {feito && <Check size={18} strokeWidth={3} />}
          </button>
        )}
        <strong className="cartao-ex-nome">{ex.nome}</strong>
        {letra && <span className="letra-bloco">{letra}</span>}
        {executando && feito && aberto && (
          <button type="button" className="link" onClick={() => setAberto(false)} aria-label="Fechar">
            <ChevronUp size={16} />
          </button>
        )}
      </div>

      <Prescricao ex={ex} />

      {anterior && (
        <p className="ultima-vez">
          Última vez ({dataCurta(anterior.feito_em)}): <b>{textoSeries(anterior.series)}</b>
        </p>
      )}

      <div className="cartao-ex-acoes">
        <button type="button" className={`botao-sec ${video ? 'ativo' : ''} ${comoFazer?.tipo ? 'tem-midia' : ''}`} onClick={() => setVideo(!video)} aria-expanded={video}>
          <Video size={16} /> {video ? 'Esconder vídeo' : 'Ver vídeo'}
        </button>
        {naCamera && (
          <button type="button" className="botao-sec" onClick={() => onCamera(naCamera.id)} aria-label={`Corrigir ${ex.nome} com a câmera`}>
            <Camera size={16} /> Câmera
          </button>
        )}
        {executando && (
          <button type="button" className="botao-sec" onClick={() => onDescanso(descanso ?? 60)}>
            <Timer size={16} /> Descanso {textoDescanso(descanso ?? 60)}
          </button>
        )}
      </div>
      {video && <MidiaExercicio nome={ex.nome} ex={comoFazer} />}

      {executando && onAnotar && (
        <div className="series-sessao">
          <div className="series-sessao-cabeca">
            <span>Série</span>
            <span>Carga (kg)</span>
            <span>Reps feitas</span>
          </div>
          <ol>
            {linhas.map((a, i) => (
              <li key={i}>
                <span className="series-sessao-n">{i + 1}ª</span>
                <input inputMode="decimal" value={a.kg} onChange={(e) => mudar(i, 'kg', e.target.value)} placeholder={prescritas[i] || (anterior?.series[i]?.kg != null ? String(anterior.series[i].kg) : '–')} aria-label={`Carga usada na ${i + 1}ª série`} />
                <input inputMode="numeric" value={a.reps} onChange={(e) => mudar(i, 'reps', e.target.value)} placeholder={reps || (anterior?.series[i]?.reps != null ? String(anterior.series[i].reps) : '–')} aria-label={`Repetições feitas na ${i + 1}ª série`} />
              </li>
            ))}
          </ol>
          <div className="acoes-linha">
            {linhas.length < 10 && (
              <button type="button" className="link" onClick={() => onAnotar([...linhas, { kg: linhas[linhas.length - 1]?.kg ?? '', reps: '' }])}>
                <Plus size={14} /> Série
              </button>
            )}
            {linhas.length > 1 && (
              <button type="button" className="link" onClick={() => onAnotar(linhas.slice(0, -1))}>
                − Série
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/** Tela de finalizar: início, fim, tempo total, PSE e comentário. */
function Finalizar({ treino, inicio, fim, feitos, total, salvando, erro, comPersonal, onConcluir, onVoltar }: { treino: Treino; inicio: string; fim: string; feitos: number; total: number; salvando: boolean; erro: string | null; comPersonal: boolean; onConcluir: (r: Retorno, f: Feedback) => void; onVoltar: () => void }) {
  const [f, setF] = useState<Feedback>(feedbackVazio)
  const m = minutos(inicio, fim) ?? 0
  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar ao treino
        </button>
      </header>
      <section className="cartao destaque finalizado">
        <span className="finalizado-medalha">
          <Medal size={34} />
        </span>
        <h1>Treino finalizado!</h1>
        <p className="dica-sec">{treino.nome || `Treino ${treino.letra}`}</p>
        <dl className="finalizado-tempos">
          <dt>Início</dt>
          <dd>{hora(inicio)}</dd>
          <dt>Fim</dt>
          <dd>{hora(fim)}</dd>
          <dt>Tempo total</dt>
          <dd>
            <b className="verde">{textoDuracao(m)}</b>
          </dd>
          <dt>Exercícios feitos</dt>
          <dd>
            {feitos} de {total}
          </dd>
        </dl>
      </section>
      <form
        className="cartao formulario"
        onSubmit={(e) => {
          e.preventDefault()
          onConcluir({ inicio, fim, intensidade: f.pse !== null ? intensidadeDaPse(f.pse) : '', comentario: f.comentario }, f)
        }}
      >
        <h2>Como foi o treino?</h2>
        <CamposFeedback f={f} onMudar={setF} />
        {erro && <p className="mensagem erro">{erro}</p>}
        {comPersonal && <p className="dica-sec">Seu personal vê os horários, as cargas, a PSE e o seu comentário na sua ficha.</p>}
        <button className="botao grande" type="submit" disabled={salvando || f.pse === null}>
          <CheckCircle2 size={20} /> {salvando ? 'Guardando…' : 'CONCLUIR'}
        </button>
        {f.pse === null && <p className="dica-sec centro">Escolha a intensidade para concluir.</p>}
      </form>
    </div>
  )
}

type Props = {
  treino: Treino
  /** Treino do personal (anota cargas e vai para a ficha). Falso na série sugerida. */
  comPersonal: boolean
  comoFazerDe: (nome: string) => ExercicioProprio | undefined
  ultimaDe: (nome: string) => { feito_em: string; series: SerieFeita[] } | null
  /** Coisas que ficam no topo (aviso da série sugerida, PDF). */
  topo?: ReactNode
  salvando: boolean
  erro: string | null
  onVoltar: () => void
  onCamera: (id: ExercicioId) => void
  onConcluir: (retorno: Retorno, feedback: Feedback, cargas: CargaExercicio[]) => Promise<boolean>
}

/**
 * Treino do aluno. Primeiro abre em modo visualização (só olhar a ficha).
 * INICIAR TREINO marca a hora, liga o cronômetro e libera marcar os
 * exercícios, anotar carga e repetições e o descanso. Tudo fica salvo no
 * aparelho a cada toque, então fechar o app não perde nada.
 */
export function SessaoTreino({ treino, comPersonal, comoFazerDe, ultimaDe, topo, salvando, erro, onVoltar, onCamera, onConcluir }: Props) {
  const [sessao, setSessao] = useState<Sessao | null>(() => lerGuardada(treino.id))
  const [agora, setAgora] = useState(() => Date.now())
  const [descanso, setDescanso] = useState<Descanso | null>(null)
  const [fim, setFim] = useState<string | null>(null)
  const avisou = useRef(false)
  const blocos = useMemo(() => blocosDe(treino.exercicios), [treino.exercicios])

  useEffect(() => {
    try {
      CHAVES_ANTIGAS.forEach((k) => localStorage.removeItem(k))
    } catch {
      // Nada a fazer.
    }
  }, [])

  // Cronômetro: um tique por segundo enquanto o treino ou o descanso estão correndo.
  useEffect(() => {
    if (!sessao || fim) return
    const t = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [sessao, fim])

  useEffect(() => {
    if (descanso && agora >= descanso.fim && !avisou.current) {
      avisou.current = true
      avisarFimDescanso()
    }
  }, [agora, descanso])

  function mudar(nova: Sessao | null) {
    const s = nova ? { ...nova, em: new Date().toISOString() } : null
    setSessao(s)
    guardar(s)
  }

  function iniciar() {
    mudar({ treinoId: treino.id, inicio: new Date().toISOString(), feitos: [], cargas: {}, em: '' })
    setAgora(Date.now())
    window.scrollTo(0, 0)
  }

  function reiniciar() {
    if (!window.confirm('Reiniciar o treino? O tempo volta a zero e as marcações e cargas de hoje saem.')) return
    setDescanso(null)
    iniciar()
  }

  function comecarDescanso(segundos: number, nome: string) {
    avisou.current = false
    setAgora(Date.now())
    setDescanso({ fim: Date.now() + segundos * 1000, total: segundos, nome })
  }

  const total = treino.exercicios.length
  const feitos = sessao?.feitos.filter((i) => i < total).length ?? 0

  if (sessao && fim)
    return (
      <Finalizar
        treino={treino}
        inicio={sessao.inicio}
        fim={fim}
        feitos={feitos}
        total={total}
        salvando={salvando}
        erro={erro}
        comPersonal={comPersonal}
        onVoltar={() => setFim(null)}
        onConcluir={async (r, f) => {
          const ok = await onConcluir(r, f, comPersonal ? cargasDaSessao(treino, sessao) : [])
          if (ok) guardar(null)
        }}
      />
    )

  const executando = !!sessao
  const cartao = (i: number, letra?: string, sozinho = true) => {
    const ex = treino.exercicios[i]
    return (
      <CartaoExercicio
        key={i}
        ex={ex}
        letra={letra}
        executando={executando}
        feito={!!sessao?.feitos.includes(i)}
        onMarcar={sozinho && sessao ? () => mudar({ ...sessao, feitos: alternarFeito(sessao.feitos, [i]) }) : undefined}
        comoFazer={comoFazerDe(ex.nome)}
        anterior={comPersonal ? ultimaDe(ex.nome) : null}
        anotacao={sessao?.cargas[i]}
        onAnotar={sessao ? (a) => mudar({ ...sessao, cargas: { ...sessao.cargas, [i]: a } }) : undefined}
        onDescanso={(s) => comecarDescanso(s, ex.nome)}
        onCamera={onCamera}
      />
    )
  }

  return (
    <div className={`tela sessao-treino ${executando ? 'executando' : ''}`}>
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Treinos
        </button>
      </header>
      <h1 className="sessao-titulo">
        <span className="sessao-letra">{treino.letra}</span>
        <span>
          {treino.nome || `Treino ${treino.letra}`}
          {treino.foco && <small>{treino.foco}</small>}
        </span>
      </h1>
      {topo}

      {sessao ? (
        <section className="painel-sessao">
          <div className="cronometro" role="timer" aria-label="Tempo de treino">
            <Timer size={20} /> {textoCronometro(agora - new Date(sessao.inicio).getTime())}
          </div>
          <div className="painel-sessao-linha">
            <span>
              Início {hora(sessao.inicio)} · <b className="verde">{feitos}</b> de {total} feitos
            </span>
            <button type="button" className="link" onClick={reiniciar}>
              <RotateCcw size={14} /> Reiniciar treino
            </button>
          </div>
          <span className="progresso-sessao">
            <span style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} />
          </span>
        </section>
      ) : (
        <section className="cartao destaque iniciar-sessao">
          <button type="button" className="botao grande botao-iniciar" onClick={iniciar}>
            <PlayCircle size={22} /> INICIAR TREINO
          </button>
          <p className="dica-sec centro">
            Você está no <b>modo visualização</b>: veja a ficha e os vídeos à vontade. Aperte <b>INICIAR TREINO</b> para começar a contar o tempo e anotar cargas e repetições.
          </p>
        </section>
      )}

      <ol className="lista-sessao">
        {blocos.map((b) =>
          b.length === 1 ? (
            cartao(b[0])
          ) : (
            <li key={`b${b[0]}`} className={`bloco-combinado ${b.every((i) => sessao?.feitos.includes(i)) ? 'feito' : ''}`}>
              <div className="bloco-combinado-topo">
                {executando && sessao && (
                  <button
                    type="button"
                    className={`check-ex ${b.every((i) => sessao.feitos.includes(i)) ? 'marcado' : ''}`}
                    onClick={() => mudar({ ...sessao, feitos: alternarFeito(sessao.feitos, b) })}
                    aria-label={`Marcar ${nomeDoCombinado(b.length)} como feito`}
                    aria-pressed={b.every((i) => sessao.feitos.includes(i))}
                  >
                    {b.every((i) => sessao.feitos.includes(i)) && <Check size={18} strokeWidth={3} />}
                  </button>
                )}
                <span>
                  <strong>
                    <Link2 size={16} /> {nomeDoCombinado(b.length)} · exercícios combinados
                  </strong>
                  <small>Alterne esses exercícios: uma série de cada, em sequência ({b.map((_, j) => letraNoBloco(j)).join(' → ')}), e descanse no fim da volta.</small>
                </span>
              </div>
              <ol className="bloco-combinado-lista">{b.map((i, j) => cartao(i, letraNoBloco(j), false))}</ol>
            </li>
          ),
        )}
      </ol>

      {executando ? (
        <button
          className="botao grande"
          onClick={() => {
            if (feitos < total && !window.confirm(`Você marcou ${feitos} de ${total} exercícios. Finalizar mesmo assim?`)) return
            setDescanso(null)
            setFim(new Date().toISOString())
            window.scrollTo(0, 0)
          }}
        >
          <CheckCircle2 size={20} /> FINALIZAR TREINO
        </button>
      ) : (
        <button type="button" className="botao grande botao-iniciar" onClick={iniciar}>
          <PlayCircle size={22} /> INICIAR TREINO
        </button>
      )}
      {executando && <p className="dica-sec centro salvo-auto">Tudo o que você marca fica salvo no celular na hora. Se o app fechar, é só voltar aqui.</p>}

      {descanso && (
        <BarraDescanso
          d={descanso}
          agora={agora}
          onMais={() => setDescanso({ ...descanso, fim: descanso.fim + 15000, total: descanso.total + 15 })}
          onFechar={() => setDescanso(null)}
        />
      )}
    </div>
  )
}
