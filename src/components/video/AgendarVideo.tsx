import { CalendarCheck, CalendarX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { agendarVideo, alunoPodeDesmarcar, cancelarAgendamento, dataHoraBr, horaBr, horariosLivres, porDia, type Agendamento } from '../../nuvem/video'

type Props = {
  profissionalId: string
  nomePersonal: string
  /** Duração da chamada que vai ser usada (o crédito que vence primeiro). */
  minutos: number
  onFechar: () => void
  onMudou?: () => void
}

/** Aluno escolhe um dia e horário livre do personal para a chamada de vídeo. */
export function AgendarVideo({ profissionalId, nomePersonal, minutos, onFechar, onMudou }: Props) {
  const [livres, setLivres] = useState<Date[] | null>(null)
  const [diaAberto, setDiaAberto] = useState(0)
  const [escolhido, setEscolhido] = useState<Date | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState<Date | null>(null)
  const primeiro = nomePersonal.split(' ')[0]

  const carregar = useCallback(async () => {
    setLivres(await horariosLivres(profissionalId, minutos))
  }, [profissionalId, minutos])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function confirmar() {
    if (!escolhido) return
    setSalvando(true)
    setErro(null)
    const e = await agendarVideo(profissionalId, escolhido)
    setSalvando(false)
    if (e) {
      setErro(e)
      setEscolhido(null)
      return carregar()
    }
    setPronto(escolhido)
    onMudou?.()
  }

  if (pronto)
    return (
      <div className="agenda-video">
        <p className="disponivel-agora">
          <CalendarCheck size={16} /> Agendado: {dataHoraBr(pronto)}
        </p>
        <p className="dica-sec">
          {primeiro} recebeu o aviso no chat. 15 minutos antes, o app lembra vocês dois. Na hora, toque em "Chamar por vídeo".
        </p>
        <button className="botao-sec" onClick={onFechar}>
          Ok
        </button>
      </div>
    )

  const dias = porDia(livres ?? [])
  const dia = dias[Math.min(diaAberto, Math.max(0, dias.length - 1))]

  return (
    <div className="agenda-video">
      <h3>Agendar treino por vídeo ({minutos} min)</h3>
      {livres === null ? (
        <p className="dica-sec">Procurando horários…</p>
      ) : !dias.length ? (
        <p className="dica-sec">{primeiro} ainda não abriu horários na agenda. Combine pelo chat ou espere ficar "Disponível agora".</p>
      ) : (
        <>
          <div className="agenda-dias" role="tablist">
            {dias.map((d, i) => (
              <button
                key={d.dia}
                role="tab"
                aria-selected={d === dia}
                className={d === dia ? 'ativo' : ''}
                onClick={() => {
                  setDiaAberto(i)
                  setEscolhido(null)
                }}
              >
                {d.dia}
              </button>
            ))}
          </div>
          <div className="horas-livres">
            {dia.horas.map((h) => (
              <button key={h.toISOString()} className={escolhido?.getTime() === h.getTime() ? 'ativo' : ''} onClick={() => setEscolhido(h)}>
                {horaBr(h)}
              </button>
            ))}
          </div>
          <button className="botao" disabled={!escolhido || salvando} onClick={confirmar}>
            <CalendarCheck size={18} /> {escolhido ? `Agendar ${dataHoraBr(escolhido)}` : 'Escolha um horário'}
          </button>
          <p className="dica-sec">Você pode desmarcar até 2 horas antes. A chamada só é gasta quando {primeiro} atende.</p>
        </>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="link" onClick={onFechar}>
        Fechar
      </button>
    </div>
  )
}

/** Os treinos agendados (aluno ou personal), com o botão de desmarcar. */
export function ListaAgendamentos({ meuId, lista, onMudou }: { meuId: string; lista: Agendamento[]; onMudou: () => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())
  if (!lista.length) return null

  async function desmarcar(a: Agendamento) {
    if (!window.confirm(`Desmarcar o treino de ${dataHoraBr(a.inicio)}?`)) return
    setErro(null)
    const e = await cancelarAgendamento(a.id)
    if (e) setErro(e)
    onMudou()
  }

  return (
    <ul className="lista-agenda">
      {lista.map((a) => {
        const souAluno = a.aluno_id === meuId
        const outro = (souAluno ? a.profissional_nome : a.aluno_nome).split(' ')[0]
        const pode = !souAluno || alunoPodeDesmarcar(a, agora)
        return (
          <li key={a.id}>
            <span>
              <b>{dataHoraBr(a.inicio)}</b> · {a.minutos} min com {outro}
            </span>
            {pode && (
              <button className="link" onClick={() => desmarcar(a)}>
                <CalendarX size={14} /> Desmarcar
              </button>
            )}
          </li>
        )
      })}
      {erro && <li className="mensagem erro">{erro}</li>}
    </ul>
  )
}

