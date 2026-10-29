import { Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { decidirPreco, emReais, lerReais, listarCatalogo, listarPedidosPreco, mudarSugerido, precoServico, type ItemCatalogo, type PedidoPreco } from '../../nuvem/planos'

/** Administrador: preço sugerido de cada serviço e pedidos dos personais para cobrar outro valor. */
export function AdminPrecos({ nomePorId }: { nomePorId: Map<string, string> }) {
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([])
  const [pedidos, setPedidos] = useState<PedidoPreco[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function carregar() {
    const [c, p] = await Promise.all([listarCatalogo(), listarPedidosPreco()])
    setCatalogo(c)
    setPedidos(p)
    setValores(Object.fromEntries(c.map((i) => [i.id, String(i.preco_sugerido).replace('.', ',')])))
  }

  useEffect(() => {
    carregar()
  }, [])

  const pendentes = pedidos.filter((p) => p.situacao === 'pendente')
  const decididos = pedidos.filter((p) => p.situacao !== 'pendente').slice(0, 20)
  const sugeridoDe = (id: string | null) => catalogo.find((i) => i.id === id)

  async function decidir(p: PedidoPreco, aprovar: boolean) {
    const e = await decidirPreco(p.id, aprovar, respostas[p.id] ?? '')
    setErro(e)
    setOk(e ? null : aprovar ? `Aprovado: ${p.nome} por ${emReais(p.valor)}.` : 'Pedido recusado.')
    if (!e) carregar()
  }

  async function salvarSugerido(i: ItemCatalogo) {
    const v = lerReais(valores[i.id] ?? '')
    if (!v || v < 5) return setErro('Coloque um preço a partir de R$ 5,00.')
    const e = await mudarSugerido(i.id, v)
    setErro(e)
    setOk(e ? null : `${i.nome}: novo preço ${emReais(v)} (vale para quem usa o preço do FormaCerta).`)
    if (!e) carregar()
  }

  return (
    <>
      <section className="cartao formulario">
        <h2>Pedidos de preço ({pendentes.length})</h2>
        {pendentes.length === 0 && <p className="dica-sec">Nenhum pedido esperando. Quando um personal pedir outro valor ou um serviço novo, aparece aqui.</p>}
        {pendentes.map((p) => {
          const item = sugeridoDe(p.catalogo_id)
          return (
            <div key={p.id} className="pedido-admin">
              <strong>{nomePorId.get(p.profissional_id) ?? 'Personal'}</strong>
              <span>
                {p.nome}: pede <b className="verde">{precoServico({ preco: p.valor, mensal: p.mensal })}</b>
                {item ? ` (sugerido ${precoServico({ preco: item.preco_sugerido, mensal: item.mensal })})` : ' · serviço novo'}
              </span>
              {p.motivo && <span className="dica-sec">“{p.motivo}”</span>}
              <label className="campo">
                Resposta (opcional)
                <input value={respostas[p.id] ?? ''} maxLength={300} onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })} />
              </label>
              <div className="acoes-linha">
                <button className="botao" onClick={() => decidir(p, true)}>
                  <Check size={16} /> Aprovar
                </button>
                <button className="botao-sec" onClick={() => decidir(p, false)}>
                  <X size={16} /> Recusar
                </button>
              </div>
            </div>
          )
        })}
      </section>

      {erro && <p className="mensagem erro">{erro}</p>}
      {ok && <p className="mensagem ok">{ok}</p>}

      <section className="cartao formulario">
        <h2>Preço sugerido de cada serviço</h2>
        <p className="dica-sec">É o valor que o personal cobra quando liga o serviço. Mudar aqui muda para todos que usam o preço do FormaCerta (quem teve outro valor aprovado continua com o dele).</p>
        {catalogo.map((i) => (
          <div key={i.id} className="linha-campos preco-sugerido">
            <label className="campo">
              {i.nome}
              {i.mensal ? ' (por mês)' : ''}
              <input inputMode="decimal" value={valores[i.id] ?? ''} onChange={(e) => setValores({ ...valores, [i.id]: e.target.value })} />
              <small className="dica-sec">
                Mercado: {emReais(i.preco_min)} a {emReais(i.preco_max)}
              </small>
            </label>
            <button className="botao-sec" disabled={lerReais(valores[i.id] ?? '') === i.preco_sugerido} onClick={() => salvarSugerido(i)}>
              Salvar
            </button>
          </div>
        ))}
      </section>

      {decididos.length > 0 && (
        <section className="cartao">
          <h2>Já respondidos</h2>
          <ul className="lista-simples">
            {decididos.map((p) => (
              <li key={p.id}>
                {nomePorId.get(p.profissional_id) ?? 'Personal'} · {p.nome} · {emReais(p.valor)}: {p.situacao === 'aprovado' ? 'aprovado' : 'recusado'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
