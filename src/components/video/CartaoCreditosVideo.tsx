import { CalendarCheck, MessageCircle, Video } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  avisarChamada,
  chamarVideo,
  creditosPorPersonal,
  dataHoraBr,
  diasParaVencer,
  horaDeChamar,
  meusAgendamentos,
  minhasChamadas,
  type Agendamento,
  type CreditosDoPersonal,
} from '../../nuvem/video'
import { AgendarVideo, ListaAgendamentos } from './AgendarVideo'

/** Aluno, na tela inicial: as chamadas de vídeo que ainda tem para usar, a validade e os treinos agendados. */
export function CartaoCreditosVideo({ meuId, onChat }: { meuId: string; onChat: () => void }) {
  const [grupos, setGrupos] = useState<CreditosDoPersonal[]>([])
  const [agenda, setAgenda] = useState<Agendamento[]>([])
  const [agora, setAgora] = useState(0)
  const [agendar, setAgendar] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const ler = useCallback(async () => {
    const [c, a] = await Promise.all([minhasChamadas(), meusAgendamentos()])
    setAgora(Date.now())
    setGrupos(creditosPorPersonal(c, meuId))
    setAgenda(a.filter((x) => x.aluno_id === meuId))
  }, [meuId])

  useEffect(() => {
    ler()
    const vez = setInterval(ler, 60000)
    return () => clearInterval(vez)
  }, [ler])

  if (!grupos.length) return null

  async function chamar(profissional: string) {
    setErro(null)
    const r = await chamarVideo(profissional)
    if (r.erro) return setErro(r.erro)
    avisarChamada()
  }

  return (
    <>
      {grupos.map((g) => {
        const primeiro = g.profissional_nome.split(' ')[0]
        const dias = diasParaVencer(g, agora)
        const agendados = agenda.filter((a) => a.profissional_id === g.profissional_id)
        const naHora = agendados.find((a) => horaDeChamar(a, agora))
        const livres = g.quantidade - agendados.length
        return (
          <section className={`cartao cartao-creditos-video ${dias !== null && dias <= 7 ? 'vence' : ''}`} key={g.profissional_id}>
            <span className="etiqueta">
              <Video size={14} /> Treino por vídeo
            </span>
            <h2>
              Você tem {g.quantidade} chamada{g.quantidade > 1 ? 's' : ''} com {primeiro}
            </h2>
            {dias !== null && g.vence_em && (
              <p className={`dica-sec ${dias <= 7 ? 'alerta-texto' : ''}`}>
                {dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia${dias > 1 ? 's' : ''}`} ({new Date(g.vence_em).toLocaleDateString('pt-BR')}). Agende para não perder.
              </p>
            )}
            {agendados.length > 0 && <ListaAgendamentos meuId={meuId} lista={agendados} onMudou={ler} />}
            {naHora && (
              <button className="botao" onClick={() => chamar(g.profissional_id)}>
                <Video size={18} /> Chamar {primeiro} agora ({dataHoraBr(naHora.inicio).split(' ').pop()})
              </button>
            )}
            {agendar === g.profissional_id ? (
              <AgendarVideo
                profissionalId={g.profissional_id}
                nomePersonal={g.profissional_nome}
                minutos={Math.min(...g.minutos)}
                onFechar={() => setAgendar(null)}
                onMudou={ler}
              />
            ) : (
              <div className="acoes-linha">
                {livres > 0 && (
                  <button className={naHora ? 'botao-sec' : 'botao'} onClick={() => setAgendar(g.profissional_id)}>
                    <CalendarCheck size={18} /> Agendar horário
                  </button>
                )}
                <button className="botao-sec" onClick={onChat}>
                  <MessageCircle size={18} /> Abrir o chat
                </button>
              </div>
            )}
            {erro && <p className="mensagem erro">{erro}</p>}
          </section>
        )
      })}
    </>
  )
}
