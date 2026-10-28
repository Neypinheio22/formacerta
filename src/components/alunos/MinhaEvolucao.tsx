import { useEffect, useState } from 'react'
import { listarFichas, type Ficha } from '../../nuvem/fichas'
import { FichaAluno } from './FichaAluno'

/** Tela do aluno: a própria ficha e os gráficos de evolução. Ele preenche os dados e anota as medidas. */
export function MinhaEvolucao({ meuId, nome, onVoltar }: { meuId: string; nome: string; onVoltar: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)

  useEffect(() => {
    listarFichas().then((r) => setFicha(r.fichas.find((f) => f.aluno_id === meuId) ?? null))
  }, [meuId])

  if (ficha === undefined) return <p className="carregando">Carregando…</p>
  return <FichaAluno ficha={ficha} meuId={meuId} podeEditar={false} souOAluno nome={nome} textoVoltar="Início" onVoltar={onVoltar} />
}
