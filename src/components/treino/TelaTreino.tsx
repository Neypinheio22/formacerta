import { BadgeCheck, Camera, CheckCircle2, Dumbbell, Medal, PlayCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { ExercicioId } from '../../movimento/tipos'
import type { Perfil } from '../../nuvem/conta'
import { INTENSIDADES, marcarDia, marcarFeito, type ExercicioTreino, type Retorno, type Treino } from '../../nuvem/treinos'
import { numero } from '../../testes/formato'
import { carregarSeries, doExercicio, proximaCarga, type Faixa } from '../../treino/carga'
import { linhasDe, repsDe, resumoLinha } from '../../treino/linhas'
import { hora, minutos, textoDuracao } from '../../treino/retorno'
import { diaLocal, noCatalogo } from '../../treino/semana'
import { SemanaCartao } from './CartoesAluno'
import { ListaMateriais } from './Materiais'
import { gravarUltimaSugerida, useMeuTreino } from './useMeuTreino'
import { AVISO_SUGERIDA } from '../../treino/sugerida'

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

function LinhaExercicio({ ex, onCamera }: { ex: ExercicioTreino; onCamera: (id: ExercicioId) => void }) {
  const naCamera = noCatalogo(EXERCICIOS, ex.nome)
  const series = useMemo(() => doExercicio(carregarSeries(), ex.nome), [ex.nome])
  const ultima = series[series.length - 1]
  const sugestao = ultima ? proximaCarga(ultima, faixaDe(repsDe(ex)), 2) : null
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
        {ultima && sugestao && (
          <span className="exercicio-carga">
            Última: {kg(ultima.kg)} × {ultima.reps} · hoje: <b className="verde">{kg(sugestao.kg)}</b>
          </span>
        )}
      </div>
      {naCamera && (
        <button className="botao-sec camera-mini" onClick={() => onCamera(naCamera.id)} aria-label={`Corrigir ${ex.nome} com a câmera`}>
          <Camera size={16} />
        </button>
      )}
    </li>
  )
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

/** Tela "Treino finalizado": início, fim, tempo, intensidade e comentário para o personal. */
function TreinoFinalizado({ treino, inicio, fim, salvando, erro, comPersonal, onConcluir, onVoltar }: { treino: Treino; inicio: string; fim: string; salvando: boolean; erro: string | null; comPersonal: boolean; onConcluir: (r: Retorno) => void; onVoltar: () => void }) {
  const [intensidade, setIntensidade] = useState('')
  const [comentario, setComentario] = useState('')
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
        </dl>
      </section>
      <form
        className="cartao formulario"
        onSubmit={(e) => {
          e.preventDefault()
          onConcluir({ inicio, fim, intensidade, comentario })
        }}
      >
        <label className="campo">
          Como foi a intensidade do treino?
          <select value={intensidade} onChange={(e) => setIntensidade(e.target.value)} required>
            <option value="" disabled>
              Selecione
            </option>
            {INTENSIDADES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Se quiser, deixe seu comentário
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} rows={4} placeholder="Ex.: senti o joelho no afundo, deu para subir a carga no supino…" />
        </label>
        {erro && <p className="mensagem erro">{erro}</p>}
        {comPersonal && <p className="dica-sec">Seu personal vê o tempo, a intensidade e o comentário na sua ficha.</p>}
        <button className="botao grande" type="submit" disabled={salvando || !intensidade}>
          <CheckCircle2 size={20} /> {salvando ? 'Guardando…' : 'Concluir'}
        </button>
      </form>
    </div>
  )
}

/** Aviso fixo da série sugerida: quem monta o treino é o personal. */
function AvisoSugerida({ temFicha, onPersonais }: { temFicha: boolean; onPersonais: () => void }) {
  return (
    <section className="cartao aviso-sugerida">
      <p>
        <TriangleAlert size={18} /> <b>Série sugerida, não é o seu treino personalizado.</b>
      </p>
      <p className="dica-sec">{AVISO_SUGERIDA}</p>
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

  const treino = t.lista.find((x) => x.letra === aberto) ?? null

  // O relógio do treino começa quando o aluno abre o treino.
  useEffect(() => {
    setInicio(treino ? inicioDoTreino(treino.letra) : null)
    setFim(null)
  }, [treino?.letra])

  async function concluir(tr: Treino | null, retorno?: Retorno) {
    setSalvando(true)
    setAviso(null)
    const erro = tr && perfil && !t.sugerida ? await marcarFeito(perfil.id, tr, retorno) : null
    setSalvando(false)
    if (erro) return setAviso(erro)
    esquecerInicio()
    setFim(null)
    marcarDia(diaLocal(new Date()))
    if (tr && t.sugerida) gravarUltimaSugerida(tr.letra)
    setAviso(tr ? `Treino ${tr.letra} concluído! Mandou bem. 💪` : 'Treino de hoje marcado! 💪')
    setAberto(null)
    t.recarregar()
    window.scrollTo(0, 0)
  }

  if (treino && inicio && fim)
    return (
      <TreinoFinalizado
        treino={treino}
        inicio={inicio}
        fim={fim}
        salvando={salvando}
        erro={aviso}
        comPersonal={!t.sugerida}
        onVoltar={() => setFim(null)}
        onConcluir={(r) => concluir(treino, r)}
      />
    )

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
        {t.sugerida && <AvisoSugerida temFicha={!!t.ficha} onPersonais={onPersonais} />}
        <p className="dica-sec">Toque na câmera ao lado do exercício para o app contar as repetições e corrigir o movimento.</p>
        <ol className="lista-treino">
          {treino.exercicios.map((ex, i) => (
            <LinhaExercicio key={i} ex={ex} onCamera={onCamera} />
          ))}
        </ol>
        <button className="botao-sec" onClick={onCarga}>
          <Dumbbell size={16} /> Anotar as cargas de hoje
        </button>
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

      {t.sugerida && <AvisoSugerida temFicha={!!t.ficha} onPersonais={onPersonais} />}

      {t.lista.length > 0 && (
        <div className="grade-treinos">
          {t.lista.map((x) => (
            <button key={x.id} className={`atalho treino-letra ${t.proximo?.id === x.id ? 'proximo' : ''}`} onClick={() => setAberto(x.letra)}>
              <span className="treino-letra-grande">{x.letra}</span>
              {t.sugerida && <span className="etiqueta-sugerida">Sugerida pelo app</span>}
              <strong>{x.nome || `Treino ${x.letra}`}</strong>
              <span>
                {x.exercicios.length} exercício{x.exercicios.length === 1 ? '' : 's'}
                {t.proximo?.id === x.id && ' · próximo'}
              </span>
            </button>
          ))}
        </div>
      )}

      {!aluno && (
        <section className="cartao">
          <h2>Ficha de treino dos alunos</h2>
          <p className="dica-sec">Para montar os treinos A, B, C e mandar materiais, abra Alunos, escolha o aluno e toque na aba 🏋️ Treino.</p>
        </section>
      )}

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
