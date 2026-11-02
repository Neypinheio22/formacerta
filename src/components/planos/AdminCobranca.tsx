import { useEffect, useState } from 'react'
import { ROTULO_BLOQUEIO, lerBloqueio, salvarBloqueio, type BloqueioChat } from '../../nuvem/chat'
import { ROTULO_PAPEL, type Perfil } from '../../nuvem/conta'
import {
  CONFIG_PADRAO,
  ROTULO_FORMA,
  ROTULO_PAGAMENTO,
  adicionarTestador,
  darPlano,
  definirPagamento,
  emReais,
  lerConfig,
  lerReais,
  lerTravas,
  listarPagamentos,
  listarRepasses,
  marcarRepasse,
  planosDeTodos,
  listarPlanos,
  listarTestadores,
  salvarConfig,
  salvarPlano,
  tirarTestador,
  type ConfigCobranca,
  type Pagamento,
  type Plano,
  type PlanoDeAlguem,
  type Repasse,
  type SituacaoPagamento,
} from '../../nuvem/planos'
import { AdminVideo } from '../video/AdminVideo'

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

      <Travas planosParaTodos={config.planos_para === 'todos'} />

      <Cortesias perfis={perfis} planos={planos} />

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

/** Liga ou desliga as travas do plano pago (Aluno Pro, limite de alunos, venda de serviços). */
function Travas({ planosParaTodos }: { planosParaTodos: boolean }) {
  const [travar, setTravar] = useState<boolean | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    lerTravas().then(setTravar)
  }, [])

  // Sem o SQL novo a coluna não existe: o quadro não aparece.
  if (travar === null) return null

  async function mudar(v: boolean) {
    if (!v && !confirm('Desligar as travas? Todo mundo volta a usar tudo, mesmo sem pagar.')) return
    const e = await salvarConfig({ travar_recursos: v })
    setErro(e)
    if (!e) setTravar(v)
  }

  return (
    <section className="cartao formulario">
      <h2>O que é só do plano pago</h2>
      <div className="escolha">
        <button className={travar ? 'ativo' : ''} onClick={() => mudar(true)}>
          Travado
        </button>
        <button className={!travar ? 'ativo' : ''} onClick={() => mudar(false)}>
          Tudo liberado
        </button>
      </div>
      <p className="dica-sec">
        {travar
          ? 'Travado: corrida, exercício em vídeo e Central de Inteligência só para o Aluno Pro (ou aluno de personal que paga o plano; cortesia não conta). O personal fica no limite de alunos do plano e só vende serviços a partir do Essencial.'
          : 'Tudo liberado: ninguém fica travado, como antes dos planos.'}
        {travar && !planosParaTodos && ' Enquanto os planos estão escondidos, nada é travado.'}
      </p>
      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}

/** Plano de cortesia: o administrador dá um plano por tantos dias, sem pagamento (parceiros, testadores). */
function Cortesias({ perfis, planos }: { perfis: Perfil[]; planos: Plano[] }) {
  const [lista, setLista] = useState<PlanoDeAlguem[]>([])
  const [quem, setQuem] = useState('')
  const [plano, setPlano] = useState('')
  const [dias, setDias] = useState('30')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    planosDeTodos().then(setLista)
  }, [])

  const pessoa = perfis.find((p) => p.id === quem)
  const publico = pessoa ? (pessoa.papel === 'aluno' ? 'aluno' : 'profissional') : null
  const opcoes = planos.filter((p) => p.publico === publico && p.preco_mensal > 0)
  const nome = (id: string) => {
    const p = perfis.find((x) => x.id === id)
    return p ? p.nome || p.email : 'conta excluída'
  }
  const cortesias = lista.filter((a) => a.cortesia && (a.situacao === 'ativa' || a.situacao === 'vencida'))

  async function dar() {
    const n = Math.round(lerReais(dias) ?? 0)
    if (!quem || !plano || n < 1) return setMsg({ ok: false, texto: 'Escolha a pessoa, o plano e os dias.' })
    const p = planos.find((x) => x.id === plano)
    if (!confirm(`Dar o plano ${p?.nome ?? ''} de cortesia para ${nome(quem)} por ${n} dias?`)) return
    const e = await darPlano(quem, plano, n)
    setMsg(e ? { ok: false, texto: e } : { ok: true, texto: 'Pronto: o plano já está valendo.' })
    if (!e) {
      setQuem('')
      setPlano('')
      setLista(await planosDeTodos())
    }
  }

  return (
    <section className="cartao formulario">
      <h2>Plano de cortesia</h2>
      <p className="dica-sec">Para parceiros e testadores: o plano vale na hora, sem pagamento, pelos dias que você escolher. A cortesia é só da pessoa: os alunos dela continuam assinando o Aluno Pro, e as vendas pagam a comissão normal.</p>
      <label className="campo">
        Quem
        <select
          value={quem}
          onChange={(e) => {
            setQuem(e.target.value)
            setPlano('')
          }}
        >
          <option value="">Escolha um profissional ou aluno</option>
          {perfis
            .filter((p) => p.papel !== 'admin')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || p.email} ({ROTULO_PAPEL[p.papel].toLowerCase()})
              </option>
            ))}
        </select>
      </label>
      <div className="linha-campos">
        <label className="campo">
          Plano
          <select value={plano} onChange={(e) => setPlano(e.target.value)} disabled={!quem}>
            <option value="">Escolha</option>
            {opcoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          Dias
          <input inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} />
        </label>
      </div>
      {msg && <p className={`mensagem ${msg.ok ? 'ok' : 'erro'}`}>{msg.texto}</p>}
      <button className="botao" onClick={dar}>
        Dar plano
      </button>
      {cortesias.length > 0 && (
        <ul className="historico">
          {cortesias.map((a) => (
            <li key={a.usuario_id}>
              <span className="linha">
                <span>
                  {nome(a.usuario_id)}
                  <br />
                  <small className="dica-sec">
                    {planos.find((p) => p.id === a.plano_id)?.nome ?? a.plano_id} · {a.situacao === 'vencida' ? 'venceu em' : 'até'} {a.valido_ate ? new Date(a.valido_ate).toLocaleDateString('pt-BR') : '—'}
                  </small>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Administrador: quanto falta repassar a cada personal e o botão de marcar o repasse feito. */
export function AdminRepasses() {
  const [lista, setLista] = useState<Repasse[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const r = await listarRepasses()
    setLista(r.lista)
    setErro(r.erro)
  }

  useEffect(() => {
    carregar()
  }, [])

  const aReceber = (r: Repasse) => Math.round((r.servicos_valor + r.chamadas_valor) * 100) / 100
  const total = (lista ?? []).reduce((t, r) => t + aReceber(r), 0)

  async function marcar(r: Repasse) {
    if (!confirm(`Você já mandou ${emReais(aReceber(r))} para ${r.nome}? Marcar como repassado?`)) return
    const { erro } = await marcarRepasse(r.profissional_id)
    if (erro) setErro(erro)
    else carregar()
  }

  return (
    <>
      <div className="numeros">
        <div>
          <strong>{emReais(total)}</strong> a repassar
        </div>
        <div>
          <strong>{(lista ?? []).filter((r) => aReceber(r) > 0).length}</strong> personais
        </div>
      </div>
      <p className="dica-sec">O dinheiro de serviços e chamadas de vídeo cai inteiro na conta do FormaCerta. Aqui está a parte de cada personal, já sem a comissão e as taxas. Depois de mandar o Pix para ele, marque o repasse como feito.</p>
      {erro && <p className="mensagem erro">{erro}</p>}
      {lista === null && !erro && <p className="carregando">Carregando…</p>}
      {lista?.length === 0 && <p className="dica-sec">Nenhuma venda de personal ainda.</p>}
      {lista?.map((r) => (
        <section className="cartao pessoa repasse" key={r.profissional_id}>
          <h3>{r.nome}</h3>
          <p className="dica-sec">
            {r.servicos} {r.servicos === 1 ? 'serviço' : 'serviços'}: {emReais(r.servicos_valor)} · {r.chamadas} {r.chamadas === 1 ? 'chamada' : 'chamadas'} de vídeo: {emReais(r.chamadas_valor)}
          </p>
          {r.repassado_total > 0 && <p className="dica-sec">Já repassado: {emReais(r.repassado_total)}</p>}
          {aReceber(r) > 0 ? (
            <button className="botao" onClick={() => marcar(r)}>
              Marcar repasse de {emReais(aReceber(r))} como feito
            </button>
          ) : (
            <small className="dica-sec">Nada a repassar.</small>
          )}
        </section>
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
      <AdminVideo />
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
