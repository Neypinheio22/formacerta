import { useEffect, useState } from 'react'

/** Toque de chamada simples, feito pelo próprio navegador. */
export function useToque(tocando: boolean) {
  useEffect(() => {
    if (!tocando) return
    let ctx: AudioContext | null = null
    try {
      ctx = new AudioContext()
    } catch {
      ctx = null
    }
    const tocar = () => {
      navigator.vibrate?.([400, 200, 400])
      if (!ctx) return
      for (const [i, f] of [880, 660].entries()) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.value = f
        g.gain.value = 0.15
        o.connect(g).connect(ctx.destination)
        o.start(ctx.currentTime + i * 0.25)
        o.stop(ctx.currentTime + i * 0.25 + 0.2)
      }
    }
    tocar()
    const vez = setInterval(tocar, 1800)
    return () => {
      clearInterval(vez)
      ctx?.close()
    }
  }, [tocando])
}

export function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const vez = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(vez)
  }, [ativo])
  return agora
}
