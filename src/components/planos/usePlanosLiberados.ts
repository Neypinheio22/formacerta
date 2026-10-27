import { useEffect, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import { planosLiberados } from '../../nuvem/planos'

/** Os planos ficam escondidos até o administrador liberar (ele e os testadores já veem). */
export function usePlanosLiberados(perfil: Perfil | null) {
  const [liberado, setLiberado] = useState(false)
  useEffect(() => {
    if (perfil) planosLiberados().then(setLiberado)
  }, [perfil])
  return perfil?.papel === 'admin' || liberado
}
