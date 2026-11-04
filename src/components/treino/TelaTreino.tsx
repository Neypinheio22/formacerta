import { BadgeCheck, BookCopy, Dumbbell, FileDown, HeartPulse, History, PlayCircle, Star, TriangleAlert, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { ExercicioId } from '../../movimento/tipos'
import type { Perfil } from '../../nuvem/conta'
import { avaliarTreino, marcarDia, marcarFeito, type Retorno, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { dataCurta } from '../../testes/formato'
import { comoFazerDe } from '../../treino/comoFazer'
import { carregarSeries, gravarSeries } from '../../treino/carga'
import { historicoDoTreino, ROTULO_STATUS, temFeedback, ultimaCarga, type CargaExercicio, type Feedback } from '../../treino/execucao'
import { FormAvaliar, ResumoFeedback } from './Feedbacks'
import { OrientacoesAluno } from './Orientacoes'
import { useAtualizacao } from './useAtualizacao'
import { diaLocal } from '../../treino/semana'
import { SemanaCartao } from './CartoesAluno'
import { CartaoBibliotecaExercicios } from './BibliotecaExercicios'
import { useExercicios } from './useExercicios'
import { ListaMateriais } from './Materiais'
import { gravarUltimaSugerida, useMeuTreino } from './useMeuTreino'
import { AVISO_SUGERIDA } from '../../treino/sugerida'
import { dataDia, resumoAerobico, rotuloNivel, rotuloTipo } from '../../treino/rotinas'
import { IconeDaRotina } from './IconeRotina'
import { TelaBiblioteca } from './BibliotecaTreinos'
import { ExportarPdf } from './ExportarPdf'
import { SessaoTreino, sessaoIniciada } from './SessaoTreino'

type Props = {
  perfil: Perfil | null
  /** Letra do treino para abrir direto (vindo do "Ir para o treino" da tela inicial). */
  abrir?: string
  onVoltar: () => void
  onCamera: (exercicio?: ExercicioId) => void
  onCarga: () => void
  onPersonais: () => void
}

/** As séries anotadas também vão para o Diário de cargas do aparelho (projeção de carga). */
function levarParaDiario(cargas: CargaExercicio[]) {
  const novas = cargas.flatMap((c) =>
    c.series.filter((x) => x.kg && x.reps).map((x, i) => ({ id: `${Date.now()}-${c.nome}-${i}`, date: new Date().toISOString(), exercicio: c.nome, kg: x.kg!, reps: Math.round(x.reps!) })),
  )
  if (novas.length) gravarSeries([...carregarSeries(), ...novas])
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
  const aluno = perfil?.papel === 'aluno'
  const exercicios = useExercicios(!!perfil)
  const profissionalId = t.ficha?.profissional_id ?? perfil?.profissional_id ?? perfil?.id

  const [biblioteca, setBiblioteca] = useState(false)
  const [pdf, setPdf] = useState(false)
  const treino = t.lista.find((x) => x.letra === aberto) ?? null
  const anotar = !t.sugerida && !!t.ficha

  // O personal mudou a ficha ou respondeu: aparece sozinho quando o aluno volta ao
  // app (fora do meio de um treino já iniciado, para não mexer no que ele anotou).
  useAtualizacao(() => {
    if (!treino || !sessaoIniciada(treino.id)) t.recarregar()
  }, 60)

  async function concluir(tr: Treino, retorno: Retorno, feedback: Feedback, cargas: CargaExercicio[]): Promise<boolean> {
    setSalvando(true)
    setAviso(null)
    const erro = perfil && !t.sugerida ? await marcarFeito(perfil.id, tr, retorno, { cargas, feedback }) : null
    setSalvando(false)
    if (erro) {
      setAviso(erro)
      return false
    }
    levarParaDiario(cargas)
    marcarDia(diaLocal(new Date()))
    if (t.sugerida) gravarUltimaSugerida(tr.letra)
    setAviso(`Treino ${tr.letra} concluído! Mandou bem. 💪`)
    setAberto(null)
    t.recarregar()
    window.scrollTo(0, 0)
    return true
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

  const podePdf = aluno && !t.sugerida && !!t.rotina && !!t.ficha && t.treinos.length > 0
  const janelaPdf =
    pdf && podePdf ? (
      <ExportarPdf rotina={t.rotina!} treinos={t.treinos} ficha={t.ficha!} quem="aluno" letraInicial={treino?.letra} exercicios={exercicios.lista} onFechar={() => setPdf(false)} />
    ) : null

  if (treino)
    return (
      <SessaoTreino
        key={treino.id}
        treino={treino}
        comPersonal={anotar}
        comoFazerDe={(nome) => comoFazerDe(exercicios.lista, nome, profissionalId)}
        ultimaDe={(nome) => ultimaCarga(t.feitos, nome)}
        salvando={salvando}
        erro={aviso}
        onVoltar={() => {
          setAberto(null)
          setAviso(null)
        }}
        onCamera={onCamera}
        onConcluir={(r, f, c) => concluir(treino, r, f, c)}
        topo={
          <>
            {t.sugerida && <AvisoSugerida temFicha={!!t.ficha?.profissional_id} motivos={t.ajuste?.motivos} onPersonais={onPersonais} />}
            {podePdf && (
              <button className="link link-discreto" onClick={() => setPdf(true)}>
                <FileDown size={14} /> Baixar este treino em PDF
              </button>
            )}
            {janelaPdf}
          </>
        }
      />
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
