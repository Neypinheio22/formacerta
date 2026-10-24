import { Wallet } from 'lucide-react'
import { useState } from 'react'
import { ROTULO_PAGAMENTO, apagarServico, dividir, emReais, lerReais, salvarServico, type Pagamento, type Servico } from '../../nuvem/planos'

type Props = {
  meuId: string
  comissaoPct: number
  servicos: Servico[]
  recebidos: Pagamento[]
  onMudou: () => void
}

const SUGESTOES = [
  { nome: 'Avaliação postural', preco: '120' },
  { nome: 'Avaliação completa (postura, corrida e testes)', preco: '200' },
  { nome: 'Avaliação funcional do idoso', preco: '220' },
  { nome: 'Reavaliação', preco: '80' },
]

/** O personal coloca as avaliações à venda para os alunos dele e vê quanto recebe. */
export function MinhasAvaliacoes({ meuId, comissaoPct, servicos, recebidos, onMudou }: Props) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const valor = lerReais(preco)
  const conta = valor ? dividir(valor, comissaoPct) : null
  const pagos = recebidos.filter((p) => p.situacao === 'pago')
  const totalLiquido = pagos.reduce((t, p) => t + p.valor - p.comissao, 0)

  async function adicionar() {
    if (!valor || valor < 5) return setErro('Coloque um preço a partir de R$ 5,00.')
    const e = await salvarServico({ profissional_id: meuId, nome: nome.trim(), descricao: descricao.trim(), preco: valor, ativo: true })
    if (e) return setErro(e)
    setNome('')
    setDescricao('')
    setPreco('')
    setErro(null)
    onMudou()
  }

  async function alternar(s: Servico) {
    const e = await salvarServico({ ...s, ativo: !s.ativo })
    if (e) setErro(e)
    else onMudou()
  }

  async function apagar(s: Servico) {
    if (!confirm(`Tirar "${s.nome}" da venda?`)) return
    const e = await apagarServico(s.id)
    if (e) setErro(e)
    else onMudou()
  }

  return (
    <section className="cartao destaque">
      <span className="etiqueta">
        <Wallet size={14} /> Nova renda
      </span>
      <h2>Suas avaliações à venda</h2>
      <p className="dica-sec">
        Seus alunos contratam e pagam pelo app. Você define o preço; o FormaCerta fica com {comissaoPct}% para cobrir o pagamento e a plataforma.
      </p>

      {erro && <p className="mensagem erro">{erro}</p>}

      {servicos.map((s) => {
        const d = dividir(s.preco, comissaoPct)
        return (
          <div className={`servico ${s.ativo ? '' : 'pausado'}`} key={s.id}>
            <div>
              <strong>{s.nome}</strong>
              <p className="dica-sec">
                {emReais(s.preco)} · você recebe {emReais(d.liquido)}
                {!s.ativo && ' · pausada'}
              </p>
            </div>
            <div className="servico-acoes">
              <button className="link" onClick={() => alternar(s)}>
                {s.ativo ? 'Pausar' : 'Vender'}
              </button>
              <button className="link perigo" onClick={() => apagar(s)}>
                Apagar
              </button>
            </div>
          </div>
        )
      })}

      <div className="formulario">
        <label className="campo">
          Nome da avaliação
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Ex.: Avaliação postural" list="sugestoes-avaliacao" />
          <datalist id="sugestoes-avaliacao">
            {SUGESTOES.map((s) => (
              <option key={s.nome} value={s.nome} />
            ))}
          </datalist>
        </label>
        <label className="campo">
          O que inclui (opcional)
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} placeholder="Ex.: 4 fotos, relatório em PDF e plano de exercícios" />
        </label>
        <label className="campo">
          Preço para o aluno (R$)
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="120,00" />
        </label>
        {conta && (
          <div className="divisao">
            <span>
              Aluno paga <strong>{emReais(valor!)}</strong>
            </span>
            <span>
              FormaCerta ({comissaoPct}%) <strong>{emReais(conta.comissao)}</strong>
            </span>
            <span className="verde">
              Você recebe <strong>{emReais(conta.liquido)}</strong>
            </span>
          </div>
        )}
        <button className="botao" disabled={!nome.trim() || !valor} onClick={adicionar}>
          Colocar à venda
        </button>
        <p className="dica-sec">Mercado: avaliação postural R$ 80 a 150, completa R$ 150 a 250, idoso R$ 150 a 300, reavaliação R$ 60 a 100.</p>
      </div>

      {recebidos.length > 0 && (
        <>
          <h3>Vendas</h3>
          <p className="dica-sec">Recebido até agora: {emReais(totalLiquido)}</p>
          <ul className="historico">
            {recebidos.map((p) => (
              <li key={p.id}>
                <span className="linha">
                  <span>
                    {p.descricao}
                    <br />
                    <small className="dica-sec">
                      {new Date(p.criado_em).toLocaleDateString('pt-BR')} · {ROTULO_PAGAMENTO[p.situacao]}
                    </small>
                  </span>
                  <span className="nota">{emReais(p.valor - p.comissao)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
