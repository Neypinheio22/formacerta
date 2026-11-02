// Fotos dos exercícios para a ficha em PDF: a foto que o personal cadastrou,
// um quadro do vídeo dele ou a miniatura do vídeo do YouTube. Tudo reduzido
// para JPEG (o PDF fica leve e nítido). O que não abrir fica sem foto.

import { enderecoMidia } from '../nuvem/exercicios'
import type { Imagem } from '../relatorio/pdf'
import { idYoutube, type ExercicioProprio } from './comoFazer'

const LADO = 520
const ESPERA = 9000

function comPrazo<T>(p: Promise<T>, ms = ESPERA): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))])
}

/** Desenha numa tela com fundo branco e devolve em JPEG. */
function paraJpeg(fonte: CanvasImageSource, largura: number, altura: number, lado = LADO): Imagem | null {
  if (!largura || !altura) return null
  const escala = Math.min(1, lado / Math.max(largura, altura))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(largura * escala))
  canvas.height = Math.max(1, Math.round(altura * escala))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height)
  try {
    return { image: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

/** Baixa a imagem (precisa de CORS) e reduz. */
export async function imagemDeEndereco(url: string, lado = LADO, png = false): Promise<Imagem | null> {
  try {
    const r = await comPrazo(fetch(url, { mode: 'cors' }))
    if (!r || !r.ok) return null
    const blob = await r.blob()
    const local = URL.createObjectURL(blob)
    try {
      const img = await comPrazo(
        new Promise<HTMLImageElement>((ok, falha) => {
          const i = new Image()
          i.onload = () => ok(i)
          i.onerror = falha
          i.src = local
        }),
      )
      if (!img) return null
      if (!png) return paraJpeg(img, img.naturalWidth, img.naturalHeight, lado)
      // Logo: PNG para manter o fundo transparente.
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.naturalWidth * escala))
      c.height = Math.max(1, Math.round(img.naturalHeight * escala))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      return { image: c.toDataURL('image/png'), width: c.width, height: c.height }
    } finally {
      URL.revokeObjectURL(local)
    }
  } catch {
    return null
  }
}

/** Um quadro do começo do vídeo do personal. */
function quadroDoVideo(url: string): Promise<Imagem | null> {
  return comPrazo(
    new Promise<Imagem | null>((ok) => {
      const v = document.createElement('video')
      v.crossOrigin = 'anonymous'
      v.muted = true
      v.playsInline = true
      v.preload = 'auto'
      v.onloadedmetadata = () => {
        v.currentTime = Math.min(1, (v.duration || 2) / 2)
      }
      v.onseeked = () => ok(paraJpeg(v, v.videoWidth, v.videoHeight))
      v.onerror = () => ok(null)
      v.src = url
    }),
  ).then((x) => x ?? null)
}

const guardadas = new Map<string, Promise<Imagem | null>>()

/** Foto do exercício para o PDF, ou null se não tiver (ou não abrir). */
export function imagemDoExercicio(m: ExercicioProprio | undefined): Promise<Imagem | null> {
  if (!m?.tipo) return Promise.resolve(null)
  const chave = `${m.id}:${m.arquivo ?? m.link}`
  let p = guardadas.get(chave)
  if (!p) {
    p = (async () => {
      if (m.tipo === 'link') {
        const id = m.link ? idYoutube(m.link) : null
        return id ? imagemDeEndereco(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`) : null
      }
      const url = await enderecoMidia(m)
      if (!url) return null
      return m.tipo === 'imagem' ? imagemDeEndereco(url) : quadroDoVideo(url)
    })().catch(() => null)
    guardadas.set(chave, p)
    // Falhou: tenta de novo na próxima vez.
    p.then((x) => {
      if (!x) guardadas.delete(chave)
    })
  }
  return p
}

/** Endereço do vídeo de como fazer para virar link no PDF. */
export function videoDoExercicio(m: ExercicioProprio | undefined): string | null {
  if (m?.tipo === 'link' && m.link && /^https:\/\//i.test(m.link)) return m.link
  return null
}
