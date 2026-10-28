import { CheckCircle2, Copy, Film, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { Ficha } from '../../nuvem/fichas'
import { apagarTreino, definirMetaSemana, exercicioVazio, listarTreinos, salvarTreino, type ExercicioTreino, type Treino } from '../../nuvem/treinos'
import { SUGESTOES_EXERCICIO } from '../../treino/carga'
import { acharExercicio, comoFazerDe, type ExercicioProprio } from '../../treino/comoFazer'
import { linhasDe, linhaVazia, tipoDe, TIPOS_LINHA, type CampoLinha, type LinhaSerie, type TipoLinha } from '../../treino/linhas'
import { EXERCICIOS_MOBILIDADE } from '../../treino/videosApp'
import { proximaLetra } from '../../treino/semana'
import { SERIE_SUGERIDA } from '../../treino/sugerida'
import { FormExercicio, MeusExercicios, MidiaExercicio } from './ComoFazer'
import { useExercicios } from './useExercicios'
import { MateriaisEditor } from './Materiais'
import { RetornosAluno } from './RetornosAluno'

const SUGESTOES = [...EXERCICIOS.map((e) => e.nome), ...SUGESTOES_EXERCICIO, ...EXERCICIOS_MOBILIDADE]

type Biblioteca = { meuId: string; lista: ExercicioProprio[]; onMudou: () => void }

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

type Rascunho = { id?: string; letra: string; nome: string; exercicios: ExercicioTreino[] }

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

function FormTreino({ inicial, bib, onSalvar, onCancelar }: { inicial: Rascunho; bib: Biblioteca; onSalvar: (r: Rascunho) => Promise<string | null>; onCancelar: () => void }) {
  // Treinos antigos (séries, repetições e dica) abrem já convertidos em linhas.
  const [r, setR] = useState<Rascunho>(() => ({ ...inicial, exercicios: inicial.exercicios.map((e) => ({ ...e, linhas: linhasDe(e) })) }))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mudarEx = (i: number, mudancas: Partial<ExercicioTreino>) => setR((x) => ({ ...x, exercicios: x.exercicios.map((e, j) => (j === i ? { ...e, ...mudancas } : e)) }))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const erro = await onSalvar(r)
    setSalvando(false)
    setErro(erro)
  }

  return (
    <form className="cartao destaque formulario" onSubmit={salvar}>
      <h2>Treino {r.letra}</h2>
      <label className="campo">
        Nome do treino
        <input value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} maxLength={60} placeholder="Ex.: Pernas, Superiores, Glúteo" />
      </label>
      <p className="dica-sec">Em cada exercício, adicione as linhas que quiser: escolha o tipo (repetições e carga, cadência, observações...) e toque em + Linha.</p>
      <datalist id="sugestoes-treino">
        {[...new Set([...bib.lista.map((e) => e.nome), ...SUGESTOES])].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <ol className="exercicios-editor">
        {r.exercicios.map((ex, i) => (
          <li key={i}>
            <div className="exercicio-linha">
              <input list="sugestoes-treino" value={ex.nome} onChange={(e) => mudarEx(i, { nome: e.target.value })} maxLength={80} placeholder="Exercício" aria-label="Exercício" />
              <button type="button" className="icone-apagar" aria-label="Tirar exercício" onClick={() => setR({ ...r, exercicios: r.exercicios.filter((_, j) => j !== i) })}>
                <X size={16} />
              </button>
            </div>
            <MidiaNaFicha nome={ex.nome} bib={bib} />
            <EditorLinhas linhas={ex.linhas ?? []} onMudar={(linhas) => mudarEx(i, { linhas })} />
          </li>
        ))}
      </ol>
      {r.exercicios.length < 30 && (
        <button type="button" className="botao-sec" onClick={() => setR({ ...r, exercicios: [...r.exercicios, exercicioVazio()] })}>
          <Plus size={16} /> Exercício
        </button>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao" type="submit" disabled={salvando || !r.exercicios.some((e) => e.nome.trim())}>
        {salvando ? 'Guardando…' : `Guardar treino ${r.letra}`}
      </button>
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}

/** Aba Treino da ficha (personal): monta os treinos A, B, C..., a meta da semana e os materiais. */
export function EditorTreinos({ ficha, meuId }: { ficha: Ficha; meuId: string }) {
  const [treinos, setTreinos] = useState<Treino[] | null>(null)
  const [editando, setEditando] = useState<Rascunho | null>(null)
  const [meta, setMeta] = useState<number | null>(ficha.treinos_semana ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const exercicios = useExercicios()
  const bib: Biblioteca = { meuId, lista: exercicios.lista, onMudou: exercicios.recarregar }

  const carregar = useCallback(async () => {
    const r = await listarTreinos(ficha.id)
    setTreinos(r.treinos)
    setErro(r.erro)
  }, [ficha.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function mudarMeta(v: string) {
    const n = v ? Number(v) : null
    const e = await definirMetaSemana(ficha.id, n)
    if (e) setErro(e)
    else setMeta(n)
  }

  async function usarSugerida() {
    for (const t of SERIE_SUGERIDA) {
      const e = await salvarTreino(ficha.id, { letra: t.letra, nome: t.nome, exercicios: t.exercicios })
      if (e) return setErro(e)
    }
    carregar()
  }

  async function apagar(t: Treino) {
    if (!confirm(`Apagar o treino ${t.letra}${t.nome ? ` (${t.nome})` : ''}?`)) return
    const e = await apagarTreino(t.id)
    if (e) setErro(e)
    else carregar()
  }

  if (editando)
    return (
      <FormTreino
        inicial={editando}
        bib={bib}
        onCancelar={() => setEditando(null)}
        onSalvar={async (r) => {
          const e = await salvarTreino(ficha.id, r)
          if (!e) {
            setEditando(null)
            carregar()
          }
          return e
        }}
      />
    )

  const livre = treinos ? proximaLetra(treinos.map((t) => t.letra)) : null
  const primeiro = ficha.nome.split(' ')[0]

  return (
    <>
      <section className="cartao">
        <h2>Ficha de treino</h2>
        <p className="dica-sec">{primeiro} vê o próximo treino na tela inicial e marca quando concluir.</p>
        {treinos === null && <p className="carregando">Carregando treinos…</p>}
        {treinos?.length === 0 && (
          <>
            <p className="dica-sec">Nenhum treino ainda. Enquanto isso, {primeiro} vê a série sugerida pelo app, com o aviso para procurar um personal. Comece pelo treino A ou use a série sugerida como base e ajuste.</p>
            <button className="botao-sec" onClick={usarSugerida}>
              <Copy size={16} /> Usar a série sugerida como base
            </button>
          </>
        )}
        {treinos && treinos.length > 0 && (
          <ul className="historico">
            {treinos.map((t) => (
              <li key={t.id}>
                <span className="linha">
                  <span>
                    <b className="verde">{t.letra}</b> {t.nome || 'Sem nome'} · {t.exercicios.length} exercício{t.exercicios.length === 1 ? '' : 's'}
                  </span>
                  <span className="linha-fim">
                    <button className="icone-apagar" aria-label={`Editar treino ${t.letra}`} onClick={() => setEditando({ id: t.id, letra: t.letra, nome: t.nome, exercicios: t.exercicios })}>
                      <Pencil size={16} />
                    </button>
                    <button className="icone-apagar" aria-label={`Apagar treino ${t.letra}`} onClick={() => apagar(t)}>
                      <Trash2 size={16} />
                    </button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {livre && treinos && (
          <button className="botao" onClick={() => setEditando({ letra: livre, nome: '', exercicios: [exercicioVazio()] })}>
            <Plus size={18} /> Treino {livre}
          </button>
        )}
        <label className="campo">
          Meta de treinos por semana
          <select value={meta ?? ''} onChange={(e) => mudarMeta(e.target.value)}>
            <option value="">Igual ao número de treinos ({treinos?.length || 3})</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n} por semana
              </option>
            ))}
          </select>
        </label>
        {erro && <p className="mensagem erro">{erro}</p>}
      </section>
      <RetornosAluno ficha={ficha} treinos={treinos ?? []} />
      <MeusExercicios meuId={meuId} admin={false} lista={exercicios.lista} onMudou={exercicios.recarregar} />
      <MateriaisEditor meuId={meuId} fichaId={ficha.id} nome={ficha.nome} />
    </>
  )
}
