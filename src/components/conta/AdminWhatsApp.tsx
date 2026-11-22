import { Bot, CalendarClock, ChevronLeft, ChevronRight, MessageCircle, Paperclip, Send, Tag, Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminImagensRobo } from './AdminImagensRobo'
import {
  agendarMensagem,
  buscarAudioWhatsApp,
  apagarEtiqueta,
  cancelarAgendada,
  comNey,
  CORES_ETIQUETA,
  criarEtiqueta,
  ETAPAS,
  janelaAberta,
  janelaAbertaEm,
  lerMensagens,
  listarAgendadas,
  listarConversas,
  listarEtiquetas,
  listarPainel,
  mudarAtendimento,
  responderConversa,
  salvarConversa,
  SITUACOES,
  subirAnexo,
  type Agendada,
  type ConversaPainel,
  type Etapa,
  type Etiqueta,
  type MensagemWhatsApp,
  type SituacaoConversa,
} from '../../nuvem/whatsappAgente'

const hora = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const telefone = (t: string) => (t.startsWith('55') && t.length >= 12 ? `(${t.slice(2, 4)}) ${t.slice(4, -4)}-${t.slice(-4)}` : `+${t}`)
const nomeEtapa = (e: Etapa) => ETAPAS.find((x) => x.id === e)?.nome ?? e
const diasDesde = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)

/** Etiqueta colorida. */
function Pilula({ nome, cor, titulo }: { nome: string; cor: string; titulo?: string }) {
  return (
    <span className="chip pilula" style={{ background: `${cor}26`, color: cor }} title={titulo}>
      {nome}
    </span>
  )
}

type Parte = 'conversas' | 'funil' | 'agendadas' | 'imagens'

/** Administrador: conversas do robô no WhatsApp, etiquetas, funil de follow-up e mensagens agendadas. */
export function AdminWhatsApp() {
  const [parte, setParte] = useState<Parte>('conversas')
  const [lista, setLista] = useState<ConversaPainel[] | null | undefined>(undefined)
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [aberta, setAberta] = useState<string | null>(null)

  async function recarregar() {
    const [painel, tags] = await Promise.all([listarPainel(), listarEtiquetas()])
    if (painel === null) {
      // SQL das etiquetas ainda não rodado: mostra as conversas do jeito antigo.
      const antigas = await listarConversas()
      setLista(antigas === null ? null : antigas.map((c) => ({ ...c, ultima_entrada_em: null, etiquetas: [], etapa: 'novo', etapa_em: c.ultima_mensagem_em, anotacao: '', situacao: 'lead', conta_nome: null, conta_tipo: null, conta_ligada: false, plano: null, valido_ate: null, ultimo_autor: null, agendadas: 0, semFunil: true }) as ConversaPainel))
    } else setLista(painel)
    setEtiquetas(tags)
  }
  useEffect(() => {
    recarregar()
  }, [])

  const mudou = (nova: ConversaPainel) => setLista((l) => l?.map((x) => (x.id === nova.id ? nova : x)))
  const semFunil = !!lista?.some((c) => (c as { semFunil?: boolean }).semFunil)

  return (
    <>
      <div className="escolha abas">
        {(
          [
            ['conversas', 'Conversas'],
            ['funil', 'Funil'],
            ['agendadas', 'Agendadas'],
            ['imagens', 'Imagens do robô'],
          ] as [Parte, string][]
        ).map(([id, nome]) => (
          <button key={id} className={parte === id ? 'ativo' : ''} onClick={() => setParte(id)}>
            {nome}
          </button>
        ))}
      </div>
      {parte === 'imagens' ? (
        <AdminImagensRobo />
      ) : lista === undefined ? (
        <p className="carregando">Carregando…</p>
      ) : lista === null ? (
        <p className="dica-sec">Esta aba aparece depois de rodar o SQL do agente de WhatsApp.</p>
      ) : semFunil && parte !== 'conversas' ? (
        <p className="dica-sec">O funil e as mensagens agendadas aparecem depois de rodar o SQL das etiquetas do WhatsApp.</p>
      ) : parte === 'conversas' ? (
        <Conversas lista={lista} etiquetas={etiquetas} semFunil={semFunil} aberta={aberta} setAberta={setAberta} onMudou={mudou} onEtiquetas={() => listarEtiquetas().then(setEtiquetas)} />
      ) : parte === 'funil' ? (
        <Funil
          lista={lista}
          etiquetas={etiquetas}
          onMudou={mudou}
          onAbrir={(id) => {
            setAberta(id)
            setParte('conversas')
          }}
        />
      ) : (
        <Agendadas onMudou={recarregar} />
      )}
    </>
  )
}

// ---------------- Conversas ----------------

type Filtro = { tipo: 'todas' } | { tipo: 'ney' } | { tipo: 'situacao'; valor: SituacaoConversa } | { tipo: 'etiqueta'; valor: string }

function passa(c: ConversaPainel, f: Filtro) {
  if (f.tipo === 'ney') return comNey(c)
  if (f.tipo === 'situacao') return c.situacao === f.valor
  if (f.tipo === 'etiqueta') return c.etiquetas.includes(f.valor)
  return true
}

function Conversas({
  lista,
  etiquetas,
  semFunil,
  aberta,
  setAberta,
  onMudou,
  onEtiquetas,
}: {
  lista: ConversaPainel[]
  etiquetas: Etiqueta[]
  semFunil: boolean
  aberta: string | null
  setAberta: (id: string | null) => void
  onMudou: (c: ConversaPainel) => void
  onEtiquetas: () => void
}) {
  const [filtro, setFiltro] = useState<Filtro>({ tipo: 'todas' })
  const [editarEtiquetas, setEditarEtiquetas] = useState(false)
  const comVoce = lista.filter(comNey).length
  const followUp = lista.filter((c) => c.etapa === 'follow_up').length
  const situacoes = useMemo(() => (Object.keys(SITUACOES) as SituacaoConversa[]).filter((s) => lista.some((c) => c.situacao === s)), [lista])
  const visiveis = lista.filter((c) => passa(c, filtro))
  const igual = (f: Filtro) => JSON.stringify(f) === JSON.stringify(filtro)

  useEffect(() => {
    if (aberta) document.getElementById(`conversa-${aberta}`)?.scrollIntoView({ block: 'start' })
  }, [aberta])

  return (
    <div className="admin-whatsapp">
      <p className="dica-sec">
        O robô responde sozinho no número do FormaCerta. Quando ele passa a conversa para você, chega um e-mail. Abra a conversa e responda por aqui: o robô fica quieto nela por 12 horas, ou até você tocar em Devolver ao robô.
      </p>
      <div className="numeros">
        <div>
          <strong>{lista.length}</strong> conversas
        </div>
        <div className={comVoce > 0 ? 'destaque-laranja' : ''}>
          <strong>{comVoce}</strong> com você
        </div>
        {!semFunil && (
          <div className={followUp > 0 ? 'destaque-laranja' : ''}>
            <strong>{followUp}</strong> fazer follow-up
          </div>
        )}
      </div>

      {!semFunil && (
        <div className="filtros-etiquetas" role="group" aria-label="Filtrar conversas">
          <button className={`filtro ${igual({ tipo: 'todas' }) ? 'ativo' : ''}`} onClick={() => setFiltro({ tipo: 'todas' })}>
            Todas
          </button>
          <button className={`filtro ${igual({ tipo: 'ney' }) ? 'ativo' : ''}`} onClick={() => setFiltro({ tipo: 'ney' })}>
            Com você
          </button>
          {situacoes.map((s) => (
            <button key={s} className={`filtro ${igual({ tipo: 'situacao', valor: s }) ? 'ativo' : ''}`} style={{ '--cor': SITUACOES[s].cor } as React.CSSProperties} onClick={() => setFiltro({ tipo: 'situacao', valor: s })}>
              <i /> {SITUACOES[s].nome} · {lista.filter((c) => c.situacao === s).length}
            </button>
          ))}
          {etiquetas.map((e) => (
            <button key={e.id} className={`filtro ${igual({ tipo: 'etiqueta', valor: e.id }) ? 'ativo' : ''}`} style={{ '--cor': e.cor } as React.CSSProperties} onClick={() => setFiltro({ tipo: 'etiqueta', valor: e.id })}>
              <i /> {e.nome}
            </button>
          ))}
          <button className="filtro" onClick={() => setEditarEtiquetas((v) => !v)}>
            <Tag size={14} /> {editarEtiquetas ? 'Fechar' : 'Editar etiquetas'}
          </button>
        </div>
      )}
      {editarEtiquetas && <EditarEtiquetas etiquetas={etiquetas} onMudou={onEtiquetas} />}

      {visiveis.length === 0 && <p className="dica-sec">{lista.length === 0 ? 'Nenhuma conversa ainda.' : 'Nenhuma conversa com esse filtro.'}</p>}
      {visiveis.map((c) => (
        <CartaoConversa key={c.id} c={c} etiquetas={etiquetas} semFunil={semFunil} aberta={aberta === c.id} onAbrir={() => setAberta(aberta === c.id ? null : c.id)} onMudou={onMudou} />
      ))}
    </div>
  )
}

function EditarEtiquetas({ etiquetas, onMudou }: { etiquetas: Etiqueta[]; onMudou: () => void }) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES_ETIQUETA[0])
  const [erro, setErro] = useState<string | null>(null)

  async function criar() {
    if (!nome.trim()) return
    const e = await criarEtiqueta(nome, cor, (etiquetas.at(-1)?.ordem ?? 0) + 1)
    setErro(e)
    if (!e) {
      setNome('')
      onMudou()
    }
  }
  async function apagar(et: Etiqueta) {
    if (!window.confirm(`Apagar a etiqueta "${et.nome}"? Ela sai de todas as conversas.`)) return
    const e = await apagarEtiqueta(et.id)
    setErro(e)
    if (!e) onMudou()
  }

  return (
    <section className="cartao editar-etiquetas">
      <h3>Suas etiquetas</h3>
      <p className="dica-sec">
        As etiquetas <b>Lead, Testando, Assinante, Vencido…</b> são automáticas: o app olha a conta da pessoa (pelo código confirmado no WhatsApp ou pelo telefone do cadastro). Estas aqui você coloca à mão.
      </p>
      <div className="lista-etiquetas">
        {etiquetas.map((e) => (
          <span key={e.id} className="etiqueta-editar">
            <Pilula nome={e.nome} cor={e.cor} />
            <button className="icone-acao" onClick={() => apagar(e)} aria-label={`Apagar ${e.nome}`}>
              <Trash2 size={14} />
            </button>
          </span>
        ))}
      </div>
      <label className="campo">
        Nova etiqueta
        <input value={nome} maxLength={30} placeholder="Ex.: Indicação do Romildo" onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="cores" role="radiogroup" aria-label="Cor">
        {CORES_ETIQUETA.map((c) => (
          <button key={c} role="radio" aria-checked={cor === c} className={cor === c ? 'ativo' : ''} style={{ background: c }} onClick={() => setCor(c)} aria-label={c} />
        ))}
      </div>
      <button className="botao" disabled={!nome.trim()} onClick={criar}>
        <Tag size={16} /> Criar etiqueta
      </button>
      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}

/** Player independente por balão; só solicita o link privado quando o admin tocar. */
function AudioDoContato({ mensagem }: { mensagem: MensagemWhatsApp }) {
  const [url, setUrl] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function ouvir() {
    setCarregando(true)
    setErro(null)
    const resultado = await buscarAudioWhatsApp(mensagem.id)
    setCarregando(false)
    setUrl(resultado.url)
    setErro(resultado.erro)
  }

  if (!mensagem.midia_id && !mensagem.midia_caminho) {
    return <p className="dica-sec">Áudio antigo não armazenado. Peça ao contato para reenviar.</p>
  }

  return (
    <div className="whatsapp-audio-player">
      <span className="whatsapp-audio-label">🎙️ Mensagem de voz recebida</span>
      {url ? (
        <>
          <audio controls preload="metadata" src={url} aria-label="Áudio do contato" />
          <button className="botao-sec whatsapp-audio-recarregar" type="button" onClick={ouvir} disabled={carregando}>
            {carregando ? 'Atualizando…' : 'Atualizar áudio'}
          </button>
        </>
      ) : (
        <button className="botao-sec" type="button" onClick={ouvir} disabled={carregando}>
          {carregando ? 'Carregando áudio…' : '▶ Ouvir áudio'}
        </button>
      )}
      {erro && <span className="dica-sec" role="alert">{erro}</span>}
    </div>
  )
}

function CartaoConversa({
  c,
  etiquetas,
  semFunil,
  aberta,
  onAbrir,
  onMudou,
}: {
  c: ConversaPainel
  etiquetas: Etiqueta[]
  semFunil: boolean
  aberta: boolean
  onAbrir: () => void
  onMudou: (c: ConversaPainel) => void
}) {
  const [msgs, setMsgs] = useState<MensagemWhatsApp[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [painel, setPainel] = useState<'etiquetas' | 'agendar' | null>(null)
  const ney = comNey(c)
  const situacao = SITUACOES[c.situacao]
  const minhas = etiquetas.filter((e) => c.etiquetas.includes(e.id))

  const [anexo, setAnexo] = useState<{ url: string; tipo: 'imagem' | 'documento'; nome: string } | null>(null)
  const [subindo, setSubindo] = useState(false)

  async function escolherAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setSubindo(true)
    setErro(null)
    const r = await subirAnexo(arquivo)
    setSubindo(false)
    if (r.erro) return setErro(r.erro)
    setAnexo({ url: r.url!, tipo: r.tipo!, nome: r.nome! })
  }

  async function enviar() {
    const t = texto.trim()
    if (!t && !anexo) return
    setEnviando(true)
    const e = await responderConversa(c.id, t, anexo)
    setEnviando(false)
    setErro(e)
    if (e) return
    const agora = new Date().toISOString()
    const novas: MensagemWhatsApp[] = []
    if (t) novas.push({ id: Date.now(), autor: 'humano', texto: t, criado_em: agora })
    if (anexo) novas.push({ id: Date.now() + 1, autor: 'humano', texto: `[${anexo.tipo === 'documento' ? 'Arquivo' : 'Imagem'}: ${anexo.nome}]`, criado_em: agora })
    setTexto('')
    setAnexo(null)
    setMsgs((m) => [...(m ?? []), ...novas])
    onMudou({ ...c, atendimento: 'humano', humano_ate: new Date(Date.now() + 12 * 3600_000).toISOString(), motivo_humano: 'Você respondeu pelo app', ultimo_autor: 'humano' })
  }

  useEffect(() => {
    if (aberta && msgs === null) lerMensagens(c.id).then(setMsgs)
  }, [aberta, msgs, c.id])

  async function mudar(robo: boolean) {
    const e = await mudarAtendimento(c.id, robo)
    setErro(e)
    if (!e) onMudou({ ...c, atendimento: robo ? 'robo' : 'humano', humano_ate: null, motivo_humano: robo ? '' : 'Pausado pelo administrador' })
  }

  async function mudarEtapa(etapa: Etapa) {
    const e = await salvarConversa(c.id, { etapa })
    setErro(e)
    if (!e) onMudou({ ...c, etapa, etapa_em: new Date().toISOString() })
  }

  return (
    <section className="cartao pessoa" id={`conversa-${c.id}`}>
      <div className="pessoa-topo">
        <div>
          <h3>{c.nome || c.conta_nome || 'Sem nome'}</h3>
          <p className="dica-sec">
            {telefone(c.telefone)} · última mensagem {hora(c.ultima_mensagem_em)}
          </p>
          {ney && c.motivo_humano && <p className="dica-sec">Motivo: {c.motivo_humano}</p>}
        </div>
        <span className={`chip ${ney ? 'chip-atencao' : 'chip-ok'}`}>{ney ? 'Com você' : 'Robô'}</span>
      </div>

      {!semFunil && (
        <div className="linha-etiquetas">
          <Pilula nome={situacao.nome} cor={situacao.cor} titulo={situacao.dica} />
          {c.conta_tipo && c.conta_tipo !== 'admin' && <span className="chip chip-neutro">{c.conta_tipo === 'personal' ? 'Personal' : 'Aluno'}{c.plano ? ` · ${c.plano}` : ''}</span>}
          {minhas.map((e) => (
            <Pilula key={e.id} nome={e.nome} cor={e.cor} />
          ))}
          {c.agendadas > 0 && (
            <span className="chip chip-neutro">
              <CalendarClock size={12} /> {c.agendadas} agendada{c.agendadas > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
      {c.anotacao && <p className="anotacao-conversa">📝 {c.anotacao}</p>}

      <div className="acoes-linha">
        <button className="botao-sec" onClick={onAbrir}>
          {aberta ? 'Fechar' : 'Ver conversa'}
        </button>
        {ney ? (
          <button className="botao" onClick={() => mudar(true)}>
            <Bot size={16} /> Devolver ao robô
          </button>
        ) : (
          <button className="botao-sec" onClick={() => mudar(false)}>
            <UserRound size={16} /> Pausar robô
          </button>
        )}
        <a className="botao botao-whatsapp" href={`https://wa.me/${c.telefone}`} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> WhatsApp
        </a>
      </div>

      {!semFunil && (
        <div className="acoes-linha funil-linha">
          <label className="campo etapa-campo">
            Etapa do funil
            <select value={c.etapa} onChange={(e) => mudarEtapa(e.target.value as Etapa)}>
              {ETAPAS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </label>
          <button className={`botao-sec ${painel === 'etiquetas' ? 'ativo' : ''}`} onClick={() => setPainel(painel === 'etiquetas' ? null : 'etiquetas')}>
            <Tag size={16} /> Etiquetas
          </button>
          <button className={`botao-sec ${painel === 'agendar' ? 'ativo' : ''}`} onClick={() => setPainel(painel === 'agendar' ? null : 'agendar')}>
            <CalendarClock size={16} /> Agendar
          </button>
        </div>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}

      {painel === 'etiquetas' && <PainelEtiquetas c={c} etiquetas={etiquetas} onMudou={onMudou} />}
      {painel === 'agendar' && <PainelAgendar c={c} onMudou={(n) => onMudou({ ...c, agendadas: n })} />}

      {aberta && (
        <div className="chat-mensagens">
          {msgs === null && <p className="carregando">Carregando…</p>}
          {msgs?.map((m) => (
            <div key={m.id} className={`balao ${m.autor === 'entrada' ? '' : 'minha'}`}>
              {m.autor !== 'entrada' && <span className="balao-hora">{m.autor === 'robo' ? 'Robô' : 'Você'}</span>}
              {m.midia_tipo === 'audio' ? (
                <AudioDoContato mensagem={m} />
              ) : m.texto.startsWith('[Mandou áudio') ? (
                <p className="dica-sec">Áudio anterior não armazenado. Peça ao contato para reenviar.</p>
              ) : (
                <p>{m.texto}</p>
              )}
              <span className="balao-hora">{hora(m.criado_em)}</span>
            </div>
          ))}
          {msgs && !janelaAberta(msgs) && (
            <p className="dica-sec">A pessoa escreveu há mais de 24 horas. O WhatsApp só deixa responder quando ela escrever de novo.</p>
          )}
          {msgs && janelaAberta(msgs) && (
            <div className="chat-escrever com-anexo">
              {anexo && (
                <p className="anexo-escolhido chat-anexo">
                  <Paperclip size={14} /> {anexo.nome}
                  <button className="icone-acao" onClick={() => setAnexo(null)} aria-label="Tirar anexo">
                    <X size={14} />
                  </button>
                </p>
              )}
              <label className={`chat-clipe ${subindo ? 'ocupado' : ''}`} title="Anexar foto ou PDF" aria-label="Anexar foto ou PDF">
                <Paperclip size={18} />
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" hidden onChange={escolherAnexo} disabled={subindo || enviando} />
              </label>
              <textarea rows={2} placeholder={subindo ? 'Enviando o arquivo…' : 'Responder (a pessoa vê: Atendimento FormaCerta)'} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} />
              <button className="botao chat-enviar" disabled={enviando || subindo || (!texto.trim() && !anexo)} onClick={enviar} aria-label="Enviar">
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function PainelEtiquetas({ c, etiquetas, onMudou }: { c: ConversaPainel; etiquetas: Etiqueta[]; onMudou: (c: ConversaPainel) => void }) {
  const [anotacao, setAnotacao] = useState(c.anotacao)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  async function alternar(id: string) {
    const novas = c.etiquetas.includes(id) ? c.etiquetas.filter((x) => x !== id) : [...c.etiquetas, id]
    const e = await salvarConversa(c.id, { etiquetas: novas })
    setErro(e)
    if (!e) onMudou({ ...c, etiquetas: novas })
  }
  async function salvarAnotacao() {
    const e = await salvarConversa(c.id, { anotacao: anotacao.trim() })
    setErro(e)
    setSalvo(!e)
    if (!e) onMudou({ ...c, anotacao: anotacao.trim() })
  }

  return (
    <div className="painel-conversa">
      <p className="dica-sec">Toque para colocar ou tirar. Crie novas em "Editar etiquetas", lá em cima.</p>
      <div className="lista-etiquetas">
        {etiquetas.map((e) => {
          const tem = c.etiquetas.includes(e.id)
          return (
            <button key={e.id} className={`etiqueta-alternar ${tem ? 'ativo' : ''}`} style={{ '--cor': e.cor } as React.CSSProperties} onClick={() => alternar(e.id)} aria-pressed={tem}>
              {tem ? '✓ ' : '+ '}
              {e.nome}
            </button>
          )
        })}
      </div>
      <label className="campo">
        Anotação (só você vê)
        <textarea
          rows={2}
          maxLength={1000}
          value={anotacao}
          placeholder="Ex.: quer começar em janeiro, ligar dia 05"
          onChange={(e) => {
            setAnotacao(e.target.value)
            setSalvo(false)
          }}
        />
      </label>
      <button className="botao-sec" disabled={anotacao.trim() === c.anotacao} onClick={salvarAnotacao}>
        {salvo ? 'Anotação salva ✓' : 'Salvar anotação'}
      </button>
      {erro && <p className="mensagem erro">{erro}</p>}
    </div>
  )
}

/** "2026-11-21T09:00" no horário do celular. */
const paraCampo = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function atalho(tipo: '1h' | 'amanha' | '3dias' | 'semana'): Date {
  const d = new Date()
  if (tipo === '1h') {
    d.setMinutes(d.getMinutes() + 60, 0, 0)
    return d
  }
  d.setDate(d.getDate() + (tipo === 'amanha' ? 1 : tipo === '3dias' ? 3 : 7))
  d.setHours(9, 0, 0, 0)
  return d
}

function PainelAgendar({ c, onMudou }: { c: ConversaPainel; onMudou: (pendentes: number) => void }) {
  const [quando, setQuando] = useState(paraCampo(atalho('amanha')))
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState<{ url: string; tipo: 'imagem' | 'documento'; nome: string } | null>(null)
  const [lista, setLista] = useState<Agendada[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const recarregar = () =>
    listarAgendadas(c.id).then((l) => {
      setLista(l)
      onMudou(l.filter((a) => a.situacao === 'agendada').length)
    })
  useEffect(() => {
    listarAgendadas(c.id).then(setLista)
  }, [c.id])

  const data = new Date(quando)
  const valida = !Number.isNaN(data.getTime()) && data.getTime() > Date.now() - 60_000
  const aberta = janelaAbertaEm(c.ultima_entrada_em, data)

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setOcupado(true)
    setErro(null)
    const r = await subirAnexo(arquivo)
    setOcupado(false)
    if (r.erro) return setErro(r.erro)
    setAnexo({ url: r.url!, tipo: r.tipo!, nome: r.nome! })
  }

  async function agendar() {
    setOcupado(true)
    setErro(null)
    const e = await agendarMensagem({ conversa_id: c.id, texto: texto.trim(), anexo_url: anexo?.url ?? null, anexo_tipo: anexo?.tipo ?? null, anexo_nome: anexo?.nome ?? '', enviar_em: data.toISOString() })
    setOcupado(false)
    setErro(e)
    if (e) return
    setTexto('')
    setAnexo(null)
    setOk(`Agendada para ${hora(data.toISOString())}.`)
    recarregar()
  }

  async function cancelar(a: Agendada) {
    const e = await cancelarAgendada(a.id)
    setErro(e)
    if (!e) recarregar()
  }

  return (
    <div className="painel-conversa">
      <div className="atalhos-hora">
        {(
          [
            ['1h', 'Daqui 1 hora'],
            ['amanha', 'Amanhã 9h'],
            ['3dias', 'Em 3 dias'],
            ['semana', 'Em 1 semana'],
          ] as const
        ).map(([id, nome]) => (
          <button key={id} className="filtro" onClick={() => setQuando(paraCampo(atalho(id)))}>
            {nome}
          </button>
        ))}
      </div>
      <label className="campo">
        Dia e hora
        <input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
      </label>
      <label className="campo">
        Mensagem
        <textarea rows={3} maxLength={4000} value={texto} placeholder="Oi! Passando para saber se conseguiu testar o app 😊" onChange={(e) => setTexto(e.target.value)} />
      </label>
      {anexo ? (
        <p className="anexo-escolhido">
          <Paperclip size={14} /> {anexo.nome}
          <button className="icone-acao" onClick={() => setAnexo(null)} aria-label="Tirar anexo">
            <X size={14} />
          </button>
        </p>
      ) : (
        <label className="botao-sec anexar">
          <Paperclip size={16} /> {ocupado ? 'Enviando…' : 'Anexar foto ou PDF'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" hidden onChange={escolher} disabled={ocupado} />
        </label>
      )}

      {valida && !aberta && (
        <p className="aviso-janela">
          ⚠️ Nesse horário já vai ter passado 24 horas desde a última mensagem da pessoa. O WhatsApp só deixa mandar texto livre dentro dessas 24 horas. Se ela não escrever de novo até lá, a mensagem <b>não vai</b> (ou vai só o modelo de lembrete aprovado na Meta, se você tiver um).
        </p>
      )}
      {valida && aberta && <p className="dica-sec">✅ Dentro das 24 horas: vai do jeitinho que você escreveu, com "{'Atendimento FormaCerta'}" em cima.</p>}

      <button className="botao" disabled={ocupado || !valida || (!texto.trim() && !anexo)} onClick={agendar}>
        <CalendarClock size={16} /> Agendar
      </button>
      {ok && <p className="mensagem ok">{ok} O envio sai em até 5 minutos depois do horário.</p>}
      {erro && <p className="mensagem erro">{erro}</p>}

      {lista && lista.length > 0 && (
        <div className="lista-agendadas">
          <h4>Desta conversa</h4>
          {lista.slice(0, 10).map((a) => (
            <LinhaAgendada key={a.id} a={a} onCancelar={() => cancelar(a)} />
          ))}
        </div>
      )}
    </div>
  )
}

const SITUACAO_AGENDADA: Record<Agendada['situacao'], { nome: string; classe: string }> = {
  agendada: { nome: 'Agendada', classe: 'chip-atencao' },
  enviando: { nome: 'Enviando', classe: 'chip-atencao' },
  enviada: { nome: 'Enviada', classe: 'chip-ok' },
  modelo: { nome: 'Foi o modelo', classe: 'chip-atencao' },
  falhou: { nome: 'Não enviada', classe: 'chip-alerta' },
  cancelada: { nome: 'Cancelada', classe: 'chip-neutro' },
}

function LinhaAgendada({ a, comNome, onCancelar }: { a: Agendada; comNome?: boolean; onCancelar: () => void }) {
  const s = SITUACAO_AGENDADA[a.situacao]
  return (
    <div className="linha-agendada">
      <div className="linha-agendada-topo">
        <strong>{comNome ? `${a.conversa?.nome || telefone(a.conversa?.telefone ?? '')} · ` : ''}{hora(a.enviar_em)}</strong>
        <span className={`chip ${s.classe}`}>{s.nome}</span>
      </div>
      {a.texto && <p>{a.texto}</p>}
      {a.anexo_url && (
        <p className="dica-sec">
          <Paperclip size={12} /> {a.anexo_nome || 'anexo'}
        </p>
      )}
      {a.observacao && <p className="dica-sec">{a.observacao}</p>}
      {a.situacao === 'agendada' && (
        <button className="botao-sec pequeno" onClick={onCancelar}>
          <X size={14} /> Cancelar
        </button>
      )}
    </div>
  )
}

// ---------------- Agendadas (todas) ----------------

function Agendadas({ onMudou }: { onMudou: () => void }) {
  const [lista, setLista] = useState<Agendada[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const recarregar = () => listarAgendadas().then(setLista)
  useEffect(() => {
    recarregar()
  }, [])

  if (lista === null) return <p className="carregando">Carregando…</p>
  const pendentes = lista.filter((a) => a.situacao === 'agendada').sort((a, b) => a.enviar_em.localeCompare(b.enviar_em))
  const passadas = lista.filter((a) => a.situacao !== 'agendada')

  async function cancelar(a: Agendada) {
    const e = await cancelarAgendada(a.id)
    setErro(e)
    if (!e) {
      recarregar()
      onMudou()
    }
  }

  return (
    <div className="admin-whatsapp">
      <p className="dica-sec">
        Para agendar, abra a conversa em <b>Conversas</b> e toque em <b>Agendar</b>. O WhatsApp só deixa mandar texto livre até 24 horas depois da última mensagem da pessoa. Depois disso, só um modelo aprovado pela Meta.
      </p>
      {erro && <p className="mensagem erro">{erro}</p>}
      <h3>Vão sair ({pendentes.length})</h3>
      {pendentes.length === 0 && <p className="dica-sec">Nenhuma mensagem esperando.</p>}
      {pendentes.map((a) => (
        <LinhaAgendada key={a.id} a={a} comNome onCancelar={() => cancelar(a)} />
      ))}
      {passadas.length > 0 && <h3>Já passaram</h3>}
      {passadas.slice(0, 30).map((a) => (
        <LinhaAgendada key={a.id} a={a} comNome onCancelar={() => undefined} />
      ))}
    </div>
  )
}

// ---------------- Funil (quadro em colunas) ----------------

function Funil({ lista, etiquetas, onMudou, onAbrir }: { lista: ConversaPainel[]; etiquetas: Etiqueta[]; onMudou: (c: ConversaPainel) => void; onAbrir: (id: string) => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<Etapa | null>(null)

  async function mover(c: ConversaPainel, etapa: Etapa) {
    if (c.etapa === etapa) return
    const antes = c
    onMudou({ ...c, etapa, etapa_em: new Date().toISOString() })
    const e = await salvarConversa(c.id, { etapa })
    setErro(e)
    if (e) onMudou(antes)
  }

  return (
    <div className="funil">
      <p className="dica-sec">
        Arraste o cartão para outra coluna (no computador) ou use as setas ‹ ›. Quando a pessoa paga o Pix na conversa, ela vai sozinha para <b>Fechou</b>. Quem estava em follow-up ou aguardando e escreve de novo volta para <b>Em conversa</b>.
      </p>
      {erro && <p className="mensagem erro">{erro}</p>}
      <div className="funil-colunas">
        {ETAPAS.map((etapa, i) => {
          const daqui = lista.filter((c) => c.etapa === etapa.id).sort((a, b) => b.ultima_mensagem_em.localeCompare(a.ultima_mensagem_em))
          return (
            <section
              key={etapa.id}
              className={`funil-coluna etapa-${etapa.id} ${sobre === etapa.id ? 'sobre' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setSobre(etapa.id)
              }}
              onDragLeave={() => setSobre(null)}
              onDrop={(e) => {
                e.preventDefault()
                setSobre(null)
                const c = lista.find((x) => x.id === arrastando)
                if (c) mover(c, etapa.id)
              }}
            >
              <header>
                <h3>{etapa.nome}</h3>
                <span className="chip chip-neutro">{daqui.length}</span>
              </header>
              <p className="dica-sec">{etapa.dica}</p>
              {daqui.map((c) => {
                const s = SITUACOES[c.situacao]
                const dias = diasDesde(c.etapa_em)
                return (
                  <article key={c.id} className="funil-cartao" draggable onDragStart={() => setArrastando(c.id)} onDragEnd={() => setArrastando(null)}>
                    <button className="sem-botao" onClick={() => onAbrir(c.id)}>
                      <strong>{c.nome || c.conta_nome || telefone(c.telefone)}</strong>
                      <span className="dica-sec">
                        {dias === 0 ? 'hoje nesta etapa' : `${dias} dia${dias > 1 ? 's' : ''} nesta etapa`}
                        {comNey(c) ? ' · com você' : ''}
                      </span>
                    </button>
                    <div className="linha-etiquetas">
                      <Pilula nome={s.nome} cor={s.cor} titulo={s.dica} />
                      {etiquetas
                        .filter((e) => c.etiquetas.includes(e.id))
                        .map((e) => (
                          <Pilula key={e.id} nome={e.nome} cor={e.cor} />
                        ))}
                      {c.agendadas > 0 && (
                        <span className="chip chip-neutro">
                          <CalendarClock size={12} /> {c.agendadas}
                        </span>
                      )}
                    </div>
                    {c.anotacao && <p className="anotacao-conversa">📝 {c.anotacao}</p>}
                    <div className="funil-setas">
                      <button className="icone-acao" disabled={i === 0} onClick={() => mover(c, ETAPAS[i - 1].id)} aria-label={`Mover para ${i > 0 ? ETAPAS[i - 1].nome : ''}`}>
                        <ChevronLeft size={18} />
                      </button>
                      <span className="dica-sec">{nomeEtapa(c.etapa)}</span>
                      <button className="icone-acao" disabled={i === ETAPAS.length - 1} onClick={() => mover(c, ETAPAS[i + 1].id)} aria-label={`Mover para ${i < ETAPAS.length - 1 ? ETAPAS[i + 1].nome : ''}`}>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
    </div>
  )
}
