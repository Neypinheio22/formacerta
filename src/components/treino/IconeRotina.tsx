import { Bandage, BicepsFlexed, Dumbbell, Flame, Footprints, HeartPulse, PersonStanding, Target, Weight, type LucideIcon } from 'lucide-react'
import type { IconeRotina } from '../../treino/rotinas'

const DESENHOS: Record<IconeRotina, LucideIcon> = {
  geral: Dumbbell,
  superiores: BicepsFlexed,
  pernas: Footprints,
  core: Target,
  forca: Weight,
  emagrecer: Flame,
  cardio: HeartPulse,
  mobilidade: PersonStanding,
  reabilitacao: Bandage,
}

/** Ícone do grupo muscular ou objetivo da rotina, num círculo verde. */
export function IconeDaRotina({ id, size = 22 }: { id: string; size?: number }) {
  const Desenho = DESENHOS[id as IconeRotina] ?? Dumbbell
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
