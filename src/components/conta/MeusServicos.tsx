import { Clock, Plus, Store, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  apagarServico,
  desistirPedido,
  emReais,
  lerReais,
  listarCatalogo,
  listarPedidosPreco,
  listarServicos,
  pedirPreco,
  precoServico,
  salvarServico,
  type ItemCatalogo,
  type PedidoPreco,
  type Servico,
} from '../../nuvem/planos'

const GRUPOS: { grupo: ItemCatalogo['grupo']; titulo: string }[] = [
  { grupo: 'avaliacao', titulo: 'Avaliações' },
  { grupo: 'treino', titulo: 'Treino e acompanhamento' },
]

type Pedindo = { catalogo_id: string | null; nome: string; mensal: boolean; valor: string; motivo: string }

/** Formulário curto para pedir outro valor (ou um serviço novo) ao FormaCerta. */
function PedirValor({ pedido, novo, onMudar, onEnviar, onCancelar }: { pedido: Pedindo; novo: boolean; onMudar: (p: Pedindo) => void; onEnviar: () => void; onCancelar: () => void }) {
  return (
    <div className="pedir-valor">
      {novo && (
        <label className="campo">
          Nome do serviço
          <input value={pedido.nome} maxLength={80} placeholder="Ex.: Treino para gestantes" onChange={(e) => onMudar({ ...pedido, nome: e.target.value })} />
        </label>
      )}
      <label className="campo">
        Valor que você quer cobrar{pedido.mensal ? ' por mês' : ''} (R$)
        <input inputMode="decimal" value={pedido.valor} placeholder="150" onChange={(e) => onMudar({ ...pedido, valor: e.target.value })} />
      </label>
      {novo && (
        <label className="aceite">
          <input type="checkbox" checked={pedido.mensal} onChange={(e) => onMudar({ ...pedido, mensal: e.target.checked })} />
          <span>Cobrado por mês</span>
        </label>
      )}
      <label className="campo">
        Por quê? (opcional)
        <input value={pedido.motivo} maxLength={300} placeholder="Ex.: especialização, atendimento em casa" onChange={(e) => onMudar({ ...pedido, motivo: e.target.value })} />
      </label>
      <div className="acoes-linha">
        <button className="botao" onClick={onEnviar}>
          Enviar para o FormaCerta
        </button>
        <button className="link" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** O personal liga os serviços da lista do FormaCerta. O preço é o sugerido; outro valor passa pela aprovação do administrador. */
export function MeusServicos({ meuId }: { meuId: string }) {
  const [catalogo, setCatalogo] = useState<ItemCatalogo[] | null>(null)
  const [meus, setMeus] = useState<Servico[]>([])
  const [pedidos, setPedidos] = useState<PedidoPreco[]>([])
  const [pedindo, setPedindo] = useState<Pedindo | null>(null)
  const [mudando, setMudando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [c, s, p] = await Promise.all([listarCatalogo(), listarServicos(), listarPedidosPreco()])
    setCatalogo(c)
    setMeus(s.filter((x) => x.profissional_id === meuId))
    setPedidos(p.filter((x) => x.profissional_id === meuId))
  }, [meuId])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Sem o SQL novo a lista não existe: o quadro não aparece.
  if (!catalogo?.length) return null

  const proprios = meus.filter((s) => !s.catalogo_id)
  const pendentes = pedidos.filter((p) => p.situacao === 'pendente')
  const respondidos = pedidos.filter((p) => p.situacao !== 'pendente').slice(0, 3)

  async function ligar(item: ItemCatalogo, ligado: boolean) {
    setMudando(item.id)
    setErro(null)
    setOk(null)
    const atual = meus.find((s) => s.catalogo_id === item.id)
    const e = atual
      ? await salvarServico({ ...atual, ativo: ligado })
      : await salvarServico({ profissional_id: meuId, nome: item.nome, descricao: item.descricao, preco: item.preco_sugerido, ativo: true, catalogo_id: item.id, mensal: item.mensal })
    if (e) setErro(e)
    await carregar()
    setMudando(null)
  }

  async function enviarPedido() {
    if (!pedindo) return
    const valor = lerReais(pedindo.valor)
    if (!pedindo.nome.trim()) return setErro('Escreva o nome do serviço.')
    if (!valor || valor < 5) return setErro('Coloque um valor a partir de R$ 5,00.')
    const e = await pedirPreco({ profissional_id: meuId, catalogo_id: pedindo.catalogo_id, nome: pedindo.nome.trim().slice(0, 80), mensal: pedindo.mensal, valor, motivo: pedindo.motivo.trim() })
    if (e) return setErro(e)
    setPedindo(null)
    setErro(null)
    setOk('Pedido enviado. O FormaCerta confere e o novo valor aparece aqui quando for aprovado.')
    carregar()
  }

  async function desistir(p: PedidoPreco) {
    const e = await desistirPedido(p.id)
    if (e) setErro(e)
    else carregar()
  }

  async function tirarProprio(s: Servico) {
    if (!confirm(`Tirar "${s.nome}" dos seus serviços?`)) return
    const e = await apagarServico(s.id)
    if (e) setErro(e)
    else carregar()
  }

  const formulario = (catalogo_id: string | null) =>
    pedindo && pedindo.catalogo_id === catalogo_id ? (
      <PedirValor pedido={pedindo} novo={catalogo_id === null} onMudar={setPedindo} onEnviar={enviarPedido} onCancelar={() => setPedindo(null)} />
    ) : null

  return (
    <section className="cartao formulario meus-servicos">
      <span className="etiqueta">
        <Store size={14} /> Seus serviços no app
      </span>
      <h2>Meus serviços</h2>
      <p className="dica-sec">
        Ligue o que você faz. Cada serviço já vem com o <b>preço do FormaCerta</b>. Quer cobrar um valor diferente? Toque em <b>Pedir outro valor</b> e a gente confere. O aluno vê seus serviços quando abre a conversa com você no chat.
      </p>

      {GRUPOS.map(({ grupo, titulo }) => (
        <div key={grupo} className="servicos-grupo">
          <h3>{titulo}</h3>
          {catalogo
            .filter((i) => i.grupo === grupo)
            .map((i) => {
              const meu = meus.find((s) => s.catalogo_id === i.id)
              const ligado = !!meu?.ativo
              const pendente = pendentes.find((p) => p.catalogo_id === i.id)
              const preco = meu?.preco_aprovado ? meu : { preco: i.preco_sugerido, mensal: i.mensal }
              return (
                <div key={i.id} className={`servico-linha ${ligado ? 'ligado' : ''}`}>
                  <label className="aceite">
                    <input type="checkbox" checked={ligado} disabled={mudando === i.id} onChange={(e) => ligar(i, e.target.checked)} />
                    <span>
                      <b>{i.nome}</b>
                      <small>
                        {meu?.preco_aprovado ? 'Seu valor aprovado' : 'Preço FormaCerta'}: <b className="verde">{precoServico(preco)}</b>
                      </small>
                    </span>
                  </label>
                  {pendente ? (
                    <p className="dica-sec pedido-pendente">
                      <Clock size={13} /> Você pediu {precoServico({ preco: pendente.valor, mensal: i.mensal })}. Aguardando o FormaCerta.{' '}
                      <button className="link" onClick={() => desistir(pendente)}>
                        Desistir
                      </button>
                    </p>
                  ) : (
                    ligado &&
                    !pedindo && (
                      <button className="link pedir-link" onClick={() => setPedindo({ catalogo_id: i.id, nome: i.nome, mensal: i.mensal, valor: '', motivo: '' })}>
                        Pedir outro valor
                      </button>
                    )
                  )}
                  {formulario(i.id)}
                </div>
              )
            })}
        </div>
      ))}

      <div className="servicos-grupo">
        <h3>Serviço fora da lista</h3>
        {proprios.map((s) => (
          <div key={s.id} className="servico-proprio">
            <span>
              <b>{s.nome}</b> · {precoServico(s)}
            </span>
            <button className="link" aria-label={`Tirar ${s.nome}`} onClick={() => tirarProprio(s)}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {pendentes
          .filter((p) => !p.catalogo_id)
          .map((p) => (
            <p key={p.id} className="dica-sec pedido-pendente">
              <Clock size={13} /> {p.nome} · {precoServico({ preco: p.valor, mensal: p.mensal })}: aguardando o FormaCerta.{' '}
              <button className="link" onClick={() => desistir(p)}>
                Desistir
              </button>
            </p>
          ))}
        {formulario(null) ??
          (!pedindo && (
            <button className="botao-sec" onClick={() => setPedindo({ catalogo_id: null, nome: '', mensal: false, valor: '', motivo: '' })}>
              <Plus size={16} /> Pedir um serviço novo
            </button>
          ))}
      </div>

      {respondidos.length > 0 && (
        <div className="servicos-grupo">
          <h3>Respostas do FormaCerta</h3>
          {respondidos.map((p) => (
            <p key={p.id} className={`mensagem ${p.situacao === 'aprovado' ? 'ok' : 'aviso'}`}>
              {p.nome} por {emReais(p.valor)}: {p.situacao === 'aprovado' ? 'aprovado' : 'não aprovado'}
              {p.resposta ? `. ${p.resposta}` : ''}
            </p>
          ))}
        </div>
      )}

      {ok && <p className="mensagem ok">{ok}</p>}
      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}
