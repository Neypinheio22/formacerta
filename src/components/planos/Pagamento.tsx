import { Barcode, CircleCheck, CreditCard, Info, QrCode, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SUPORTE, useConta } from '../../nuvem/conta'
import {
  CONFIG_PADRAO,
  ROTULO_FORMA,
  assinaturaAtual,
  comprarAvaliacao,
  emReais,
  escolherPlano,
  lerConfig,
  minhasAssinaturas,
  precoDo,
  type Assinatura,
  type Ciclo,
  type ConfigCobranca,
  type Forma,
  type Plano,
  type Servico,
} from '../../nuvem/planos'

export type Pedido = { tipo: 'assinatura'; plano: Plano; ciclo: Ciclo } | { tipo: 'avaliacao'; servico: Servico }

type Props = {
  pedido: Pedido
  onVoltar: () => void
  onPronto: () => void
}

const FORMAS: { forma: Forma; icone: typeof QrCode; texto: string }[] = [
  { forma: 'pix', icone: QrCode, texto: 'Na hora. Aparece o QR Code e o código copia e cola.' },
  { forma: 'cartao', icone: CreditCard, texto: 'Crédito, renova sozinho. Os dados do cartão são digitados na página segura do banco.' },
  { forma: 'boleto', icone: Barcode, texto: 'Vence em 3 dias úteis. Libera quando o banco confirmar.' },
]

/** Resumo do pedido e forma de pagamento. Enquanto o gateway não está ligado, só registra o pedido. */
export function Pagamento({ pedido, onVoltar, onPronto }: Props) {
  const { perfil } = useConta()
  const [forma, setForma] = useState<Forma>('pix')
  const [config, setConfig] = useState<ConfigCobranca>(CONFIG_PADRAO)
  const [jaPagou, setJaPagou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState<Assinatura | 'avaliacao' | null>(null)

  useEffect(() => {
    lerConfig().then(setConfig)
    if (perfil) minhasAssinaturas(perfil.id).then((a) => setJaPagou(a.some((x) => x.valor > 0)))
  }, [perfil])

  const valor = pedido.tipo === 'assinatura' ? precoDo(pedido.plano, pedido.ciclo) : pedido.servico.preco
  const gratis = valor === 0
  const comTeste = pedido.tipo === 'assinatura' && !gratis && config.dias_gratis > 0 && !jaPagou
  const titulo = pedido.tipo === 'assinatura' ? `Plano ${pedido.plano.nome}` : pedido.servico.nome
  const gatewayLigado = config.gateway !== 'nenhum'

  async function confirmar() {
    if (!perfil) return
    setEnviando(true)
    setErro(null)
    if (pedido.tipo === 'assinatura') {
      const e = await escolherPlano(pedido.plano.id, pedido.ciclo, forma)
      if (e) setErro(e)
      else setFeito(assinaturaAtual(await minhasAssinaturas(perfil.id)))
    } else {
      const e = await comprarAvaliacao(pedido.servico.id, forma)
      if (e) setErro(e)
      else setFeito('avaliacao')
    }
    setEnviando(false)
  }

  if (feito !== null) return <Pronto feito={feito} titulo={titulo} gatewayLigado={gatewayLigado} onPronto={onPronto} />

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      </header>

      <h1>{gratis ? 'Confirmar plano' : 'Pagamento'}</h1>

      {!gatewayLigado && !gratis && (
        <p className="mensagem aviso faixa">
          <Info size={16} /> Modo de teste: nenhum valor é cobrado ainda. O pedido fica registrado e o pagamento pelo app é ligado em breve.
        </p>
      )}

      <section className="cartao resumo-pedido">
        <span className="dica-sec">Você está contratando</span>
        <h2>{titulo}</h2>
        {pedido.tipo === 'assinatura' && !gratis && <p className="dica-sec">Cobrança {pedido.ciclo === 'anual' ? 'anual' : 'mensal'} · cancele quando quiser</p>}
        {pedido.tipo === 'avaliacao' && pedido.servico.descricao && <p className="dica-sec">{pedido.servico.descricao}</p>}
        <div className="linha-total">
          <span>Hoje</span>
          <strong>{emReais(comTeste ? 0 : valor)}</strong>
        </div>
        {comTeste && (
          <p className="dica-sec">
            {config.dias_gratis} dias grátis. Depois, {emReais(valor)} por {pedido.ciclo === 'anual' ? 'ano' : 'mês'}. Avisamos antes da primeira cobrança.
          </p>
        )}
      </section>

      {!gratis && (
        <section className="cartao">
          <h2>Como você quer pagar?</h2>
          <div className="opcoes">
            {FORMAS.map(({ forma: f, icone: Icone, texto }) => (
              <button key={f} className={`opcao forma ${forma === f ? 'ativo' : ''}`} onClick={() => setForma(f)}>
                <strong>
                  <Icone size={18} /> {ROTULO_FORMA[f]}
                </strong>
                <span>{texto}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {erro && <p className="mensagem erro">{erro}</p>}

      <button className="botao grande" disabled={enviando || !perfil || perfil.papel === 'admin'} onClick={confirmar}>
        {enviando ? 'Enviando…' : gratis ? 'Usar o plano grátis' : comTeste ? `Começar ${config.dias_gratis} dias grátis` : `Pagar ${emReais(valor)} com ${ROTULO_FORMA[forma]}`}
      </button>

      <p className="aviso-legal">
        <ShieldCheck size={14} /> O FormaCerta não guarda o número do seu cartão. Dúvidas: {SUPORTE}
      </p>
    </div>
  )
}

function Pronto({ feito, titulo, gatewayLigado, onPronto }: { feito: Assinatura | 'avaliacao' | null; titulo: string; gatewayLigado: boolean; onPronto: () => void }) {
  let texto: string
  if (feito === 'avaliacao')
    texto = gatewayLigado
      ? 'Assim que o pagamento for confirmado, o seu personal recebe o aviso para marcar a avaliação.'
      : 'Pedido registrado. O pagamento pelo app ainda vai ser ligado: combine com o seu personal e ele marca a avaliação.'
  else if (feito?.situacao === 'teste')
    texto = `Seu teste grátis começou e vai até ${new Date(feito.valido_ate!).toLocaleDateString('pt-BR')}. Aproveite tudo do plano.`
  else if (feito?.situacao === 'ativa') texto = 'Pronto, o plano já está valendo.'
  else
    texto = gatewayLigado
      ? 'Assim que o pagamento for confirmado, o plano começa a valer.'
      : 'Pedido registrado. O pagamento pelo app ainda vai ser ligado; o administrador confirma o seu plano.'

  return (
    <div className="tela">
      <section className="cartao destaque centro pronto">
        <CircleCheck size={56} className="verde" />
        <h1>{titulo}</h1>
        <p className="dica">{texto}</p>
        <button className="botao grande" onClick={onPronto}>
          Ver meus planos
        </button>
      </section>
    </div>
  )
}
