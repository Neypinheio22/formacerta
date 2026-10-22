import type { Referencia } from './tipos'

// Os vídeos são grandes demais para o localStorage; ficam no IndexedDB do aparelho.
// Quando houver servidor, as referências passam a ser enviadas para a nuvem.
const BANCO = 'formacerta'
const TABELA = 'referencias'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const req = indexedDB.open(BANCO, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(TABELA, { keyPath: 'id' })
    req.onsuccess = () => ok(req.result)
    req.onerror = () => falha(req.error)
  })
}

async function transacao<T>(modo: IDBTransactionMode, faz: (t: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((ok, falha) => {
    const req = faz(db.transaction(TABELA, modo).objectStore(TABELA))
    req.onsuccess = () => ok(req.result)
    req.onerror = () => falha(req.error)
  }).finally(() => db.close()) as Promise<T>
}

export async function listarReferencias(): Promise<Referencia[]> {
  const todas = await transacao<Referencia[]>('readonly', (t) => t.getAll())
  return todas.sort((a, b) => b.data.localeCompare(a.data))
}

export function salvarReferencia(r: Referencia) {
  return transacao('readwrite', (t) => t.put(r))
}

export function apagarReferencia(id: string) {
  return transacao('readwrite', (t) => t.delete(id))
}
