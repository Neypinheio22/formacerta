// Ficha de treino em PDF (A4): um treino só ou a rotina inteira, com a logo e
// os dados do personal, nome do aluno, datas, orientações e cada exercício com
// as linhas que o personal escreveu (série/rep, carga, intervalo, cadência...)
// e, se pedir, a foto do exercício. Texto de verdade: fica leve, nítido no
// celular e na impressão, e dá para copiar.

import { ALTURA_FAIXA, desenharSimbolo, faixaMarca, textoPdf, type Doc, type Imagem } from '../relatorio/pdf'
import { linhasDe, tipoDe, type LinhaSerie } from './linhas'
import { dataDia } from './rotinas'

export type ExercicioPdf = {
  nome: string
  linhas: LinhaSerie[]
  imagem?: Imagem | null
  /** Link do vídeo de como fazer (vira um link clicável no PDF). */
  video?: string | null
}

export type TreinoPdf = { letra: string; nome: string; foco: string; exercicios: ExercicioPdf[] }

export type DadosFichaPdf = {
  /** Um treino só ou a rotina completa. */
  tipo: 'treino' | 'rotina'
  aluno: string
  personal: { nome: string; registro: string; contato: string; logo?: Imagem | null }
  rotina: { nome: string; objetivo: string; nivel: string; tipo: string }
  /** AAAA-MM-DD */
  elaborada: string
  /** AAAA-MM-DD, ou vazio quando não tem validade. */
  validade: string
  orientacoes: { rotulo: string; texto: string }[]
  observacoes: string
  treinos: TreinoPdf[]
  aerobicos: { titulo: string; texto: string; obs: string }[]
  geradoEm: Date
}

/** Um campo da linha pronto para o PDF: rótulo pequeno em cima, valor embaixo. */
export type CampoPdf = { rotulo: string; valor: string }

/**
 * Como a linha aparece no PDF. Linhas de números (série/rep, carga, intervalo...)
 * viram colunas; observação, cadência e exercício viram uma frase.
 */
export function linhaPdf(l: LinhaSerie): { campos: CampoPdf[] } | { frase: CampoPdf } {
  const t = tipoDe(l.tipo)
  if (t.campos.length === 1) return { frase: { rotulo: t.nome, valor: (l.texto ?? '').trim() } }
  const campos = t.campos
    .filter((k) => (l[k.chave] ?? '').trim())
    .map((k) => {
      const v = l[k.chave]!.trim()
      return { rotulo: k.chave === 'serie' ? 'Séries x reps' : k.rotulo, valor: k.chave === 'carga' && !/[a-z]/i.test(v) ? `${v} kg` : v }
    })
  return { campos }
}

/** Linhas do exercício que têm alguma coisa escrita (os treinos antigos viram linhas também). */
export const linhasDoExercicio = (ex: { series?: string; reps?: string; obs?: string; linhas?: LinhaSerie[] }) =>
  linhasDe(ex).filter((l) => tipoDe(l.tipo).campos.some((k) => (l[k.chave] ?? '').trim()))

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** "Treino-A-Maria-Silva.pdf" ou "Rotina-Hipertrofia-Maria-Silva.pdf". */
export function nomeArquivoFicha(d: Pick<DadosFichaPdf, 'tipo' | 'aluno' | 'rotina' | 'treinos'>): string {
  const inicio = d.tipo === 'treino' ? `Treino-${d.treinos[0]?.letra ?? ''}` : `Rotina-${semAcento(d.rotina.nome).slice(0, 30)}`
  const aluno = semAcento(d.aluno).slice(0, 40)
  return `${[inicio, aluno].filter(Boolean).join('-').replace(/-+/g, '-')}.pdf`
}

/** Título do PDF: "Treino A · Peito e tríceps" ou "Rotina completa · 3 treinos". */
export function tituloFicha(d: Pick<DadosFichaPdf, 'tipo' | 'treinos'>): string {
  if (d.tipo === 'treino') {
    const t = d.treinos[0]
    return t ? `Treino ${t.letra}${t.nome ? ` · ${t.nome}` : ''}` : 'Treino'
  }
  return `Rotina completa · ${d.treinos.length} treino${d.treinos.length === 1 ? '' : 's'}`
}

/**
 * Registro como o personal digitou no cadastro, com o conselho na frente quando
 * dá para saber pelo final: "-G/UF" é CREF, "-F" é CREFITO.
 */
export function registroComConselho(r: string): string {
  const x = r.trim()
  if (!x || /[a-z]{3,}/i.test(x.split(/[\s\d]/)[0] ?? '')) return x
  if (/-G(\/[A-Z]{2})?$/i.test(x)) return `CREF ${x}`
  if (/-F$/i.test(x)) return `CREFITO ${x}`
  return x
}

type Cor = [number, number, number]
const TEXTO: Cor = [20, 28, 36]
const CINZA: Cor = [100, 112, 122]
const CINZA_CLARO: Cor = [214, 222, 228]
const VERDE: Cor = [18, 150, 90]
const VERDE_CLARO: Cor = [232, 248, 239]
const MARCA: Cor = [54, 242, 148]
const FUNDO_MARCA: Cor = [2, 11, 22]

const A4 = { w: 210, h: 297 }
const M = 14
const LARGURA = A4.w - 2 * M
const BASE = A4.h - 20
const TOPO_CONTINUA = 22
const FOTO = 30

const formato = (dataUrl: string) => (dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG')

function limpar(d: DadosFichaPdf): DadosFichaPdf {
  const t = textoPdf
  return {
    ...d,
    aluno: t(d.aluno),
    personal: { ...d.personal, nome: t(d.personal.nome), registro: t(d.personal.registro), contato: t(d.personal.contato) },
    rotina: { nome: t(d.rotina.nome), objetivo: t(d.rotina.objetivo), nivel: t(d.rotina.nivel), tipo: t(d.rotina.tipo) },
    orientacoes: d.orientacoes.map((o) => ({ rotulo: t(o.rotulo), texto: t(o.texto) })),
    observacoes: t(d.observacoes),
    treinos: d.treinos.map((tr) => ({
      ...tr,
      nome: t(tr.nome),
      foco: t(tr.foco),
      exercicios: tr.exercicios.map((e) => ({
        ...e,
        nome: t(e.nome),
        linhas: e.linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, k === 'tipo' ? v : t(String(v))])) as LinhaSerie),
      })),
    })),
    aerobicos: d.aerobicos.map((a) => ({ titulo: t(a.titulo), texto: t(a.texto), obs: t(a.obs) })),
  }
}

export async function gerarFichaPdf(dados: DadosFichaPdf): Promise<{ pdf: Blob; paginas: number }> {
  const d = limpar(dados)
  const { jsPDF } = await import('jspdf')
  const doc: Doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setProperties({ title: `${tituloFicha(d)} - ${d.aluno}`, author: d.personal.nome || 'FormaCerta', creator: 'FormaCerta' })
  let y = M

  const cor = (c: Cor) => doc.setTextColor(c[0], c[1], c[2])
  const preencher = (c: Cor) => doc.setFillColor(c[0], c[1], c[2])
  const traco = (c: Cor, w: number) => {
    doc.setDrawColor(c[0], c[1], c[2])
    doc.setLineWidth(w)
  }
  const fonte = (tamanho: number, estilo: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') => {
    doc.setFont('helvetica', estilo)
    doc.setFontSize(tamanho)
  }
  const alt = (tamanho = doc.getFontSize()) => tamanho * 0.3528 * 1.3
  const quebrar = (texto: string, largura: number) => doc.splitTextToSize(texto, largura) as string[]

  const novaPagina = () => {
    doc.addPage()
    y = TOPO_CONTINUA
  }
  const garantir = (h: number) => {
    if (y + h > BASE) novaPagina()
  }
  const paragrafo = (texto: string, x = M, largura = LARGURA) => {
    for (const l of quebrar(texto, largura)) {
      garantir(alt())
      doc.text(l, x, y + alt() * 0.78)
      y += alt()
    }
  }

  // ---------- Cabeçalho da primeira página ----------
  faixaMarca(doc, d.tipo === 'treino' ? 'Ficha de treino' : 'Rotina de treino completa')
  y = ALTURA_FAIXA + 7

  const p = d.personal
  let xTexto = M
  let altLogo = 0
  if (p.logo) {
    const escala = Math.min(34 / p.logo.width, 20 / p.logo.height)
    const w = p.logo.width * escala
    altLogo = p.logo.height * escala
    doc.addImage(p.logo.image, formato(p.logo.image), M, y, w, altLogo)
    xTexto = M + w + 5
  }
  let yT = y
  const linhaTopo = (texto: string, tamanho: number, estilo: 'normal' | 'bold', c: Cor) => {
    if (!texto.trim()) return
    fonte(tamanho, estilo)
    cor(c)
    for (const l of quebrar(texto, A4.w - M - xTexto).slice(0, 2)) {
      doc.text(l, xTexto, yT + alt() * 0.78)
      yT += alt()
    }
  }
  linhaTopo(p.nome || 'Personal', 13, 'bold', TEXTO)
  linhaTopo(p.registro, 9.5, 'bold', VERDE)
  linhaTopo(p.contato, 8.5, 'normal', CINZA)
  y = Math.max(y + altLogo, yT) + 5

  // Quadro com a rotina, o aluno e as datas.
  const infos: CampoPdf[] = [
    { rotulo: 'Aluno', valor: d.aluno || '—' },
    { rotulo: 'Personal', valor: [p.nome, p.registro].filter(Boolean).join(' · ') || '—' },
    { rotulo: 'Objetivo', valor: [d.rotina.objetivo, d.rotina.tipo].filter(Boolean).join(' · ') || '—' },
    { rotulo: 'Nível', valor: d.rotina.nivel || '—' },
    { rotulo: 'Data de elaboração', valor: dataDia(d.elaborada) || '—' },
    { rotulo: 'Validade da ficha', valor: d.validade ? `até ${dataDia(d.validade)}` : 'Sem validade definida' },
  ]
  const colW = (LARGURA - 8) / 2
  fonte(10.5, 'bold')
  const linhasInfo = infos.map((i) => quebrar(i.valor, colW - 2))
  const altInfo: number[] = []
  for (let i = 0; i < infos.length; i += 2) altInfo.push(Math.max(linhasInfo[i].length, linhasInfo[i + 1]?.length ?? 1) * alt(10.5) + alt(7.5) + 2.5)
  fonte(15, 'bold')
  const nomeRotina = quebrar(d.rotina.nome || 'Rotina de treino', LARGURA - 8)
  const altQuadro = 6 + alt(7.5) + nomeRotina.length * alt(15) + 3 + altInfo.reduce((a, b) => a + b, 0) + 2
  preencher(VERDE_CLARO)
  doc.roundedRect(M, y, LARGURA, altQuadro, 2.5, 2.5, 'F')
  preencher(VERDE)
  doc.rect(M, y, 1.6, altQuadro, 'F')
  let yq = y + 6
  fonte(7.5, 'bold')
  cor(VERDE)
  doc.text(d.tipo === 'treino' ? `FICHA DE TREINO · ${tituloFicha(d).toUpperCase()}` : 'ROTINA COMPLETA', M + 5, yq)
  yq += alt(7.5) - 1
  fonte(15, 'bold')
  cor(TEXTO)
  for (const l of nomeRotina) {
    doc.text(l, M + 5, yq + alt(15) * 0.78)
    yq += alt(15)
  }
  yq += 3
  for (let i = 0; i < infos.length; i += 2) {
    for (let j = 0; j < 2 && i + j < infos.length; j++) {
      const x = M + 5 + j * (colW + 2)
      fonte(7.5, 'bold')
      cor(CINZA)
      doc.text(infos[i + j].rotulo.toUpperCase(), x, yq + alt(7.5) * 0.78)
      fonte(10.5, 'bold')
      cor(TEXTO)
      linhasInfo[i + j].forEach((l, k) => doc.text(l, x, yq + alt(7.5) + alt(10.5) * (k + 0.78)))
    }
    yq += altInfo[i / 2]
  }
  y += altQuadro + 6

  // ---------- Orientações gerais ----------
  if (d.orientacoes.length) {
    garantir(20)
    fonte(11.5, 'bold')
    cor(TEXTO)
    doc.text('Orientações gerais', M, y + alt() * 0.78)
    y += alt() + 1.5
    for (const o of d.orientacoes) {
      fonte(9.5)
      const linhas = quebrar(o.texto, LARGURA - 6)
      const h = alt(7.5) + linhas.length * alt(9.5) + 1.5
      garantir(Math.min(h, 40))
      preencher(VERDE)
      doc.circle(M + 1.3, y + 2.2, 0.9, 'F')
      fonte(7.5, 'bold')
      cor(VERDE)
      doc.text(o.rotulo.toUpperCase(), M + 5, y + alt(7.5) * 0.78)
      y += alt(7.5)
      fonte(9.5)
      cor(TEXTO)
      paragrafo(o.texto, M + 5, LARGURA - 6)
      y += 1.5
    }
    y += 3
  }

  // ---------- Treinos ----------
  /** Faixa escura com a letra do treino. */
  const cabecalhoTreino = (t: TreinoPdf, continua = false) => {
    fonte(9)
    const foco = [t.foco, continua ? 'continuação' : `${t.exercicios.length} exercício${t.exercicios.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
    const h = 15
    garantir(h + 30)
    preencher(FUNDO_MARCA)
    doc.roundedRect(M, y, LARGURA, h, 2.5, 2.5, 'F')
    preencher(MARCA)
    doc.roundedRect(M + 2.5, y + 2.5, 10, 10, 2, 2, 'F')
    fonte(15, 'bold')
    doc.setTextColor(FUNDO_MARCA[0], FUNDO_MARCA[1], FUNDO_MARCA[2])
    doc.text(t.letra, M + 7.5, y + 9.8, { align: 'center' })
    fonte(12, 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(quebrar(t.nome || `Treino ${t.letra}`, LARGURA - 22)[0], M + 16, y + 6.6)
    fonte(8.5)
    doc.setTextColor(170, 196, 210)
    doc.text(quebrar(foco, LARGURA - 22)[0] ?? '', M + 16, y + 11.6)
    y += h + 4
  }

  /** Cartão de um exercício. Nunca é cortado entre duas páginas. */
  const cartaoExercicio = (t: TreinoPdf, e: ExercicioPdf, n: number) => {
    const comFoto = !!e.imagem
    const xT = M + 11 + (comFoto ? FOTO + 4 : 0)
    const larguraT = A4.w - M - 3 - xT
    // Mede antes de desenhar.
    fonte(11, 'bold')
    const nome = quebrar(e.nome, larguraT)
    let hT = nome.length * alt(11) + 1
    const blocos = e.linhas.map(linhaPdf)
    const medidas = blocos.map((b) => {
      if ('frase' in b) {
        fonte(9, 'normal')
        const l = quebrar(`${b.frase.rotulo}: ${b.frase.valor}`, larguraT)
        return { h: l.length * alt(9) + 1.2, l }
      }
      const porLinha = Math.min(4, Math.max(1, b.campos.length))
      const cw = larguraT / porLinha
      fonte(10.5, 'bold')
      const vals = b.campos.map((c) => quebrar(c.valor, cw - 2))
      let h = 0
      for (let i = 0; i < b.campos.length; i += porLinha) h += alt(7) + Math.max(...vals.slice(i, i + porLinha).map((v) => v.length)) * alt(10.5) + 1
      return { h: h + 1, vals, cw, porLinha }
    })
    hT += medidas.reduce((a, m) => a + m.h, 0)
    if (e.video) hT += alt(8.5) + 0.5
    const h = Math.max(hT, comFoto ? FOTO : 0, 9) + 6
    if (y + h > BASE) {
      novaPagina()
      cabecalhoTreino(t, true)
    }
    traco(CINZA_CLARO, 0.3)
    preencher([255, 255, 255])
    doc.roundedRect(M, y, LARGURA, h, 2, 2, 'FD')
    // Número.
    preencher(VERDE)
    doc.circle(M + 5.5, y + 6, 3.2, 'F')
    fonte(9, 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(String(n), M + 5.5, y + 7.2, { align: 'center' })
    // Foto.
    if (e.imagem) {
      const f = e.imagem
      const x0 = M + 11
      const y0 = y + 3
      preencher([244, 247, 249])
      doc.roundedRect(x0, y0, FOTO, FOTO, 1.5, 1.5, 'F')
      const escala = Math.min(FOTO / f.width, FOTO / f.height)
      const fw = f.width * escala
      const fh = f.height * escala
      doc.addImage(f.image, formato(f.image), x0 + (FOTO - fw) / 2, y0 + (FOTO - fh) / 2, fw, fh)
    }
    let yy = y + 3
    fonte(11, 'bold')
    cor(TEXTO)
    for (const l of nome) {
      doc.text(l, xT, yy + alt(11) * 0.78)
      yy += alt(11)
    }
    yy += 1
    blocos.forEach((b, i) => {
      const m = medidas[i]
      if ('frase' in b) {
        fonte(9, 'italic')
        cor(CINZA)
        m.l!.forEach((l, k) => {
          if (k === 0) {
            fonte(9, 'bolditalic')
            const rot = `${b.frase.rotulo}: `
            const largRot = doc.getTextWidth(rot)
            doc.text(rot, xT, yy + alt(9) * 0.78)
            fonte(9, 'italic')
            doc.text(l.slice(rot.length).trimStart(), xT + largRot, yy + alt(9) * 0.78)
          } else doc.text(l, xT, yy + alt(9) * 0.78)
          yy += alt(9)
        })
        yy += 1.2
        return
      }
      for (let k = 0; k < b.campos.length; k += m.porLinha!) {
        const grupo = b.campos.slice(k, k + m.porLinha!)
        const altVal = Math.max(...m.vals!.slice(k, k + m.porLinha!).map((v) => v.length)) * alt(10.5)
        grupo.forEach((c, j) => {
          const x = xT + j * m.cw!
          fonte(7, 'bold')
          cor(CINZA)
          doc.text(c.rotulo.toUpperCase(), x, yy + alt(7) * 0.78)
          fonte(10.5, 'bold')
          cor(TEXTO)
          m.vals![k + j].forEach((v, z) => doc.text(v, x, yy + alt(7) + alt(10.5) * (z + 0.78)))
        })
        yy += alt(7) + altVal + 1
      }
      yy += 1
    })
    if (e.video) {
      fonte(8.5, 'bold')
      cor(VERDE)
      doc.textWithLink('Ver vídeo de como fazer', xT, yy + alt(8.5) * 0.78, { url: e.video })
    }
    y += h + 2.5
  }

  d.treinos.forEach((t, i) => {
    // Na rotina, cada treino começa numa página nova (dá para imprimir só o do dia).
    if (i > 0) novaPagina()
    else garantir(60)
    cabecalhoTreino(t)
    if (!t.exercicios.length) {
      fonte(10, 'italic')
      cor(CINZA)
      paragrafo('Treino sem exercícios.')
    }
    t.exercicios.forEach((e, n) => cartaoExercicio(t, e, n + 1))
    y += 3
  })

  // ---------- Aeróbico ----------
  if (d.aerobicos.length) {
    garantir(24)
    fonte(11.5, 'bold')
    cor(TEXTO)
    doc.text('Aeróbico', M, y + alt() * 0.78)
    y += alt() + 1.5
    for (const a of d.aerobicos) {
      garantir(12)
      fonte(10, 'bold')
      cor(TEXTO)
      paragrafo(a.titulo)
      fonte(9.5)
      cor(CINZA)
      if (a.texto) paragrafo(a.texto)
      if (a.obs) paragrafo(a.obs)
      y += 2
    }
    y += 2
  }

  // ---------- Observações e assinatura ----------
  if (d.observacoes.trim()) {
    fonte(9.5)
    const linhas = quebrar(d.observacoes, LARGURA - 8)
    const h = Math.min(linhas.length * alt(9.5) + alt(11.5) + 7, BASE - TOPO_CONTINUA)
    garantir(h)
    traco(VERDE, 0.4)
    doc.roundedRect(M, y, LARGURA, h, 2, 2, 'S')
    y += 3
    fonte(11.5, 'bold')
    cor(TEXTO)
    doc.text('Observações do personal', M + 4, y + alt() * 0.78)
    y += alt() + 1
    fonte(9.5)
    paragrafo(d.observacoes, M + 4, LARGURA - 8)
    y += 6
  }

  garantir(26)
  y += 14
  traco(CINZA, 0.3)
  doc.line(A4.w / 2 - 40, y, A4.w / 2 + 40, y)
  y += 4.5
  fonte(10, 'bold')
  cor(TEXTO)
  doc.text(p.nome || 'Personal responsável', A4.w / 2, y, { align: 'center' })
  if (p.registro) {
    y += 4.5
    fonte(8.5)
    cor(CINZA)
    doc.text(p.registro, A4.w / 2, y, { align: 'center' })
  }

  // ---------- Topo das páginas seguintes e rodapé ----------
  const total = doc.getNumberOfPages()
  const gerado = `${String(d.geradoEm.getDate()).padStart(2, '0')}/${String(d.geradoEm.getMonth() + 1).padStart(2, '0')}/${d.geradoEm.getFullYear()}`
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    if (i > 1) {
      desenharSimbolo(doc, M, 8, 6)
      fonte(9, 'bold')
      cor(TEXTO)
      doc.text('Forma', M + 7.5, 12.2)
      doc.setTextColor(VERDE[0], VERDE[1], VERDE[2])
      doc.text('Certa', M + 7.5 + doc.getTextWidth('Forma'), 12.2)
      fonte(8.5)
      cor(CINZA)
      doc.text(quebrar(`${d.aluno} · ${d.rotina.nome}`, LARGURA - 40)[0] ?? '', A4.w - M, 12.2, { align: 'right' })
      traco(CINZA_CLARO, 0.3)
      doc.line(M, 15.5, A4.w - M, 15.5)
    }
    traco(MARCA, 0.6)
    doc.line(M, A4.h - 14, A4.w - M, A4.h - 14)
    desenharSimbolo(doc, M, A4.h - 12.2, 4.5)
    fonte(7.5)
    cor(CINZA)
    const rodape = `Ficha de treino feita com o FormaCerta · ${p.nome ? `${p.nome} · ` : ''}gerada em ${gerado}`
    doc.text(quebrar(rodape, LARGURA - 30)[0], M + 6, A4.h - 9)
    doc.text(`Página ${i} de ${total}`, A4.w - M, A4.h - 9, { align: 'right' })
  }

  return { pdf: doc.output('blob'), paginas: total }
}

/** Rótulo e texto de linha antigos ou novos lidos do exercício guardado. */
export function exercicioPdf(ex: { nome: string; series?: string; reps?: string; obs?: string; linhas?: LinhaSerie[] }, extra: Pick<ExercicioPdf, 'imagem' | 'video'> = {}): ExercicioPdf {
  return { nome: ex.nome, linhas: linhasDoExercicio(ex), ...extra }
}
