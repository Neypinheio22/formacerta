import { Dumbbell, Home, LineChart, MessagesSquare, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { contarNaoLidas } from '../nuvem/chat'
import { Logo } from './Logo'

export type Aba = 'inicio' | 'treino' | 'conversas' | 'evolucao' | 'alunos' | 'conta'

type Item = { aba: Aba; rotulo: string; Icone: LucideIcon }

/**
 * Barra fixa embaixo nas telas principais. O aluno vê Evolução; o personal vê Alunos. O Chat mostra quantas mensagens novas.
 * No computador (tela larga) ela vira um menu lateral à esquerda, que aparece também nas telas internas (`soComputador`).
 */
export function BarraInferior({ atual, aluno, onIr, soComputador = false }: { atual: Aba | null; aluno: boolean; onIr: (a: Aba) => void; soComputador?: boolean }) {
  const [novas, setNovas] = useState(0)
  useEffect(() => {
    let vivo = true
    const ler = () => contarNaoLidas().then((n) => vivo && setNovas(n))
    ler()
    const vez = setInterval(ler, 30000)
    return () => {
      vivo = false
      clearInterval(vez)
    }
  }, [atual])

  const itens: Item[] = [
    { aba: 'inicio', rotulo: 'Início', Icone: Home },
    { aba: 'treino', rotulo: 'Treino', Icone: Dumbbell },
    { aba: 'conversas', rotulo: 'Chat', Icone: MessagesSquare },
    aluno ? { aba: 'evolucao', rotulo: 'Evolução', Icone: LineChart } : { aba: 'alunos', rotulo: 'Alunos', Icone: Users },
    { aba: 'conta', rotulo: 'Conta', Icone: UserRound },
  ]
  return (
    <nav className={soComputador ? 'barra-inferior so-computador' : 'barra-inferior'} aria-label="Menu principal">
      <button className="barra-logo" aria-label="FormaCerta, ir para o início" onClick={() => onIr('inicio')}>
        <Logo size={22} />
      </button>
      {itens.map(({ aba, rotulo, Icone }) => (
        <button key={aba} className={aba === atual ? 'ativo' : ''} aria-current={aba === atual ? 'page' : undefined} onClick={() => onIr(aba)}>
          <span className="barra-inferior-icone">
            <Icone size={20} strokeWidth={aba === atual ? 2.5 : 2} />
            {aba === 'conversas' && novas > 0 && (
              <b className="selo-novas" aria-label={`${novas} mensagens novas`}>
                {novas > 9 ? '9+' : novas}
              </b>
            )}
          </span>
          {rotulo}
        </button>
      ))}
    </nav>
  )
}
