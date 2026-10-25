import { FileText, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { guardarTelefone, linkWhatsApp, telefoneGuardado, telefoneValido } from '../../compartilhar/whatsapp'

type Props = {
  /** Mensagem já pronta com o resultado. */
  texto: string
  /** Nome da pessoa avaliada, para lembrar o telefone dela. */
  avaliado?: string
  /** Abre o relatório em PDF (padrão FormaCerta) já com este teste marcado. */
  onPdf?: () => void
}

/** Cartão no fim de cada resultado: manda o relatório em PDF ou o resultado em texto pelo WhatsApp. */
export function EnviarWhatsApp({ texto, avaliado = '', onPdf }: Props) {
  const [telefone, setTelefone] = useState(() => telefoneGuardado(avaliado))
  const [copiado, setCopiado] = useState(false)
  const digitou = telefone.replace(/\D/g, '').length > 0
  const invalido = digitou && !telefoneValido(telefone)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <section className="cartao destaque formulario enviar-whatsapp">
      <h2>
        <MessageCircle size={20} /> Enviar pelo WhatsApp
      </h2>

      {onPdf && (
        <>
          <button className="botao botao-whatsapp" onClick={onPdf}>
            <FileText size={20} /> Enviar PDF pelo WhatsApp
          </button>
          <p className="dica-sec">Abre o relatório em PDF com a marca FormaCerta, a sua logo e o seu CREF. Lá, toque em “Enviar PDF pelo WhatsApp” e escolha a conversa.</p>
          <h3 className="sub">Ou mande só o texto</h3>
        </>
      )}

      <label className="campo">
        WhatsApp {avaliado.trim() ? `de ${avaliado.trim()}` : 'da pessoa'} (com DDD)
        <input
          type="tel"
          inputMode="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="Ex.: 71 99999-8888"
          maxLength={20}
        />
        <span className="dica-sec">{invalido ? 'Confira o número: falta o DDD ou algum dígito.' : 'Se deixar em branco, o WhatsApp pede para escolher o contato.'}</span>
      </label>
      <a
        className={`${onPdf ? 'botao-sec' : 'botao botao-whatsapp'}${invalido ? ' desativado' : ''}`}
        href={linkWhatsApp(texto, telefone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={invalido}
        onClick={(e) => {
          if (invalido) return e.preventDefault()
          guardarTelefone(avaliado, telefone)
        }}
      >
        <MessageCircle size={20} /> {onPdf ? 'Enviar texto pelo WhatsApp' : 'Enviar pelo WhatsApp'}
      </a>
      <button className="botao-sec" onClick={copiar}>
        Copiar o texto
      </button>
      {copiado && <p className="mensagem ok">Texto copiado. É só colar na conversa.</p>}
    </section>
  )
}
