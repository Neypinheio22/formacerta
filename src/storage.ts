import type { Assessment } from './pose/types'

const CHAVE = 'formacerta:avaliacoes'
const MAXIMO = 10

// Por enquanto o histórico fica só no aparelho. Quando o painel do personal
// existir, as avaliações passam a ser enviadas para o servidor.
export function loadAssessments(): Assessment[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as Assessment[]
  } catch {
    return []
  }
}

export function saveAssessment(a: Assessment): boolean {
  const lista = [a, ...loadAssessments().filter((x) => x.id !== a.id)].slice(0, MAXIMO)
  // Se o armazenamento encher, vai descartando as avaliações mais antigas.
  for (let n = lista.length; n > 0; n--) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, n)))
      return true
    } catch {
      /* tenta de novo com menos itens */
    }
  }
  return false
}

export function deleteAssessment(id: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(loadAssessments().filter((x) => x.id !== id)))
  } catch {
    /* ignora */
  }
}
