import { useEffect, useState } from 'react'
import {
  CONFIG_PADRAO,
  ROTULO_FORMA,
  ROTULO_PAGAMENTO,
  definirPagamento,
  emReais,
  lerConfig,
  lerReais,
  listarPagamentos,
  listarPlanos,
  salvarConfig,
  salvarPlano,
  type ConfigCobranca,
  type Pagamento,
  type Plano,
  type SituacaoPagamento,
} from '../../nuvem/planos'

/** Administrador: muda preços, recursos, comissão e dias grátis. */
export function AdminPlanos() {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [config, setConfig] = useState<ConfigCobranca>(CONFIG_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    listarPlanos().then((r) => {
      setPlanos(r.planos)
      setErro(r.erro)
    })
    lerConfig().then(setConfig)
  }, [])

  async function gravarConfig() {
    const e = await salvarConfig({ comissao_pct: config.comissao_pct, dias_gratis: config.dias_gratis })
    setErro(e)
    setOk(e ? null : 'Regras salvas.')
  }

  return (
    <>
      <section className="cartao">
        <h2>Pagamento pelo app</h2>
        <p className="dica-sec">
          {config.gateway === 'nenhum'
            ? 'Desligado. Os pedidos ficam registrados e você confirma à mão na aba Pagamentos. Para cobrar de verdade falta CNPJ e conta num gateway (Asaas, Mercado Pago ou Stripe).'
            : `Ligado pelo ${config.gateway}.`}
        </p>
      </section>

      <section className="cartao formulario">
        <h2>Regras gerais</h2>
        <div className="linha-campos">
          <label className="campo">
            Comissão nas avaliações (%)
            <input inputMode="decimal" value={String(config.comissao_pct)} onChange={(e) => setConfig({ ...config, comissao_pct: lerReais(e.target.value) ?? 0 })} />
          </label>
          <label className="campo">
            Dias grátis
            <input inputMode="numeric" value={String(config.dias_gratis)} onChange={(e) => setConfig({ ...config, dias_gratis: Math.round(lerReais(e.target.value) ?? 0) })} />
          </label>
        </div>
        <p className="dica-sec">Dias grátis valem no primeiro plano pago de cada pessoa. Coloque 0 para desligar.</p>
        <button className="botao" onClick={gravarConfig}>
          Salvar regras
        </button>
      </section>

      {erro && <p className="mensagem erro">{erro}</p>}
      {ok && <p className="mensagem ok">{ok}</p>}

      <h2 className="secao">Planos do personal</h2>
      {planos
        .filter((p) => p.publico === 'profissional')
        .map((p) => (
          <EditarPlano key={p.id} plano={p} onSalvo={(n) => setPlanos((ps) => ps.map((x) => (x.id === n.id ? n : x)))} />
        ))}
      <h2 className="secao">Planos do aluno</h2>
      {planos
        .filter((p) => p.publico === 'aluno')
        .map((p) => (
          <EditarPlano key={p.id} plano={p} onSalvo={(n) => setPlanos((ps) => ps.map((x) => (x.id === n.id ? n : x)))} />
        ))}
    </>
  )
}

function EditarPlano({ plano, onSalvo }: { plano: Plano; onSalvo: (p: Plano) => void }) {
  const [p, setP] = useState(plano)
  const [mensal, setMensal] = useState(plano.preco_mensal.toFixed(2).replace('.', ','))
  const [anual, setAnual] = useState(plano.preco_anual.toFixed(2).replace('.', ','))
  const [limite, setLimite] = useState(plano.limite_alunos === null ? '' : String(plano.limite_alunos))
  const [recursos, setRecursos] = useState(plano.recursos.join('\n'))
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function salvar() {
    const novo: Plano = {
      ...p,
      preco_mensal: lerReais(mensal) ?? 0,
      preco_anual: lerReais(anual) ?? 0,
      limite_alunos: limite.trim() ? Math.round(lerReais(limite) ?? 0) : null,
      recursos: recursos
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean),
    }
    const e = await salvarPlano(novo)
    setMsg(e ? { ok: false, texto: e } : { ok: true, texto: 'Salvo. Já aparece para todos.' })
    if (!e) onSalvo(novo)
  }

  return (
    <section className={`cartao formulario ${p.ativo ? '' : 'bloqueado'}`}>
      <div className="plano-topo">
        <h3>{p.nome}</h3>
        <span className="chip">{p.preco_mensal === 0 ? 'grátis' : emReais(lerReais(mensal) ?? 0) + '/mês'}</span>
      </div>
      <label className="campo">
        Nome
        <input value={p.nome} maxLength={40} onChange={(e) => setP({ ...p, nome: e.target.value })} />
      </label>
      <label className="campo">
        Frase
        <input value={p.descricao} maxLength={200} onChange={(e) => setP({ ...p, descricao: e.target.value })} />
      </label>
      <div className="linha-campos">
        <label className="campo">
          Mensal (R$)
          <input inputMode="decimal" value={mensal} onChange={(e) => setMensal(e.target.value)} />
        </label>
        <label className="campo">
          Anual (R$)
          <input inputMode="decimal" value={anual} onChange={(e) => setAnual(e.target.value)} />
        </label>
      </div>
      {p.publico === 'profissional' && (
        <label className="campo">
          Limite de alunos (vazio = ilimitado)
          <input inputMode="numeric" value={limite} onChange={(e) => setLimite(e.target.value)} />
        </label>
      )}
      <label className="campo">
        O que inclui (um por linha)
        <textarea rows={4} value={recursos} onChange={(e) => setRecursos(e.target.value)} />
      </label>
      <label className="aceite">
        <input type="checkbox" checked={p.destaque} onChange={(e) => setP({ ...p, destaque: e.target.checked })} /> Mostrar como recomendado
      </label>
      <label className="aceite">
        <input type="checkbox" checked={p.ativo} onChange={(e) => setP({ ...p, ativo: e.target.checked })} /> Plano à venda
      </label>
      {msg && <p className={`mensagem ${msg.ok ? 'ok' : 'erro'}`}>{msg.texto}</p>}
      <button className="botao" onClick={salvar}>
        Salvar plano
      </button>
    </section>
  )
}

/** Administrador: pedidos de plano e avaliações vendidas, com a parte do FormaCerta. */
export function AdminPagamentos({ nomePorId }: { nomePorId: Map<string, string> }) {
  const [lista, setLista] = useState<Pagamento[]>([])
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarPagamentos().then(setLista)
  }, [])

  const pagos = lista.filter((p) => p.situacao === 'pago')
  const pendentes = lista.filter((p) => p.situacao === 'pendente')
  const receita = pagos.reduce((t, p) => t + p.comissao, 0)

  async function mudar(p: Pagamento, nova: SituacaoPagamento) {
    if (nova === 'pago' && !confirm(`Confirmar que ${emReais(p.valor)} de ${nomePorId.get(p.pagador_id) ?? 'alguém'} caiu na conta?`)) return
    const e = await definirPagamento(p.id, nova)
    if (e) setErro(e)
    else setLista((l) => l.map((x) => (x.id === p.id ? { ...x, situacao: nova } : x)))
  }

  return (
    <>
      <div className="numeros">
        <div>
          <strong>{pendentes.length}</strong> pendentes
        </div>
        <div>
          <strong>{pagos.length}</strong> pagos
        </div>
        <div>
          <strong>{emReais(receita)}</strong> seus
        </div>
      </div>
      {erro && <p className="mensagem erro">{erro}</p>}
      {lista.length === 0 && <p className="dica-sec">Nenhum pedido ainda.</p>}
      {lista.map((p) => (
        <section className="cartao pessoa" key={p.id}>
          <div className="pessoa-topo">
            <div>
              <h3>{p.descricao}</h3>
              <p className="dica-sec">
                {nomePorId.get(p.pagador_id) ?? 'conta excluída'} · {ROTULO_FORMA[p.forma]} · {new Date(p.criado_em).toLocaleDateString('pt-BR')}
              </p>
              <p className="dica-sec">
                {emReais(p.valor)}
                {p.tipo === 'avaliacao' && ` · para ${nomePorId.get(p.recebedor_id ?? '') ?? 'personal'} · sua parte ${emReais(p.comissao)}`}
              </p>
            </div>
            <span className={`chip ${p.situacao === 'pago' ? 'chip-ok' : p.situacao === 'pendente' ? 'chip-atencao' : 'chip-alerta'}`}>{ROTULO_PAGAMENTO[p.situacao]}</span>
          </div>
          {p.situacao === 'pendente' && (
            <div className="acoes-linha">
              <button className="botao" onClick={() => mudar(p, 'pago')}>
                Marcar como pago
              </button>
              <button className="botao-sec perigo" onClick={() => mudar(p, 'cancelado')}>
                Cancelar
              </button>
            </div>
          )}
        </section>
      ))}
    </>
  )
}
