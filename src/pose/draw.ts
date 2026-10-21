import { LM, type Point } from './types'

export const CONEXOES: [number, number][] = [
  [LM.orelhaEsq, LM.ombroEsq],
  [LM.orelhaDir, LM.ombroDir],
  [LM.ombroEsq, LM.ombroDir],
  [LM.ombroEsq, LM.cotoveloEsq],
  [LM.cotoveloEsq, LM.punhoEsq],
  [LM.ombroDir, LM.cotoveloDir],
  [LM.cotoveloDir, LM.punhoDir],
  [LM.ombroEsq, LM.quadrilEsq],
  [LM.ombroDir, LM.quadrilDir],
  [LM.quadrilEsq, LM.quadrilDir],
  [LM.quadrilEsq, LM.joelhoEsq],
  [LM.joelhoEsq, LM.tornozeloEsq],
  [LM.quadrilDir, LM.joelhoDir],
  [LM.joelhoDir, LM.tornozeloDir],
]

export const PONTOS = [...new Set(CONEXOES.flat())]

const VISIVEL = 0.5

/** Desenha o esqueleto verde por cima do vídeo, como no folder do app. */
export function drawSkeleton(ctx: CanvasRenderingContext2D, lm: Point[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  const escala = Math.max(w, h) / 400
  ctx.lineCap = 'round'
  ctx.lineWidth = 3 * escala
  ctx.strokeStyle = '#36F294'
  ctx.shadowColor = '#36F294'
  ctx.shadowBlur = 8 * escala
  for (const [a, b] of CONEXOES) {
    if ((lm[a].visibility ?? 1) < VISIVEL || (lm[b].visibility ?? 1) < VISIVEL) continue
    ctx.beginPath()
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  for (const i of PONTOS) {
    if ((lm[i].visibility ?? 1) < VISIVEL) continue
    ctx.beginPath()
    ctx.arc(lm[i].x * w, lm[i].y * h, 4.5 * escala, 0, Math.PI * 2)
    ctx.fillStyle = '#36F294'
    ctx.fill()
    ctx.lineWidth = 1.5 * escala
    ctx.strokeStyle = '#020B16'
    ctx.stroke()
  }
}
