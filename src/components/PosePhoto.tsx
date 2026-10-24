import { CONEXOES, PONTOS } from '../pose/draw'
import type { Point } from '../pose/types'

type Props = { image: string; width: number; height: number; landmarks: Point[] | null; children?: React.ReactNode }

/** Foto com o esqueleto desenhado por cima, em SVG para ficar nítido em qualquer tamanho. */
export function PosePhoto({ image, width, height, landmarks, children }: Props) {
  const r = Math.max(width, height) / 110
  const ok = (p: Point) => (p.visibility ?? 1) >= 0.5
  return (
    <svg className="pose-foto" viewBox={`0 0 ${width} ${height}`}>
      <image href={image} width={width} height={height} />
      {landmarks && (
        <g stroke="#36F294" strokeWidth={r * 0.7} strokeLinecap="round" fill="#36F294">
          {CONEXOES.filter(([a, b]) => ok(landmarks[a]) && ok(landmarks[b])).map(([a, b]) => (
            <line key={`${a}-${b}`} x1={landmarks[a].x * width} y1={landmarks[a].y * height} x2={landmarks[b].x * width} y2={landmarks[b].y * height} />
          ))}
          {PONTOS.filter((i) => ok(landmarks[i])).map((i) => (
            <circle key={i} cx={landmarks[i].x * width} cy={landmarks[i].y * height} r={r} stroke="#020B16" strokeWidth={r * 0.35} />
          ))}
        </g>
      )}
      {children}
    </svg>
  )
}
