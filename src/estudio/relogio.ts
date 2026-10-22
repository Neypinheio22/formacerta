import type { VideoAngulo } from './tipos'

export type Amostra = { enviado: number; controle: number; recebido: number }

/**
 * Diferença entre o relógio do controle e o deste celular (ms), estilo NTP.
 * Usa a amostra de ida e volta mais rápida, que é a mais confiável.
 * relógio do controle ≈ relógio local + diferença.
 */
export function diferencaRelogio(amostras: Amostra[]): number {
  if (amostras.length === 0) return 0
  const melhor = amostras.reduce((a, b) => (b.recebido - b.enviado < a.recebido - a.enviado ? b : a))
  return melhor.controle - (melhor.enviado + melhor.recebido) / 2
}

/**
 * Alinha os vídeos numa linha do tempo comum: começa quando o último ângulo
 * começou a gravar e termina quando o primeiro parou.
 * desloca[i] = segundos a pular no vídeo i para ficar no instante zero.
 */
export function alinhar(videos: Pick<VideoAngulo, 'inicio' | 'duracao'>[]) {
  if (videos.length === 0) return { desloca: [], duracao: 0 }
  const comeco = Math.max(...videos.map((v) => v.inicio))
  const fim = Math.min(...videos.map((v) => v.inicio + v.duracao))
  return {
    desloca: videos.map((v) => (comeco - v.inicio) / 1000),
    duracao: Math.max(0, fim - comeco) / 1000,
  }
}

export function formatarTempo(s: number) {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
