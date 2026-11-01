import { useCallback, useEffect, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import { corpoDaFicha, perfilTreino, ajustarSerie, type PerfilTreino } from '../../corpo/corpo'
import { idadeDe, type Ficha } from '../../nuvem/fichas'
import { listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { listarAerobicos, listarRotinas, listarTreinosDasRotinas, type Aerobico, type Rotina } from '../../nuvem/rotinas'
import { diasMarcados, listarFeitos, listarTreinos, minhaFicha, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { carregarSeries } from '../../treino/carga'
import { rotinaAtual } from '../../treino/rotinas'
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

/** Treinos da rotina que vale hoje. Banco sem as rotinas (SQL não rodado): todos os treinos da ficha. */
async function treinosDaRotina(fichaId: string): Promise<{ treinos: Treino[]; rotina: Rotina | null }> {
  const r = await listarRotinas(fichaId)
  if (r.semTabela) return { treinos: (await listarTreinos(fichaId)).treinos, rotina: null }
  const atual = rotinaAtual(r.rotinas)
  return { treinos: atual ? await listarTreinosDasRotinas([atual.id]) : [], rotina: atual }
}

/** Letra do último treino feito nesta rotina. Rotina nova começa pelo A. */
function ultimoDaRotina(feitos: TreinoFeito[], treinos: Treino[]): string | null {
  return feitos.find((f) => treinos.some((t) => t.id === f.treino_id))?.letra ?? null
}

/**
 * Ficha de treino do aluno logado, treinos feitos e a meta da semana. Conta
 * como dia treinado: treino concluído na ficha, dia marcado no aparelho ou
 * carga anotada no Diário de cargas.
 */
export function useMeuTreino(perfil: Perfil | null) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [rotina, setRotina] = useState<Rotina | null>(null)
  const [aerobicos, setAerobicos] = useState<Aerobico[]>([])
  const [feitos, setFeitos] = useState<TreinoFeito[]>([])
  const [medidas, setMedidas] = useState<ResultadoNuvem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [metaLocal, setMetaLocal] = useState(lerMetaLocal)
  const [versao, setVersao] = useState(0)

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let vivo = true
    async function buscar() {
      const f = perfil?.papel === 'aluno' ? await minhaFicha(perfil.id) : null
      const [t, fe, m, ae] = f
        ? await Promise.all([treinosDaRotina(f.id), listarFeitos(f.id), listarResultados({ fichaId: f.id, tipo: 'medidas' }), listarAerobicos(f.id)])
        : [{ treinos: [] as Treino[], rotina: null }, [] as TreinoFeito[], { lista: [] as ResultadoNuvem[] }, { lista: [] as Aerobico[] }]
      if (!vivo) return
      setFicha(f)
      setRotina(t.rotina)
      setAerobicos(ae.lista.filter((a) => a.situacao === 'ativa'))
      setMedidas(m.lista)
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
  // A série sugerida se ajusta ao corpo e ao objetivo do aluno (o treino do personal, não).
  const ajuste: PerfilTreino | null = sugerida && ficha ? perfilTreino(corpoDaFicha(ficha, medidas, idadeDe(ficha.nascimento)), ficha.objetivo) : null
  const lista = sugerida ? (ajuste ? ajustarSerie(SERIE_SUGERIDA, ajuste) : SERIE_SUGERIDA) : treinos
  const proximo = proximoTreino(lista, sugerida ? lerUltimaSugerida() : ultimoDaRotina(feitos, treinos))

  function mudarMetaLocal(n: number) {
    const v = Math.min(7, Math.max(1, n))
    gravarMetaLocal(v)
    setMetaLocal(v)
  }

  return { ficha, treinos, rotina, aerobicos, lista, sugerida, ajuste, feitos, carregando, feitosNaSemana, meta, metaDoPersonal, proximo, mudarMetaLocal, recarregar }
}
