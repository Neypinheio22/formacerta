import { Bandage, BicepsFlexed, Dumbbell, Footprints, HeartPulse, PersonStanding, Target, type LucideIcon } from 'lucide-react'
import { tipoDaRotina, type IconeRotina } from '../../treino/rotinas'

const DESENHOS: Record<IconeRotina, LucideIcon> = {
  geral: Dumbbell,
  superiores: BicepsFlexed,
  pernas: Footprints,
  core: Target,
  cardio: HeartPulse,
  mobilidade: PersonStanding,
  reabilitacao: Bandage,
}

/** Ícone do tipo de exercício da rotina, num círculo verde. Sem tipo: o que combina com o objetivo. */
export function IconeDaRotina({ id, objetivo = '', size = 22 }: { id: string; objetivo?: string; size?: number }) {
  const Desenho = DESENHOS[tipoDaRotina(id, objetivo)]
  return (
    <span className="rotina-icone" aria-hidden>
      <Desenho size={size} />
    </span>
  )
}

export function DesenhoIcone({ id, size = 18 }: { id: IconeRotina; size?: number }) {
  const Desenho = DESENHOS[id]
  return <Desenho size={size} />
}
