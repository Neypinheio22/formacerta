import { useCallback, useEffect, useState } from 'react'
import { listarExercicios } from '../../nuvem/exercicios'
import type { ExercicioProprio } from '../../treino/comoFazer'

/** Exercícios cadastrados que a pessoa logada vê (os dela, os do personal dela e os do app). */
export function useExercicios(ativo = true) {
  const [lista, setLista] = useState<ExercicioProprio[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const recarregar = useCallback(async () => {
    if (!ativo) return
    const r = await listarExercicios()
    setLista(r.exercicios)
    setErro(r.erro)
  }, [ativo])
  useEffect(() => {
    recarregar()
  }, [recarregar])
  return { lista, erro, recarregar }
}
