import { CheckCircle2, ClipboardList, Film, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { Ficha } from '../../nuvem/fichas'
import { listarRotinas, listarTreinosDasRotinas, type Rotina } from '../../nuvem/rotinas'
import { definirMetaSemana, exercicioVazio, type ExercicioTreino, type Treino } from '../../nuvem/treinos'
import { SUGESTOES_EXERCICIO } from '../../treino/carga'
import { acharExercicio, comoFazerDe, type ExercicioProprio } from '../../treino/comoFazer'
import { linhaVazia, tipoDe, TIPOS_LINHA, type CampoLinha, type LinhaSerie, type TipoLinha } from '../../treino/linhas'
import { EXERCICIOS_MOBILIDADE } from '../../treino/videosApp'
import { andamento, dataDia, rotinaAtual } from '../../treino/rotinas'
import { FormExercicio, MeusExercicios, MidiaExercicio } from './ComoFazer'
import { useExercicios } from './useExercicios'
import { MateriaisEditor } from './Materiais'
import { RetornosAluno } from './RetornosAluno'
import { IconeDaRotina } from './IconeRotina'

const SUGESTOES = [...EXERCICIOS.map((e) => e.nome), ...SUGESTOES_EXERCICIO, ...EXERCICIOS_MOBILIDADE]

export type Biblioteca = { meuId: string; lista: ExercicioProprio[]; onMudou: () => void }

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
  const mudarEx = (i: number, mudancas: Partial<ExercicioTreino>) => onMudar(exercicios.map((e, j) => (j === i ? { ...e, ...mudancas } : e)))
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
        <button type="button" className="botao-sec" onClick={() => onMudar([...exercicios, exercicioVazio()])}>
          <Plus size={16} /> Exercício
        </button>
      )}
    </>
  )
}

/** Aba Treino da ficha (personal): rotina atual, meta da semana, retorno dos treinos e materiais. */
export function EditorTreinos({ ficha, meuId, onAbrirRotinas }: { ficha: Ficha; meuId: string; onAbrirRotinas: () => void }) {
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null)
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [faltaSql, setFaltaSql] = useState(false)
  const [meta, setMeta] = useState<number | null>(ficha.treinos_semana ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const exercicios = useExercicios()

  useEffect(() => {
    let vivo = true
    listarRotinas(ficha.id).then(async (r) => {
      const t = await listarTreinosDasRotinas(r.rotinas.map((x) => x.id))
      if (!vivo) return
      setRotinas(r.rotinas)
      setTreinos(t)
      setFaltaSql(r.semTabela)
      setErro(r.semTabela ? null : r.erro)
    })
    return () => {
      vivo = false
    }
  }, [ficha.id])

  async function mudarMeta(v: string) {
    const n = v ? Number(v) : null
    const e = await definirMetaSemana(ficha.id, n)
    if (e) setErro(e)
    else setMeta(n)
  }

  const atual = rotinas ? rotinaAtual(rotinas) : null
  const treinosAtual = treinos.filter((t) => t.rotina_id === atual?.id)
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
          <button className="rotina-resumo" onClick={onAbrirRotinas}>
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
        )}
        {!faltaSql && (
          <button className="botao" onClick={onAbrirRotinas}>
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
      <RetornosAluno ficha={ficha} treinos={treinos} />
      <MeusExercicios meuId={meuId} admin={false} lista={exercicios.lista} onMudou={exercicios.recarregar} />
      <MateriaisEditor meuId={meuId} fichaId={ficha.id} nome={ficha.nome} />
    </>
  )
}
