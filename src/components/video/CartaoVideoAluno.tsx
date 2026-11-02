import { Video } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { precoServico, type Servico } from '../../nuvem/planos'
import { avisarChamada, chamarVideo, disponivelAte, minhasChamadas } from '../../nuvem/video'

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
  const [creditos, setCreditos] = useState<number | null>(null)
  const [minutos, setMinutos] = useState<number[]>([])
  const [chamando, setChamando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [comprar, setComprar] = useState(false)
  const primeiro = nomePersonal.split(' ')[0]

  const ler = useCallback(async () => {
    const [ate, lista] = await Promise.all([disponivelAte(profissionalId), minhasChamadas()])
    const meus = lista.filter((c) => c.aluno_id === meuId && c.profissional_id === profissionalId && c.situacao === 'credito')
    setOnline(!!ate)
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

      {temCredito ? (
        <>
          <p className="dica-sec">
            Você tem <b>{creditos}</b> chamada{creditos! > 1 ? 's' : ''} com {primeiro}
            {proxima ? ` (${proxima} min)` : ''}.
          </p>
          {online ? (
            <button className="botao" disabled={chamando} onClick={chamar}>
              <Video size={18} /> {chamando ? 'Chamando…' : 'Chamar por vídeo agora'}
            </button>
          ) : (
            <p className="dica-sec">Combine um horário aqui no chat. Quando {primeiro} ficar disponível, o botão de chamar acende.</p>
          )}
        </>
      ) : (
        <>
          <p className="dica-sec">
            {primeiro} acompanha seu treino ao vivo pela câmera e corrige na hora. Você paga por chamada e só usa quando {primeiro} estiver disponível.
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
