import { useCallback, useEffect, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import type { Ficha } from '../../nuvem/fichas'
import { diasMarcados, listarFeitos, listarTreinos, minhaFicha, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { carregarSeries } from '../../treino/carga'
import { diasTreinadosNaSemana, proximoTreino } from '../../treino/semana'
import { SERIE_SUGERIDA } from '../../treino/sugerida'

const CHAVE_META = 'formacerta:meta-semana'
const CHAVE_ULTIMA_SUGERIDA = 'formacerta:ultima-sugerida'

function lerUltimaSugerida(): string | null {
  try {
    return localStorage.getItem(CHAVE_ULTIMA_SUGERIDA)
  } catch {
    return null
  }
}

export function gravarUltimaSugerida(letra: string) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_SUGERIDA, letra)
  } catch {
    // Sem espaço no aparelho: o próximo volta ao A.
  }
}

export function lerMetaLocal(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE_META))
    return n >= 1 && n <= 7 ? n : 3
  } catch {
    return 3
  }
}

export function gravarMetaLocal(n: number) {
  try {
    localStorage.setItem(CHAVE_META, String(n))
  } catch {
    // Sem espaço no aparelho: a meta volta ao padrão.
  }
}

/**
 * Ficha de treino do aluno logado, treinos feitos e a meta da semana. Conta
 * como dia treinado: treino concluído na ficha, dia marcado no aparelho ou
 * carga anotada no Diário de cargas.
 */
export function useMeuTreino(perfil: Perfil | null) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [feitos, setFeitos] = useState<TreinoFeito[]>([])
  const [carregando, setCarregando] = useState(true)
  const [metaLocal, setMetaLocal] = useState(lerMetaLocal)
  const [versao, setVersao] = useState(0)

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let vivo = true
    async function buscar() {
      const f = perfil?.papel === 'aluno' ? await minhaFicha(perfil.id) : null
      const [t, fe] = f ? await Promise.all([listarTreinos(f.id), listarFeitos(f.id)]) : [{ treinos: [] as Treino[] }, [] as TreinoFeito[]]
      if (!vivo) return
      setFicha(f)
      setTreinos(t.treinos)
      setFeitos(fe)
      setCarregando(false)
    }
    buscar()
    return () => {
      vivo = false
    }
  }, [perfil?.id, perfil?.papel, versao])

  const datas = [...feitos.map((f) => f.feito_em), ...diasMarcados(), ...carregarSeries().map((s) => s.date)]
  const feitosNaSemana = diasTreinadosNaSemana(datas)
  const metaDoPersonal = ficha?.treinos_semana ?? null
  const meta = metaDoPersonal ?? (treinos.length || metaLocal)
  // Sem treino do personal, o aluno segue a série sugerida pelo app (com aviso).
  const sugerida = perfil?.papel === 'aluno' && !carregando && !treinos.length
  const lista = sugerida ? SERIE_SUGERIDA : treinos
  const proximo = proximoTreino(lista, sugerida ? lerUltimaSugerida() : feitos[0]?.letra || null)

  function mudarMetaLocal(n: number) {
    const v = Math.min(7, Math.max(1, n))
    gravarMetaLocal(v)
    setMetaLocal(v)
  }

  return { ficha, treinos, lista, sugerida, feitos, carregando, feitosNaSemana, meta, metaDoPersonal, proximo, mudarMetaLocal, recarregar }
}
