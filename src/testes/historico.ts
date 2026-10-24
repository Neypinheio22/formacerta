// Histórico dos testes do personal (flexibilidade, Adams). Fica no aparelho, como as
// avaliações de postura, até o painel do personal ter servidor.

import type { Point } from '../pose/types'

export type Registro = { id: string; date: string; avaliado: string; observacoes: string }

export type FotoTeste = { image: string; width: number; height: number; landmarks: Point[] }

const MAXIMO = 60

export function carregar<T extends Registro>(chave: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(chave) ?? '[]') as T[]
  } catch {
    return []
  }
}

function tentar(chave: string, lista: unknown[]) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista))
    return true
  } catch {
    return false
  }
}

const semFoto = <T extends Registro>(r: T): T => ({ ...r, foto: undefined })

function gravar<T extends Registro>(chave: string, lista: T[]): boolean {
  lista = lista.slice(0, MAXIMO)
  if (tentar(chave, lista)) return true
  // Se o armazenamento encher, primeiro tira as fotos dos registros antigos
  // (os números e as observações ficam) e só depois descarta registros.
  for (const fotos of [10, 3, 0]) {
    if (tentar(chave, lista.map((r, i) => (i < fotos ? r : semFoto(r))))) return true
  }
  for (let n = lista.length - 1; n > 0; n--) {
    if (tentar(chave, lista.slice(0, n).map(semFoto))) return true
  }
  return lista.length === 0
}

export function salvar<T extends Registro>(chave: string, r: T): boolean {
  const lista = [r, ...carregar<T>(chave).filter((x) => x.id !== r.id)].sort((a, b) => b.date.localeCompare(a.date))
  return gravar(chave, lista)
}

export function atualizar<T extends Registro>(chave: string, id: string, mudancas: Partial<T>): boolean {
  return gravar(chave, carregar<T>(chave).map((r) => (r.id === id ? { ...r, ...mudancas } : r)))
}

/** Reduz a foto antes de guardar, para caber mais registros no aparelho. */
export function reduzirFoto(image: string, larguraMax = 480): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, larguraMax / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * escala)
      canvas.height = Math.round(img.naturalHeight * escala)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => resolve(image)
    img.src = image
  })
}

export function apagar(chave: string, id: string) {
  gravar(chave, carregar(chave).filter((x) => x.id !== id))
}

/** Nomes dos avaliados, do mais recente para o mais antigo. */
export function avaliados(lista: Registro[]): string[] {
  return [...new Set(lista.map((r) => r.avaliado.trim()).filter(Boolean))]
}

/** Registros de um avaliado, ignorando maiúsculas e espaços. */
export function doAvaliado<T extends Registro>(lista: T[], nome: string): T[] {
  const n = nome.trim().toLocaleLowerCase('pt-BR')
  return lista.filter((r) => r.avaliado.trim().toLocaleLowerCase('pt-BR') === n)
}
