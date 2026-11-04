import { BellRing, CalendarClock, CheckCheck, MessagesSquare, Pause, Pencil, Play, Plus, Repeat, Send, Trash2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { listarFichas, type Ficha } from '../../nuvem/fichas'
import {
  CATEGORIAS,
  dadosDe,
  dadosVazios,
  dataBr,
  descreverRecorrencia,
  listarNotificacoes,
  mudarNotificacao,
  quandoBr,
  type AcaoNotificacao,
  type DadosNotificacao,
  type Notificacao,
} from '../../nuvem/notificacoes'
import { CriarNotificacao, EscolherTipo } from './CriarNotificacao'

type Aba = 'agendadas' | 'recorrentes' | 'historico'

const SITUACAO: Record<Notificacao['situacao'], string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  enviada: 'Enviada',
  cancelada: 'Cancelada',
  encerrada: 'Encerrada',
}

/** Tela do personal: criar, programar e acompanhar as notificações para os alunos. */
export function Notificacoes({ meuId, meuNome, criar = false, onVoltar }: { meuId: string; meuNome: string; criar?: boolean; onVoltar: () => void }) {
  const [lista, setLista] = useState<Notificacao[] | null>(null)
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('agendadas')
  // null: lista. 'escolher': os 3 botões. Objeto: formulário.
  const [criando, setCriando] = useState<'escolher' | DadosNotificacao | null>(criar ? 'escolher' : null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [n, f] = await Promise.all([listarNotificacoes(), listarFichas()])
    setLista(n.lista)
    setErro(n.erro ?? f.erro)
    setFichas(f.fichas.filter((x) => x.profissional_id === meuId))
  }, [meuId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const topo = () => window.scrollTo(0, 0)
  const nomes = (n: Notificacao) => {
    if (n.todos) return `Todos os alunos ativos (${n.alunos})`
    const nomes = fichas.filter((f) => n.fichas.includes(f.id)).map((f) => f.nome.split(' ')[0])
    if (!nomes.length) return 'Alunos removidos'
    return nomes.length > 3 ? `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}` : nomes.join(', ')
  }

  async function agir(n: Notificacao, acao: AcaoNotificacao) {
    if (acao === 'excluir' && !window.confirm(n.situacao === 'ativa' || n.situacao === 'pausada' ? 'Excluir esta notificação? Ela não será mais enviada.' : 'Tirar do histórico? Os alunos continuam com o aviso que já receberam.')) return
    if (acao === 'cancelar' && !window.confirm(n.tipo === 'recorrente' ? 'Encerrar esta recorrência? Ela não será mais enviada.' : 'Cancelar este agendamento?')) return
    if (acao === 'enviar_agora' && !window.confirm(`Enviar agora para ${n.alunos} ${n.alunos === 1 ? 'aluno' : 'alunos'}?`)) return
    setOcupado(n.id)
    setOk(null)
    const e = await mudarNotificacao(n.id, acao)
    setOcupado(null)
    if (e) return setErro(e)
    setErro(null)
    setOk({ pausar: 'Pausada.', retomar: 'Ativa de novo.', cancelar: n.tipo === 'recorrente' ? 'Recorrência encerrada.' : 'Agendamento cancelado.', excluir: 'Excluída.', enviar_agora: 'Enviada agora.' }[acao])
    await carregar()
  }

  if (criando) {
    const editando = typeof criando === 'object' && !!criando.id
    return (
      <div className="tela tela-notificacoes">
        <header className="topo">
          <button
            className="voltar"
            onClick={() => {
              setCriando(null)
              topo()
            }}
          >
            ← Notificações
          </button>
        </header>
        <h1>{editando ? 'Editar notificação' : 'Criar notificação'}</h1>
        {criando === 'escolher' ? (
          <>
            <p className="dica-sec">Como você quer enviar?</p>
            <EscolherTipo
              onEscolher={(t) => {
                setCriando(dadosVazios(t))
                topo()
              }}
            />
          </>
        ) : (
          <CriarNotificacao
            key={criando.id ?? criando.tipo}
            inicial={criando}
            fichas={fichas}
            meuNome={meuNome}
            onTrocar={() => setCriando('escolher')}
            onCancelar={() => {
              setCriando(null)
              topo()
            }}
            onPronto={async (msg) => {
              const t = criando.tipo
              setCriando(null)
              setOk(msg)
              setErro(null)
              setAba(t === 'recorrente' ? 'recorrentes' : t === 'agendada' ? 'agendadas' : 'historico')
              topo()
              await carregar()
            }}
          />
        )}
      </div>
    )
  }

  const programadas = (lista ?? []).filter((n) => n.tipo === 'agendada' && (n.situacao === 'ativa' || n.situacao === 'pausada'))
  const recorrentes = (lista ?? []).filter((n) => n.tipo === 'recorrente' && (n.situacao === 'ativa' || n.situacao === 'pausada'))
  const historico = (lista ?? []).filter((n) => n.envios > 0 || !(n.situacao === 'ativa' || n.situacao === 'pausada'))
  const mostrar = aba === 'agendadas' ? programadas : aba === 'recorrentes' ? recorrentes : historico
  const pendentes = programadas.length + recorrentes.length

  function cartao(n: Notificacao) {
    const categoria = CATEGORIAS.find((c) => c.id === n.categoria)
    const viva = n.situacao === 'ativa' || n.situacao === 'pausada'
    const Icone = n.tipo === 'agora' ? Zap : n.tipo === 'agendada' ? CalendarClock : Repeat
    return (
      <li key={n.id} className={`cartao notif-item ${n.situacao}`}>
        <div className="notif-item-topo">
          <span className="atalho-icone">
            <Icone size={18} />
          </span>
          <div>
            <strong>{n.titulo}</strong>
            <small>
              {categoria ? `${categoria.emoji} ${categoria.rotulo} · ` : ''}
              {nomes(n)}
            </small>
          </div>
          {n.situacao !== 'ativa' && <span className={`notif-situacao ${n.situacao}`}>{SITUACAO[n.situacao]}</span>}
        </div>
        <p className="notif-texto">{n.texto}</p>
        <p className="notif-quando">
          {n.tipo === 'agendada' && viva && n.enviar_em && <>📅 Sai em {quandoBr(n.enviar_em)}</>}
          {n.tipo === 'recorrente' && (
            <>
              🔁 {descreverRecorrencia(n)}
              {n.inicio && n.fim ? ` · ${dataBr(n.inicio)} a ${dataBr(n.fim)}` : n.fim ? ` · até ${dataBr(n.fim)}` : ''}
              {n.situacao === 'ativa' && n.proximo_envio && (
                <>
                  <br />
                  Próximo envio: {quandoBr(n.proximo_envio)}
                </>
              )}
            </>
          )}
          {!viva && n.ultimo_envio && n.tipo !== 'recorrente' && <>Enviada em {quandoBr(n.ultimo_envio)}</>}
          {!viva && !n.ultimo_envio && n.tipo === 'agendada' && n.enviar_em && <>Era para {quandoBr(n.enviar_em)}</>}
          {n.no_chat && (
            <span className="notif-chat">
              <MessagesSquare size={13} /> também no chat
            </span>
          )}
        </p>
        {n.entregues > 0 && (
          <p className="notif-leitura">
            <CheckCheck size={14} /> {n.lidas} de {n.entregues} {n.entregues === 1 ? 'aviso lido' : 'avisos lidos'}
            {n.tipo === 'recorrente' && n.envios > 0 ? ` · enviada ${n.envios} ${n.envios === 1 ? 'vez' : 'vezes'}` : ''}
          </p>
        )}
        <div className="notif-botoes">
          {viva && (
            <button
              className="botao-sec"
              disabled={ocupado === n.id}
              onClick={() => {
                setCriando(dadosDe(n))
                topo()
              }}
            >
              <Pencil size={15} /> Editar
            </button>
          )}
          {n.situacao === 'ativa' && n.tipo !== 'agora' && (
            <button className="botao-sec" disabled={ocupado === n.id} onClick={() => agir(n, 'pausar')}>
              <Pause size={15} /> Pausar
            </button>
          )}
          {n.situacao === 'pausada' && (
            <button className="botao-sec" disabled={ocupado === n.id} onClick={() => agir(n, 'retomar')}>
              <Play size={15} /> Retomar
            </button>
          )}
          {viva && n.tipo === 'agendada' && (
            <button className="botao-sec" disabled={ocupado === n.id} onClick={() => agir(n, 'enviar_agora')}>
              <Send size={15} /> Enviar agora
            </button>
          )}
          {viva && n.tipo === 'agendada' && (
            <button className="botao-sec perigo" disabled={ocupado === n.id} onClick={() => agir(n, 'cancelar')}>
              <X size={15} /> Cancelar
            </button>
          )}
          {(n.tipo === 'recorrente' || !viva) && (
            <button className="botao-sec perigo" disabled={ocupado === n.id} onClick={() => agir(n, 'excluir')}>
              <Trash2 size={15} /> Excluir
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="tela tela-notificacoes">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <div className="notif-cabeca">
        <div>
          <h1>
            <BellRing size={24} className="verde" /> Notificações
          </h1>
          <p className="dica-sec">Mande avisos para o celular dos seus alunos: na hora, agendados ou repetindo sozinhos.</p>
        </div>
        <button
          className="botao"
          onClick={() => {
            setCriando('escolher')
            setOk(null)
            topo()
          }}
        >
          <Plus size={18} /> Criar notificação
        </button>
      </div>

      <div className="placar notif-placar">
        <div>
          <b>{programadas.length}</b>
          <span>agendadas</span>
        </div>
        <div>
          <b>{recorrentes.length}</b>
          <span>recorrentes</span>
        </div>
        <div>
          <b>{(lista ?? []).reduce((s, n) => s + n.entregues, 0)}</b>
          <span>avisos entregues</span>
        </div>
      </div>

      {ok && <p className="mensagem ok">{ok}</p>}
      {erro && <p className="mensagem erro">{erro}</p>}

      <div className="seletor-comparar notif-abas" role="tablist">
        <button role="tab" aria-selected={aba === 'agendadas'} className={aba === 'agendadas' ? 'ativo' : ''} onClick={() => setAba('agendadas')}>
          Agendadas
        </button>
        <button role="tab" aria-selected={aba === 'recorrentes'} className={aba === 'recorrentes' ? 'ativo' : ''} onClick={() => setAba('recorrentes')}>
          Recorrentes
        </button>
        <button role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'ativo' : ''} onClick={() => setAba('historico')}>
          Histórico
        </button>
      </div>

      {lista === null && !erro && <p className="carregando">Carregando…</p>}
      {lista && !mostrar.length && (
        <div className="cartao notif-vazio">
          <p>
            {aba === 'agendadas'
              ? 'Nenhuma mensagem agendada. Agende um lembrete para um dia e horário.'
              : aba === 'recorrentes'
                ? 'Nenhuma recorrência. Exemplo: lembrete de treino toda segunda, quarta e sexta às 7h.'
                : 'Nada enviado ainda.'}
          </p>
          <button className="botao-sec" onClick={() => setCriando(dadosVazios(aba === 'recorrentes' ? 'recorrente' : aba === 'agendadas' ? 'agendada' : 'agora'))}>
            <Plus size={16} /> {aba === 'recorrentes' ? 'Criar recorrência' : aba === 'agendadas' ? 'Agendar mensagem' : 'Enviar na hora'}
          </button>
        </div>
      )}
      <ul className="notif-lista">{mostrar.map(cartao)}</ul>
      {pendentes > 0 && aba === 'historico' && <p className="dica-sec">As agendadas e recorrentes que ainda vão sair ficam nas outras abas.</p>}
    </div>
  )
}
