import { Plus, Store, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { apagarServico, emReais, lerReais, listarCatalogo, listarServicos, precoServico, salvarServico, type ItemCatalogo, type Servico } from '../../nuvem/planos'

type Linha = { ligado: boolean; preco: string }

const GRUPOS: { grupo: ItemCatalogo['grupo']; titulo: string }[] = [
  { grupo: 'avaliacao', titulo: 'Avaliações' },
  { grupo: 'treino', titulo: 'Treino e acompanhamento' },
]

/** O personal liga os trabalhos da lista do FormaCerta que ele faz e põe o preço dele. */
export function MeusServicos({ meuId }: { meuId: string }) {
  const [catalogo, setCatalogo] = useState<ItemCatalogo[] | null>(null)
  const [meus, setMeus] = useState<Servico[]>([])
  const [linhas, setLinhas] = useState<Record<string, Linha>>({})
  const [novo, setNovo] = useState({ nome: '', preco: '', mensal: false })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const carregar = useCallback(async () => {
    const [c, s] = await Promise.all([listarCatalogo(), listarServicos()])
    const doPersonal = s.filter((x) => x.profissional_id === meuId)
    setCatalogo(c)
    setMeus(doPersonal)
    setLinhas(
      Object.fromEntries(
        c.map((i) => {
          const m = doPersonal.find((x) => x.catalogo_id === i.id)
          return [i.id, { ligado: !!m?.ativo, preco: m ? String(m.preco).replace('.', ',') : '' }]
        }),
      ),
    )
  }, [meuId])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Sem o SQL novo a lista não existe: o quadro não aparece.
  if (!catalogo?.length) return null

  const proprios = meus.filter((s) => !s.catalogo_id)
  const mudar = (id: string, l: Partial<Linha>) => {
    setOk(false)
    setLinhas((ls) => ({ ...ls, [id]: { ...ls[id], ...l } }))
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    for (const item of catalogo!) {
      const l = linhas[item.id]
      const atual = meus.find((s) => s.catalogo_id === item.id)
      const preco = lerReais(l.preco)
      if (l.ligado && (!preco || preco < 5)) {
        setSalvando(false)
        return setErro(`Coloque o seu preço em "${item.nome}" (a partir de R$ 5,00).`)
      }
      if (!l.ligado && !atual?.ativo) continue
      if (!l.ligado) {
        const e = await salvarServico({ ...atual!, ativo: false })
        if (e) return falhou(e)
        continue
      }
      if (atual && atual.ativo && atual.preco === preco) continue
      const e = await salvarServico({
        ...(atual ? { id: atual.id } : {}),
        profissional_id: meuId,
        nome: item.nome,
        descricao: item.descricao,
        preco: preco!,
        ativo: true,
        catalogo_id: item.id,
        mensal: item.mensal,
      })
      if (e) return falhou(e)
    }
    await carregar()
    setSalvando(false)
    setOk(true)
  }

  function falhou(e: string) {
    setSalvando(false)
    setErro(e)
  }

  async function adicionarProprio() {
    const preco = lerReais(novo.preco)
    if (!novo.nome.trim()) return setErro('Escreva o nome do serviço.')
    if (!preco || preco < 5) return setErro('Coloque um preço a partir de R$ 5,00.')
    const e = await salvarServico({ profissional_id: meuId, nome: novo.nome.trim().slice(0, 80), descricao: '', preco, ativo: true, mensal: novo.mensal })
    if (e) return setErro(e)
    setNovo({ nome: '', preco: '', mensal: false })
    setErro(null)
    carregar()
  }

  async function tirarProprio(s: Servico) {
    if (!confirm(`Tirar "${s.nome}" dos seus serviços?`)) return
    const e = await apagarServico(s.id)
    if (e) setErro(e)
    else carregar()
  }

  return (
    <section className="cartao formulario meus-servicos">
      <span className="etiqueta">
        <Store size={14} /> Seus serviços no app
      </span>
      <h2>Meus serviços e preços</h2>
      <p className="dica-sec">Ligue o que você faz e coloque o seu preço. Os alunos veem no seu perfil e contratam pelo chat, com pagamento pelo app. A faixa ao lado é o preço comum no mercado.</p>

      {GRUPOS.map(({ grupo, titulo }) => (
        <div key={grupo} className="servicos-grupo">
          <h3>{titulo}</h3>
          {catalogo
            .filter((i) => i.grupo === grupo)
            .map((i) => {
              const l = linhas[i.id] ?? { ligado: false, preco: '' }
              return (
                <div key={i.id} className={`servico-linha ${l.ligado ? 'ligado' : ''}`}>
                  <label className="aceite">
                    <input type="checkbox" checked={l.ligado} onChange={(e) => mudar(i.id, { ligado: e.target.checked })} />
                    <span>
                      <b>{i.nome}</b>
                      <small>
                        {emReais(i.preco_min)} a {emReais(i.preco_max)}
                        {i.mensal ? ' por mês' : ''}
                      </small>
                    </span>
                  </label>
                  {l.ligado && (
                    <label className="campo servico-preco">
                      Seu preço{i.mensal ? ' por mês' : ''} (R$)
                      <input inputMode="decimal" value={l.preco} placeholder={String(Math.round((i.preco_min + i.preco_max) / 2))} onChange={(e) => mudar(i.id, { preco: e.target.value })} />
                    </label>
                  )}
                </div>
              )
            })}
        </div>
      ))}

      <button className="botao" disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar serviços'}
      </button>
      {ok && <p className="mensagem ok">Serviços salvos. Já aparecem para os alunos.</p>}

      <div className="servicos-grupo">
        <h3>Serviço próprio</h3>
        <p className="dica-sec">Faz algo que não está na lista? Crie aqui.</p>
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
        <div className="linha-campos">
          <label className="campo">
            Nome
            <input value={novo.nome} maxLength={80} placeholder="Ex.: Treino para gestantes" onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          </label>
          <label className="campo">
            Preço (R$)
            <input inputMode="decimal" value={novo.preco} placeholder="150" onChange={(e) => setNovo({ ...novo, preco: e.target.value })} />
          </label>
        </div>
        <label className="aceite">
          <input type="checkbox" checked={novo.mensal} onChange={(e) => setNovo({ ...novo, mensal: e.target.checked })} />
          <span>Cobrado por mês</span>
        </label>
        <button className="botao-sec" onClick={adicionarProprio}>
          <Plus size={16} /> Adicionar serviço
        </button>
      </div>

      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}
