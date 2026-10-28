/** Onde passar a fita: desenho do corpo com as linhas e a dica de cada medida. */

const DICAS: { nome: string; dica: string }[] = [
  { nome: 'Tórax', dica: 'Na linha dos mamilos, depois de soltar o ar.' },
  { nome: 'Braço', dica: 'No meio, entre o ombro e o cotovelo, com o braço solto.' },
  { nome: 'Antebraço', dica: 'Na parte mais grossa, logo abaixo do cotovelo.' },
  { nome: 'Abdômen', dica: 'Na altura do umbigo, barriga relaxada.' },
  { nome: 'Cintura', dica: 'Na parte mais fina, entre a última costela e o umbigo.' },
  { nome: 'Quadril', dica: 'Na parte mais larga do bumbum, pés juntos.' },
  { nome: 'Coxa', dica: 'No meio, entre a virilha e o joelho.' },
  { nome: 'Panturrilha', dica: 'Na parte mais grossa, em pé e sem apoiar o peso na ponta do pé.' },
]

// Linhas tracejadas sobre a silhueta (coordenadas do desenho de 120 x 240).
const LINHAS: { y: number; x1: number; x2: number; rotulo: string }[] = [
  { y: 62, x1: 38, x2: 82, rotulo: 'Tórax' },
  { y: 80, x1: 20, x2: 32, rotulo: 'Braço' },
  { y: 104, x1: 12, x2: 26, rotulo: 'Antebraço' },
  { y: 90, x1: 41, x2: 79, rotulo: 'Cintura' },
  { y: 104, x1: 40, x2: 80, rotulo: 'Abdômen' },
  { y: 122, x1: 37, x2: 83, rotulo: 'Quadril' },
  { y: 152, x1: 39, x2: 58, rotulo: 'Coxa' },
  { y: 196, x1: 43, x2: 56, rotulo: 'Panturrilha' },
]

export function ComoMedir() {
  return (
    <details className="como-medir">
      <summary>Como medir em casa</summary>
      <div className="como-medir-corpo">
        <svg viewBox="0 0 120 240" width="120" height="240" role="img" aria-label="Onde passar a fita métrica no corpo">
          <g fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" strokeLinejoin="round">
            <circle cx="60" cy="22" r="14" />
            <path d="M52 36 v8 M68 36 v8" />
            <path d="M40 46 Q60 40 80 46 L84 70 L82 94 L84 124 L80 138 L62 138 L60 128 L58 138 L40 138 L36 124 L38 94 L36 70 Z" />
            <path d="M40 48 L28 64 L20 96 L14 124 M80 48 L92 64 L100 96 L106 124" />
            <path d="M34 66 L26 96 L22 124 M86 66 L94 96 L98 124" />
            <path d="M40 138 L40 176 L44 230 L54 230 L56 176 L58 138 M80 138 L80 176 L76 230 L66 230 L64 176 L62 138" />
          </g>
          <g stroke="var(--verde, #2EE88A)" strokeWidth="2.5" strokeDasharray="4 3">
            {LINHAS.map((l) => (
              <line key={l.rotulo} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} />
            ))}
          </g>
        </svg>
        <ul>
          {DICAS.map((d) => (
            <li key={d.nome}>
              <b>{d.nome}:</b> {d.dica}
            </li>
          ))}
        </ul>
      </div>
      <p className="dica-sec">
        Fita justa na pele, sem apertar. Meça sempre do mesmo jeito: de manhã, em jejum, depois de ir ao banheiro e na mesma balança. Assim o gráfico mostra a evolução de verdade.
      </p>
    </details>
  )
}
