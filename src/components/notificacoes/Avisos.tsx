import { Bell, BellRing, CalendarClock, ChevronRight, Plus, Repeat } from 'lucide-react'
import { useEffect, useState } from 'react'
import { quando } from '../../nuvem/chat'
import type { Perfil } from '../../nuvem/conta'
import { CATEGORIAS, contarAvisosNovos, contarProgramadas, listarAvisos, listarNotificacoes, marcarAvisosLidos, quandoBr, type Aviso, type Notificacao } from '../../nuvem/notificacoes'
import { CartaoNotificacoes } from '../CartaoAvisos'

/** Número do sino: avisos novos (aluno) ou notificações programadas (personal). Atualiza a cada minuto. */
export function useContadorSino(perfil: Perfil | null) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!perfil) return
    let vivo = true
    const ler = () => (perfil.papel === 'aluno' ? contarAvisosNovos(perfil.id) : contarProgramadas(perfil.id)).then((x) => vivo && setN(x))
    ler()
    const vez = setInterval(ler, 60000)
    window.addEventListener('formacerta:avisos-lidos', ler)
    return () => {
      vivo = false
      clearInterval(vez)
      window.removeEventListener('formacerta:avisos-lidos', ler)
    }
  }, [perfil])
  return n
}

/** Sino no topo da tela inicial, com o número. */
export function SinoNotificacoes({ perfil, onAbrir }: { perfil: Perfil; onAbrir: () => void }) {
  const n = useContadorSino(perfil)
  const aluno = perfil.papel === 'aluno'
  const rotulo = aluno ? (n ? `${n} avisos novos do personal` : 'Avisos do personal') : n ? `Notificações: ${n} programadas` : 'Notificações'
  return (
    <button className="sino" aria-label={rotulo} title={rotulo} onClick={onAbrir}>
      <Bell size={20} />
      {n > 0 && <b className="selo-novas">{n > 9 ? '9+' : n}</b>}
    </button>
  )
}

/** Cartão "Notificações" da tela inicial do personal: o que está programado e o atalho para criar. */
export function CartaoNotificacoesPersonal({ onAbrir, onCriar }: { onAbrir: () => void; onCriar: () => void }) {
  const [lista, setLista] = useState<Notificacao[] | null>(null)
  useEffect(() => {
    listarNotificacoes().then((r) => setLista(r.erro ? [] : r.lista))
  }, [])
  const vivas = (lista ?? []).filter((n) => n.situacao === 'ativa' || n.situacao === 'pausada')
  const agendadas = vivas.filter((n) => n.tipo === 'agendada').length
  const recorrentes = vivas.filter((n) => n.tipo === 'recorrente').length
  const proxima = vivas
    .filter((n) => n.situacao === 'ativa' && n.proximo_envio)
    .sort((a, b) => a.proximo_envio!.localeCompare(b.proximo_envio!))[0]
  return (
    <section className="cartao cartao-notif-personal">
      <div className="notif-cartao-topo">
        <span className="etiqueta">
          <BellRing size={14} /> Notificações
        </span>
        {vivas.length > 0 && <b className="selo-novas">{vivas.length}</b>}
      </div>
      <h2>Fale com seus alunos</h2>
      <p className="dica-sec">
        {lista === null
          ? 'Carregando…'
          : vivas.length
            ? `${agendadas} ${agendadas === 1 ? 'agendada' : 'agendadas'} e ${recorrentes} ${recorrentes === 1 ? 'recorrente' : 'recorrentes'}.`
            : 'Lembrete de treino, mensalidade e avaliação direto no celular do aluno, na hora, agendado ou repetindo sozinho.'}
      </p>
      {proxima && (
        <p className="notif-proxima">
          {proxima.tipo === 'recorrente' ? <Repeat size={14} /> : <CalendarClock size={14} />} Próxima: <b>{proxima.titulo}</b> · {quandoBr(proxima.proximo_envio!)}
        </p>
      )}
      <div className="acoes-linha">
        <button className="botao" onClick={onCriar}>
          <Plus size={18} /> Criar notificação
        </button>
        <button className="botao-sec" onClick={onAbrir}>
          Ver todas <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}

/** Cartão na tela inicial do aluno com o aviso mais novo que ele ainda não leu. */
export function CartaoAvisoNovo({ meuId, onAbrir }: { meuId: string; onAbrir: () => void }) {
  const [novo, setNovo] = useState<Aviso | null>(null)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    let vivo = true
    const ler = () =>
      Promise.all([listarAvisos(), contarAvisosNovos(meuId)]).then(([r, n]) => {
        if (!vivo) return
        setNovo(r.lista.find((a) => !a.lida_em) ?? null)
        setTotal(n)
      })
    ler()
    window.addEventListener('formacerta:avisos-lidos', ler)
    return () => {
      vivo = false
      window.removeEventListener('formacerta:avisos-lidos', ler)
    }
  }, [meuId])
  if (!novo) return null
  return (
    <button className="cartao cartao-aviso-novo" onClick={onAbrir}>
      <span className="etiqueta">
        <BellRing size={14} /> {total > 1 ? `${total} avisos novos` : 'Aviso novo'} do personal
      </span>
      <strong>{novo.titulo}</strong>
      <p>{novo.texto}</p>
      <span className="link">
        Ver avisos <ChevronRight size={14} />
      </span>
    </button>
  )
}

/** Tela do aluno: os avisos que o personal mandou. Abrir marca todos como lidos. */
export function Avisos({ onVoltar }: { onVoltar: () => void }) {
  const [lista, setLista] = useState<Aviso[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    listarAvisos().then((r) => {
      setLista(r.lista)
      setErro(r.erro)
      if (r.lista.some((a) => !a.lida_em)) marcarAvisosLidos()
    })
  }, [])
  return (
    <div className="tela tela-notificacoes">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <h1>
        <BellRing size={24} className="verde" /> Avisos do personal
      </h1>
      <CartaoNotificacoes personal={false} />
      {erro && <p className="mensagem erro">{erro}</p>}
      {lista === null && !erro && <p className="carregando">Carregando…</p>}
      {lista && !lista.length && (
        <div className="cartao notif-vazio">
          <p>Nenhum aviso ainda. Quando o seu personal mandar um lembrete de treino, de avaliação ou de mensalidade, ele aparece aqui e no seu celular.</p>
        </div>
      )}
      <ul className="notif-lista">
        {(lista ?? []).map((a) => {
          const categoria = CATEGORIAS.find((c) => c.id === a.categoria)
          return (
            <li key={a.id} className={`cartao aviso-item ${a.lida_em ? '' : 'novo'}`}>
              <div className="notif-item-topo">
                {a.profissional_foto ? (
                  <img className="aviso-foto" src={a.profissional_foto} alt="" width={36} height={36} />
                ) : (
                  <span className="atalho-icone">
                    <BellRing size={18} />
                  </span>
                )}
                <div>
                  <strong>{a.titulo}</strong>
                  <small>
                    {a.profissional_nome ?? 'Seu personal'} · {quando(a.criado_em)}
                    {categoria ? ` · ${categoria.emoji} ${categoria.rotulo}` : ''}
                  </small>
                </div>
                {!a.lida_em && <span className="notif-situacao novo">Novo</span>}
              </div>
              <p className="notif-texto">{a.texto}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
