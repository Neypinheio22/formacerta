import { Archive, ArchiveRestore, HeartPulse, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Ficha } from '../../nuvem/fichas'
import { listarAerobicos, mudarSituacaoAerobico, salvarAerobico, type Aerobico, type DadosAerobico } from '../../nuvem/rotinas'
import { INTENSIDADES_AEROBICO, resumoAerobico, TIPOS_AEROBICO, type Situacao } from '../../treino/rotinas'

const vazio: DadosAerobico = { tipo: '', duracao_min: 30, intensidade: '', vezes_semana: 3, observacoes: '' }

function FormAerobico({ inicial, onSalvar, onCancelar }: { inicial: DadosAerobico; onSalvar: (d: DadosAerobico) => Promise<string | null>; onCancelar: () => void }) {
  const [d, setD] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const numero = (v: string, max: number) => (v ? Math.min(max, Math.max(1, Math.round(Number(v)) || 1)) : null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!d.tipo.trim()) return setErro('Escolha o tipo de aeróbico.')
    setSalvando(true)
    setErro(await onSalvar(d))
    setSalvando(false)
  }

  return (
    <form className="cartao destaque formulario" onSubmit={salvar}>
      <h2>Aeróbico</h2>
      <label className="campo">
        Tipo
        <input list="tipos-aerobico" value={d.tipo} maxLength={40} placeholder="Ex.: Esteira, Bicicleta, Caminhada" onChange={(e) => setD({ ...d, tipo: e.target.value })} />
        <datalist id="tipos-aerobico">
          {TIPOS_AEROBICO.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <div className="linha-campos">
        <label className="campo">
          Duração (minutos)
          <input type="number" inputMode="numeric" min={1} max={600} value={d.duracao_min ?? ''} onChange={(e) => setD({ ...d, duracao_min: numero(e.target.value, 600) })} />
        </label>
        <label className="campo">
          Vezes por semana
          <input type="number" inputMode="numeric" min={1} max={14} value={d.vezes_semana ?? ''} onChange={(e) => setD({ ...d, vezes_semana: numero(e.target.value, 14) })} />
        </label>
      </div>
      <fieldset className="campo">
        <legend>Intensidade</legend>
        <div className="atalhos-data">
          {INTENSIDADES_AEROBICO.map((i) => (
            <button key={i} type="button" className={`chip-botao ${d.intensidade === i ? 'ativo' : ''}`} onClick={() => setD({ ...d, intensidade: d.intensidade === i ? '' : i })}>
              {i}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="campo">
        Observações (opcional)
        <textarea rows={3} maxLength={300} value={d.observacoes} placeholder="Ex.: inclinação 5%, depois do treino de musculação" onChange={(e) => setD({ ...d, observacoes: e.target.value })} />
      </label>
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao" type="submit" disabled={salvando}>
        {salvando ? 'Guardando…' : 'Salvar aeróbico'}
      </button>
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}

/** Aba Aeróbico da tela de rotinas: tipo, duração, intensidade e frequência. */
export function AbaAerobico({ ficha }: { ficha: Ficha }) {
  const [lista, setLista] = useState<Aerobico[] | null>(null)
  const [editando, setEditando] = useState<{ id?: string; dados: DadosAerobico } | null>(null)
  const [verAntigos, setVerAntigos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiro = ficha.nome.split(' ')[0]

  const carregar = useCallback(async () => {
    const r = await listarAerobicos(ficha.id)
    setLista(r.lista)
    setErro(r.erro)
  }, [ficha.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function mudar(a: Aerobico, situacao: Situacao) {
    if (situacao === 'excluida' && !confirm(`Excluir ${a.tipo}? Dá para recuperar depois.`)) return
    const e = await mudarSituacaoAerobico(a.id, situacao)
    if (e) setErro(e)
    else carregar()
  }

  if (editando)
    return (
      <FormAerobico
        inicial={editando.dados}
        onCancelar={() => setEditando(null)}
        onSalvar={async (d) => {
          const e = await salvarAerobico(ficha.id, editando.id, d)
          if (!e) {
            setEditando(null)
            carregar()
          }
          return e
        }}
      />
    )

  const ativos = lista?.filter((a) => a.situacao === 'ativa') ?? []
  const antigos = lista?.filter((a) => a.situacao !== 'ativa') ?? []

  return (
    <>
      <button className="botao grande" onClick={() => setEditando({ dados: vazio })}>
        <Plus size={20} /> Adicionar aeróbico
      </button>
      {erro && <p className="mensagem erro">{erro}</p>}
      {lista === null && <p className="carregando">Carregando…</p>}
      {lista && ativos.length === 0 && <p className="dica-sec centro">Nenhum aeróbico para {primeiro} ainda. Ele aparece na aba Treino do aluno.</p>}
      <ul className="rotinas-lista">
        {ativos.map((a) => (
          <li key={a.id} className="cartao rotina-cartao">
            <span className="rotina-corpo">
              <span className="rotina-icone" aria-hidden>
                <HeartPulse size={22} />
              </span>
              <span className="rotina-info">
                <strong>{a.tipo}</strong>
                <small>{resumoAerobico({ ...a, tipo: '' }).replace(/^ · /, '')}</small>
                {a.observacoes && <small>{a.observacoes}</small>}
              </span>
            </span>
            <span className="linha-fim">
              <button className="icone-apagar" aria-label={`Editar ${a.tipo}`} onClick={() => setEditando({ id: a.id, dados: a })}>
                <Pencil size={16} />
              </button>
              <button className="icone-apagar" aria-label={`Arquivar ${a.tipo}`} onClick={() => mudar(a, 'arquivada')}>
                <Archive size={16} />
              </button>
              <button className="icone-apagar" aria-label={`Excluir ${a.tipo}`} onClick={() => mudar(a, 'excluida')}>
                <Trash2 size={16} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {antigos.length > 0 && (
        <button className="link" onClick={() => setVerAntigos(!verAntigos)}>
          {verAntigos ? 'Esconder' : 'Ver'} arquivados e excluídos ({antigos.length})
        </button>
      )}
      {verAntigos && (
        <ul className="historico">
          {antigos.map((a) => (
            <li key={a.id}>
              <span className="linha">
                <span>
                  {resumoAerobico(a)} <span className="chip chip-neutro">{a.situacao === 'arquivada' ? 'arquivado' : 'excluído'}</span>
                </span>
                <button className="icone-apagar" aria-label={`Recuperar ${a.tipo}`} onClick={() => mudar(a, 'ativa')}>
                  {a.situacao === 'arquivada' ? <ArchiveRestore size={16} /> : <RotateCcw size={16} />}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
