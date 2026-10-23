import { useEffect, useState } from 'react'
import { drawSkeleton } from '../../pose/draw'
import type { Point } from '../../pose/types'

// Tornozelo, calcanhar e ponta do pé: na corrida a pisada importa.
const PES: [number, number][] = [
  [27, 29],
  [29, 31],
  [31, 27],
  [28, 30],
  [30, 32],
  [32, 28],
]

/** Esqueleto verde com os pés desenhados. */
export function desenharCorredor(ctx: CanvasRenderingContext2D, lm: Point[] | null, w: number, h: number) {
  if (!lm) {
    ctx.clearRect(0, 0, w, h)
    return
  }
  drawSkeleton(ctx, lm, w, h)
  const escala = Math.max(w, h) / 400
  ctx.lineWidth = 2.5 * escala
  ctx.strokeStyle = '#36F294'
  for (const [a, b] of PES) {
    ctx.beginPath()
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
    ctx.stroke()
  }
}

/**
 * Endereço local do vídeo. Criado e apagado no mesmo efeito: com useMemo, o
 * React em modo de desenvolvimento apagava o endereço antes de o vídeo carregar.
 */
export function useUrlDoArquivo(arquivo: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!arquivo) return
    const u = URL.createObjectURL(arquivo)
    setUrl(u)
    return () => {
      URL.revokeObjectURL(u)
      setUrl(null)
    }
  }, [arquivo])
  return url
}
