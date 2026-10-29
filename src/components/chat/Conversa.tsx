import { EyeOff, Handshake, Lock, Plus, Send, ShoppingBag, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import { MENSAGEM_MAXIMO, enviarMensagem, lerBloqueio, lerMensagens, marcarLida, outroLado, quando, temContato, type BloqueioChat, type Conversa as ConversaNuvem, type Mensagem } from '../../nuvem/chat'
import { lerReais, precoServico, listarServicos, salvarServico, type Servico } from '../../nuvem/planos'
import { usePlanosLiberados } from '../planos/usePlanosLiberados'

type Props = {
  perfil: Perfil
  conversa: ConversaNuvem
  onVoltar: () => void
  onPagar: (s: Servico) => void
}

/** Serviço dentro do chat: proposta do personal ou interesse do aluno. O aluno paga pelo app. */
function Proposta({ servico, interesse = false, podePagar, contratacaoLiberada, onPagar }: { servico: Servico | undefined; interesse?: boolean; podePagar: boolean; contratacaoLiberada: boolean; onPagar: (s: Servico) => void }) {
  if (!servico || !servico.ativo) return <p className="proposta encerrada">{interesse ? 'Serviço não está mais disponível' : 'Proposta encerrada'}</p>
  return (
    <div className="proposta">
      <span className="etiqueta">
        <Handshake size={14} /> {interesse ? 'Interesse' : 'Proposta'}
      </span>
      <strong>{servico.nome}</strong>
      {servico.descricao && <span className="dica-sec">{servico.descricao}</span>}
      <b className="proposta-preco">{precoServico(servico)}</b>
      {podePagar &&
        (contratacaoLiberada ? (
          <button className="botao" onClick={() => onPagar(servico)}>
            Contratar e pagar
          </button>
        ) : (
          <span className="dica-sec">O pagamento pelo app abre em breve.</span>
        ))}
    </div>
  )
}

/** Conversa entre aluno e personal. Atualiza sozinha a cada poucos segundos. */
export function Conversa({ perfil, conversa, onVoltar, onPagar }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[] | null>(null)
  const [servicos, setServicos] = useState<Servico[]>([])
  const [bloqueio, setBloqueio] = useState<BloqueioChat>('ate_contratar')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [painel, setPainel] = useState(false)
  const [escolheu, setEscolheu] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoPreco, setNovoPreco] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const contratacaoLiberada = usePlanosLiberados(perfil)

  const outro = outroLado(conversa, perfil.id)
  const souAluno = conversa.aluno_id === perfil.id
  const souPersonal = conversa.profissional_id === perfil.id
  // O administrador pode abrir conversas dos outros (denúncia), só para ler.
  const participo = souAluno || souPersonal
  const doPersonal = servicos.filter((s) => s.profissional_id === conversa.profissional_id)
  const aVenda = doPersonal.filter((s) => s.ativo)
  const total = mensagens?.length ?? 0

  useEffect(() => {
    let vivo = true
    const ler = () =>
      lerMensagens(conversa.id).then((m) => {
        if (vivo) setMensagens((antes) => (antes && antes.length === m.length && antes.at(-1)?.id === m.at(-1)?.id ? antes : m))
      })
    ler()
    listarServicos().then((s) => vivo && setServicos(s))
    lerBloqueio().then((b) => vivo && setBloqueio(b))
    const vez = setInterval(ler, 4000)
    return () => {
      vivo = false
      clearInterval(vez)
    }
  }, [conversa.id])

  useEffect(() => {
    if (!total) return
    fim.current?.scrollIntoView({ block: 'end' })
    if (participo) marcarLida(conversa.id)
  }, [total, conversa.id, participo])

  async function mandar(servico?: string, textoProposta?: string) {
    const corpo = textoProposta ?? texto.trim()
    if (!corpo && !servico) return
    setEnviando(true)
    const e = await enviarMensagem(conversa.id, corpo, servico)
    setEnviando(false)
    setErro(e)
    if (e) return
    if (!textoProposta) setTexto('')
    setPainel(false)
    setMensagens(await lerMensagens(conversa.id))
  }

  /** O aluno toca num serviço do menu: aparece o valor e o personal já recebe o interesse (triagem). */
  async function escolher(s: Servico) {
    await mandar(s.id, `Tenho interesse em: ${s.nome}`)
    setEscolheu(true)
  }

  async function criarEMandar() {
    const preco = lerReais(novoPreco)
    if (!novoNome.trim()) return setErro('Escreva o que você está oferecendo.')
    if (!preco || preco < 5) return setErro('Coloque um preço a partir de R$ 5,00.')
    const e = await salvarServico({ profissional_id: perfil.id, nome: novoNome.trim().slice(0, 80), descricao: '', preco, ativo: true })
    if (e) return setErro(e)
    const lista = await listarServicos()
    setServicos(lista)
    const novo = [...lista].reverse().find((s) => s.profissional_id === perfil.id && s.nome === novoNome.trim().slice(0, 80))
    setNovoNome('')
    setNovoPreco('')
    if (novo) await mandar(novo.id, `Proposta: ${novo.nome}`)
  }

  const avisoBloqueio =
    bloqueio === 'nunca'
      ? null
      : bloqueio === 'sempre'
        ? 'Telefone, e-mail e links aparecem ocultos no chat. Contrate pelo app: pagamento seguro, recibo e histórico guardado.'
        : 'Até a primeira contratação pelo app, telefone, e-mail e links aparecem ocultos. Contratando aqui você tem pagamento seguro, recibo e histórico guardado.'

  return (
    <div className="tela tela-chat">
      <header className="topo chat-topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
        <span className="chat-quem">
          {outro.foto ? <img className="personal-foto" src={outro.foto} alt="" /> : <span className="personal-inicial">{outro.nome.charAt(0).toUpperCase()}</span>}
          <strong>{participo ? outro.nome : `${conversa.aluno_nome} ↔ ${conversa.profissional_nome}`}</strong>
        </span>
      </header>

      {avisoBloqueio && (
        <p className="mensagem aviso chat-aviso">
          <Lock size={14} /> {avisoBloqueio}
        </p>
      )}

      {souPersonal && contratacaoLiberada && (
        <button className="botao-sec chat-contratar" onClick={() => setPainel(!painel)}>
          <Handshake size={16} /> Mandar proposta
        </button>
      )}

      {painel && (
        <section className="cartao chat-painel">
          <button className="chat-fechar" aria-label="Fechar" onClick={() => setPainel(false)}>
            <X size={18} />
          </button>
          {souPersonal && (
            <>
              <h2>Mandar proposta</h2>
              <p className="dica-sec">O aluno recebe um cartão com o botão de pagar pelo app.</p>
              {aVenda.map((s) => (
                <button key={s.id} className="opcao" disabled={enviando} onClick={() => mandar(s.id, `Proposta: ${s.nome}`)}>
                  <strong>{s.nome}</strong>
                  <span>{precoServico(s)}</span>
                </button>
              ))}
              <div className="linha-campos">
                <label className="campo">
                  Novo serviço
                  <input value={novoNome} maxLength={80} placeholder="Ex.: Treino mensal online" onChange={(e) => setNovoNome(e.target.value)} />
                </label>
                <label className="campo">
                  Preço (R$)
                  <input inputMode="decimal" value={novoPreco} placeholder="150" onChange={(e) => setNovoPreco(e.target.value)} />
                </label>
              </div>
              <button className="botao" disabled={enviando} onClick={criarEMandar}>
                <Plus size={16} /> Criar e mandar
              </button>
            </>
          )}
        </section>
      )}

      {mensagens === null && <p className="carregando">Carregando mensagens…</p>}
      {mensagens?.length === 0 && !souAluno && <p className="dica-sec centro">Nenhuma mensagem ainda.</p>}

      <div className="chat-mensagens">
        {souAluno && mensagens && (
          <div className="balao saudacao-chat">
            <p>
              Olá{perfil.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}! Aqui é {outro.nome.split(' ')[0]}. Que bom ter você por aqui. {aVenda.length ? 'Toque em um serviço para ver o valor, ou escreva sua dúvida.' : 'Escreva sua dúvida que eu já respondo.'}
            </p>
            {aVenda.length > 0 && (
              <div className="menu-servicos" aria-label="Serviços">
                <span className="etiqueta">
                  <ShoppingBag size={14} /> Serviços
                </span>
                {aVenda.map((s) => (
                  <button key={s.id} className="opcao" disabled={enviando} onClick={() => escolher(s)}>
                    {s.nome}
                  </button>
                ))}
              </div>
            )}
            <small className="balao-hora">
              <Sparkles size={11} /> Mensagem automática
            </small>
          </div>
        )}
        {mensagens?.map((m) => {
          const minha = m.autor_id === perfil.id
          const doAluno = m.autor_id === conversa.aluno_id
          return (
            <div key={m.id} className={`balao ${minha || (!participo && !doAluno) ? 'minha' : ''}`}>
              {m.texto && !m.servico_id && <p>{m.texto}</p>}
              {m.servico_id && <Proposta servico={doPersonal.find((s) => s.id === m.servico_id)} interesse={doAluno} podePagar={souAluno} contratacaoLiberada={contratacaoLiberada} onPagar={onPagar} />}
              {m.oculto && (
                <small className="balao-oculto">
                  <EyeOff size={12} /> Contato oculto pelo FormaCerta
                </small>
              )}
              <small className="balao-hora">{quando(m.criado_em)}</small>
            </div>
          )
        })}
        <div ref={fim} />
      </div>

      {erro && <p className="mensagem erro">{erro}</p>}

      {participo ? (
        <div className="chat-escrever">
          {bloqueio !== 'nunca' && temContato(texto) && <p className="dica-sec chat-dica">Telefone, e-mail e links podem aparecer ocultos.</p>}
          <textarea
            rows={1}
            value={texto}
            maxLength={MENSAGEM_MAXIMO}
            placeholder={escolheu ? 'Seu objetivo ou alguma dor?' : 'Escreva sua mensagem'}
            aria-label="Mensagem"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                mandar()
              }
            }}
          />
          <button className="botao chat-enviar" aria-label="Enviar" disabled={enviando || !texto.trim()} onClick={() => mandar()}>
            <Send size={18} />
          </button>
        </div>
      ) : (
        <p className="dica-sec centro">Você está vendo como administrador. Só os dois participantes escrevem aqui.</p>
      )}
    </div>
  )
}
