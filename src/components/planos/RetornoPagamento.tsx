import { CircleCheck, CircleX, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useConta } from '../../nuvem/conta'
import { emReais, lerPagamento, type Pagamento } from '../../nuvem/planos'
import { BotaoRecibo } from './BotaoRecibo'
import { recarregarDireitos } from './useDireitos'

/** Quanto tempo a tela espera o aviso do Mercado Pago antes de dizer "ainda processando". */
const ESPERA_MS = 90_000

type Props = { pagamento: string; falhou: boolean; onInicio: () => void; onPlanos: () => void }

/** Volta da página do Mercado Pago (cartão ou boleto): confirma o pagamento na tela. */
export function RetornoPagamento({ pagamento, falhou, onInicio, onPlanos }: Props) {
  const { recarregar } = useConta()
  const [pg, setPg] = useState<Pagamento | null | undefined>(undefined)
  const [esgotou, setEsgotou] = useState(false)

  useEffect(() => {
    let vivo = true
    const inicio = Date.now()
    async function olhar() {
      const p = await lerPagamento(pagamento)
      if (!vivo) return
      setPg(p)
      if (p?.situacao === 'pago') {
        recarregarDireitos()
        if (p.tipo === 'avaliacao') recarregar()
        return
      }
      if (Date.now() - inicio > ESPERA_MS) return setEsgotou(true)
      setTimeout(olhar, 3000)
    }
    olhar()
    return () => {
      vivo = false
    }
  }, [pagamento, recarregar])

  const pago = pg?.situacao === 'pago'
  const boleto = pg?.forma === 'boleto'

  let icone = <Clock size={56} className="verde pulsando" />
  let titulo = 'Confirmando o seu pagamento…'
  let texto = 'Estamos esperando a confirmação do Mercado Pago. Leva só alguns segundos.'
  if (pg === null) {
    titulo = 'Pagamento não encontrado'
    texto = 'Entre com a mesma conta que fez o pedido para ver o pagamento.'
    icone = <CircleX size={56} className="alerta-texto" />
  } else if (pago) {
    icone = <CircleCheck size={56} className="verde" />
    titulo = 'Pagamento confirmado'
    texto =
      pg.tipo === 'assinatura'
        ? `Recebemos o pagamento de "${pg.descricao}". O seu plano já está valendo. Obrigado!`
        : `Recebemos o pagamento de "${pg.descricao}". O seu personal já recebeu o aviso e vai combinar o atendimento com você pelo chat.`
  } else if (pg?.situacao === 'cancelado') {
    icone = <CircleX size={56} className="alerta-texto" />
    titulo = 'Pedido cancelado'
    texto = 'Este pedido foi cancelado. Se quiser, faça um novo em Planos.'
  } else if (falhou) {
    icone = <CircleX size={56} className="alerta-texto" />
    titulo = 'Pagamento não aprovado'
    texto = 'O Mercado Pago não aprovou o pagamento. Nada foi cobrado. Tente com outro cartão ou pague com Pix.'
  } else if (boleto) {
    titulo = 'Boleto gerado'
    texto = 'Assim que o banco confirmar o pagamento (até 3 dias úteis), o app libera sozinho e você recebe o recibo por e-mail.'
  } else if (esgotou) {
    titulo = 'Pagamento em processamento'
    texto = 'O Mercado Pago ainda não confirmou. Quando confirmar, o app libera sozinho e você recebe o recibo por e-mail. Acompanhe em Planos → Meus pagamentos.'
  }

  return (
    <div className="tela">
      <section className="cartao destaque centro pronto">
        {icone}
        <h1>{titulo}</h1>
        {pg && <strong className="valor-pix">{emReais(pg.valor)}</strong>}
        <p className="dica">{texto}</p>
        {pago && (
          <>
            <p className="dica-sec">O recibo também foi para o seu e-mail.</p>
            <BotaoRecibo pagamento={pagamento} classe="botao-sec" />
          </>
        )}
        {(falhou || pg?.situacao === 'pendente') && !pago && !boleto && (
          <button className="botao-sec" onClick={onPlanos}>
            Pagar de outro jeito
          </button>
        )}
        <button className="botao grande" onClick={onInicio}>
          Voltar ao início
        </button>
      </section>
    </div>
  )
}
