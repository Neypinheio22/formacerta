import { FileSignature } from 'lucide-react'
import { useState } from 'react'
import { emReais } from '../../nuvem/planos'
import { aceitarTermoVideo, dividirChamada, type RegrasVideo } from '../../nuvem/video'

type Props = {
  regras: RegrasVideo
  /** Já aceitou: mostra só o texto, sem o botão. */
  aceito?: boolean
  onAceito?: () => void
  onFechar?: () => void
}

/** Termo que o personal aceita antes de oferecer chamada de vídeo: comissão e taxa por chamada. */
export function TermoVideo({ regras, aceito = false, onAceito, onFechar }: Props) {
  const [marcado, setMarcado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const pct = regras.comissao_pct.toLocaleString('pt-BR')
  const taxa = emReais(regras.taxa_video)
  const ex = dividirChamada(60, regras.comissao_pct, regras.taxa_video)

  async function aceitar() {
    setSalvando(true)
    const e = await aceitarTermoVideo()
    setSalvando(false)
    if (e) return setErro(e)
    onAceito?.()
  }

  return (
    <section className="cartao termo-video">
      <span className="etiqueta">
        <FileSignature size={14} /> Termo do atendimento por vídeo
      </span>
      <h2>Antes de atender por chamada de vídeo</h2>
      <ol className="termo-lista">
        <li>
          <b>Preço do FormaCerta.</b> O aluno paga a chamada pelo app, no preço da lista do FormaCerta (ou no valor que o administrador aprovar para você).
        </li>
        <li>
          <b>Comissão de {pct}%.</b> De cada chamada vendida, {pct}% ficam com o FormaCerta.
        </li>
        <li>
          <b>Taxa de {taxa} por chamada realizada.</b> Cada chamada de vídeo que você atende tem a taxa de {taxa}, paga por você e descontada do seu repasse. No pacote, a taxa vale para cada uma das chamadas.
        </li>
        <li>
          <b>Exemplo.</b> Treino acompanhado de 30 min por {emReais(60)}: comissão de {emReais(ex.comissao)} e taxa de {emReais(ex.taxa)}. <b className="verde">Você recebe {emReais(ex.liquido)}.</b>
        </li>
        <li>
          <b>Disponível de verdade.</b> Só ligue "Disponível para vídeo" quando puder atender. Você tem 2 minutos para atender. Se não atender ou recusar, o aluno não perde nada: a chamada volta como crédito para ele e nenhuma taxa é cobrada.
        </li>
        <li>
          <b>Tempo da chamada.</b> A chamada termina sozinha quando acaba o tempo pago (15, 30 ou 60 minutos).
        </li>
        <li>
          <b>Conduta profissional.</b> Atenda com seu registro (CREF), em local adequado, sem gravar o aluno sem autorização dele e sem passar telefone ou contato para fechar fora do app. Os dados do aluno seguem a LGPD e a Política de privacidade do FormaCerta.
        </li>
        <li>
          <b>Repasse.</b> O FormaCerta repassa a você o valor das chamadas feitas, já sem a comissão e as taxas. O resumo fica em Conta → Atendimento por vídeo.
        </li>
        <li>
          <b>Mudanças.</b> Se a comissão, a taxa ou as regras mudarem, o app pede um novo aceite antes de você atender de novo.
        </li>
      </ol>

      {aceito ? (
        <p className="mensagem ok">Você já aceitou este termo.</p>
      ) : (
        <>
          <label className="aceite">
            <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
            <span>
              Li e aceito: pago {pct}% de comissão ao FormaCerta e {taxa} por chamada de vídeo realizada.
            </span>
          </label>
          <button className="botao" disabled={!marcado || salvando} onClick={aceitar}>
            {salvando ? 'Salvando…' : 'Aceitar e liberar a chamada de vídeo'}
          </button>
        </>
      )}
      {onFechar && (
        <button className="link" onClick={onFechar}>
          {aceito ? 'Fechar' : 'Agora não'}
        </button>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
    </section>
  )
}
