// Desenhos de como fazer cada teste, para o aluno usar como referência.
// Feitos em SVG para ficarem nítidos em qualquer tela e não pesarem no app.
// A pessoa é montada por articulações (tornozelo, joelho, quadril, ombro…) com membros
// afinando nas pontas, roupa e sombra, para parecer um corpo de verdade e não um boneco de palito.
// Quando o passo tem `foto` (arquivo em public/como-fazer/), a foto aparece no lugar do desenho;
// se a foto não carregar, volta o desenho.

import { useState } from 'react'

type Passo = { titulo: string; texto: string; desenho: React.ReactNode; foto?: string; errado?: boolean }
type P = [number, number]

const PELE = '#e2ad86'
const PELE_SOMBRA = '#b9805b'
const CAMISA = '#2ee88a'
const CAMISA_SOMBRA = '#1fae67'
const SHORT = '#2b4258'
const SHORT_SOMBRA = '#1c2d3d'
const CABELO = '#3b2a20'
const TENIS = '#eef3f6'
const TENIS_SOLA = '#8a99a5'
const CHAO = '#2a4a5e'
const DESTAQUE = '#fb8d1a'
const VERMELHO = '#ff5a5f'
const CHAO_Y = 150

const rad = (g: number) => (g * Math.PI) / 180
const soma = (a: P, ang: number, comp: number): P => [a[0] + Math.sin(rad(ang)) * comp, a[1] - Math.cos(rad(ang)) * comp]
const desce = (a: P, ang: number, comp: number): P => [a[0] + Math.sin(rad(ang)) * comp, a[1] + Math.cos(rad(ang)) * comp]
const n = (v: number) => Math.round(v * 10) / 10

/** Membro de a até b, com raio ra numa ponta e rb na outra (afina como um braço ou perna). */
function Segmento({ a, b, ra, rb, cor }: { a: P; b: P; ra: number; rb: number; cor: string }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = Math.hypot(dx, dy) || 1
  const nx = -dy / L
  const ny = dx / L
  const d = [
    `M${n(a[0] + nx * ra)} ${n(a[1] + ny * ra)}`,
    `L${n(b[0] + nx * rb)} ${n(b[1] + ny * rb)}`,
    `A${rb} ${rb} 0 0 0 ${n(b[0] - nx * rb)} ${n(b[1] - ny * rb)}`,
    `L${n(a[0] - nx * ra)} ${n(a[1] - ny * ra)}`,
    `A${ra} ${ra} 0 0 0 ${n(a[0] + nx * ra)} ${n(a[1] + ny * ra)}`,
    'Z',
  ].join(' ')
  return <path d={d} fill={cor} />
}

function Quadro({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 300 170" className="ilustracao" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="fundo-ilustracao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b2536" />
          <stop offset="1" stopColor="#071a28" />
        </linearGradient>
        <marker id="ponta" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={DESTAQUE} />
        </marker>
      </defs>
      <rect width="300" height="170" fill="url(#fundo-ilustracao)" />
      <rect y={CHAO_Y} width="300" height="20" fill="#06141f" />
      <line x1="0" y1={CHAO_Y} x2="300" y2={CHAO_Y} stroke={CHAO} strokeWidth="2" />
      {children}
    </svg>
  )
}

function Seta({ d }: { d: string }) {
  return <path d={d} stroke={DESTAQUE} strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#ponta)" />
}

function Tenis({ tornozelo, sombra }: { tornozelo: P; sombra?: boolean }) {
  const [x, y] = tornozelo
  return (
    <g>
      <path
        d={`M${x - 6} ${y - 3} Q${x - 1} ${y - 6} ${x + 4} ${y - 2} Q${x + 13} ${y} ${x + 17} ${CHAO_Y - 3} Q${x + 18} ${CHAO_Y} ${x + 14} ${CHAO_Y} L${x - 6} ${CHAO_Y} Q${x - 8} ${CHAO_Y - 3} ${x - 6} ${y - 3} Z`}
        fill={sombra ? '#b8c4cc' : TENIS}
      />
      <rect x={x - 7} y={CHAO_Y - 2} width="25" height="2.5" rx="1.2" fill={TENIS_SOLA} />
    </g>
  )
}

type Pose = {
  /** Inclinação do tronco: 0 = em pé, 90 = na horizontal, mais que 90 = cabeça abaixo do quadril. */
  tronco: number
  /** Quanto o joelho dobrou, em graus (0 = esticado). */
  joelho?: number
  /** Inclinação da canela para trás (o quadril recua quando a pessoa se inclina). */
  canela?: number
  /** Ângulo do braço a partir da vertical para baixo (positivo = para a frente). */
  braco?: number
  cotovelo?: number
  cabeca?: number
  /** Costas à mostra (teste de Adams): tronco com pele e top. */
  costasDeFora?: boolean
  x?: number
}

/** Pessoa de lado, virada para a direita. Devolve o desenho e onde ficam as articulações. */
function juntas({ tronco, joelho = 0, canela = 0, braco = 0, cotovelo = 6, cabeca = 0, x = 150 }: Pose) {
  const tornozelo: P = [x, CHAO_Y - 7]
  const jo = soma(tornozelo, -canela, 34)
  const quadril = soma(jo, -canela - joelho, 34)
  const ombro = soma(quadril, tronco, 38)
  const pescoco = soma(ombro, tronco + cabeca * 0.5, 6)
  const cab = soma(ombro, tronco + cabeca, 15)
  const cotov = desce(ombro, braco, 23)
  const punho = desce(cotov, braco + cotovelo, 21)
  const mao = desce(punho, braco + cotovelo, 9)
  return { tornozelo, joelho: jo, quadril, ombro, pescoco, cabeca: cab, cotovelo: cotov, punho, mao }
}

function Perna({ q, j, t, sombra }: { q: P; j: P; t: P; sombra?: boolean }) {
  const pele = sombra ? PELE_SOMBRA : PELE
  const coxaShort = soma(q, Math.atan2(j[0] - q[0], q[1] - j[1]) * (180 / Math.PI), 14)
  return (
    <g>
      <Segmento a={j} b={t} ra={5.6} rb={3.6} cor={pele} />
      <Segmento a={j} b={[j[0] + (t[0] - j[0]) * 0.4 - 1.5, j[1] + (t[1] - j[1]) * 0.4]} ra={5.6} rb={6.2} cor={pele} />
      <Segmento a={q} b={j} ra={9} rb={5.8} cor={pele} />
      <Segmento a={q} b={coxaShort} ra={10.5} rb={9} cor={sombra ? SHORT_SOMBRA : SHORT} />
      <Tenis tornozelo={t} sombra={sombra} />
    </g>
  )
}

function Braco({ o, c, p, m, sombra }: { o: P; c: P; p: P; m: P; sombra?: boolean }) {
  const pele = sombra ? PELE_SOMBRA : PELE
  return (
    <g>
      <Segmento a={c} b={p} ra={3.8} rb={2.8} cor={pele} />
      <Segmento a={p} b={m} ra={3} rb={2.2} cor={pele} />
      <Segmento a={o} b={c} ra={5} rb={3.8} cor={pele} />
      <Segmento a={o} b={[o[0] + (c[0] - o[0]) * 0.4, o[1] + (c[1] - o[1]) * 0.4]} ra={6.2} rb={5.4} cor={sombra ? CAMISA_SOMBRA : CAMISA} />
    </g>
  )
}

/** Pessoa de lado, de bermuda, camiseta e tênis. */
function PessoaLado(pose: Pose) {
  const J = juntas(pose)
  const longe = (p: P): P => [p[0] + 4, p[1] - 1]
  const ang = pose.tronco + (pose.cabeca ?? 0)
  const nuca = soma(J.cabeca, ang - 100, 3)
  return (
    <g>
      <ellipse cx={J.tornozelo[0] + 4} cy={CHAO_Y + 1} rx="26" ry="3" fill="#000" opacity="0.35" />
      <Braco o={longe(J.ombro)} c={longe(J.cotovelo)} p={longe(J.punho)} m={longe(J.mao)} sombra />
      <Perna q={longe(J.quadril)} j={longe(J.joelho)} t={[J.tornozelo[0] + 4, J.tornozelo[1]]} sombra />
      <Perna q={J.quadril} j={J.joelho} t={J.tornozelo} />
      <Segmento a={J.ombro} b={J.pescoco} ra={4.4} rb={4} cor={PELE} />
      {pose.costasDeFora ? (
        <g>
          <Segmento a={J.quadril} b={J.ombro} ra={11} rb={11.5} cor={PELE} />
          <Segmento a={soma(J.quadril, pose.tronco, 20)} b={soma(J.quadril, pose.tronco, 32)} ra={11.4} rb={11.6} cor={CAMISA} />
          <Segmento a={J.quadril} b={soma(J.quadril, pose.tronco, 5)} ra={11.4} rb={11.2} cor={SHORT} />
        </g>
      ) : (
        <g>
          <Segmento a={J.quadril} b={J.ombro} ra={11.5} rb={12} cor={CAMISA} />
          <Segmento a={J.quadril} b={soma(J.quadril, pose.tronco, 5)} ra={11.6} rb={11.4} cor={SHORT} />
        </g>
      )}
      <circle cx={J.cabeca[0]} cy={J.cabeca[1]} r="8.6" fill={PELE} />
      <Segmento a={nuca} b={soma(J.cabeca, ang - 30, 4)} ra={7.8} rb={6.4} cor={CABELO} />
      <circle cx={soma(J.cabeca, ang - 90, 1)[0]} cy={soma(J.cabeca, ang - 90, 1)[1]} r="1.8" fill={PELE_SOMBRA} />
      <Braco o={J.ombro} c={J.cotovelo} p={J.punho} m={J.mao} />
    </g>
  )
}

/** Pessoa de costas, em pé, com as costas à mostra (teste de Adams). */
function PessoaCostas() {
  return (
    <g>
      <ellipse cx="150" cy={CHAO_Y + 1} rx="30" ry="3" fill="#000" opacity="0.35" />
      {[141, 159].map((x) => (
        <g key={x}>
          <Segmento a={[x + (x < 150 ? 2 : -2), 112]} b={[x, CHAO_Y - 8]} ra={5.8} rb={3.8} cor={PELE} />
          <Segmento a={[x + (x < 150 ? 2 : -2), 112]} b={[x, 126]} ra={5.8} rb={6.3} cor={PELE} />
          <Segmento a={[x + (x < 150 ? 1 : -1), 86]} b={[x + (x < 150 ? 2 : -2), 112]} ra={8.6} rb={5.8} cor={PELE} />
          <rect x={x - 7} y={CHAO_Y - 7} width="14" height="7" rx="3.5" fill={TENIS} />
          <rect x={x - 7.5} y={CHAO_Y - 2} width="15" height="2.5" rx="1.2" fill={TENIS_SOLA} />
        </g>
      ))}
      <path d="M131 80 Q150 76 169 80 L170 98 Q160 102 150 98 Q140 102 130 98 Z" fill={SHORT} />
      <line x1="150" y1="80" x2="150" y2="98" stroke={SHORT_SOMBRA} strokeWidth="1.5" />
      <path d="M126 46 Q150 38 174 46 Q177 52 171 62 Q167 72 169 82 L131 82 Q133 72 129 62 Q123 52 126 46 Z" fill={PELE} />
      <path d="M128 56 L172 56 L170 64 L130 64 Z" fill={CAMISA} />
      <line x1="150" y1="44" x2="150" y2="80" stroke={PELE_SOMBRA} strokeWidth="1.6" strokeDasharray="2 3" />
      <path d="M138 52 Q141 60 140 70 M162 52 Q159 60 160 70" stroke={PELE_SOMBRA} strokeWidth="1" fill="none" opacity="0.6" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <Segmento a={[150 + s * 24, 48]} b={[150 + s * 28, 74]} ra={5} rb={3.8} cor={PELE} />
          <Segmento a={[150 + s * 28, 74]} b={[150 + s * 29, 96]} ra={3.8} rb={2.8} cor={PELE} />
          <Segmento a={[150 + s * 29, 96]} b={[150 + s * 29, 105]} ra={3} rb={2.2} cor={PELE} />
        </g>
      ))}
      <Segmento a={[150, 44]} b={[150, 36]} ra={5} rb={4.6} cor={PELE} />
      <circle cx="150" cy="27" r="9.5" fill={CABELO} />
      <circle cx="150" cy="15" r="4.5" fill={CABELO} />
      <circle cx="140.6" cy="28" r="2" fill={PELE} />
      <circle cx="159.4" cy="28" r="2" fill={PELE} />
    </g>
  )
}

/** Pessoa curvada vista por trás, com um lado das costas mais alto (gibosidade). */
function PessoaCurvadaCostas() {
  return (
    <g>
      <ellipse cx="150" cy={CHAO_Y + 1} rx="30" ry="3" fill="#000" opacity="0.35" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <Segmento a={[150 + s * 30, 92]} b={[150 + s * 22, 118]} ra={4.6} rb={3.6} cor={PELE_SOMBRA} />
          <Segmento a={[150 + s * 22, 118]} b={[150 + s * 9, 136]} ra={3.6} rb={2.8} cor={PELE_SOMBRA} />
          <Segmento a={[150 + s * 9, 136]} b={[150 + s * 3, 143]} ra={3} rb={2.4} cor={PELE_SOMBRA} />
        </g>
      ))}
      {[141, 159].map((x) => (
        <g key={x}>
          <Segmento a={[x + (x < 150 ? 1 : -1), 114]} b={[x, CHAO_Y - 8]} ra={6} rb={3.8} cor={PELE} />
          <Segmento a={[x + (x < 150 ? 1 : -1), 114]} b={[x, 128]} ra={6} rb={6.4} cor={PELE} />
          <Segmento a={[x + (x < 150 ? 1 : -1), 94]} b={[x + (x < 150 ? 1 : -1), 114]} ra={9} rb={6} cor={PELE} />
          <rect x={x - 7} y={CHAO_Y - 7} width="14" height="7" rx="3.5" fill={TENIS} />
          <rect x={x - 7.5} y={CHAO_Y - 2} width="15" height="2.5" rx="1.2" fill={TENIS_SOLA} />
        </g>
      ))}
      <path d="M102 98 Q104 72 124 65 Q139 61 150 71 Q160 76 178 74 Q197 76 198 98 Q176 93 150 95 Q124 93 102 98 Z" fill={PELE} />
      <path d="M150 71 Q151 84 150 95" stroke={PELE_SOMBRA} strokeWidth="1.6" strokeDasharray="2 3" fill="none" />
      <path d="M118 74 Q126 70 134 74 M166 76 Q176 72 186 76" stroke={PELE_SOMBRA} strokeWidth="1.2" fill="none" opacity="0.6" />
      <path d="M128 92 Q150 86 172 92 L172 108 Q161 112 150 108 Q139 112 128 108 Z" fill={SHORT} />
      <line x1="150" y1="90" x2="150" y2="108" stroke={SHORT_SOMBRA} strokeWidth="1.5" />
    </g>
  )
}

/** Perna de lado, grande, com as alturas que o app usa para classificar. */
function PernaNiveis() {
  const niveis = [
    { y: 40, t: 'Muito limitada', c: VERMELHO, onde: 'acima do joelho' },
    { y: 70, t: 'Limitada', c: DESTAQUE, onde: 'joelho' },
    { y: 104, t: 'Moderada', c: '#f5c518', onde: 'canela' },
    { y: 136, t: 'Boa', c: CAMISA, onde: 'tornozelo' },
    { y: 158, t: 'Excelente', c: CAMISA, onde: 'palma no chão' },
  ]
  return (
    <g>
      <Segmento a={[92, 70]} b={[94, 136]} ra={9} rb={5.4} cor={PELE} />
      <Segmento a={[92, 70]} b={[89, 98]} ra={9} rb={10.5} cor={PELE} />
      <Segmento a={[90, 4]} b={[92, 70]} ra={15} rb={9} cor={PELE} />
      <Segmento a={[90, -8]} b={[90, 24]} ra={17} rb={15} cor={SHORT} />
      <circle cx="98" cy="70" r="3" fill={PELE_SOMBRA} opacity="0.6" />
      <path d="M84 132 Q92 128 100 134 Q116 138 122 145 Q123 150 118 150 L84 150 Q80 146 84 132 Z" fill={TENIS} />
      <rect x="82" y="147.5" width="42" height="3" rx="1.5" fill={TENIS_SOLA} />
      {niveis.map((v) => (
        <g key={v.t}>
          <line x1="112" y1={v.y} x2="150" y2={v.y} stroke={v.c} strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="112" cy={v.y} r="3.5" fill={v.c} />
          <text x="156" y={v.y + 1} fill={v.c} fontSize="12" fontWeight="700">
            {v.t}
          </text>
          <text x="156" y={v.y + 11} fill="#9fb3c2" fontSize="8.5">
            {v.onde}
          </text>
        </g>
      ))}
    </g>
  )
}

function Celular({ x, y, ate }: { x: number; y: number; ate: number }) {
  return (
    <g>
      <rect x={x} y={y} width="16" height="28" rx="3" fill="#0d2233" stroke={CAMISA} strokeWidth="2" />
      <circle cx={x + 8} cy={y + 5} r="2" fill={CAMISA} />
      <line x1={x + 20} y1={y + 14} x2={ate} y2={y + 14} stroke={CAMISA} strokeWidth="1.5" strokeDasharray="4 4" />
    </g>
  )
}

const FLEX: Passo[] = [
  {
    titulo: '1. Posição inicial',
    texto: 'Em pé, de lado para o celular. Pés afastados na largura do quadril, joelhos esticados e braços soltos.',
    desenho: (
      <Quadro>
        <PessoaLado tronco={2} braco={2} cotovelo={4} />
      </Quadro>
    ),
  },
  {
    titulo: '2. Execução',
    texto: 'Incline o tronco à frente devagar, sem dobrar os joelhos. Os braços descem soltos em direção ao chão.',
    desenho: (
      <Quadro>
        <PessoaLado tronco={50} canela={4} braco={8} cotovelo={4} cabeca={10} />
        <Seta d="M168 24 Q214 28 220 68" />
      </Quadro>
    ),
  },
  {
    titulo: '3. Posição final',
    texto: 'Vá até o limite confortável, sem balançar nem forçar. Segure e tire a foto de lado, com os pés aparecendo.',
    desenho: (
      <Quadro>
        <Celular x={22} y={72} ate={112} />
        <PessoaLado tronco={112} canela={8} braco={-6} cotovelo={2} cabeca={6} x={156} />
      </Quadro>
    ),
  },
  {
    titulo: '4. Onde as mãos chegam',
    texto: 'O app compara a ponta dos dedos com o joelho, a canela, o tornozelo e o chão e classifica sozinho.',
    desenho: (
      <Quadro>
        <PernaNiveis />
      </Quadro>
    ),
  },
  {
    titulo: 'Não vale: joelho dobrado',
    texto: 'Se os joelhos dobrarem, a medida não vale. O app avisa: repita com as pernas esticadas.',
    errado: true,
    desenho: (
      <Quadro>
        <PessoaLado tronco={100} canela={-26} joelho={60} braco={-4} cotovelo={2} cabeca={6} x={150} />
        <circle cx={juntas({ tronco: 100, canela: -26, joelho: 60, x: 150 }).joelho[0]} cy={juntas({ tronco: 100, canela: -26, joelho: 60, x: 150 }).joelho[1]} r="15" fill="none" stroke={VERMELHO} strokeWidth="3" />
      </Quadro>
    ),
  },
]

const ADAMS: Passo[] = [
  {
    titulo: '1. Em pé, de costas',
    texto: 'Costas à mostra ou roupa justa, cabelo preso. Pés juntos, joelhos esticados e braços soltos.',
    desenho: (
      <Quadro>
        <PessoaCostas />
      </Quadro>
    ),
  },
  {
    titulo: '2. Incline o tronco',
    texto: 'Curve o tronco para frente até as costas ficarem quase na horizontal. Braços soltos e palmas unidas.',
    desenho: (
      <Quadro>
        <PessoaLado tronco={92} canela={6} braco={0} cotovelo={0} cabeca={14} costasDeFora x={130} />
        <Seta d="M134 30 Q176 26 188 62" />
        <Celular x={262} y={62} ate={214} />
      </Quadro>
    ),
  },
  {
    titulo: '3. Compare os dois lados',
    texto: 'Olhando as costas por trás, na horizontal: um lado mais alto (gibosidade) é sinal para avaliar.',
    desenho: (
      <Quadro>
        <PessoaCurvadaCostas />
        <line x1="96" y1="65" x2="214" y2="65" stroke="#9fb3c2" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d="M122 58 L122 40" stroke={DESTAQUE} strokeWidth="2.5" strokeLinecap="round" />
        <text x="122" y="34" textAnchor="middle" fill={DESTAQUE} fontSize="12" fontWeight="700">
          lado mais alto
        </text>
      </Quadro>
    ),
  },
]

function Imagem({ passo }: { passo: Passo }) {
  const [falhou, setFalhou] = useState(false)
  if (!passo.foto || falhou) return <>{passo.desenho}</>
  return (
    <img
      className="ilustracao ilustracao-foto"
      src={`${import.meta.env.BASE_URL}como-fazer/${passo.foto}`}
      alt={passo.titulo}
      loading="lazy"
      onError={() => setFalhou(true)}
    />
  )
}

function ComoFazer({ passos, titulo }: { passos: Passo[]; titulo: string }) {
  return (
    <section className="cartao como-fazer">
      <h2>{titulo}</h2>
      <div className="como-fazer-passos">
        {passos.map((p) => (
          <figure key={p.titulo} className={p.errado ? 'errado' : ''}>
            <Imagem passo={p} />
            <figcaption>
              <strong>{p.titulo}</strong>
              <span>{p.texto}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export const ComoFazerFlex = () => <ComoFazer titulo="Como fazer o teste" passos={FLEX} />

export const ComoFazerAdams = () => <ComoFazer titulo="Como fazer o teste" passos={ADAMS} />
