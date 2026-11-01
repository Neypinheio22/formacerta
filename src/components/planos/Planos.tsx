import { Check, Crown, Gift, Info, Receipt, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useConta } from '../../nuvem/conta'
import {
  CONFIG_PADRAO,
  PLANOS_PADRAO,
  ROTULO_ASSINATURA,
  ROTULO_FORMA,
  ROTULO_PAGAMENTO,
  assinaturaAtual,
  cancelarAssinatura,
  economiaAnual,
  emReais,
  lerConfig,
  listarPagamentos,
  listarPlanos,
  listarServicos,
  mensalNoAnual,
  minhasAssinaturas,
  publicoDe,
  type Assinatura,
  type Ciclo,
  type ConfigCobranca,
  type Pagamento,
  type Plano,
  type Publico,
  type Servico,
} from '../../nuvem/planos'
import { MinhasAvaliacoes } from './MinhasAvaliacoes'
import type { Pedido } from './Pagamento'

type Props = {
  onVoltar: () => void
  onPagar: (pedido: Pedido) => void
}

/** Planos do aluno ou do personal, com o plano atual e o que já foi pago. */
export function Planos({ onVoltar, onPagar }: Props) {
  const { perfil } = useConta()
  const [publico, setPublico] = useState<Publico>(perfil ? publicoDe(perfil.papel) : 'aluno')
  const [ciclo, setCiclo] = useState<Ciclo>('mensal')
  const [planos, setPlanos] = useState<Plano[]>(PLANOS_PADRAO)
  const [config, setConfig] = useState<ConfigCobranca>(CONFIG_PADRAO)
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    if (!perfil) return
    const [p, c, a, s, pg] = await Promise.all([listarPlanos(), lerConfig(), minhasAssinaturas(perfil.id), listarServicos(), listarPagamentos()])
    setPlanos(p.planos)
    setErro(p.erro)
    setConfig(c)
    setAssinaturas(a)
    setServicos(s)
    setPagamentos(pg)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!perfil) return null

  const atual = assinaturaAtual(assinaturas)
  const planoAtual = atual ? planos.find((p) => p.id === atual.plano_id) : null
  const jaPagou = assinaturas.some((a) => a.valor > 0)
  const visiveis = planos.filter((p) => p.publico === publico && p.ativo)
  const ehAdmin = perfil.papel === 'admin'
  const meusPagamentos = pagamentos.filter((p) => p.pagador_id === perfil.id)

  async function cancelar() {
    if (!confirm('Cancelar o seu plano? Você volta para o plano grátis.')) return
    const e = await cancelarAssinatura()
    if (e) setErro(e)
    else carregar()
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>

      <h1>Planos</h1>
      <p className="dica-sec">
        {publico === 'aluno'
          ? 'Comece grátis. Com o Aluno Pro você libera todos os testes e guarda a sua evolução.'
          : 'Avalie seus alunos com IA, entregue relatório com a sua marca e venda avaliações pelo app.'}
      </p>

      {ehAdmin && (
        <div className="escolha">
          <button className={publico === 'profissional' ? 'ativo' : ''} onClick={() => setPublico('profissional')}>
            Ver como personal
          </button>
          <button className={publico === 'aluno' ? 'ativo' : ''} onClick={() => setPublico('aluno')}>
            Ver como aluno
          </button>
        </div>
      )}

      {ehAdmin && (
        <p className="mensagem aviso faixa">
          <Info size={16} /> Você está como administrador: aqui só dá para ver os planos. Para fazer uma compra teste, entre com uma conta de personal ou aluno que esteja na lista de testadores (Administração → Planos).
        </p>
      )}

      {erro && <p className="mensagem erro">{erro}</p>}

      {!ehAdmin && (
        <section className="cartao plano-atual">
          <span className="etiqueta">
            <Crown size={14} /> Seu plano
          </span>
          <h2>{planoAtual ? planoAtual.nome : 'Grátis'}</h2>
          {atual ? (
            <p className="dica-sec">
              {ROTULO_ASSINATURA[atual.situacao]}
              {atual.valor > 0 && ` · ${emReais(atual.valor)} por ${atual.ciclo === 'anual' ? 'ano' : 'mês'}`}
              {atual.valido_ate && ` · ${atual.situacao === 'teste' ? 'grátis até' : 'vale até'} ${new Date(atual.valido_ate).toLocaleDateString('pt-BR')}`}
            </p>
          ) : (
            <p className="dica-sec">Você está no plano grátis.</p>
          )}
          {atual && atual.valor > 0 && (
            <button className="link" onClick={cancelar}>
              Cancelar plano
            </button>
          )}
        </section>
      )}

      <div className="escolha ciclo">
        <button className={ciclo === 'mensal' ? 'ativo' : ''} onClick={() => setCiclo('mensal')}>
          Mensal
        </button>
        <button className={ciclo === 'anual' ? 'ativo' : ''} onClick={() => setCiclo('anual')}>
          Anual <small>2 meses grátis</small>
        </button>
      </div>

      {config.dias_gratis > 0 && !jaPagou && (
        <p className="mensagem ok faixa">
          <Gift size={16} /> {config.dias_gratis} dias grátis no primeiro plano pago. Cancele quando quiser.
        </p>
      )}

      {visiveis.map((p) => {
        const gratis = p.preco_mensal === 0
        const eSeu = atual ? atual.plano_id === p.id && (gratis || atual.ciclo === ciclo) : gratis
        return (
          <section className={`cartao plano ${p.destaque ? 'destaque recomendado' : ''}`} key={p.id}>
            <div className="plano-topo">
              <h2>{p.nome}</h2>
              {p.destaque && <span className="chip chip-ok">Recomendado</span>}
            </div>
            <p className="dica-sec">{p.descricao}</p>
            <p className="preco">
              {gratis ? (
                <strong>R$ 0</strong>
              ) : (
                <>
                  <strong>{emReais(ciclo === 'anual' ? p.preco_anual : p.preco_mensal)}</strong>
                  <span>/{ciclo === 'anual' ? 'ano' : 'mês'}</span>
                </>
              )}
            </p>
            {!gratis && ciclo === 'anual' && (
              <p className="dica-sec">
                Sai {emReais(mensalNoAnual(p))} por mês · economia de {emReais(economiaAnual(p))}
              </p>
            )}
            <ul className="recursos">
              {p.recursos.map((r) => (
                <li key={r}>
                  <Check size={16} strokeWidth={3} /> {r}
                </li>
              ))}
            </ul>
            {ehAdmin ? null : eSeu ? (
              <button className="botao-sec" disabled>
                Seu plano atual
              </button>
            ) : (
              <button className={p.destaque ? 'botao' : 'botao-sec'} onClick={() => onPagar({ tipo: 'assinatura', plano: p, ciclo: gratis ? 'mensal' : ciclo })}>
                {gratis ? 'Usar o grátis' : config.dias_gratis > 0 && !jaPagou ? `Começar ${config.dias_gratis} dias grátis` : `Assinar o ${p.nome}`}
              </button>
            )}
          </section>
        )
      })}

      {perfil.papel === 'profissional' && (
        <MinhasAvaliacoes meuId={perfil.id} comissaoPct={config.comissao_pct} servicos={servicos} recebidos={pagamentos.filter((p) => p.recebedor_id === perfil.id)} onMudou={carregar} />
      )}

      {perfil.papel === 'aluno' && (
        <section className="cartao destaque">
          <span className="etiqueta">
            <Tag size={14} /> Do seu personal
          </span>
          <h2>Avaliações</h2>
          {!perfil.profissional_id && <p className="dica-sec">Quando você tiver um personal no FormaCerta, as avaliações dele aparecem aqui para você contratar.</p>}
          {perfil.profissional_id && servicos.length === 0 && <p className="dica-sec">O seu personal ainda não colocou avaliações à venda.</p>}
          {servicos.map((s) => (
            <div className="servico" key={s.id}>
              <div>
                <strong>{s.nome}</strong>
                {s.descricao && <p className="dica-sec">{s.descricao}</p>}
              </div>
              <button className="botao" onClick={() => onPagar({ tipo: 'avaliacao', servico: s })}>
                {emReais(s.preco)}
              </button>
            </div>
          ))}
        </section>
      )}

      {meusPagamentos.length > 0 && (
        <section className="cartao">
          <span className="etiqueta">
            <Receipt size={14} /> Histórico
          </span>
          <h2>Meus pagamentos</h2>
          <ul className="historico">
            {meusPagamentos.map((p) => (
              <li key={p.id}>
                <span className="linha">
                  <span>
                    {p.descricao}
                    <br />
                    <small className="dica-sec">
                      {new Date(p.criado_em).toLocaleDateString('pt-BR')} · {ROTULO_FORMA[p.forma]} · {ROTULO_PAGAMENTO[p.situacao]}
                    </small>
                  </span>
                  <span className="nota">{emReais(p.valor)}</span>
                </span>
                {p.situacao === 'pendente' && config.gateway === 'mercadopago' && (
                  <button className="botao pagar-pendente" onClick={() => onPagar({ tipo: 'pendente', pagamento: p })}>
                    Pagar agora
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
