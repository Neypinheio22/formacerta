// Fundo de colmeia (hexágonos) da marca. A malha é fixa e não gasta bateria;
// na tela inicial alguns blocos acendem devagar, só com CSS.
const R = 34 // raio de cada hexágono, em px
const L = R * Math.sqrt(3) // distância entre centros na mesma fileira
const A = R * 1.5 // distância entre fileiras

function hexagono(x: number, y: number, r = R - 2) {
  const p = []
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i - Math.PI / 6
    p.push(`${(x + r * Math.cos(ang)).toFixed(1)},${(y + r * Math.sin(ang)).toFixed(1)}`)
  }
  return `M${p.join('L')}Z`
}

// Sempre os mesmos blocos acesos (sorteio com semente), para a tela não "pular".
function blocosAcesos() {
  const lista: { d: string; atraso: number; duracao: number }[] = []
  let s = 7
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  for (let lin = 0; lin < 24; lin++) {
    for (let col = 0; col < 12; col++) {
      if (rand() < 0.08) {
        lista.push({ d: hexagono(col * L + (lin % 2 ? L / 2 : 0), lin * A), atraso: rand() * -8, duracao: 5 + rand() * 5 })
      }
    }
  }
  return lista
}

const ACESOS = blocosAcesos()

export function FundoHex({ brilho = false }: { brilho?: boolean }) {
  if (brilho) {
    return (
      <svg className="fundo-hex brilho" aria-hidden="true">
        {ACESOS.map((h, i) => (
          <path key={i} d={h.d} style={{ animationDelay: `${h.atraso}s`, animationDuration: `${h.duracao}s` }} />
        ))}
      </svg>
    )
  }
  return (
    <svg className="fundo-hex" aria-hidden="true">
      <defs>
        <pattern id="colmeia" width={L} height={A * 2} patternUnits="userSpaceOnUse">
          <path d={[hexagono(0, 0), hexagono(L, 0), hexagono(L / 2, A), hexagono(0, A * 2), hexagono(L, A * 2)].join('')} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#colmeia)" />
    </svg>
  )
}
