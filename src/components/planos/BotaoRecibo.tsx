import { FileText } from 'lucide-react'
import { useState } from 'react'
import { lerRecibo } from '../../nuvem/planos'

/** Baixa (ou compartilha, no celular) o recibo em PDF de um pagamento confirmado. */
export function BotaoRecibo({ pagamento, classe = 'link' }: { pagamento: string; classe?: string }) {
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState(false)

  async function baixar() {
    setGerando(true)
    setErro(false)
    try {
      const r = await lerRecibo(pagamento)
      if (!r) throw new Error('sem recibo')
      const [{ gerarRecibo }, { compartilharPdf }] = await Promise.all([import('../../relatorio/recibo'), import('../../relatorio/pdf')])
      await compartilharPdf(await gerarRecibo(r), `recibo-formacerta-${r.numero}.pdf`, `Recibo ${r.numero} do FormaCerta`)
    } catch {
      setErro(true)
    }
    setGerando(false)
  }

  return (
    <>
      <button className={classe} disabled={gerando} onClick={baixar}>
        <FileText size={14} /> {gerando ? 'Gerando recibo…' : 'Recibo em PDF'}
      </button>
      {erro && <span className="mensagem erro">Não deu para gerar o recibo agora. Tente de novo.</span>}
    </>
  )
}
