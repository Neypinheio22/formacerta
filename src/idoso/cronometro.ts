// Cronômetro dos testes e link dos vídeos explicativos.

import { useEffect, useRef, useState } from 'react'
import { speak as falar } from '../voz'

/** Link do YouTube vira endereço de vídeo embutido. */
export function embutirYoutube(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

/** Cronômetro: regressivo quando tem duração, progressivo quando não tem. */
export function useCronometro(duracao?: number, onFim?: () => void) {
  const [passado, setPassado] = useState(0)
  const [rodando, setRodando] = useState(false)
  const inicio = useRef(0)
  const acumulado = useRef(0)
  const fim = useRef(onFim)
  useEffect(() => {
    fim.current = onFim
  })

  useEffect(() => {
    if (!rodando) return
    const t = setInterval(() => {
      const s = acumulado.current + (performance.now() - inicio.current) / 1000
      if (duracao && s >= duracao) {
        acumulado.current = duracao
        setPassado(duracao)
        setRodando(false)
        falar('Tempo!')
        navigator.vibrate?.([300, 100, 300])
        fim.current?.()
        return
      }
      setPassado(s)
    }, 100)
    return () => clearInterval(t)
  }, [rodando, duracao])

  return {
    passado,
    rodando,
    acabou: !!duracao && passado >= duracao,
    iniciar() {
      if (duracao && passado >= duracao) return
      if (passado === 0) falar('Já!')
      inicio.current = performance.now()
      setRodando(true)
    },
    pausar() {
      acumulado.current += (performance.now() - inicio.current) / 1000
      setPassado(acumulado.current)
      setRodando(false)
    },
    zerar() {
      acumulado.current = 0
      setPassado(0)
      setRodando(false)
    },
  }
}

