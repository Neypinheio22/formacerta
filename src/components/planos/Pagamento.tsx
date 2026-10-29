import { Barcode, CircleCheck, Copy, CreditCard, Info, QrCode, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SUPORTE, useConta } from '../../nuvem/conta'
import {
  CONFIG_PADRAO,
  ROTULO_FORMA,
  assinaturaAtual,
  cobrar,
  comprarAvaliacao,
  emReais,
  escolherPlano,
  lerConfig,
  lerPagamento,
  minhasAssinaturas,
  pagamentoDaAssinatura,
  precoDo,
  type Assinatura,
  type Ciclo,
  type Cobranca,
  type ConfigCobranca,
  type Forma,
  type Pagamento as PagamentoNuvem,
  type Plano,
  type Servico,
} from '../../nuvem/planos'

export type Pedido =
  | { tipo: 'assinatura'; plano: Plano; ciclo: Ciclo }
  | { tipo: 'avaliacao'; servico: Servico }
  /** Pagar um pedido que ficou pendente. */
  | { tipo: 'pendente'; pagamento: PagamentoNuvem }

type Props = {
  pedido: Pedido
  onVoltar: () => void
  onPronto: () => void
  /** Texto do botão no fim (padrão: "Ver meus planos"). */
  textoPronto?: string
}

const FORMAS: { forma: Forma; icone: typeof QrCode; texto: string }[] = [
  { forma: 'pix', icone: QrCode, texto: 'Na hora. Aparece o QR Code e o código copia e cola.' },
  { forma: 'cartao', icone: CreditCard, texto: 'Crédito em até 12x. Os dados do cartão são digitados na página segura do Mercado Pago.' },
  { forma: 'boleto', icone: Barcode, texto: 'Vence em 3 dias úteis. Libera quando o banco confirmar.' },
]

type Fim = { tipo: 'assinatura'; assinatura: Assinatura | null } | { tipo: 'pedido' } | { tipo: 'pix'; pagamento: string; cobranca: Cobranca }

/** Resumo do pedido e forma de pagamento. Com o Mercado Pago ligado gera o Pix ou abre a página dele; sem, só registra o pedido. */
export function Pagamento({ pedido, onVoltar, onPronto, textoPronto = 'Ver meus planos' }: Props) {
  const { perfil } = useConta()
  const [forma, setForma] = useState<Forma>(pedido.tipo === 'pendente' ? pedido.pagamento.forma : 'pix')
  const [config, setConfig] = useState<ConfigCobranca>(CONFIG_PADRAO)
  const [jaPagou, setJaPagou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [fim, setFim] = useState<Fim | null>(null)

  useEffect(() => {
    lerConfig().then(setConfig)
    if (perfil) minhasAssinaturas(perfil.id).then((a) => setJaPagou(a.some((x) => x.valor > 0)))
  }, [perfil])

  const valor = pedido.tipo === 'assinatura' ? precoDo(pedido.plano, pedido.ciclo) : pedido.tipo === 'avaliacao' ? pedido.servico.preco : pedido.pagamento.valor
  const gratis = valor === 0
  const comTeste = pedido.tipo === 'assinatura' && !gratis && config.dias_gratis > 0 && !jaPagou
  const titulo = pedido.tipo === 'assinatura' ? `Plano ${pedido.plano.nome}` : pedido.tipo === 'avaliacao' ? pedido.servico.nome : pedido.pagamento.descricao
  const mercadoPago = config.gateway === 'mercadopago'

  /** Leva ao Pix ou à página do Mercado Pago. Devolve false se deu erro. */
  async function pagarAgora(pagamento: string) {
    const { cobranca, erro } = await cobrar(pagamento, forma)
    if (erro || !cobranca) {
      setErro(`${erro ?? 'Não deu para gerar a cobrança.'} O pedido ficou salvo: dá para pagar depois em Planos → Meus pagamentos.`)
      return false
    }
    if (cobranca.pix_copia_cola) setFim({ tipo: 'pix', pagamento, cobranca })
    else if (cobranca.link) window.location.href = cobranca.link
    return true
  }

  async function confirmar() {
    if (!perfil) return
    setEnviando(true)
    setErro(null)
    if (pedido.tipo === 'pendente') {
      await pagarAgora(pedido.pagamento.id)
    } else if (pedido.tipo === 'assinatura') {
      const e = await escolherPlano(pedido.plano.id, pedido.ciclo, forma)
      if (e) setErro(e)
      else {
        const atual = assinaturaAtual(await minhasAssinaturas(perfil.id))
        const pendente = mercadoPago && atual?.situacao === 'aguardando' ? await pagamentoDaAssinatura(atual.id) : null
        if (!pendente || !(await pagarAgora(pendente.id))) setFim({ tipo: 'assinatura', assinatura: atual })
      }
    } else {
      const { id, erro: e } = await comprarAvaliacao(pedido.servico.id, forma)
      if (e || !id) setErro(e)
      else if (!mercadoPago || !(await pagarAgora(id))) setFim({ tipo: 'pedido' })
    }
    setEnviando(false)
  }

  if (fim?.tipo === 'pix') return <PagarPix titulo={titulo} valor={valor} pagamento={fim.pagamento} cobranca={fim.cobranca} textoPronto={textoPronto} onPronto={onPronto} />
  if (fim) return <Pronto fim={fim} titulo={titulo} mercadoPago={mercadoPago} textoPronto={textoPronto} onPronto={onPronto} />

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      </header>

      <h1>{gratis ? 'Confirmar plano' : 'Pagamento'}</h1>

      {!mercadoPago && !gratis && (
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

      {!gratis && !comTeste && (
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
        <ShieldCheck size={14} /> {mercadoPago ? 'Pagamento processado pelo Mercado Pago.' : ''} O FormaCerta não guarda o número do seu cartão. Dúvidas: {SUPORTE}
      </p>
    </div>
  )
}

/** QR Code e copia e cola. Confere sozinho a cada 5 segundos se o Pix caiu. */
function PagarPix({ titulo, valor, pagamento, cobranca, textoPronto, onPronto }: { titulo: string; valor: number; pagamento: string; cobranca: Cobranca; textoPronto: string; onPronto: () => void }) {
  const [pago, setPago] = useState(false)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (pago) return
    const vez = setInterval(async () => {
      if ((await lerPagamento(pagamento))?.situacao === 'pago') setPago(true)
    }, 5000)
    return () => clearInterval(vez)
  }, [pagamento, pago])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cobranca.pix_copia_cola ?? '')
      setCopiado(true)
    } catch {
      /* o texto continua na tela para copiar à mão */
    }
  }

  if (pago)
    return (
      <div className="tela">
        <section className="cartao destaque centro pronto">
          <CircleCheck size={56} className="verde" />
          <h1>Pagamento confirmado</h1>
          <p className="dica">{titulo} já está valendo. Obrigado!</p>
          <button className="botao grande" onClick={onPronto}>
            {textoPronto}
          </button>
        </section>
      </div>
    )

  return (
    <div className="tela">
      <h1>Pague com Pix</h1>
      <section className="cartao centro pix">
        <span className="dica-sec">{titulo}</span>
        <strong className="valor-pix">{emReais(valor)}</strong>
        {cobranca.pix_qr && <img className="qr-pix" src={`data:image/png;base64,${cobranca.pix_qr}`} alt="QR Code do Pix" />}
        <p className="dica-sec">Abra o app do seu banco, escolha Pix e leia o QR Code, ou copie o código abaixo.</p>
        <textarea className="copia-cola" readOnly rows={3} value={cobranca.pix_copia_cola ?? ''} onFocus={(e) => e.target.select()} />
        <button className="botao" onClick={copiar}>
          <Copy size={18} /> {copiado ? 'Código copiado' : 'Copiar código Pix'}
        </button>
        <p className="carregando">Esperando o pagamento… a tela muda sozinha quando o Pix cair.</p>
      </section>
      <button className="botao-sec" onClick={onPronto}>
        Pagar depois
      </button>
    </div>
  )
}

function Pronto({ fim, titulo, mercadoPago, textoPronto, onPronto }: { fim: Exclude<Fim, { tipo: 'pix' }>; titulo: string; mercadoPago: boolean; textoPronto: string; onPronto: () => void }) {
  let texto: string
  const a = fim.tipo === 'assinatura' ? fim.assinatura : null
  if (fim.tipo === 'pedido')
    texto = mercadoPago
      ? 'Pedido registrado. Assim que o pagamento for confirmado, ele aparece para o seu personal.'
      : 'Pedido registrado. O pagamento pelo app ainda vai ser ligado: combine com o seu personal e ele marca a avaliação.'
  else if (a?.situacao === 'teste') texto = `Seu teste grátis começou e vai até ${new Date(a.valido_ate!).toLocaleDateString('pt-BR')}. Aproveite tudo do plano.`
  else if (a?.situacao === 'ativa') texto = 'Pronto, o plano já está valendo.'
  else
    texto = mercadoPago
      ? 'Pedido registrado. Assim que o pagamento for confirmado, o plano começa a valer.'
      : 'Pedido registrado. O pagamento pelo app ainda vai ser ligado; o administrador confirma o seu plano.'

  return (
    <div className="tela">
      <section className="cartao destaque centro pronto">
        <CircleCheck size={56} className="verde" />
        <h1>{titulo}</h1>
        <p className="dica">{texto}</p>
        <button className="botao grande" onClick={onPronto}>
          {textoPronto}
        </button>
      </section>
    </div>
  )
}
