import { Bot, MessageCircle, Send, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { comNey, janelaAberta, lerMensagens, listarConversas, mudarAtendimento, responderConversa, type ConversaWhatsApp, type MensagemWhatsApp } from '../../nuvem/whatsappAgente'

const hora = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const telefone = (t: string) => (t.startsWith('55') && t.length >= 12 ? `(${t.slice(2, 4)}) ${t.slice(4, -4)}-${t.slice(-4)}` : `+${t}`)

/** Administrador: conversas do robô no WhatsApp, com pausar e devolver ao robô. */
export function AdminWhatsApp() {
  const [lista, setLista] = useState<ConversaWhatsApp[] | null | undefined>(undefined)
  const [aberta, setAberta] = useState<string | null>(null)

  useEffect(() => {
    listarConversas().then(setLista)
  }, [])

  if (lista === undefined) return <p className="carregando">Carregando…</p>
  if (lista === null) return <p className="dica-sec">Esta aba aparece depois de rodar o SQL do agente de WhatsApp.</p>

  const comVoce = lista.filter(comNey).length

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
      </div>
      {lista.length === 0 && <p className="dica-sec">Nenhuma conversa ainda.</p>}
      {lista.map((c) => (
        <CartaoConversa
          key={c.id}
          c={c}
          aberta={aberta === c.id}
          onAbrir={() => setAberta(aberta === c.id ? null : c.id)}
          onMudou={(nova) => setLista((l) => l?.map((x) => (x.id === nova.id ? nova : x)))}
        />
      ))}
    </div>
  )
}

function CartaoConversa({ c, aberta, onAbrir, onMudou }: { c: ConversaWhatsApp; aberta: boolean; onAbrir: () => void; onMudou: (c: ConversaWhatsApp) => void }) {
  const [msgs, setMsgs] = useState<MensagemWhatsApp[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const ney = comNey(c)

  async function enviar() {
    const t = texto.trim()
    if (!t) return
    setEnviando(true)
    const e = await responderConversa(c.id, t)
    setEnviando(false)
    setErro(e)
    if (e) return
    setTexto('')
    setMsgs((m) => [...(m ?? []), { id: Date.now(), autor: 'humano', texto: t, criado_em: new Date().toISOString() }])
    onMudou({ ...c, atendimento: 'humano', humano_ate: new Date(Date.now() + 12 * 3600_000).toISOString(), motivo_humano: 'Você respondeu pelo app' })
  }

  useEffect(() => {
    if (aberta && msgs === null) lerMensagens(c.id).then(setMsgs)
  }, [aberta, msgs, c.id])

  async function mudar(robo: boolean) {
    const e = await mudarAtendimento(c.id, robo)
    setErro(e)
    if (!e) onMudou({ ...c, atendimento: robo ? 'robo' : 'humano', humano_ate: null, motivo_humano: robo ? '' : 'Pausado pelo administrador' })
  }

  return (
    <section className="cartao pessoa">
      <div className="pessoa-topo">
        <div>
          <h3>{c.nome || 'Sem nome'}</h3>
          <p className="dica-sec">
            {telefone(c.telefone)} · última mensagem {hora(c.ultima_mensagem_em)}
          </p>
          {ney && c.motivo_humano && <p className="dica-sec">Motivo: {c.motivo_humano}</p>}
        </div>
        <span className={`chip ${ney ? 'chip-atencao' : 'chip-ok'}`}>{ney ? 'Com você' : 'Robô'}</span>
      </div>

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
      {erro && <p className="mensagem erro">{erro}</p>}

      {aberta && (
        <div className="chat-mensagens">
          {msgs === null && <p className="carregando">Carregando…</p>}
          {msgs?.map((m) => (
            <div key={m.id} className={`balao ${m.autor === 'entrada' ? '' : 'minha'}`}>
              {m.autor !== 'entrada' && <span className="balao-hora">{m.autor === 'robo' ? 'Robô' : 'Você'}</span>}
              <p>{m.texto}</p>
              <span className="balao-hora">{hora(m.criado_em)}</span>
            </div>
          ))}
          {msgs && !janelaAberta(msgs) && (
            <p className="dica-sec">A pessoa escreveu há mais de 24 horas. O WhatsApp só deixa responder quando ela escrever de novo.</p>
          )}
          {msgs && janelaAberta(msgs) && (
            <div className="chat-escrever">
              <textarea rows={2} placeholder="Responder pelo número do FormaCerta" value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} />
              <button className="botao chat-enviar" disabled={enviando || !texto.trim()} onClick={enviar} aria-label="Enviar">
                <Send size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
