import { useEffect, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import { meusDireitos, type Direitos } from '../../nuvem/planos'

// Uma consulta só para todas as telas; recarrega quando um pagamento é confirmado.
let guardado: { id: string; direitos: Direitos | null; promessa: Promise<Direitos | null> } | null = null
const ouvintes = new Set<() => void>()

function buscar(id: string) {
  const promessa = meusDireitos()
  guardado = { id, direitos: guardado?.id === id ? guardado.direitos : null, promessa }
  promessa.then((d) => {
    if (guardado?.promessa !== promessa) return
    guardado.direitos = d
    ouvintes.forEach((f) => f())
  })
}

/** Pede de novo ao banco (depois de pagar, mudar de plano ou criar aluno). */
export function recarregarDireitos() {
  if (guardado) buscar(guardado.id)
}

/** O que a pessoa pode usar. Vazio enquanto carrega ou se o banco não responde (aí nada é travado). */
export function useDireitos(perfil: Perfil | null): Direitos | null {
  const [, setVez] = useState(0)
  useEffect(() => {
    const f = () => setVez((v) => v + 1)
    ouvintes.add(f)
    return () => {
      ouvintes.delete(f)
    }
  }, [])
  useEffect(() => {
    if (perfil && guardado?.id !== perfil.id) buscar(perfil.id)
  }, [perfil])
  return perfil && guardado?.id === perfil.id ? guardado.direitos : null
}

/** Recurso do Aluno Pro travado para esta pessoa? Só trava com certeza: sem resposta do banco, libera. */
export const travadoNoPro = (perfil: Perfil | null, d: Direitos | null) => perfil?.papel === 'aluno' && !!d && d.travado && !d.pro
