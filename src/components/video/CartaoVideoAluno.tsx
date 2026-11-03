import { CalendarCheck, Video } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { precoServico, type Servico } from '../../nuvem/planos'
import { avisarChamada, chamarVideo, diasParaVencer, disponibilidade, horaDeChamar, meusAgendamentos, minhasChamadas, type Agendamento } from '../../nuvem/video'
import { AgendarVideo, ListaAgendamentos } from './AgendarVideo'

type Props = {
  meuId: string
  profissionalId: string
  nomePersonal: string
  /** Chamadas de vídeo que este personal vende. */
  servicos: Servico[]
  contratacaoLiberada: boolean
  onPagar: (s: Servico) => void
}

/** No chat do aluno: comprar chamada de vídeo e chamar o personal quando ele está disponível. */
export function CartaoVideoAluno({ meuId, profissionalId, nomePersonal, servicos, contratacaoLiberada, onPagar }: Props) {
  const [online, setOnline] = useState(false)
  const [vagas, setVagas] = useState(1)
  const [creditos, setCreditos] = useState<number | null>(null)
  const [minutos, setMinutos] = useState<number[]>([])
  const [chamando, setChamando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [comprar, setComprar] = useState(false)
  const [agenda, setAgenda] = useState<Agendamento[]>([])
  const [vence, setVence] = useState<number | null>(null)
  const [agora, setAgora] = useState(0)
  const [agendar, setAgendar] = useState(false)
  const primeiro = nomePersonal.split(' ')[0]

  const ler = useCallback(async () => {
    const [disp, lista, ag] = await Promise.all([disponibilidade(profissionalId), minhasChamadas(), meusAgendamentos()])
    const meus = lista.filter((c) => c.aluno_id === meuId && c.profissional_id === profissionalId && c.situacao === 'credito')
    const agoraMs = Date.now()
    setAgora(agoraMs)
    setAgenda(ag.filter((a) => a.aluno_id === meuId && a.profissional_id === profissionalId))
    const dias = meus.map((c) => diasParaVencer(c, agoraMs)).filter((d): d is number => d !== null)
    setVence(dias.length ? Math.min(...dias) : null)
    setOnline(!!disp)
    setVagas(disp?.vagas ?? 1)
    setCreditos(meus.length)
    setMinutos(meus.map((c) => c.minutos))
  }, [meuId, profissionalId])

  useEffect(() => {
    ler()
    const vez = setInterval(ler, 15000)
    window.addEventListener('formacerta:chamada', ler)
    return () => {
      clearInterval(vez)
      window.removeEventListener('formacerta:chamada', ler)
    }
  }, [ler])

  if (!servicos.length && !creditos) return null

  async function chamar() {
    setChamando(true)
    setErro(null)
    const r = await chamarVideo(profissionalId)
    setChamando(false)
    if (r.erro) return setErro(r.erro)
    avisarChamada()
  }

  const temCredito = (creditos ?? 0) > 0
  const naHora = agenda.some((a) => horaDeChamar(a, agora))
  const podeChamar = online || naHora
  const livres = (creditos ?? 0) - agenda.length
  const proxima = minutos.length ? Math.min(...minutos) : 0

  return (
    <section className={`cartao cartao-video-aluno ${online ? 'online' : ''}`}>
      <div className="video-linha">
        <span className="etiqueta">
          <Video size={14} /> Treino por vídeo
        </span>
        <span className={`status-video ${online ? 'on' : ''}`}>
          <span className="ponto-vivo" /> {online ? 'Disponível agora' : 'Indisponível agora'}
        </span>
      </div>
      {online && vagas > 1 && <p className="dica-sec">Sala de treino com até {vagas} alunos ao mesmo tempo. {primeiro} acompanha cada um no seu quadro.</p>}

      {temCredito ? (
        <>
          <p className="dica-sec">
            Você tem <b>{creditos}</b> chamada{creditos! > 1 ? 's' : ''} com {primeiro}
            {proxima ? ` (${proxima} min)` : ''}.{vence !== null && vence <= 7 ? ` Vence em ${vence} dia${vence === 1 ? '' : 's'}.` : ''}
          </p>
          <ListaAgendamentos meuId={meuId} lista={agenda} onMudou={ler} />
          {podeChamar ? (
            <button className="botao" disabled={chamando} onClick={chamar}>
              <Video size={18} /> {chamando ? 'Chamando…' : naHora ? 'Chamar para o treino agendado' : 'Chamar por vídeo agora'}
            </button>
          ) : (
            !agendar && <p className="dica-sec">Agende um horário ou espere {primeiro} ficar disponível. Na hora, o botão de chamar acende.</p>
          )}
          {agendar ? (
            <AgendarVideo profissionalId={profissionalId} nomePersonal={nomePersonal} minutos={proxima || 30} onFechar={() => setAgendar(false)} onMudou={ler} />
          ) : (
            livres > 0 && (
              <button className="botao-sec" onClick={() => setAgendar(true)}>
                <CalendarCheck size={16} /> Agendar horário
              </button>
            )
          )}
        </>
      ) : (
        <>
          <p className="dica-sec">
            {primeiro} acompanha seu treino ao vivo pela câmera e corrige na hora. Você paga por chamada e agenda o horário ou chama quando {primeiro} estiver disponível.
          </p>
          {!comprar ? (
            <button className="botao-sec" onClick={() => setComprar(true)}>
              <Video size={16} /> Ver chamadas e preços
            </button>
          ) : (
            <div className="menu-servicos">
              {servicos.map((s) => (
                <button key={s.id} className="opcao" disabled={!contratacaoLiberada} onClick={() => onPagar(s)}>
                  <strong>{s.nome}</strong>
                  <span>{precoServico(s)}</span>
                </button>
              ))}
              {!contratacaoLiberada && <span className="dica-sec">O pagamento pelo app abre em breve.</span>}
              <span className="dica-sec">Se {primeiro} não atender em 2 minutos, a chamada continua guardada para você.</span>
            </div>
          )}
        </>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}
