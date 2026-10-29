import { useEffect, useState } from 'react'
import { ROTULO_BLOQUEIO, lerBloqueio, salvarBloqueio, type BloqueioChat } from '../../nuvem/chat'
import { ROTULO_PAPEL, type Perfil } from '../../nuvem/conta'
import {
  CONFIG_PADRAO,
  ROTULO_FORMA,
  ROTULO_PAGAMENTO,
  adicionarTestador,
  definirPagamento,
  emReais,
  lerConfig,
  lerReais,
  listarPagamentos,
  listarPlanos,
  listarTestadores,
  salvarConfig,
  salvarPlano,
  tirarTestador,
  type ConfigCobranca,
  type Pagamento,
  type Plano,
  type SituacaoPagamento,
} from '../../nuvem/planos'

/** Administrador: muda preços, recursos, comissão e dias grátis. */
export function AdminPlanos({ perfis }: { perfis: Perfil[] }) {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [config, setConfig] = useState<ConfigCobranca>(CONFIG_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [bloqueio, setBloqueio] = useState<BloqueioChat>('ate_contratar')

  useEffect(() => {
    lerBloqueio().then(setBloqueio)
    listarPlanos().then((r) => {
      setPlanos(r.planos)
      setErro(r.erro)
    })
    lerConfig().then(setConfig)
  }, [])

  async function mudarGateway(gateway: ConfigCobranca['gateway']) {
    if (gateway === 'mercadopago' && !confirm('Ligar o pagamento pelo Mercado Pago? Confira antes se o token MP_ACCESS_TOKEN já está nos segredos do Supabase.')) return
    const e = await salvarConfig({ gateway })
    setErro(e)
    if (!e) setConfig({ ...config, gateway })
  }

  async function mudarBloqueio(b: BloqueioChat) {
    const e = await salvarBloqueio(b)
    setErro(e)
    if (!e) setBloqueio(b)
  }

  async function gravarConfig() {
    const e = await salvarConfig({ comissao_pct: config.comissao_pct, dias_gratis: config.dias_gratis })
    setErro(e)
    setOk(e ? null : 'Regras salvas.')
  }

  return (
    <>
      <QuemVe config={config} perfis={perfis} onMudar={(planos_para) => setConfig({ ...config, planos_para })} />

      <section className="cartao formulario">
        <h2>Pagamento pelo app</h2>
        <div className="escolha">
          <button className={config.gateway === 'nenhum' ? 'ativo' : ''} onClick={() => mudarGateway('nenhum')}>
            Manual
          </button>
          <button className={config.gateway === 'mercadopago' ? 'ativo' : ''} onClick={() => mudarGateway('mercadopago')}>
            Mercado Pago
          </button>
        </div>
        <p className="dica-sec">
          {config.gateway === 'mercadopago'
            ? 'Ligado: o app gera o Pix ou abre a página do Mercado Pago, e o plano libera sozinho quando o pagamento cai. Com o token de teste (TEST-) nenhum dinheiro de verdade passa.'
            : 'Manual: os pedidos ficam registrados e você confirma à mão na aba Pagamentos. Antes de ligar o Mercado Pago, cole o token MP_ACCESS_TOKEN nos segredos do Supabase.'}
        </p>
      </section>

      <section className="cartao formulario">
        <h2>Telefone e e-mail no chat</h2>
        <div className="escolha">
          {(Object.keys(ROTULO_BLOQUEIO) as BloqueioChat[]).map((b) => (
            <button key={b} className={bloqueio === b ? 'ativo' : ''} onClick={() => mudarBloqueio(b)}>
              {ROTULO_BLOQUEIO[b]}
            </button>
          ))}
        </div>
        <p className="dica-sec">
          {bloqueio === 'ate_contratar'
            ? 'Telefone, e-mail, links e "me chama no zap" ficam ocultos até o aluno ter um pagamento confirmado para aquele personal.'
            : bloqueio === 'sempre'
              ? 'Telefone, e-mail e links ficam ocultos sempre, mesmo depois de contratar.'
              : 'Nada fica oculto: aluno e personal podem trocar contato no chat.'}
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

/** Enquanto o Ney configura, os planos só aparecem para ele e os testadores escolhidos. */
function QuemVe({ config, perfis, onMudar }: { config: ConfigCobranca; perfis: Perfil[]; onMudar: (v: ConfigCobranca['planos_para']) => void }) {
  const [testadores, setTestadores] = useState<string[]>([])
  const [escolhido, setEscolhido] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarTestadores().then(setTestadores)
  }, [])

  const nome = (p: Perfil) => `${p.nome || p.email} (${ROTULO_PAPEL[p.papel].toLowerCase()})`
  const fora = perfis.filter((p) => p.papel !== 'admin' && !testadores.includes(p.id))

  async function mudar(v: ConfigCobranca['planos_para']) {
    if (v === 'todos' && !confirm('Mostrar os planos e o pagamento para todos os usuários do app?')) return
    const e = await salvarConfig({ planos_para: v })
    if (e) setErro(e)
    else onMudar(v)
  }

  async function adicionar() {
    if (!escolhido) return
    const e = await adicionarTestador(escolhido)
    if (e) return setErro(e)
    setTestadores((t) => [...t, escolhido])
    setEscolhido('')
  }

  async function tirar(id: string) {
    const e = await tirarTestador(id)
    if (e) setErro(e)
    else setTestadores((t) => t.filter((x) => x !== id))
  }

  return (
    <section className="cartao formulario">
      <h2>Quem vê os planos</h2>
      <div className="escolha">
        <button className={config.planos_para === 'testadores' ? 'ativo' : ''} onClick={() => mudar('testadores')}>
          Só você e testadores
        </button>
        <button className={config.planos_para === 'todos' ? 'ativo' : ''} onClick={() => mudar('todos')}>
          Todos
        </button>
      </div>
      <p className="dica-sec">
        {config.planos_para === 'testadores'
          ? 'Escondido: o botão Planos só aparece para você e para as pessoas abaixo. Os outros não veem nada.'
          : 'Liberado: todo mundo vê o botão Planos.'}
      </p>
      {erro && <p className="mensagem erro">{erro}</p>}
      {config.planos_para === 'testadores' && (
        <>
          {testadores.map((id) => {
            const p = perfis.find((x) => x.id === id)
            return (
              <div className="servico" key={id}>
                <div>{p ? nome(p) : 'conta excluída'}</div>
                <button className="link perigo" onClick={() => tirar(id)}>
                  Tirar
                </button>
              </div>
            )
          })}
          <label className="campo">
            Adicionar testador
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
              <option value="">Escolha um profissional ou aluno</option>
              {fora.map((p) => (
                <option key={p.id} value={p.id}>
                  {nome(p)}
                </option>
              ))}
            </select>
          </label>
          <button className="botao-sec" disabled={!escolhido} onClick={adicionar}>
            Adicionar
          </button>
        </>
      )}
    </section>
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
