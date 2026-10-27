import { Dumbbell, Home, LineChart, UserRound, Users, type LucideIcon } from 'lucide-react'

export type Aba = 'inicio' | 'treino' | 'evolucao' | 'alunos' | 'conta'

type Item = { aba: Aba; rotulo: string; Icone: LucideIcon }

/** Barra fixa embaixo nas telas principais. O aluno vê Evolução; o personal vê Alunos. */
export function BarraInferior({ atual, aluno, onIr }: { atual: Aba; aluno: boolean; onIr: (a: Aba) => void }) {
  const itens: Item[] = [
    { aba: 'inicio', rotulo: 'Início', Icone: Home },
    { aba: 'treino', rotulo: 'Treino', Icone: Dumbbell },
    aluno ? { aba: 'evolucao', rotulo: 'Evolução', Icone: LineChart } : { aba: 'alunos', rotulo: 'Alunos', Icone: Users },
    { aba: 'conta', rotulo: 'Conta', Icone: UserRound },
  ]
  return (
    <nav className="barra-inferior" aria-label="Menu principal">
      {itens.map(({ aba, rotulo, Icone }) => (
        <button key={aba} className={aba === atual ? 'ativo' : ''} aria-current={aba === atual ? 'page' : undefined} onClick={() => onIr(aba)}>
          <span className="barra-inferior-icone">
            <Icone size={20} strokeWidth={aba === atual ? 2.5 : 2} />
          </span>
          {rotulo}
        </button>
      ))}
    </nav>
  )
}
