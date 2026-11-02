import { CheckCircle2, ClipboardList, Film, Library, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { Ficha } from '../../nuvem/fichas'
import { listarRotinas, listarTreinosDasRotinas, type Rotina } from '../../nuvem/rotinas'
import { definirMetaSemana, exercicioVazio, listarFeitos, listarFeitosDosTreinos, type ExercicioTreino, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { SUGESTOES_EXERCICIO } from '../../treino/carga'
import { acharExercicio, comoFazerDe, type ExercicioProprio } from '../../treino/comoFazer'
import { linhaVazia, tipoDe, TIPOS_LINHA, type CampoLinha, type LinhaSerie, type TipoLinha } from '../../treino/linhas'
import { EXERCICIOS_MOBILIDADE } from '../../treino/videosApp'
import { CATALOGO } from '../../treino/catalogo'
import { andamento, dataDia, rotinaAtual } from '../../treino/rotinas'
import { FormExercicio, MidiaExercicio } from './ComoFazer'
import { BibliotecaExercicios, CartaoBibliotecaExercicios } from './BibliotecaExercicios'
import { useExercicios } from './useExercicios'
import { MateriaisEditor } from './Materiais'
import { IconeDaRotina } from './IconeRotina'
import { FeedbacksPersonal } from './Feedbacks'
import { OrientacoesPersonal } from './Orientacoes'
import { useAtualizacao } from './useAtualizacao'
import { historicoDoTreino, ROTULO_STATUS } from '../../treino/execucao'
import { dataCurta } from '../../testes/formato'
import type { Vista } from './Rotinas'

const SUGESTOES = [...EXERCICIOS.map((e) => e.nome), ...SUGESTOES_EXERCICIO, ...EXERCICIOS_MOBILIDADE, ...CATALOGO.map((e) => e.nome)]

export type Biblioteca = { meuId: string; admin?: boolean; lista: ExercicioProprio[]; onMudou: () => void }

/** Embaixo do nome do exercício: mostra a foto ou o vídeo que o aluno vai ver, ou deixa cadastrar. */
function MidiaNaFicha({ nome, bib }: { nome: string; bib: Biblioteca }) {
  const [aberto, setAberto] = useState<'ver' | 'cadastrar' | null>(null)
  const ex = comoFazerDe(bib.lista, nome, bib.meuId)
  if (!nome.trim()) return null
  const proprio = acharExercicio(bib.lista, nome, bib.meuId)
  const meu = proprio && proprio.profissional_id === bib.meuId ? proprio : undefined
  if (aberto === 'cadastrar')
    return (
      <FormExercicio
        meuId={bib.meuId}
        admin={false}
        antes={meu}
        nomeInicial={nome.trim()}
        onCancelar={() => setAberto(null)}
        onPronto={() => {
          setAberto('ver')
          bib.onMudou()
        }}
      />
    )
  return (
    <div className="midia-ficha">
      {ex?.tipo ? (
        <button type="button" className="link" onClick={() => setAberto(aberto ? null : 'ver')}>
          <CheckCircle2 size={14} /> {meu?.tipo ? 'Com seu vídeo/foto' : 'Vídeo do app'} · {aberto ? 'esconder' : 'ver'}
        </button>
      ) : (
        <span className="dica-sec">Sem foto ou vídeo: o aluno vê uma busca no YouTube.</span>
      )}
      <button type="button" className="link" onClick={() => setAberto('cadastrar')}>
        <Film size={14} /> {meu?.tipo ? 'Trocar' : 'Pôr meu vídeo ou foto'}
      </button>
      {aberto === 'ver' && <MidiaExercicio nome={nome} ex={ex} />}
    </div>
  )
}

/** Linhas do exercício: cada uma com os campos do tipo escolhido (série/rep, carga, intervalo...). */
function EditorLinhas({ linhas, onMudar }: { linhas: LinhaSerie[]; onMudar: (l: LinhaSerie[]) => void }) {
  const [tipoNovo, setTipoNovo] = useState<TipoLinha>('reps_carga')
  const mudar = (i: number, chave: CampoLinha, valor: string) => onMudar(linhas.map((l, j) => (j === i ? { ...l, [chave]: valor } : l)))
  return (
    <>
      <ul className="linhas-serie">
        {linhas.map((l, i) => {
          const t = tipoDe(l.tipo)
          return (
            <li key={i} className="linha-serie">
              <div className="linha-serie-campos" style={{ '--n': t.campos.length } as React.CSSProperties}>
                {t.campos.map((k) => (
                  <label key={k.chave} className="campo">
                    {k.rotulo}
                    <input value={l[k.chave] ?? ''} onChange={(e) => mudar(i, k.chave, e.target.value)} maxLength={k.max} placeholder={k.exemplo} />
                  </label>
                ))}
              </div>
              <button type="button" className="icone-apagar" aria-label={`Tirar linha ${t.nome}`} onClick={() => onMudar(linhas.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </li>
          )
        })}
      </ul>
      {linhas.length < 20 && (
        <div className="nova-linha">
          <select value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value as TipoLinha)} aria-label="Tipo da linha">
            {TIPOS_LINHA.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.nome}
              </option>
            ))}
          </select>
          <button type="button" className="botao-sec" onClick={() => onMudar([...linhas, linhaVazia(tipoNovo)])}>
            <Plus size={16} /> Linha
          </button>
        </div>
      )}
    </>
  )
}

/** Lista de exercícios de um treino, com sugestões, foto/vídeo e linhas de cada um. */
export function EditorExercicios({ exercicios, bib, onMudar }: { exercicios: ExercicioTreino[]; bib: Biblioteca; onMudar: (e: ExercicioTreino[]) => void }) {
  const [buscando, setBuscando] = useState(false)
  const mudarEx = (i: number, mudancas: Partial<ExercicioTreino>) => onMudar(exercicios.map((e, j) => (j === i ? { ...e, ...mudancas } : e)))

  /** Exercícios escolhidos na biblioteca entram no fim do treino, no lugar das linhas em branco. */
  function adicionar(nomes: string[]) {
    const preenchidos = exercicios.filter((e) => e.nome.trim())
    const cabem = Math.max(0, 30 - preenchidos.length)
    onMudar([...preenchidos, ...nomes.slice(0, cabem).map((nome) => ({ ...exercicioVazio(), nome }))])
    setBuscando(false)
  }

  return (
    <>
      <p className="dica-sec">Em cada exercício, adicione as linhas que quiser: escolha o tipo (repetições e carga, cadência, observações...) e toque em + Linha.</p>
      <datalist id="sugestoes-treino">
        {[...new Set([...bib.lista.map((e) => e.nome), ...SUGESTOES])].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <ol className="exercicios-editor">
        {exercicios.map((ex, i) => (
          <li key={i}>
            <div className="exercicio-linha">
              <input list="sugestoes-treino" value={ex.nome} onChange={(e) => mudarEx(i, { nome: e.target.value })} maxLength={80} placeholder="Exercício" aria-label="Exercício" />
              <button type="button" className="icone-apagar" aria-label="Tirar exercício" onClick={() => onMudar(exercicios.filter((_, j) => j !== i))}>
                <X size={16} />
              </button>
            </div>
            <MidiaNaFicha nome={ex.nome} bib={bib} />
            <EditorLinhas linhas={ex.linhas ?? []} onMudar={(linhas) => mudarEx(i, { linhas })} />
          </li>
        ))}
      </ol>
      {exercicios.length < 30 && (
        <div className="acoes-exercicio">
          <button type="button" className="botao" onClick={() => setBuscando(true)}>
            <Library size={16} /> Buscar na biblioteca
          </button>
          <button type="button" className="botao-sec" onClick={() => onMudar([...exercicios, exercicioVazio()])}>
            <Plus size={16} /> Digitar exercício
          </button>
        </div>
      )}
      {buscando && (
        <BibliotecaExercicios
          meuId={bib.meuId}
          admin={!!bib.admin}
          lista={bib.lista}
          onMudou={bib.onMudou}
          onFechar={() => setBuscando(false)}
          escolha={{ naFicha: exercicios.map((e) => e.nome), onAdicionar: adicionar }}
        />
      )}
    </>
  )
}

/** Aba Treino da ficha (personal): rotina atual com a situação de cada treino, orientações, feedback, meta da semana e materiais. */
export function EditorTreinos({ ficha, meuId, onAbrirRotinas }: { ficha: Ficha; meuId: string; onAbrirRotinas: (v?: Vista) => void }) {
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null)
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [execucoes, setExecucoes] = useState<TreinoFeito[]>([])
  const [recentes, setRecentes] = useState<TreinoFeito[] | null>(null)
  const [faltaSql, setFaltaSql] = useState(false)
  const [meta, setMeta] = useState<number | null>(ficha.treinos_semana ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const exercicios = useExercicios()

  const carregar = useCallback(async () => {
    const r = await listarRotinas(ficha.id)
    const t = await listarTreinosDasRotinas(r.rotinas.map((x) => x.id))
    const atualId = rotinaAtual(r.rotinas)?.id
    const [ex, rec] = await Promise.all([listarFeitosDosTreinos(t.filter((x) => x.rotina_id === atualId).map((x) => x.id)), listarFeitos(ficha.id, 90)])
    setRotinas(r.rotinas)
    setTreinos(t)
    setExecucoes(ex)
    setRecentes(rec)
    setFaltaSql(r.semTabela)
    setErro(r.semTabela ? null : r.erro)
  }, [ficha.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  // O aluno concluiu ou avaliou um treino: aparece aqui sozinho.
  useAtualizacao(carregar)

  async function mudarMeta(v: string) {
    const n = v ? Number(v) : null
    const e = await definirMetaSemana(ficha.id, n)
    if (e) setErro(e)
    else setMeta(n)
  }

  const atual = rotinas ? rotinaAtual(rotinas) : null
  const treinosAtual = treinos.filter((t) => t.rotina_id === atual?.id).sort((a, b) => a.letra.localeCompare(b.letra))
  const primeiro = ficha.nome.split(' ')[0]
  const guardadas = rotinas?.filter((r) => r.situacao !== 'excluida').length ?? 0

  return (
    <>
      <section className="cartao">
        <h2>Rotinas de treino</h2>
        <p className="dica-sec">{primeiro} segue a rotina que está valendo, vê o próximo treino na tela inicial e marca quando concluir. As rotinas antigas ficam guardadas.</p>
        {faltaSql && <p className="mensagem erro">Falta rodar no Supabase o arquivo rotinas-de-treino.sql para as rotinas funcionarem.</p>}
        {rotinas === null && <p className="carregando">Carregando rotinas…</p>}
        {rotinas && !atual && !faltaSql && <p className="dica-sec">Nenhuma rotina valendo. Enquanto isso, {primeiro} vê a série sugerida pelo app, com o aviso para procurar um personal.</p>}
        {atual && (
          <>
            <button className="rotina-resumo" onClick={() => onAbrirRotinas({ tipo: 'rotina', id: atual.id })}>
              <IconeDaRotina id={atual.icone} objetivo={atual.objetivo} />
              <span>
                <strong>{atual.nome}</strong>
                <small>
                  {treinosAtual.map((t) => t.letra).join(' ') || 'Sem treinos'}
                  {atual.fim && ` · até ${dataDia(atual.fim)}`}
                </small>
              </span>
              <span className={`chip chip-${andamento(atual).tom}`}>{andamento(atual).rotulo}</span>
            </button>
            {treinosAtual.length > 0 && (
              <ul className="status-treinos">
                {treinosAtual.map((t) => {
                  const h = historicoDoTreino(t.id, execucoes)
                  const st = ROTULO_STATUS[h.status]
                  return (
                    <li key={t.id}>
                      <b className="verde">{t.letra}</b>
                      <span>
                        {t.nome || `Treino ${t.letra}`}
                        <small className="dica-sec">
                          {h.vezes}x{h.ultima ? ` · última ${dataCurta(h.ultima)}` : ''}
                        </small>
                      </span>
                      <span className={`chip chip-${st.tom}`}>{st.rotulo.replace(' na semana', '')}</span>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="acoes-linha">
              <button className="botao" onClick={() => onAbrirRotinas({ tipo: 'evolucao', id: atual.id })}>
                <TrendingUp size={16} /> Evolução
              </button>
              <button className="botao-sec" onClick={() => onAbrirRotinas({ tipo: 'rotina', id: atual.id })}>
                <ClipboardList size={16} /> Abrir rotina
              </button>
            </div>
          </>
        )}
        {!faltaSql && (
          <button className={atual ? 'botao-sec' : 'botao'} onClick={() => onAbrirRotinas()}>
            <ClipboardList size={18} /> {guardadas > 1 ? `Ver as ${guardadas} rotinas` : atual ? 'Gerenciar rotinas' : 'Criar rotina'}
          </button>
        )}
        <label className="campo">
          Meta de treinos por semana
          <select value={meta ?? ''} onChange={(e) => mudarMeta(e.target.value)}>
            <option value="">Igual ao número de treinos ({treinosAtual.length || 3})</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} por semana
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="mensagem erro">{erro}</p>}
      </section>
      <OrientacoesPersonal ficha={ficha} />
      <FeedbacksPersonal nome={ficha.nome} feitos={recentes} treinos={treinos} onMudou={carregar} />
      <CartaoBibliotecaExercicios meuId={meuId} admin={false} lista={exercicios.lista} onMudou={exercicios.recarregar} />
      <MateriaisEditor meuId={meuId} fichaId={ficha.id} nome={ficha.nome} />
    </>
  )
}
