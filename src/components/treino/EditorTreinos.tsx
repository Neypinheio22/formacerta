import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EXERCICIOS } from '../../movimento/exercicios'
import type { Ficha } from '../../nuvem/fichas'
import { apagarTreino, definirMetaSemana, exercicioVazio, listarTreinos, salvarTreino, type ExercicioTreino, type Treino } from '../../nuvem/treinos'
import { SUGESTOES_EXERCICIO } from '../../treino/carga'
import { proximaLetra } from '../../treino/semana'
import { MateriaisEditor } from './Materiais'

const SUGESTOES = [...new Set([...EXERCICIOS.map((e) => e.nome), ...SUGESTOES_EXERCICIO])].sort((a, b) => a.localeCompare(b, 'pt-BR'))

type Rascunho = { id?: string; letra: string; nome: string; exercicios: ExercicioTreino[] }

function FormTreino({ inicial, onSalvar, onCancelar }: { inicial: Rascunho; onSalvar: (r: Rascunho) => Promise<string | null>; onCancelar: () => void }) {
  const [r, setR] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const mudarEx = (i: number, campo: keyof ExercicioTreino, valor: string) =>
    setR((x) => ({ ...x, exercicios: x.exercicios.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)) }))

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
      <datalist id="sugestoes-treino">
        {SUGESTOES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <ol className="exercicios-editor">
        {r.exercicios.map((ex, i) => (
          <li key={i}>
            <div className="exercicio-linha">
              <input list="sugestoes-treino" value={ex.nome} onChange={(e) => mudarEx(i, 'nome', e.target.value)} maxLength={80} placeholder="Exercício" aria-label="Exercício" />
              <button type="button" className="icone-apagar" aria-label="Tirar exercício" onClick={() => setR({ ...r, exercicios: r.exercicios.filter((_, j) => j !== i) })}>
                <X size={16} />
              </button>
            </div>
            <div className="tres-campos">
              <label className="campo">
                Séries
                <input value={ex.series} onChange={(e) => mudarEx(i, 'series', e.target.value)} maxLength={10} inputMode="numeric" />
              </label>
              <label className="campo">
                Repetições
                <input value={ex.reps} onChange={(e) => mudarEx(i, 'reps', e.target.value)} maxLength={20} />
              </label>
              <label className="campo">
                Dica
                <input value={ex.obs} onChange={(e) => mudarEx(i, 'obs', e.target.value)} maxLength={200} placeholder="Ex.: 60 s descanso" />
              </label>
            </div>
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
        {treinos?.length === 0 && <p className="dica-sec">Nenhum treino ainda. Comece pelo treino A.</p>}
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
      <MateriaisEditor meuId={meuId} fichaId={ficha.id} nome={ficha.nome} />
    </>
  )
}
