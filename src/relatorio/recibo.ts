// Recibo de pagamento em PDF, com a faixa e a logo do FormaCerta.
import { emReais, linhasRecibo, type Recibo } from '../nuvem/planos'
import { SUPORTE } from '../nuvem/conta'
import { ALTURA_FAIXA, desenharSimbolo, faixaMarca, textoPdf } from './pdf'

export async function gerarRecibo(r: Recibo): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 16
  const L = 210 - 2 * M
  faixaMarca(doc, 'Recibo de pagamento')

  let y = ALTURA_FAIXA + 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 28, 36)
  doc.text('Recibo de pagamento', M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 112, 122)
  doc.text(`Nº ${r.numero}`, 210 - M, y, { align: 'right' })

  y += 12
  doc.setDrawColor(220, 226, 230)
  doc.setLineWidth(0.3)
  for (const [rotulo, valor] of linhasRecibo(r)) {
    doc.setFontSize(10)
    doc.setTextColor(100, 112, 122)
    doc.text(textoPdf(rotulo), M, y)
    doc.setTextColor(20, 28, 36)
    doc.setFont('helvetica', 'bold')
    const partes = doc.splitTextToSize(textoPdf(valor), L - 55) as string[]
    doc.text(partes, 210 - M, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += 5 * partes.length + 4
    doc.line(M, y - 5, 210 - M, y - 5)
  }

  y += 4
  doc.setFillColor(236, 252, 243)
  doc.roundedRect(M, y, L, 20, 3, 3, 'F')
  doc.setFontSize(11)
  doc.setTextColor(20, 28, 36)
  doc.text('Valor pago', M + 6, y + 12.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(18, 150, 90)
  doc.text(textoPdf(emReais(r.valor)), 210 - M - 6, y + 13, { align: 'right' })

  y += 34
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(60, 70, 80)
  const texto = `Declaramos que recebemos o valor acima referente a "${r.descricao}", pago pelo FormaCerta (formacerta.app.br) por meio do Mercado Pago.`
  doc.text(doc.splitTextToSize(textoPdf(texto), L) as string[], M, y)

  desenharSimbolo(doc, M, 297 - 16.2, 4.5)
  doc.setFontSize(8)
  doc.setTextColor(100, 112, 122)
  doc.text(textoPdf(`FormaCerta · formacerta.app.br · ${SUPORTE} · Este recibo não substitui nota fiscal.`), M + 6, 297 - 13)
  return doc.output('blob')
}
