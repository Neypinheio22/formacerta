import { Check, Circle, MessageCircle, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { linkWhatsApp } from '../../compartilhar/whatsapp'
import {
  diasDesde,
  etapasDoAluno,
  listarAlunosNovos,
  mensagemParaAluno,
  reenviarConfirmacao,
  situacaoDoAluno,
  ultimaAtividade,
  type AlunoNovo,
} from '../../nuvem/alunosNovos'

const PERIODOS = [
  { dias: 30, rotulo: '30 dias' },
  { dias: 60, rotulo: '60 dias' },
  { dias: 180, rotulo: '6 meses' },
]

const data = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

function quando(d: string | null) {
  if (!d) return 'nunca'
  const n = diasDesde(d)
  return n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias (${data(d)})`
}

/** Administrador: o que cada aluno novo já fez no app e quem precisa de um empurrão. */
export function AdminAlunosNovos() {
  const [dias, setDias] = useState(60)
  const [lista, setLista] = useState<AlunoNovo[] | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    listarAlunosNovos(dias).then((l) => vivo && setLista(l))
    return () => {
      vivo = false
    }
  }, [dias])

  if (lista === null) return <p className="dica-sec">Esta aba aparece depois de rodar o SQL dos alunos novos.</p>

  const semConfirmar = lista?.filter((a) => !a.email_confirmado).length ?? 0
  const semAvaliacao = lista?.filter((a) => a.email_confirmado && a.avaliacoes === 0).length ?? 0
  const ativos = lista?.filter((a) => situacaoDoAluno(a).tom === 'ok').length ?? 0

  return (
    <div className="alunos-novos">
      <div className="escolha">
        {PERIODOS.map((p) => (
          <button key={p.dias} className={dias === p.dias ? 'ativo' : ''} onClick={() => {
              if (p.dias === dias) return
              setLista(undefined)
              setDias(p.dias)
            }}>
            {p.rotulo}
          </button>
        ))}
      </div>

      {!lista ? (
        <p className="carregando">Carregando…</p>
      ) : (
        <>
          <div className="numeros">
            <div>
              <strong>{lista.length}</strong> cadastros
            </div>
            <div className={semConfirmar > 0 ? 'destaque-laranja' : ''}>
              <strong>{semConfirmar}</strong> sem confirmar e-mail
            </div>
            <div className={semAvaliacao > 0 ? 'destaque-laranja' : ''}>
              <strong>{semAvaliacao}</strong> sem 1ª avaliação
            </div>
            <div className="destaque-verde">
              <strong>{ativos}</strong> ativos
            </div>
          </div>

          {lista.length === 0 && <p className="dica-sec">Nenhum aluno se cadastrou neste período.</p>}
          {lista.map((a) => (
            <CartaoAluno key={a.id} a={a} />
          ))}
        </>
      )}
    </div>
  )
}

function CartaoAluno({ a }: { a: AlunoNovo }) {
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const sit = situacaoDoAluno(a)
  const etapas = etapasDoAluno(a)
  const feitas = etapas.filter((e) => e.feita).length

  async function reenviar() {
    setEnviando(true)
    const erro = await reenviarConfirmacao(a.email)
    setEnviando(false)
    setAviso(erro ? { texto: erro, erro: true } : { texto: `Link de confirmação reenviado para ${a.email}.`, erro: false })
  }

  const extras = [
    a.mensagens > 0 && `${a.mensagens} mensagem${a.mensagens === 1 ? '' : 's'} no chat`,
    a.comprou && 'comprou no app',
    a.notificacoes && 'notificações ligadas',
  ].filter(Boolean)

  return (
    <section className="cartao pessoa aluno-novo">
      <div className="pessoa-topo">
        <div>
          <h3>{a.nome || 'Sem nome'}</h3>
          <p className="dica-sec">{a.email}</p>
          <p className="dica-sec">
            Cadastro {data(a.criado_em)} · {a.personal ? `aluno de ${a.personal}` : 'sem personal'}
          </p>
        </div>
        <span className={`chip chip-${sit.tom}`}>{sit.rotulo}</span>
      </div>

      <p className="dica-sec">
        Último acesso: <strong>{quando(a.ultimo_acesso)}</strong>
        {ultimaAtividade(a) !== a.ultimo_acesso && ultimaAtividade(a) && <> · última atividade {quando(ultimaAtividade(a))}</>}
      </p>

      <ul className="etapas-aluno" aria-label={`${feitas} de ${etapas.length} etapas`}>
        {etapas.map((e) => (
          <li key={e.nome} className={e.feita ? 'feita' : ''}>
            {e.feita ? <Check size={14} /> : <Circle size={14} />}
            {e.nome}
            {e.nome === '1ª avaliação' && a.avaliacoes > 1 && ` (${a.avaliacoes})`}
            {e.nome === 'Fez treino' && a.treinos_feitos > 0 && ` (${a.treinos_feitos})`}
          </li>
        ))}
      </ul>
      {extras.length > 0 && <p className="dica-sec">{extras.join(' · ')}</p>}

      <div className="acoes-linha">
        {!a.email_confirmado && (
          <button className="botao" disabled={enviando} onClick={reenviar}>
            <Send size={16} /> {enviando ? 'Enviando…' : 'Reenviar confirmação'}
          </button>
        )}
        <a className="botao botao-whatsapp" href={linkWhatsApp(mensagemParaAluno(a), a.whatsapp)} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> WhatsApp
        </a>
      </div>
      {!a.whatsapp && <p className="dica-sec">Sem telefone na ficha: o WhatsApp pede para escolher o contato.</p>}
      {aviso && <p className={`mensagem ${aviso.erro ? 'erro' : 'ok'}`}>{aviso.texto}</p>}
    </section>
  )
}
