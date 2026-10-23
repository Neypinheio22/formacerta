// Desenhos de como fazer cada teste, para o aluno usar como referência.
// Feitos em SVG para ficarem nítidos em qualquer tela e não pesarem no app.

type Passo = { titulo: string; texto: string; desenho: React.ReactNode; errado?: boolean }

const CORPO = '#d9e4ec'
const ROUPA = '#36f294'
const CHAO = '#2a4a5e'
const DESTAQUE = '#fb8d1a'

function Membro({ d, largura = 12, cor = CORPO }: { d: string; largura?: number; cor?: string }) {
  return <path d={d} stroke={cor} strokeWidth={largura} strokeLinecap="round" strokeLinejoin="round" fill="none" />
}

function Quadro({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 300 170" className="ilustracao" role="img" aria-hidden="true">
      <line x1="10" y1="150" x2="290" y2="150" stroke={CHAO} strokeWidth="3" strokeLinecap="round" />
      {children}
    </svg>
  )
}

/** Banco com a régua em cima; a marca dos pés fica na face do banco. */
function Banco() {
  return (
    <g>
      <rect x="226" y="104" width="62" height="46" rx="5" fill="#0d3247" stroke="#3d6680" strokeWidth="2" />
      <rect x="196" y="98" width="92" height="7" rx="2" fill="#9fb3c2" />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={200 + i * 9} y1="98" x2={200 + i * 9} y2={i % 5 === 0 ? 92 : 95} stroke="#9fb3c2" strokeWidth="1.5" />
      ))}
    </g>
  )
}

function Seta({ d }: { d: string }) {
  return (
    <g stroke={DESTAQUE} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} markerEnd="url(#ponta)" />
    </g>
  )
}

function Ponta() {
  return (
    <defs>
      <marker id="ponta" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={DESTAQUE} />
      </marker>
    </defs>
  )
}

const WELLS: Passo[] = [
  {
    titulo: '1. Posição inicial',
    texto: 'Sentado, descalço, com a sola dos pés encostada no banco. Joelhos esticados e uma mão sobre a outra.',
    desenho: (
      <Quadro>
        <Banco />
        <Membro d="M72 138 L222 138" largura={16} cor={ROUPA} />
        <Membro d="M224 140 L226 116" largura={9} />
        <Membro d="M72 134 L84 76" largura={22} cor={ROUPA} />
        <circle cx="90" cy="56" r="13" fill={CORPO} />
        <Membro d="M84 80 L150 92" largura={8} />
      </Quadro>
    ),
  },
  {
    titulo: '2. Alcance máximo',
    texto: 'Incline o tronco devagar e deslize as mãos sobre a régua o mais longe possível. Segure 2 segundos e leia a marca.',
    desenho: (
      <Quadro>
        <Ponta />
        <Banco />
        <Membro d="M72 138 L222 138" largura={16} cor={ROUPA} />
        <Membro d="M224 140 L226 116" largura={9} />
        <Membro d="M72 134 L148 98" largura={22} cor={ROUPA} />
        <circle cx="166" cy="100" r="13" fill={CORPO} />
        <Membro d="M146 100 L238 95" largura={8} />
        <Seta d="M200 80 L250 80" />
      </Quadro>
    ),
  },
  {
    titulo: 'Não vale: joelho dobrado',
    texto: 'Se o joelho dobrar, a medida não vale. Faça 3 tentativas com os joelhos esticados e anote a melhor.',
    errado: true,
    desenho: (
      <Quadro>
        <Banco />
        <Membro d="M72 138 L150 112 L222 138" largura={16} cor={ROUPA} />
        <Membro d="M224 140 L226 116" largura={9} />
        <Membro d="M72 134 L140 96" largura={22} cor={ROUPA} />
        <circle cx="158" cy="94" r="13" fill={CORPO} />
        <Membro d="M138 98 L230 95" largura={8} />
        <circle cx="150" cy="104" r="17" fill="none" stroke="#ff5a5f" strokeWidth="3" />
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
        <Membro d="M141 146 L141 100" largura={14} cor="#0d3247" />
        <Membro d="M159 146 L159 100" largura={14} cor="#0d3247" />
        <path d="M124 44 Q150 36 176 44 L170 102 L130 102 Z" fill={CORPO} />
        <line x1="150" y1="46" x2="150" y2="98" stroke="#9fb3c2" strokeWidth="2" strokeDasharray="3 4" />
        <Membro d="M124 48 L116 96" largura={9} />
        <Membro d="M176 48 L184 96" largura={9} />
        <circle cx="150" cy="26" r="13" fill="#2a3b46" />
      </Quadro>
    ),
  },
  {
    titulo: '2. Incline o tronco',
    texto: 'Curve o tronco para frente até as costas ficarem quase na horizontal. Braços soltos e palmas unidas.',
    desenho: (
      <Quadro>
        <Ponta />
        <Membro d="M170 146 L170 92" largura={14} cor="#0d3247" />
        <path d="M176 96 Q130 70 84 92 L86 106 Q130 92 168 106 Z" fill={CORPO} />
        <circle cx="72" cy="112" r="12" fill="#2a3b46" />
        <Membro d="M96 98 L100 136" largura={8} />
        <Seta d="M120 52 Q88 54 74 80" />
        <rect x="236" y="70" width="18" height="32" rx="3" fill="none" stroke={ROUPA} strokeWidth="2.5" />
        <line x1="232" y1="86" x2="186" y2="86" stroke={ROUPA} strokeWidth="1.5" strokeDasharray="4 4" />
      </Quadro>
    ),
  },
  {
    titulo: '3. Compare os dois lados',
    texto: 'Olhando as costas por trás, na horizontal: um lado mais alto (gibosidade) é sinal para avaliar.',
    desenho: (
      <Quadro>
        <Membro d="M138 146 L138 104" largura={14} cor="#0d3247" />
        <Membro d="M162 146 L162 104" largura={14} cor="#0d3247" />
        <path d="M92 104 Q96 70 122 66 Q140 64 150 74 Q158 78 178 76 Q204 76 208 104 Z" fill={CORPO} />
        <Membro d="M98 100 L112 132" largura={8} />
        <Membro d="M202 100 L188 132" largura={8} />
        <circle cx="150" cy="118" r="12" fill="#2a3b46" />
        <line x1="96" y1="66" x2="214" y2="66" stroke="#9fb3c2" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d="M122 60 L122 40" stroke={DESTAQUE} strokeWidth="2.5" strokeLinecap="round" />
        <text x="122" y="34" textAnchor="middle" fill={DESTAQUE} fontSize="12" fontWeight="700">
          lado mais alto
        </text>
      </Quadro>
    ),
  },
]

function ComoFazer({ passos, titulo }: { passos: Passo[]; titulo: string }) {
  return (
    <section className="cartao como-fazer">
      <h2>{titulo}</h2>
      <div className="como-fazer-passos">
        {passos.map((p) => (
          <figure key={p.titulo} className={p.errado ? 'errado' : ''}>
            {p.desenho}
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

export const ComoFazerWells = () => <ComoFazer titulo="Como fazer o teste" passos={WELLS} />

export const ComoFazerAdams = () => <ComoFazer titulo="Como fazer o teste" passos={ADAMS} />
