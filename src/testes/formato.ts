import type { Status } from '../pose/types'

export const ROTULO_STATUS: Record<Status, string> = { ok: 'Adequado', atencao: 'Precisa melhorar', alerta: 'Atenção' }

export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export const numero = (v: number, casas = 1) => v.toFixed(casas).replace('.', ',')

/** Lê número digitado com vírgula ou ponto; vazio vira null. */
export function lerNumero(texto: string): number | null {
  const v = Number(texto.replace(',', '.'))
  return texto.trim() === '' || Number.isNaN(v) ? null : v
}
