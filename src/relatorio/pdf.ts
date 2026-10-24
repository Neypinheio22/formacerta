// Monta o PDF do relatório em A4, com texto de verdade (dá para copiar e fica leve).

import type { Status } from '../pose/types'
import { dataCurta } from '../testes/formato'
import type { Secao } from './conteudo'
import { contato, type Profissional } from './profissional'

export type Imagem = { image: string; width: number; height: number }

export type DadosRelatorio = {
  profissional: Profissional
  avaliado: string
  data: string
  conclusao: string
  secoes: (Secao & { fotos: Imagem[] })[]
}

type Cor = [number, number, number]
const VERDE: Cor = [18, 150, 90]
const TEXTO: Cor = [20, 28, 36]
const CINZA: Cor = [100, 112, 122]
const COR_STATUS: Record<Status, Cor> = { ok: [18, 150, 90], atencao: [200, 110, 0], alerta: [210, 40, 40] }

const A4 = { w: 210, h: 297 }
const M = 16
const LARGURA = A4.w - 2 * M
const BASE = A4.h - 18

const formato = (dataUrl: string) => (dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG')

export async function gerarPdf(d: DadosRelatorio): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = M

  const cor = (c: Cor) => doc.setTextColor(c[0], c[1], c[2])
  const fonte = (tamanho: number, estilo: 'normal' | 'bold' | 'italic' = 'normal') => {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }
  // Altura de uma linha de texto em mm para o tamanho de fonte atual.
  const altLinha = () => (doc.getFontSize() * 0.3528) * 1.35

  const novaPagina = () => {
    doc.addPage()
    y = M
  }
  const garantir = (h: number) => {
    if (y + h > BASE) novaPagina()
  }

  /** Escreve texto quebrado em linhas e avança o y. */
  const paragrafo = (texto: string, x = M, largura = LARGURA) => {
    for (const l of doc.splitTextToSize(texto, largura) as string[]) {
      garantir(altLinha())
      doc.text(l, x, y + altLinha() * 0.75)
      y += altLinha()
    }
  }

  // Cabeçalho: logo e dados do profissional.
  const p = d.profissional
  let xTexto = M
  let altCabecalho = 0
  if (p.logo) {
    const escala = Math.min(40 / p.logo.width, 22 / p.logo.height)
    const w = p.logo.width * escala
    const h = p.logo.height * escala
    doc.addImage(p.logo.image, formato(p.logo.image), M, y, w, h)
    xTexto = M + w + 6
    altCabecalho = h
  }
  let yTexto = y
  const linhaCabecalho = (texto: string, tamanho: number, estilo: 'normal' | 'bold', c: Cor) => {
    if (!texto.trim()) return
    fonte(tamanho, estilo)
    cor(c)
    doc.text(texto, xTexto, yTexto + altLinha() * 0.75, { maxWidth: A4.w - M - xTexto })
    yTexto += altLinha()
  }
  linhaCabecalho(p.nome || 'Profissional', 14, 'bold', TEXTO)
  linhaCabecalho(p.profissao, 10, 'normal', CINZA)
  linhaCabecalho(p.registro, 10, 'bold', TEXTO)
  linhaCabecalho(contato(p), 9, 'normal', CINZA)
  y += Math.max(altCabecalho, yTexto - y) + 4
  doc.setDrawColor(VERDE[0], VERDE[1], VERDE[2])
  doc.setLineWidth(0.8)
  doc.line(M, y, A4.w - M, y)
  y += 8

  fonte(16, 'bold')
  cor(TEXTO)
  doc.text('Relatório de avaliação', M, y)
  y += 7
  fonte(11)
  doc.text(`Avaliado: ${d.avaliado || '—'}`, M, y)
  doc.text(`Data: ${dataCurta(d.data)}`, A4.w - M, y, { align: 'right' })
  y += 8

  for (const s of d.secoes) {
    garantir(30)
    doc.setFillColor(232, 248, 239)
    doc.rect(M, y, LARGURA, 9, 'F')
    fonte(12, 'bold')
    cor(TEXTO)
    doc.text(s.titulo, M + 3, y + 6.2)
    fonte(10)
    cor(CINZA)
    doc.text(dataCurta(s.data), A4.w - M - 3, y + 6.2, { align: 'right' })
    y += 13

    // Rótulo à esquerda, valor à direita (colorido pelo status).
    const colValor = M + 62
    for (const l of s.linhas) {
      fonte(10)
      const valor = doc.splitTextToSize(l.valor, A4.w - M - colValor) as string[]
      const rotulo = doc.splitTextToSize(l.rotulo, colValor - M - 3) as string[]
      const h = Math.max(valor.length, rotulo.length) * altLinha()
      garantir(h)
      cor(CINZA)
      doc.text(rotulo, M, y + altLinha() * 0.75)
      fonte(10, 'bold')
      cor(l.status ? COR_STATUS[l.status] : TEXTO)
      doc.text(valor, colValor, y + altLinha() * 0.75)
      y += h + 1
    }

    fonte(10)
    cor(TEXTO)
    for (const t of s.textos) {
      y += 1
      paragrafo(t)
    }

    for (const lista of s.listas) {
      y += 2
      garantir(10)
      fonte(10, 'bold')
      cor(TEXTO)
      paragrafo(lista.titulo)
      fonte(10)
      for (const item of lista.itens) {
        const linhas = doc.splitTextToSize(item, LARGURA - 5) as string[]
        garantir(altLinha())
        doc.text('•', M + 1, y + altLinha() * 0.75)
        for (const l of linhas) {
          garantir(altLinha())
          doc.text(l, M + 5, y + altLinha() * 0.75)
          y += altLinha()
        }
      }
    }

    if (s.fotos.length) {
      y += 3
      const n = s.fotos.length
      const gap = 4
      const w = n === 1 ? 70 : (LARGURA - gap * (n - 1)) / n
      const h = Math.max(...s.fotos.map((f) => Math.min(95, (w * f.height) / f.width)))
      garantir(h)
      s.fotos.forEach((f, i) => {
        const escala = Math.min(w / f.width, h / f.height)
        const fw = f.width * escala
        const fh = f.height * escala
        doc.addImage(f.image, formato(f.image), M + i * (w + gap) + (w - fw) / 2, y, fw, fh)
      })
      y += h + 3
    }

    if (s.observacoes.trim()) {
      y += 2
      garantir(12)
      fonte(10, 'bold')
      cor(TEXTO)
      paragrafo('Observações do profissional')
      fonte(10)
      paragrafo(s.observacoes)
    }

    y += 1
    fonte(8.5, 'italic')
    cor(CINZA)
    paragrafo(s.aviso)
    y += 6
  }

  if (d.conclusao.trim()) {
    garantir(16)
    fonte(12, 'bold')
    cor(TEXTO)
    paragrafo('Conclusão e conduta')
    y += 1
    fonte(10)
    paragrafo(d.conclusao)
    y += 6
  }

  // Assinatura do profissional.
  garantir(28)
  y += 14
  doc.setDrawColor(CINZA[0], CINZA[1], CINZA[2])
  doc.setLineWidth(0.3)
  doc.line(A4.w / 2 - 40, y, A4.w / 2 + 40, y)
  y += 5
  fonte(10, 'bold')
  cor(TEXTO)
  doc.text(p.nome || 'Profissional', A4.w / 2, y, { align: 'center' })
  if (p.registro.trim()) {
    y += 5
    fonte(9)
    cor(CINZA)
    doc.text(p.registro, A4.w / 2, y, { align: 'center' })
  }

  // Rodapé em todas as páginas.
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    fonte(8)
    cor(CINZA)
    doc.text('Relatório feito com o FormaCerta · triagem, não diagnóstico médico', M, A4.h - 9)
    doc.text(`Página ${i} de ${total}`, A4.w - M, A4.h - 9, { align: 'right' })
  }

  return doc.output('blob')
}

/** Converte um SVG da tela (foto com o esqueleto e as medidas) em JPEG para o PDF. */
export function svgParaImagem(svg: SVGSVGElement, larguraMax = 900): Promise<Imagem> {
  const vb = svg.viewBox.baseVal
  const escala = Math.min(1, larguraMax / vb.width)
  const width = Math.round(vb.width * escala)
  const height = Math.round(vb.height * escala)
  const copia = svg.cloneNode(true) as SVGSVGElement
  copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copia.setAttribute('width', String(width))
  copia.setAttribute('height', String(height))
  const texto = new XMLSerializer().serializeToString(copia)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve({ image: canvas.toDataURL('image/jpeg', 0.82), width, height })
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texto)
  })
}

/** Abre a folha de compartilhar do celular (WhatsApp, e-mail…) com o PDF. Sem suporte, baixa o arquivo. */
export async function compartilharPdf(pdf: Blob, nome: string, texto: string): Promise<'compartilhado' | 'baixado' | 'cancelado'> {
  const arquivo = new File([pdf], nome, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome, text: texto })
      return 'compartilhado'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelado'
    }
  }
  baixarPdf(pdf, nome)
  return 'baixado'
}

export function baixarPdf(pdf: Blob, nome: string) {
  const url = URL.createObjectURL(pdf)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
