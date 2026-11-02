import { EyeOff, Lightbulb, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Ficha } from '../../nuvem/fichas'
import { apagarOrientacao, listarOrientacoes, rotuloOrientacao, salvarOrientacao, TIPOS_ORIENTACAO, type DadosOrientacao, type Orientacao } from '../../nuvem/orientacoes'
import { dataCurta } from '../../testes/formato'
import { useAtualizacao } from './useAtualizacao'

const vazia = (): DadosOrientacao => ({ tipo: 'orientacao', texto: '', so_personal: false, fixada: false })

function FormOrientacao({ inicial, nomeAluno, onSalvar, onCancelar }: { inicial: DadosOrientacao & { id?: string }; nomeAluno: string; onSalvar: (d: DadosOrientacao) => Promise<string | null>; onCancelar: () => void }) {
  const [d, setD] = useState<DadosOrientacao>(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const tipo = TIPOS_ORIENTACAO.find((t) => t.id === d.tipo)!
  return (
    <form
      className="formulario orientacao-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!d.texto.trim()) return setErro('Escreva a orientação.')
        setSalvando(true)
        const e2 = await onSalvar(d)
        setSalvando(false)
        setErro(e2)
      }}
    >
      <div className="atalhos-data" role="radiogroup" aria-label="Tipo">
        {TIPOS_ORIENTACAO.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={d.tipo === t.id} className={`chip-botao ${d.tipo === t.id ? 'ativo' : ''}`} onClick={() => setD({ ...d, tipo: t.id })}>
            {t.rotulo}
          </button>
        ))}
      </div>
      <label className="campo">
        Texto
        <textarea value={d.texto} onChange={(e) => setD({ ...d, texto: e.target.value })} maxLength={1000} rows={3} placeholder={tipo.exemplo} autoFocus />
      </label>
      <label className="campo-check">
        <input type="checkbox" checked={d.fixada} onChange={(e) => setD({ ...d, fixada: e.target.checked })} /> Fixar no topo
      </label>
      <label className="campo-check">
        <input type="checkbox" checked={d.so_personal} onChange={(e) => setD({ ...d, so_personal: e.target.checked })} /> Só eu vejo ({nomeAluno} não recebe)
      </label>
      {erro && <p className="mensagem erro">{erro}</p>}
      <div className="acoes-linha">
        <button className="botao" type="submit" disabled={salvando}>
          {salvando ? 'Guardando…' : inicial.id ? 'Salvar' : 'Adicionar'}
        </button>
        <button className="botao-sec" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Painel do aluno (personal): orientações gerais, recomendações e observações individuais. */
export function OrientacoesPersonal({ ficha }: { ficha: Ficha }) {
  const [lista, setLista] = useState<Orientacao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<(DadosOrientacao & { id?: string }) | null>(null)
  const primeiro = ficha.nome.split(' ')[0]

  const carregar = useCallback(async () => {
    const r = await listarOrientacoes(ficha.id)
    setLista(r.lista)
    setErro(r.erro)
  }, [ficha.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(d: DadosOrientacao, id?: string) {
    const e = await salvarOrientacao(ficha.id, id, d)
    if (e) return e
    setEditando(null)
    await carregar()
    return null
  }

  async function apagar(o: Orientacao) {
    if (!confirm('Apagar esta orientação?')) return
    const e = await apagarOrientacao(o.id)
    if (e) setErro(e)
    else carregar()
  }

  return (
    <section className="cartao orientacoes">
      <h2>
        <Lightbulb size={18} /> Orientações para {primeiro}
      </h2>
      <p className="dica-sec">{primeiro} vê na aba Treino, menos as marcadas “só eu vejo”.</p>
      {lista === null && !erro && <p className="carregando">Carregando…</p>}
      {erro && <p className="mensagem erro">{erro}</p>}
      {lista && lista.length > 0 && (
        <ul className="orientacoes-lista">
          {lista.map((o) =>
            editando?.id === o.id ? (
              <li key={o.id}>
                <FormOrientacao inicial={editando} nomeAluno={primeiro} onSalvar={(d) => salvar(d, o.id)} onCancelar={() => setEditando(null)} />
              </li>
            ) : (
              <li key={o.id} className={`orientacao orientacao-${o.tipo}`}>
                <span className="linha-fim">
                  <span className="orientacao-tipo">
                    {o.fixada && <Pin size={13} />} {rotuloOrientacao(o.tipo)}
                    {o.so_personal && (
                      <span className="chip chip-neutro">
                        <EyeOff size={12} /> só você
                      </span>
                    )}
                  </span>
                  <span className="orientacao-acoes">
                    <button className="icone-apagar" aria-label={o.fixada ? 'Desafixar' : 'Fixar'} onClick={() => salvar({ ...o, fixada: !o.fixada }, o.id)}>
                      {o.fixada ? <PinOff size={15} /> : <Pin size={15} />}
                    </button>
                    <button className="icone-apagar" aria-label="Editar" onClick={() => setEditando({ ...o })}>
                      <Pencil size={15} />
                    </button>
                    <button className="icone-apagar" aria-label="Apagar" onClick={() => apagar(o)}>
                      <Trash2 size={15} />
                    </button>
                  </span>
                </span>
                <p>{o.texto}</p>
                <small className="dica-sec">{dataCurta(o.atualizado_em)}</small>
              </li>
            ),
          )}
        </ul>
      )}
      {lista?.length === 0 && !editando && <p className="dica-sec">Nenhuma orientação ainda.</p>}
      {editando && !editando.id ? (
        <FormOrientacao inicial={editando} nomeAluno={primeiro} onSalvar={(d) => salvar(d)} onCancelar={() => setEditando(null)} />
      ) : (
        !erro?.includes('.sql') && (
          <button className="botao-sec" onClick={() => setEditando(vazia())}>
            <Plus size={16} /> Nova orientação
          </button>
        )
      )}
    </section>
  )
}

/** Aba Treino do aluno: o que o personal orientou (as fixadas primeiro). */
export function OrientacoesAluno({ fichaId }: { fichaId: string }) {
  const [lista, setLista] = useState<Orientacao[]>([])
  const carregar = useCallback(() => {
    listarOrientacoes(fichaId).then((r) => setLista(r.lista.filter((o) => !o.so_personal)))
  }, [fichaId])
  useEffect(() => {
    carregar()
  }, [carregar])
  useAtualizacao(carregar, 120)
  if (!lista.length) return null
  return (
    <section className="cartao orientacoes">
      <h2>
        <Lightbulb size={18} /> Orientações do seu personal
      </h2>
      <ul className="orientacoes-lista">
        {lista.map((o) => (
          <li key={o.id} className={`orientacao orientacao-${o.tipo}`}>
            <span className="orientacao-tipo">
              {o.fixada && <Pin size={13} />} {rotuloOrientacao(o.tipo)}
            </span>
            <p>{o.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
