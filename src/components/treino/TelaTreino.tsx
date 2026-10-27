import { Camera, CheckCircle2, Dumbbell, PlayCircle, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { ExercicioId } from '../../movimento/tipos'
import type { Perfil } from '../../nuvem/conta'
import { marcarDia, marcarFeito, type ExercicioTreino, type Treino } from '../../nuvem/treinos'
import { numero } from '../../testes/formato'
import { carregarSeries, doExercicio, proximaCarga, type Faixa } from '../../treino/carga'
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
  const sugestao = ultima ? proximaCarga(ultima, faixaDe(ex.reps), 2) : null
  return (
    <li className="exercicio-treino">
      <div>
        <strong>{ex.nome}</strong>
        <span className="dica-sec">
          {ex.series && `${ex.series} séries`}
          {ex.series && ex.reps && ' × '}
          {ex.reps && `${ex.reps} repetições`}
        </span>
        {ex.obs && <span className="dica-sec">💡 {ex.obs}</span>}
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

/** Aviso fixo da série sugerida: quem monta o treino é o personal. */
function AvisoSugerida({ temFicha }: { temFicha: boolean }) {
  return (
    <section className="cartao aviso-sugerida">
      <p>
        <TriangleAlert size={18} /> <b>Série sugerida, não é o seu treino personalizado.</b>
      </p>
      <p className="dica-sec">{AVISO_SUGERIDA}</p>
      {temFicha && <p className="dica-sec">Seu personal já tem a sua ficha: assim que ele montar os treinos, eles aparecem aqui no lugar desta série.</p>}
    </section>
  )
}

/** Aba Treino: ficha A, B, C do personal, meta da semana e materiais extras. */
export function TelaTreino({ perfil, abrir, onVoltar, onCamera, onCarga }: Props) {
  const t = useMeuTreino(perfil)
  const [aberto, setAberto] = useState<string | null>(abrir ?? null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const aluno = perfil?.papel === 'aluno'

  const treino = t.lista.find((x) => x.letra === aberto) ?? null

  async function concluir(tr: Treino | null) {
    setSalvando(true)
    const erro = tr && perfil && !t.sugerida ? await marcarFeito(perfil.id, tr) : null
    setSalvando(false)
    if (erro) return setAviso(erro)
    marcarDia(diaLocal(new Date()))
    if (tr && t.sugerida) gravarUltimaSugerida(tr.letra)
    setAviso(tr ? `Treino ${tr.letra} concluído! Mandou bem. 💪` : 'Treino de hoje marcado! 💪')
    setAberto(null)
    t.recarregar()
    window.scrollTo(0, 0)
  }

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
        {t.sugerida && <AvisoSugerida temFicha={!!t.ficha} />}
        <p className="dica-sec">Toque na câmera ao lado do exercício para o app contar as repetições e corrigir o movimento.</p>
        <ol className="lista-treino">
          {treino.exercicios.map((ex, i) => (
            <LinhaExercicio key={i} ex={ex} onCamera={onCamera} />
          ))}
        </ol>
        <button className="botao-sec" onClick={onCarga}>
          <Dumbbell size={16} /> Anotar as cargas de hoje
        </button>
        <button className="botao grande" onClick={() => concluir(treino)} disabled={salvando}>
          <CheckCircle2 size={20} /> {salvando ? 'Guardando…' : 'Concluir treino'}
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

      {t.sugerida && <AvisoSugerida temFicha={!!t.ficha} />}

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
