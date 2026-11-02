import { BadgeCheck, BookCopy, Camera, CheckCircle2, ChevronDown, ChevronUp, Dumbbell, FileDown, HeartPulse, History, Medal, PlayCircle, Star, TriangleAlert, UserRound, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { ExercicioId } from '../../movimento/tipos'
import type { Perfil } from '../../nuvem/conta'
import { avaliarTreino, marcarDia, marcarFeito, type ExercicioTreino, type Retorno, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { dataCurta, numero } from '../../testes/formato'
import { comoFazerDe, type ExercicioProprio } from '../../treino/comoFazer'
import { carregarSeries, doExercicio, gravarSeries, proximaCarga, type Faixa } from '../../treino/carga'
import { feedbackVazio, historicoDoTreino, intensidadeDoEsforco, lerNumero, limparCargas, ROTULO_STATUS, seriesPrevistas, temFeedback, ultimaCarga, type CargaExercicio, type Feedback, type SerieFeita } from '../../treino/execucao'
import { CamposFeedback, FormAvaliar, ResumoFeedback } from './Feedbacks'
import { OrientacoesAluno } from './Orientacoes'
import { useAtualizacao } from './useAtualizacao'
import { linhasDe, repsDe, resumoLinha } from '../../treino/linhas'
import { hora, minutos, textoDuracao } from '../../treino/retorno'
import { diaLocal, noCatalogo } from '../../treino/semana'
import { SemanaCartao } from './CartoesAluno'
import { MidiaExercicio } from './ComoFazer'
import { CartaoBibliotecaExercicios } from './BibliotecaExercicios'
import { useExercicios } from './useExercicios'
import { ListaMateriais } from './Materiais'
import { gravarUltimaSugerida, useMeuTreino } from './useMeuTreino'
import { AVISO_SUGERIDA } from '../../treino/sugerida'
import { dataDia, resumoAerobico, rotuloNivel, rotuloTipo } from '../../treino/rotinas'
import { IconeDaRotina } from './IconeRotina'
import { TelaBiblioteca } from './BibliotecaTreinos'
import { ExportarPdf } from './ExportarPdf'

type Props = {
  perfil: Perfil | null
  /** Letra do treino para abrir direto (vindo do "Ir para o treino" da tela inicial). */
  abrir?: string
  onVoltar: () => void
  onCamera: (exercicio?: ExercicioId) => void
  onCarga: () => void
  onPersonais: () => void
}

/** Faixa de repetições escrita pelo personal ("10 a 12", "8-10", "15"). */
function faixaDe(reps: string): Faixa {
  const n = reps.match(/\d+/g)?.map(Number).filter((x) => x > 0 && x < 100) ?? []
  if (!n.length) return { min: 8, max: 12 }
  return { min: Math.min(...n), max: Math.max(...n) }
}

const kg = (v: number) => `${numero(v, v % 1 ? 1 : 0)} kg`

/** Série como o aluno digita (texto), antes de virar número. */
type Anotacao = { kg: string; reps: string }

const textoSeries = (series: SerieFeita[]) => series.map((x) => `${x.kg != null ? numero(x.kg, x.kg % 1 ? 1 : 0) : '–'}×${x.reps ?? '–'}`).join(', ')

function LinhaExercicio({
  ex,
  comoFazer,
  onCamera,
  anotacao,
  anterior,
  onAnotar,
}: {
  ex: ExercicioTreino
  comoFazer?: ExercicioProprio
  onCamera: (id: ExercicioId) => void
  /** Séries anotadas hoje (só no treino do personal). */
  anotacao?: Anotacao[]
  /** Última vez que o aluno anotou este exercício. */
  anterior?: { feito_em: string; series: SerieFeita[] } | null
  onAnotar?: (a: Anotacao[]) => void
}) {
  const [vendo, setVendo] = useState(false)
  const [anotando, setAnotando] = useState(false)
  const naCamera = noCatalogo(EXERCICIOS, ex.nome)
  const series = useMemo(() => doExercicio(carregarSeries(), ex.nome), [ex.nome])
  const ultima = series[series.length - 1]
  const sugestao = ultima ? proximaCarga(ultima, faixaDe(repsDe(ex)), 2) : null
  const feitas = (anotacao ?? []).filter((a) => a.kg || a.reps).length
  const linhas = anotacao?.length ? anotacao : Array.from({ length: seriesPrevistas(ex) }, () => ({ kg: '', reps: '' }))
  const mudar = (i: number, campo: keyof Anotacao, v: string) => onAnotar?.(linhas.map((a, j) => (j === i ? { ...a, [campo]: v } : a)))
  return (
    <li className="exercicio-treino">
      <div>
        <strong>{ex.nome}</strong>
        {linhasDe(ex).map((l, i) => {
          const r = resumoLinha(l)
          return (
            <span key={i} className={`linha-aluno ${l.tipo === 'reps_carga' || l.tipo === 'reps_carga_tempo' || l.tipo === 'reps_tempo' ? '' : 'linha-nota'}`}>
              {['observacoes', 'cadencia', 'exercicio'].includes(l.tipo) && <b>{r.rotulo}: </b>}
              {r.texto}
            </span>
          )
        })}
        {anterior ? (
          <span className="exercicio-carga">
            Última vez ({dataCurta(anterior.feito_em)}): {textoSeries(anterior.series)}
          </span>
        ) : (
          ultima &&
          sugestao && (
            <span className="exercicio-carga">
              Última: {kg(ultima.kg)} × {ultima.reps} · hoje: <b className="verde">{kg(sugestao.kg)}</b>
            </span>
          )
        )}
      </div>
      <button className={`botao-sec camera-mini ${comoFazer?.tipo ? 'tem-midia' : ''}`} onClick={() => setVendo(!vendo)} aria-label={`Como fazer ${ex.nome}`} aria-expanded={vendo}>
        <Video size={16} />
      </button>
      {naCamera && (
        <button className="botao-sec camera-mini" onClick={() => onCamera(naCamera.id)} aria-label={`Corrigir ${ex.nome} com a câmera`}>
          <Camera size={16} />
        </button>
      )}
      {vendo && <MidiaExercicio nome={ex.nome} ex={comoFazer} />}
      {onAnotar && (
        <div className="anotar-cargas">
          <button type="button" className={`link ${feitas ? 'verde' : ''}`} onClick={() => setAnotando(!anotando)} aria-expanded={anotando}>
            <Dumbbell size={14} /> {feitas ? `${feitas} série${feitas === 1 ? '' : 's'} anotada${feitas === 1 ? '' : 's'}` : 'Anotar carga e repetições'} {anotando ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {anotando && (
            <>
              <ol className="series-anotar">
                {linhas.map((a, i) => (
                  <li key={i}>
                    <span className="dica-sec">{i + 1}ª</span>
                    <label>
                      <input inputMode="decimal" value={a.kg} onChange={(e) => mudar(i, 'kg', e.target.value)} placeholder={anterior?.series[i]?.kg != null ? String(anterior.series[i].kg) : 'kg'} aria-label={`Carga da ${i + 1}ª série`} />
                      <small>kg</small>
                    </label>
                    <label>
                      <input inputMode="numeric" value={a.reps} onChange={(e) => mudar(i, 'reps', e.target.value)} placeholder={anterior?.series[i]?.reps != null ? String(anterior.series[i].reps) : 'reps'} aria-label={`Repetições da ${i + 1}ª série`} />
                      <small>reps</small>
                    </label>
                  </li>
                ))}
              </ol>
              <div className="acoes-linha">
                {linhas.length < 10 && (
                  <button type="button" className="link" onClick={() => onAnotar([...linhas, { kg: linhas[linhas.length - 1]?.kg ?? '', reps: '' }])}>
                    + Série
                  </button>
                )}
                {linhas.length > 1 && (
                  <button type="button" className="link" onClick={() => onAnotar(linhas.slice(0, -1))}>
                    − Série
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

const CHAVE_CARGAS = 'formacerta:cargas-do-treino'

/** Cargas que o aluno vai anotando no treino aberto. Ficam no aparelho até ele concluir. */
function lerAnotacoes(treinoId: string): Record<number, Anotacao[]> {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CARGAS) ?? 'null') as { treinoId: string; em: string; cargas: Record<number, Anotacao[]> } | null
    if (salvo?.treinoId === treinoId && Date.now() - new Date(salvo.em).getTime() < 6 * 3600000) return salvo.cargas
  } catch {
    // Sem armazenamento: começa vazio.
  }
  return {}
}

function gravarAnotacoes(treinoId: string, cargas: Record<number, Anotacao[]>) {
  try {
    localStorage.setItem(CHAVE_CARGAS, JSON.stringify({ treinoId, em: new Date().toISOString(), cargas }))
  } catch {
    // Sem espaço: só não lembra.
  }
}

function esquecerAnotacoes() {
  try {
    localStorage.removeItem(CHAVE_CARGAS)
  } catch {
    // Nada a fazer.
  }
}

/** Anotações do treino prontas para guardar. */
function cargasDe(treino: Treino, anot: Record<number, Anotacao[]>): CargaExercicio[] {
  return limparCargas(treino.exercicios.map((ex, i) => ({ nome: ex.nome, series: (anot[i] ?? []).map((a) => ({ kg: lerNumero(a.kg), reps: a.reps ? (lerNumero(a.reps) ?? null) : null })) })))
}

/** As séries anotadas também vão para o Diário de cargas do aparelho (projeção de carga). */
function levarParaDiario(cargas: CargaExercicio[]) {
  const novas = cargas.flatMap((c) =>
    c.series.filter((x) => x.kg && x.reps).map((x, i) => ({ id: `${Date.now()}-${c.nome}-${i}`, date: new Date().toISOString(), exercicio: c.nome, kg: x.kg!, reps: Math.round(x.reps!) })),
  )
  if (novas.length) gravarSeries([...carregarSeries(), ...novas])
}

const CHAVE_INICIO = 'formacerta:inicio-treino'

/** Hora em que o aluno abriu o treino. Fica no aparelho para não perder se a tela recarregar. */
function inicioDoTreino(letra: string): string {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_INICIO) ?? 'null') as { letra: string; inicio: string } | null
    // Mais de 4 h aberto: foi esquecido, começa de novo.
    if (salvo?.letra === letra && Date.now() - new Date(salvo.inicio).getTime() < 4 * 3600000) return salvo.inicio
  } catch {
    // Sem armazenamento: começa agora.
  }
  const inicio = new Date().toISOString()
  try {
    localStorage.setItem(CHAVE_INICIO, JSON.stringify({ letra, inicio }))
  } catch {
    // Sem espaço no aparelho: só não lembra.
  }
  return inicio
}

function esquecerInicio() {
  try {
    localStorage.removeItem(CHAVE_INICIO)
  } catch {
    // Nada a fazer.
  }
}

/** Tela "Treino finalizado": início, fim, tempo e o feedback do aluno (dificuldade, esforço, dores e observações). */
function TreinoFinalizado({ treino, inicio, fim, salvando, erro, comPersonal, cargas, onConcluir, onVoltar }: { treino: Treino; inicio: string; fim: string; salvando: boolean; erro: string | null; comPersonal: boolean; cargas: number; onConcluir: (r: Retorno, f: Feedback) => void; onVoltar: () => void }) {
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
        <h1>Tudo certo!</h1>
        <p className="dica-sec">
          Treino {treino.letra}
          {treino.nome && ` · ${treino.nome}`} finalizado com sucesso.
        </p>
        <dl className="finalizado-tempos">
          <dt>Início</dt>
          <dd>{hora(inicio)}</dd>
          <dt>Fim</dt>
          <dd>{hora(fim)}</dd>
          <dt>Tempo de treino</dt>
          <dd>
            <b className="verde">{textoDuracao(m)}</b>
          </dd>
          {comPersonal && (
            <>
              <dt>Cargas anotadas</dt>
              <dd>{cargas ? `${cargas} exercício${cargas === 1 ? '' : 's'}` : 'nenhuma'}</dd>
            </>
          )}
        </dl>
      </section>
      <form
        className="cartao formulario"
        onSubmit={(e) => {
          e.preventDefault()
          onConcluir({ inicio, fim, intensidade: f.esforco !== null ? intensidadeDoEsforco(f.esforco) : '', comentario: f.comentario }, f)
        }}
      >
        <h2>
          <Star size={18} /> Como foi o treino?
        </h2>
        <CamposFeedback f={f} onMudar={setF} />
        {erro && <p className="mensagem erro">{erro}</p>}
        {comPersonal && <p className="dica-sec">Seu personal vê o tempo, as cargas e a sua avaliação na sua ficha, e pode deixar uma observação de volta.</p>}
        <button className="botao grande" type="submit" disabled={salvando || f.dificuldade === null || f.esforco === null}>
          <CheckCircle2 size={20} /> {salvando ? 'Guardando…' : 'Concluir'}
        </button>
        {(f.dificuldade === null || f.esforco === null) && <p className="dica-sec centro">Marque a dificuldade e o esforço para concluir.</p>}
      </form>
    </div>
  )
}

/** Últimos treinos do aluno: avaliar os que ficaram sem avaliação e ler a observação do personal. */
function MeusUltimosTreinos({ feitos, treinos, onMudou }: { feitos: TreinoFeito[]; treinos: Treino[]; onMudou: () => void }) {
  const [avaliando, setAvaliando] = useState<string | null>(null)
  const [quantos, setQuantos] = useState(5)
  const [aviso, setAviso] = useState<string | null>(null)
  if (!feitos.length) return null
  const nomeDe = (f: TreinoFeito) => treinos.find((t) => t.id === f.treino_id)?.nome
  return (
    <section className="cartao">
      <h2>
        <History size={18} /> Meus últimos treinos
      </h2>
      {aviso && <p className="mensagem ok">{aviso}</p>}
      <ul className="retornos">
        {feitos.slice(0, quantos).map((f) => (
          <li key={f.id} className={f.dor ? 'com-dor' : ''}>
            <span className="linha-fim">
              <b>
                <span className="verde">{f.letra}</span> {nomeDe(f) ?? ''}
              </b>
              <span className="dica-sec">{dataCurta(f.feito_em)}</span>
            </span>
            {avaliando === f.id ? (
              <FormAvaliar
                inicial={f}
                onCancelar={() => setAvaliando(null)}
                onSalvar={async (fb) => {
                  const e = await avaliarTreino(f.id, fb)
                  if (e) return e
                  setAvaliando(null)
                  setAviso('Avaliação enviada para o seu personal.')
                  onMudou()
                  return null
                }}
              />
            ) : temFeedback(f) ? (
              <ResumoFeedback e={f} />
            ) : (
              <button className="botao-sec" onClick={() => setAvaliando(f.id)}>
                <Star size={16} /> Avaliar este treino
              </button>
            )}
            {f.obs_personal && (
              <span className="obs-personal">
                <UserRound size={13} /> <b>Seu personal:</b> {f.obs_personal}
              </span>
            )}
          </li>
        ))}
      </ul>
      {feitos.length > quantos && (
        <button className="botao-sec" onClick={() => setQuantos(quantos + 10)}>
          Ver mais
        </button>
      )}
    </section>
  )
}

/** Aviso fixo da série sugerida: quem monta o treino é o personal. */
function AvisoSugerida({ temFicha, motivos = [], onPersonais }: { temFicha: boolean; motivos?: string[]; onPersonais: () => void }) {
  return (
    <section className="cartao aviso-sugerida">
      <p>
        <TriangleAlert size={18} /> <b>Série sugerida, não é o seu treino personalizado.</b>
      </p>
      <p className="dica-sec">{AVISO_SUGERIDA}</p>
      {motivos.length > 0 && (
        <details className="ajuste-serie">
          <summary>Ajustada para você pelos seus dados</summary>
          <ul>
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}
      {temFicha ? (
        <p className="dica-sec">Seu personal já tem a sua ficha: assim que ele montar os treinos, eles aparecem aqui no lugar desta série.</p>
      ) : (
        <button className="botao-sec" onClick={onPersonais}>
          <BadgeCheck size={16} /> Encontrar personal com CREF
        </button>
      )}
    </section>
  )
}

/** Aba Treino: ficha A, B, C do personal, meta da semana e materiais extras. */
export function TelaTreino({ perfil, abrir, onVoltar, onCamera, onCarga, onPersonais }: Props) {
  const t = useMeuTreino(perfil)
  const [aberto, setAberto] = useState<string | null>(abrir ?? null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [inicio, setInicio] = useState<string | null>(null)
  const [fim, setFim] = useState<string | null>(null)
  const aluno = perfil?.papel === 'aluno'
  const exercicios = useExercicios(!!perfil)
  const profissionalId = t.ficha?.profissional_id ?? perfil?.profissional_id ?? perfil?.id

  const [biblioteca, setBiblioteca] = useState(false)
  const [pdf, setPdf] = useState(false)
  const [anotacoes, setAnotacoes] = useState<Record<number, Anotacao[]>>({})
  const treino = t.lista.find((x) => x.letra === aberto) ?? null
  const anotar = !t.sugerida && !!t.ficha

  // O relógio do treino começa quando o aluno abre o treino.
  useEffect(() => {
    setInicio(treino ? inicioDoTreino(treino.letra) : null)
    setFim(null)
    setAnotacoes(treino?.id ? lerAnotacoes(treino.id) : {})
  }, [treino?.letra, treino?.id])

  // O personal mudou o treino ou respondeu: aparece sozinho quando o aluno volta ao app.
  useAtualizacao(() => {
    if (!treino) t.recarregar()
  }, 120)

  function mudarAnotacao(i: number, a: Anotacao[]) {
    if (!treino) return
    const novas = { ...anotacoes, [i]: a }
    setAnotacoes(novas)
    gravarAnotacoes(treino.id, novas)
  }

  async function concluir(tr: Treino | null, retorno?: Retorno, feedback?: Feedback) {
    setSalvando(true)
    setAviso(null)
    const cargas = tr && anotar ? cargasDe(tr, anotacoes) : []
    const erro = tr && perfil && !t.sugerida ? await marcarFeito(perfil.id, tr, retorno, { cargas, feedback }) : null
    setSalvando(false)
    if (erro) return setAviso(erro)
    levarParaDiario(cargas)
    esquecerAnotacoes()
    setAnotacoes({})
    esquecerInicio()
    setFim(null)
    marcarDia(diaLocal(new Date()))
    if (tr && t.sugerida) gravarUltimaSugerida(tr.letra)
    setAviso(tr ? `Treino ${tr.letra} concluído! Mandou bem. 💪` : 'Treino de hoje marcado! 💪')
    setAberto(null)
    t.recarregar()
    window.scrollTo(0, 0)
  }

  if (biblioteca && perfil && !aluno)
    return (
      <TelaBiblioteca
        meuId={perfil.id}
        onVoltar={() => {
          setBiblioteca(false)
          window.scrollTo(0, 0)
        }}
      />
    )

  if (treino && inicio && fim)
    return (
      <TreinoFinalizado
        treino={treino}
        inicio={inicio}
        fim={fim}
        salvando={salvando}
        erro={aviso}
        comPersonal={!t.sugerida}
        cargas={anotar ? cargasDe(treino, anotacoes).length : 0}
        onVoltar={() => setFim(null)}
        onConcluir={(r, f) => concluir(treino, r, f)}
      />
    )

  const podePdf = aluno && !t.sugerida && !!t.rotina && !!t.ficha && t.treinos.length > 0
  const janelaPdf =
    pdf && podePdf ? (
      <ExportarPdf rotina={t.rotina!} treinos={t.treinos} ficha={t.ficha!} quem="aluno" letraInicial={treino?.letra} exercicios={exercicios.lista} onFechar={() => setPdf(false)} />
    ) : null

  if (treino)
    return (
      <div className="tela">
        <header className="topo">
          <button className="voltar" onClick={() => setAberto(null)}>
            ← Treinos
          </button>
        </header>
        <h1>
          Treino <span className="verde">{treino.letra}</span>
          {treino.nome && ` · ${treino.nome}`}
        </h1>
        {t.sugerida && <AvisoSugerida temFicha={!!t.ficha?.profissional_id} motivos={t.ajuste?.motivos} onPersonais={onPersonais} />}
        {podePdf && (
          <button className="link link-discreto" onClick={() => setPdf(true)}>
            <FileDown size={14} /> Baixar este treino em PDF
          </button>
        )}
        {janelaPdf}
        <p className="dica-sec">Toque em <Video size={14} /> para ver como fazer o exercício e na câmera para o app contar as repetições e corrigir o movimento.</p>
        <ol className="lista-treino">
          {treino.exercicios.map((ex, i) => (
            <LinhaExercicio
              key={i}
              ex={ex}
              comoFazer={comoFazerDe(exercicios.lista, ex.nome, profissionalId)}
              onCamera={onCamera}
              anotacao={anotacoes[i]}
              anterior={anotar ? ultimaCarga(t.feitos, ex.nome) : null}
              onAnotar={anotar ? (a) => mudarAnotacao(i, a) : undefined}
            />
          ))}
        </ol>
        {anotar ? (
          <p className="dica-sec">Anote a carga e as repetições de cada série: o seu personal acompanha a sua evolução por elas.</p>
        ) : (
          <button className="botao-sec" onClick={onCarga}>
            <Dumbbell size={16} /> Anotar as cargas de hoje
          </button>
        )}
        {inicio && <p className="dica-sec centro">Treino começou às {hora(inicio)}.</p>}
        <button
          className="botao grande"
          onClick={() => {
            setFim(new Date().toISOString())
            window.scrollTo(0, 0)
          }}
        >
          <CheckCircle2 size={20} /> Concluir treino
        </button>
      </div>
    )

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <h1>Treinos</h1>
      {aviso && <p className="mensagem ok">{aviso}</p>}

      {aluno && <SemanaCartao feitos={t.feitosNaSemana} meta={t.meta} podeMudar={!t.metaDoPersonal && !t.treinos.length} onMudar={t.mudarMetaLocal} />}

      {t.carregando && aluno && <p className="carregando">Carregando sua ficha…</p>}

      {t.sugerida && <AvisoSugerida temFicha={!!t.ficha?.profissional_id} motivos={t.ajuste?.motivos} onPersonais={onPersonais} />}

      {t.rotina && !t.sugerida && (
        <p className="rotina-do-aluno">
          <IconeDaRotina id={t.rotina.icone} objetivo={t.rotina.objetivo} size={18} />
          <span className="rotina-do-aluno-texto">
            <strong>{t.rotina.nome}</strong>
            <small>{[rotuloTipo(t.rotina.icone, t.rotina.objetivo), t.rotina.objetivo, rotuloNivel(t.rotina.nivel), t.rotina.fim && `até ${dataDia(t.rotina.fim)}`].filter(Boolean).join(' · ')}</small>
          </span>
        </p>
      )}
      {podePdf && (
        <button className="botao-sec" onClick={() => setPdf(true)}>
          <FileDown size={16} /> Baixar ficha em PDF
        </button>
      )}
      {janelaPdf}

      {t.lista.length > 0 && (
        <div className="grade-treinos">
          {t.lista.map((x) => (
            <button key={x.id} className={`atalho treino-letra ${t.proximo?.id === x.id ? 'proximo' : ''}`} onClick={() => setAberto(x.letra)}>
              <span className="treino-letra-grande">{x.letra}</span>
              {t.sugerida && <span className="etiqueta-sugerida">Sugerida pelo app</span>}
              <strong>{x.nome || `Treino ${x.letra}`}</strong>
              {x.foco && <span className="treino-foco">{x.foco}</span>}
              <span>
                {x.exercicios.length} exercício{x.exercicios.length === 1 ? '' : 's'}
                {t.proximo?.id === x.id && ' · próximo'}
              </span>
              {!t.sugerida &&
                (() => {
                  const h = historicoDoTreino(x.id, t.feitos)
                  return (
                    <span className={`chip chip-${ROTULO_STATUS[h.status].tom}`}>
                      {h.vezes ? `${h.vezes}x · ${ROTULO_STATUS[h.status].rotulo.replace(' na semana', '').toLowerCase()}` : 'Não iniciado'}
                    </span>
                  )
                })()}
            </button>
          ))}
        </div>
      )}

      {aluno && t.ficha?.profissional_id && <OrientacoesAluno fichaId={t.ficha.id} />}

      {aluno && !t.sugerida && <MeusUltimosTreinos feitos={t.feitos} treinos={t.treinos} onMudou={t.recarregar} />}

      {aluno && t.aerobicos.length > 0 && (
        <section className="cartao">
          <h2>
            <HeartPulse size={18} /> Aeróbico
          </h2>
          <ul className="lista-aerobico">
            {t.aerobicos.map((a) => (
              <li key={a.id}>
                <strong>{a.tipo}</strong>
                <span>{resumoAerobico({ ...a, tipo: '' })}</span>
                {a.observacoes && <small>{a.observacoes}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!aluno && perfil && (
        <section className="cartao destaque">
          <span className="etiqueta">
            <BookCopy size={14} /> Treinos prontos
          </span>
          <h2>Biblioteca de treinos</h2>
          <p className="dica-sec">Guarde treinos em pastas e crie a rotina de um ou de vários alunos com um toque. Já vem com treinos prontos do FormaCerta.</p>
          <button className="botao grande" onClick={() => setBiblioteca(true)}>
            Abrir biblioteca
          </button>
          <p className="dica-sec">Para a rotina de um aluno só, aeróbico e materiais, abra Alunos, escolha o aluno e toque na aba 🏋️ Treino.</p>
        </section>
      )}

      {perfil && !aluno && <CartaoBibliotecaExercicios meuId={perfil.id} admin={perfil.papel === 'admin'} lista={exercicios.lista} onMudou={exercicios.recarregar} />}

      <section className="grupo-atalhos">
        <h2 className="secao">Ferramentas</h2>
        <div className="atalhos">
          <button className="atalho" onClick={() => onCamera()}>
            <span className="atalho-icone">
              <PlayCircle size={20} />
            </span>
            <strong>Exercício em vídeo</strong>
            <span>Conta as repetições e corrige</span>
          </button>
          <button className="atalho" onClick={onCarga}>
            <span className="atalho-icone">
              <Dumbbell size={20} />
            </span>
            <strong>Projeção de carga</strong>
            <span>Quanto colocar no próximo treino</span>
          </button>
        </div>
      </section>

      {aluno && <ListaMateriais />}
    </div>
  )
}
