import { useCallback, useEffect, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { loadDetector } from '../../pose/detector'
import type { Point, Status } from '../../pose/types'
import { CameraCapture, type Capture } from '../CameraCapture'
import { PosePhoto } from '../PosePhoto'

export function CampoAvaliado({ valor, onChange, nomes }: { valor: string; onChange: (v: string) => void; nomes: string[] }) {
  return (
    <label className="campo">
      Nome do avaliado
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Ex.: Maria Souza" list="avaliados" autoComplete="off" />
      <datalist id="avaliados">
        {nomes.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </label>
  )
}

export function CampoObservacoes({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <label className="campo">
      Observações e diagnóstico do profissional
      <textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Ex.: encurtamento de isquiotibiais, dor lombar ao final do movimento, conduta indicada…"
      />
    </label>
  )
}

export function AvisoTriagem({ children }: { children?: React.ReactNode }) {
  return (
    <p className="aviso-triagem">
      <strong>Triagem, não diagnóstico médico.</strong> {children ?? 'O resultado orienta o profissional e não substitui a avaliação de um médico ou fisioterapeuta.'}
    </p>
  )
}

type Ponto = { date: string; valor: number; status: Status }

/** Evolução de um teste ao longo do tempo, do mais antigo para o mais novo. */
export function GraficoEvolucao({ pontos, unidade, referencias = [] }: { pontos: Ponto[]; unidade: string; referencias?: { valor: number; rotulo: string }[] }) {
  if (pontos.length < 2) return <p className="dica-sec">Faça o teste mais vezes para ver a evolução no gráfico.</p>
  const ordem = [...pontos].sort((a, b) => a.date.localeCompare(b.date))
  const W = 320, H = 160, M = { e: 34, d: 10, c: 12, b: 24 }
  const valores = [...ordem.map((p) => p.valor), ...referencias.map((r) => r.valor)]
  let min = Math.min(...valores), max = Math.max(...valores)
  if (max - min < 4) [min, max] = [min - 2, max + 2]
  const folga = (max - min) * 0.1
  min -= folga
  max += folga
  const x = (i: number) => M.e + (i * (W - M.e - M.d)) / (ordem.length - 1)
  const y = (v: number) => M.c + ((max - v) * (H - M.c - M.b)) / (max - min)
  const cor: Record<Status, string> = { ok: 'var(--verde)', atencao: 'var(--amarelo)', alerta: 'var(--vermelho)' }
  return (
    <svg className="grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de evolução">
      {referencias.map((r) => (
        <g key={r.rotulo}>
          <line x1={M.e} x2={W - M.d} y1={y(r.valor)} y2={y(r.valor)} className="grafico-ref" />
          <text x={W - M.d} y={y(r.valor) - 3} textAnchor="end" className="grafico-ref-texto">
            {r.rotulo}
          </text>
        </g>
      ))}
      {[min + folga, max - folga].map((v) => (
        <text key={v} x={M.e - 6} y={y(v) + 4} textAnchor="end" className="grafico-eixo">
          {Math.round(v)}
        </text>
      ))}
      <polyline points={ordem.map((p, i) => `${x(i)},${y(p.valor)}`).join(' ')} className="grafico-linha" />
      {ordem.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.valor)} r={4.5} fill={cor[p.status]} />
          {(i === 0 || i === ordem.length - 1 || ordem.length <= 5) && (
            <text x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === ordem.length - 1 ? 'end' : 'middle'} className="grafico-eixo">
              {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </text>
          )}
        </g>
      ))}
      <text x={4} y={M.c - 2} className="grafico-eixo">
        {unidade}
      </text>
    </svg>
  )
}

type FotoProps = {
  validar: (lm: Point[]) => boolean
  textoOk: string
  textoAviso: string
  onFoto: (c: Capture) => void
  onCancelar: () => void
  /** Deixa usar a foto mesmo sem achar os pontos do corpo (o teste mede de outro jeito). */
  semPoseOk?: boolean
}

/** Câmera ou galeria, revisão da foto e confirmação. */
export function TirarFoto({ validar, textoOk, textoAviso, onFoto, onCancelar, semPoseOk = false }: FotoProps) {
  const [detector, setDetector] = useState<PoseLandmarker | null>(null)
  const [erro, setErro] = useState(false)
  const [preview, setPreview] = useState<Capture | null>(null)
  useEffect(() => {
    loadDetector().then(setDetector, () => setErro(true))
  }, [])
  const onCapture = useCallback((c: Capture) => setPreview(c), [])
  const valida = !!preview?.landmarks && validar(preview.landmarks)

  if (erro) return <p className="camera-erro">Não foi possível carregar a análise. Verifique a internet e recarregue a página.</p>
  if (!detector) return <p className="carregando">Preparando a câmera…</p>
  if (!preview)
    return (
      <>
        <CameraCapture view="costas" detector={detector} onCapture={onCapture} validar={validar} textoOk={textoOk} textoAviso={textoAviso} />
        <button className="botao-sec" onClick={onCancelar}>
          Cancelar foto
        </button>
      </>
    )
  return (
    <div className="revisao">
      <PosePhoto {...preview} />
      <p className={`pill estatico ${valida ? 'pill-ok' : 'pill-aviso'}`}>
        {valida ? 'Foto boa para análise' : semPoseOk ? 'Não achamos todos os pontos do corpo. Dá para usar: vamos medir pelo contorno das costas.' : preview.landmarks ? textoAviso : 'Não encontramos uma pessoa na foto. Tente de novo.'}
      </p>
      <div className="acoes">
        <button className="botao-sec" onClick={() => setPreview(null)}>
          Refazer
        </button>
        <button className="botao" disabled={!valida && !semPoseOk} onClick={() => onFoto(preview)}>
          Usar foto
        </button>
      </div>
    </div>
  )
}
