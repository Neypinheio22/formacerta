// Desenhos de como fazer cada teste, para o aluno usar como referência.
// Feitos em SVG para ficarem nítidos em qualquer tela e não pesarem no app.

type Passo = { titulo: string; texto: string; desenho: React.ReactNode; errado?: boolean }

const CORPO = '#d9e4ec'
const ROUPA = '#36f294'
const CHAO = '#2a4a5e'
const DESTAQUE = '#fb8d1a'
const PERNA = '#4f7d99'

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

/** Pessoa de lado, virada para a direita: quadril, ombro e ponta das mãos. */
function DeLado({ quadril, ombro, cabeca, mao, joelho }: { quadril: [number, number]; ombro: [number, number]; cabeca: [number, number]; mao: [number, number]; joelho?: [number, number] }) {
  const [qx, qy] = quadril
  const [jx, jy] = joelho ?? [(qx + 152) / 2, (qy + 146) / 2]
  return (
    <g>
      <Membro d={`M${qx} ${qy} L${jx} ${jy} L152 144`} largura={14} cor={PERNA} />
      <Membro d="M150 147 L170 147" largura={7} />
      <Membro d={`M${qx} ${qy} L${ombro[0]} ${ombro[1]}`} largura={22} cor={ROUPA} />
      <circle cx={cabeca[0]} cy={cabeca[1]} r="12" fill={CORPO} />
      <Membro d={`M${ombro[0]} ${ombro[1]} L${mao[0]} ${mao[1]}`} largura={8} />
    </g>
  )
}

const FLEX: Passo[] = [
  {
    titulo: '1. Posição inicial',
    texto: 'Em pé, de lado para o celular. Pés afastados na largura do quadril, joelhos esticados e braços soltos.',
    desenho: (
      <Quadro>
        <DeLado quadril={[150, 92]} ombro={[150, 48]} cabeca={[152, 28]} mao={[154, 96]} />
      </Quadro>
    ),
  },
  {
    titulo: '2. Execução',
    texto: 'Incline o tronco à frente devagar, sem dobrar os joelhos. Os braços descem soltos em direção ao chão.',
    desenho: (
      <Quadro>
        <Ponta />
        <DeLado quadril={[146, 90]} ombro={[180, 62]} cabeca={[196, 50]} mao={[188, 108]} />
        <Seta d="M166 30 Q206 30 214 66" />
      </Quadro>
    ),
  },
  {
    titulo: '3. Posição final',
    texto: 'Vá até o limite confortável, sem balançar nem forçar. Segure e tire a foto de lado, com os pés aparecendo.',
    desenho: (
      <Quadro>
        <DeLado quadril={[140, 88]} ombro={[178, 112]} cabeca={[184, 130]} mao={[176, 146]} />
        <rect x="24" y="80" width="18" height="32" rx="3" fill="none" stroke={ROUPA} strokeWidth="2.5" />
        <line x1="46" y1="96" x2="122" y2="96" stroke={ROUPA} strokeWidth="1.5" strokeDasharray="4 4" />
      </Quadro>
    ),
  },
  {
    titulo: '4. Onde as mãos chegam',
    texto: 'O app compara a ponta dos dedos com o joelho, a canela, o tornozelo e o chão e classifica sozinho.',
    desenho: (
      <Quadro>
        <Membro d="M96 18 L98 74 L98 140" largura={16} cor={PERNA} />
        <Membro d="M96 147 L120 147" largura={7} />
        {[
          { y: 42, t: 'Muito limitada', c: '#ff5a5f' },
          { y: 74, t: 'Limitada', c: DESTAQUE },
          { y: 107, t: 'Moderada', c: '#f5c518' },
          { y: 138, t: 'Boa', c: ROUPA },
          { y: 162, t: 'Excelente', c: ROUPA },
        ].map((n) => (
          <g key={n.t}>
            <line x1="110" y1={n.y} x2="140" y2={n.y} stroke={n.c} strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="110" cy={n.y} r="3.5" fill={n.c} />
            <text x="146" y={n.y + 4} fill={n.c} fontSize="12" fontWeight="700">
              {n.t}
            </text>
          </g>
        ))}
      </Quadro>
    ),
  },
  {
    titulo: 'Não vale: joelho dobrado',
    texto: 'Se os joelhos dobrarem, a medida não vale. O app avisa: repita com as pernas esticadas.',
    errado: true,
    desenho: (
      <Quadro>
        <DeLado quadril={[116, 70]} joelho={[160, 110]} ombro={[176, 98]} cabeca={[190, 112]} mao={[180, 142]} />
        <circle cx="160" cy="112" r="17" fill="none" stroke="#ff5a5f" strokeWidth="3" />
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

export const ComoFazerFlex = () => <ComoFazer titulo="Como fazer o teste" passos={FLEX} />

export const ComoFazerAdams = () => <ComoFazer titulo="Como fazer o teste" passos={ADAMS} />
