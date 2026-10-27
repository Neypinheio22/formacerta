// Meta da semana, próximo treino da ficha e água do dia. As contas ficam aqui,
// separadas das telas, para dar para testar.

/** Dia no fuso do aparelho, AAAA-MM-DD. */
export function diaLocal(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Segunda-feira da semana (a semana começa na segunda, como na academia). */
export function inicioDaSemana(hoje = new Date()): Date {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** Quantos dias diferentes desta semana tiveram treino (dois treinos no mesmo dia contam um). */
export function diasTreinadosNaSemana(datas: (Date | string)[], hoje = new Date()): number {
  const inicio = diaLocal(inicioDaSemana(hoje))
  const fim = diaLocal(hoje)
  return new Set(datas.map(diaLocal).filter((d) => d >= inicio && d <= fim)).size
}

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const

/** Primeira letra livre para um treino novo (A, B, C...). */
export function proximaLetra(usadas: string[]): string | null {
  return LETRAS.find((l) => !usadas.includes(l)) ?? null
}

/**
 * Próximo treino da ficha: o que vem depois do último feito, em ordem de letra,
 * voltando para o A depois do último. Sem nenhum feito, começa pelo A.
 */
export function proximoTreino<T extends { letra: string }>(treinos: T[], ultimaLetra: string | null): T | null {
  const ordem = [...treinos].sort((a, b) => a.letra.localeCompare(b.letra))
  if (!ordem.length) return null
  if (!ultimaLetra) return ordem[0]
  return ordem.find((t) => t.letra > ultimaLetra) ?? ordem[0]
}

const semAcento = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim()

/** Acha o exercício do catálogo do vídeo pelo nome escrito pelo personal, para abrir a câmera direto nele. */
export function noCatalogo<T extends { nome: string }>(catalogo: T[], nome: string): T | undefined {
  const n = semAcento(nome)
  if (!n) return undefined
  return catalogo.find((c) => semAcento(c.nome) === n) ?? catalogo.find((c) => n.startsWith(semAcento(c.nome)))
}

// Água: copo de 250 ml; meta de 35 ml por kg, entre 1,5 e 4,5 litros.
export const COPO_ML = 250
export const META_AGUA_PADRAO = 2500

export function metaAguaPorPeso(kg: number | null): number {
  if (!kg || kg <= 0) return META_AGUA_PADRAO
  return Math.min(4500, Math.max(1500, Math.round((kg * 35) / 100) * 100))
}

export const litros = (ml: number) => `${(ml / 1000).toFixed(1).replace('.', ',')} L`
