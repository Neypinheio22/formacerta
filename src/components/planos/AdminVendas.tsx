import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { emReais, lerPainelVendas, mesAtual, outroMes, rotuloMes, type PainelVendas } from '../../nuvem/planos'

/** Administrador: quanto entrou no mês, quanto é do FormaCerta, quanto falta repassar e quantos assinantes ativos. */
export function AdminVendas() {
  const [mes, setMes] = useState(mesAtual)
  const [painel, setPainel] = useState<PainelVendas | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    lerPainelVendas(mes).then((p) => vivo && setPainel(p))
    return () => {
      vivo = false
    }
  }, [mes])

  if (painel === null) return <p className="dica-sec">O painel aparece depois de rodar o SQL dos recibos e do painel de vendas.</p>

  const hoje = mesAtual()
  const maior = Math.max(1, ...(painel?.meses ?? []).map((m) => m.bruto))

  return (
    <div className="painel-vendas">
      <div className="mes-escolha">
        <button className="redondo-pequeno" aria-label="Mês anterior" onClick={() => setMes(outroMes(mes, -1))}>
          <ChevronLeft size={18} />
        </button>
        <strong>{rotuloMes(mes)}</strong>
        <button className="redondo-pequeno" aria-label="Próximo mês" disabled={mes >= hoje} onClick={() => setMes(outroMes(mes, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      {!painel ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <>
          <div className="numeros vendas">
            <div>
              <strong>{emReais(painel.bruto)}</strong> entrou no mês ({painel.vendas} venda{painel.vendas === 1 ? '' : 's'})
            </div>
            <div className="destaque-verde">
              <strong>{emReais(painel.receita)}</strong> é do FormaCerta
            </div>
            <div className={painel.a_repassar > 0 ? 'destaque-laranja' : ''}>
              <strong>{emReais(painel.a_repassar)}</strong> falta repassar aos personais
            </div>
          </div>

          <section className="cartao">
            <h3>De onde veio</h3>
            <dl className="lista-valores">
              <dt>Assinaturas ({painel.assinaturas.qtd})</dt>
              <dd>{emReais(painel.assinaturas.valor)}</dd>
              <dt>Serviços dos personais ({painel.servicos.qtd})</dt>
              <dd>
                {emReais(painel.servicos.valor)} <small>comissão {emReais(painel.servicos.comissao)}</small>
              </dd>
              <dt>Chamadas de vídeo ({painel.video.qtd})</dt>
              <dd>
                {emReais(painel.video.valor)} <small>comissão {emReais(painel.video.comissao)}</small>
              </dd>
              <dt>Taxas das chamadas feitas ({painel.video.chamadas})</dt>
              <dd>{emReais(painel.video.taxas)}</dd>
              {painel.pendentes.qtd > 0 && (
                <>
                  <dt>Pedidos não pagos no mês ({painel.pendentes.qtd})</dt>
                  <dd className="dica-sec">{emReais(painel.pendentes.valor)}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="cartao">
            <h3>Assinantes agora</h3>
            <div className="numeros">
              <div>
                <strong>{painel.ativos.aluno_pro}</strong> Aluno Pro
              </div>
              <div>
                <strong>{painel.ativos.personais}</strong> personais pagantes
              </div>
              <div>
                <strong>{painel.ativos.testes}</strong> em teste grátis
              </div>
            </div>
            {painel.ativos.cortesias > 0 && <p className="dica-sec">Mais {painel.ativos.cortesias} com plano cortesia.</p>}
          </section>

          <section className="cartao">
            <h3>
              <TrendingUp size={16} /> Últimos 6 meses
            </h3>
            <ul className="barras-meses">
              {painel.meses.map((m) => (
                <li key={m.mes} className={m.mes === mes ? 'atual' : ''}>
                  <span className="rotulo">{rotuloMes(m.mes)}</span>
                  <span className="trilho">
                    <span className="barra" style={{ width: `${(m.bruto / maior) * 100}%` }} />
                    <span className="barra receita" style={{ width: `${(m.receita / maior) * 100}%` }} />
                  </span>
                  <span className="valor">{emReais(m.bruto)}</span>
                </li>
              ))}
            </ul>
            <p className="dica-sec legenda-barras">
              <span className="ponto bruto" /> Entrou <span className="ponto receita" /> Do FormaCerta
            </p>
          </section>

          {painel.top.length > 0 && (
            <section className="cartao">
              <h3>Personais que mais venderam no mês</h3>
              <ol className="top-personais">
                {painel.top.map((t) => (
                  <li key={t.nome}>
                    <span>{t.nome}</span>
                    <span>
                      {t.vendas} venda{t.vendas === 1 ? '' : 's'} · <b>{emReais(t.valor)}</b>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  )
}
