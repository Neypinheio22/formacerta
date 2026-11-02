import { Users, Video, VideoOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { emReais, listarCatalogo, listarServicos } from '../../nuvem/planos'
import { aceitouTermoVideo, disponibilidade, ficarDisponivel, VAGAS_MAXIMO, lerRegrasVideo, minhasChamadas, resumoGanhos, REGRAS_PADRAO, type Chamada, type RegrasVideo } from '../../nuvem/video'
import { TermoVideo } from './TermoVideo'

const TEMPOS = [
  { min: 60, rotulo: '1 hora' },
  { min: 120, rotulo: '2 horas' },
  { min: 240, rotulo: '4 horas' },
]

const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

type Props = {
  meuId: string
  /** Versão curta (aba Chat): só o liga/desliga. */
  curto?: boolean
  /** Avisa quando o termo é aceito (a lista de serviços libera o vídeo). */
  onMudou?: () => void
}

/** Personal: termo, "Disponível para vídeo agora" e o resumo do que ele recebe. */
export function PainelVideo({ meuId, curto = false, onMudou }: Props) {
  const [regras, setRegras] = useState<RegrasVideo>(REGRAS_PADRAO)
  const [aceito, setAceito] = useState<boolean | null>(null)
  const [temServico, setTemServico] = useState(false)
  const [ate, setAte] = useState<Date | null>(null)
  const [vagas, setVagas] = useState(1)
  const [chamadas, setChamadas] = useState<Chamada[]>([])
  const [termo, setTermo] = useState(false)
  const [mudando, setMudando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const [r, a, d, c, s, cat] = await Promise.all([lerRegrasVideo(), aceitouTermoVideo(meuId), disponibilidade(meuId), minhasChamadas(), listarServicos(), listarCatalogo()])
    const deVideo = new Set(cat.filter((i) => i.grupo === 'video').map((i) => i.id))
    setRegras(r)
    setAceito(a)
    setAte(d?.ate ?? null)
    if (d) setVagas(d.vagas)
    setChamadas(c.filter((x) => x.profissional_id === meuId))
    setTemServico(s.some((x) => x.profissional_id === meuId && x.ativo && !!x.catalogo_id && deVideo.has(x.catalogo_id)))
  }, [meuId])

  useEffect(() => {
    carregar()
    const vez = setInterval(carregar, 60000)
    return () => clearInterval(vez)
  }, [carregar])

  // Sem o SQL novo, nada aparece.
  if (aceito === null) return null

  async function mudar(minutos: number, nVagas = vagas) {
    setMudando(true)
    setErro(null)
    const r = await ficarDisponivel(minutos, nVagas)
    setMudando(false)
    if (r.erro) return setErro(r.erro)
    setAte(r.ate)
  }

  /** Muda quantos alunos ao mesmo tempo. Já disponível: grava na hora, mantendo o horário. */
  function escolherVagas(n: number) {
    setVagas(n)
    if (ate) mudar(Math.max(1, Math.round((ate.getTime() - Date.now()) / 60000)), n)
  }

  const seletorVagas = (
    <div className="vagas-video">
      <span className="dica-sec">
        <Users size={14} /> Alunos ao mesmo tempo na sua sala
      </span>
      <div className="escolha">
        {Array.from({ length: VAGAS_MAXIMO }, (_, i) => i + 1).map((n) => (
          <button key={n} className={vagas === n ? 'ativo' : ''} disabled={mudando} onClick={() => escolherVagas(n)}>
            {n}
          </button>
        ))}
      </div>
      <span className="dica-sec">{vagas === 1 ? 'Um aluno por vez.' : `Até ${vagas} alunos juntos, cada um no seu quadro. Cada aluno paga a chamada dele e cada chamada tem a taxa de ${emReais(regras.taxa_video)}.`}</span>
    </div>
  )

  const ganhos = resumoGanhos(chamadas)
  const creditos = chamadas.filter((c) => c.situacao === 'credito').length

  if (termo)
    return (
      <TermoVideo
        regras={regras}
        aceito={!!aceito}
        onAceito={() => {
          setTermo(false)
          carregar()
          onMudou?.()
        }}
        onFechar={() => setTermo(false)}
      />
    )

  return (
    <section className={`cartao painel-video ${ate ? 'ligado' : ''}`}>
      <span className="etiqueta">
        <Video size={14} /> Atendimento por vídeo
      </span>
      {!aceito ? (
        <>
          <p className="dica-sec">
            Acompanhe o treino do aluno por chamada de vídeo e receba por chamada. Antes, leia e aceite o termo: {regras.comissao_pct.toLocaleString('pt-BR')}% de comissão do FormaCerta e {emReais(regras.taxa_video)} por chamada realizada.
          </p>
          <button className="botao" onClick={() => setTermo(true)}>
            Ler e aceitar o termo
          </button>
        </>
      ) : !temServico ? (
        <p className="dica-sec">Termo aceito. Agora ligue as chamadas de vídeo que você quer vender em {curto ? 'Conta → ' : ''}Meus serviços.</p>
      ) : ate ? (
        <>
          <p className="disponivel-agora">
            <span className="ponto-vivo" /> Disponível para vídeo até {hora(ate)}
          </p>
          <p className="dica-sec">Deixe o app aberto. Quando um aluno chamar, o celular toca e você tem 2 minutos para atender.</p>
          {seletorVagas}
          <button className="botao-sec" disabled={mudando} onClick={() => mudar(0)}>
            <VideoOff size={16} /> Ficar indisponível
          </button>
        </>
      ) : (
        <>
          <p className="dica-sec">Fique disponível e os alunos que compraram chamada podem ligar para você agora.</p>
          {seletorVagas}
          <div className="acoes-linha">
            {TEMPOS.map((t) => (
              <button key={t.min} className="botao-sec" disabled={mudando} onClick={() => mudar(t.min)}>
                <Video size={16} /> {t.rotulo}
              </button>
            ))}
          </div>
        </>
      )}

      {aceito && !curto && (
        <div className="ganhos-video">
          <h3>Suas chamadas</h3>
          <dl>
            <dt>Chamadas feitas</dt>
            <dd>{ganhos.feitas}</dd>
            <dt>Vendido</dt>
            <dd>{emReais(ganhos.bruto)}</dd>
            <dt>Comissão FormaCerta ({regras.comissao_pct.toLocaleString('pt-BR')}%)</dt>
            <dd>− {emReais(ganhos.comissao)}</dd>
            <dt>Taxas das chamadas ({emReais(regras.taxa_video)} cada)</dt>
            <dd>− {emReais(ganhos.taxas)}</dd>
            <dt>
              <b>Você recebe</b>
            </dt>
            <dd>
              <b className="verde">{emReais(ganhos.liquido)}</b>
            </dd>
            <dt>Ainda a repassar</dt>
            <dd>{emReais(ganhos.aReceber)}</dd>
          </dl>
          {creditos > 0 && <p className="dica-sec">Seus alunos ainda têm {creditos} chamada{creditos > 1 ? 's' : ''} para usar com você.</p>}
          <button className="link" onClick={() => setTermo(true)}>
            Ver o termo que você aceitou
          </button>
        </div>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}
