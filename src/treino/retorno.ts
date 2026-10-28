// Retorno do aluno ao terminar o treino: quanto tempo levou e como sentiu a
// intensidade. O personal usa para ver se o treino está longo demais ou se a
// intensidade está boa.

/** Minutos entre o início e o fim (null se faltar algum ou estiver trocado). */
export function minutos(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null
  const m = (new Date(fim).getTime() - new Date(inicio).getTime()) / 60000
  return Number.isFinite(m) && m >= 0 ? m : null
}

/** "45 min", "1 h 05 min", "0 min 6 s" (treino de poucos segundos). */
export function textoDuracao(min: number): string {
  if (min < 1) return `0 min ${Math.round(min * 60)} s`
  const total = Math.round(min)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Treinos acima de 4 h são esquecimento de concluir: não entram na média. */
const LIMITE_MIN = 240

/** Tempo médio dos treinos com início e fim. */
export function tempoMedio(feitos: { inicio?: string | null; fim?: string | null }[]): number | null {
  const ms = feitos.map((f) => minutos(f.inicio, f.fim)).filter((m): m is number => m !== null && m >= 1 && m <= LIMITE_MIN)
  return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null
}

/** Intensidade mais escolhida (empate: a mais recente, que vem primeiro na lista). */
export function intensidadeComum(feitos: { intensidade?: string | null }[]): string | null {
  const conta = new Map<string, number>()
  for (const f of feitos) if (f.intensidade) conta.set(f.intensidade, (conta.get(f.intensidade) ?? 0) + 1)
  let melhor: string | null = null
  for (const [k, n] of conta) if (melhor === null || n > conta.get(melhor)!) melhor = k
  return melhor
}
