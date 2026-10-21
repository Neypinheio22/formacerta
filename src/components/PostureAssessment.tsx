import { useCallback, useEffect, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { analyzeView, bodyVisible, computeScore } from '../pose/analysis'
import { loadDetector } from '../pose/detector'
import { VIEWS, type Assessment, type ViewResult } from '../pose/types'
import { CameraCapture, type Capture } from './CameraCapture'
import { PosePhoto } from './PosePhoto'

type Props = { onDone: (a: Assessment) => void; onCancel: () => void }

export function PostureAssessment({ onDone, onCancel }: Props) {
  const [detector, setDetector] = useState<PoseLandmarker | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<ViewResult[]>([])
  const [preview, setPreview] = useState<Capture | null>(null)

  useEffect(() => {
    loadDetector().then(setDetector, () => setLoadError(true))
  }, [])

  const view = VIEWS[step]
  const onCapture = useCallback((c: Capture) => setPreview(c), [])
  const valida = !!preview?.landmarks && bodyVisible(view.id, preview.landmarks)

  function aceitar() {
    if (!preview?.landmarks) return
    const result: ViewResult = {
      view: view.id,
      image: preview.image,
      width: preview.width,
      height: preview.height,
      landmarks: preview.landmarks.map(({ x, y, visibility }) => ({ x, y, visibility })),
      findings: analyzeView(view.id, preview.landmarks, preview.width, preview.height),
    }
    const todos = [...results, result]
    setPreview(null)
    if (step + 1 < VIEWS.length) {
      setResults(todos)
      setStep(step + 1)
      return
    }
    onDone({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      score: computeScore(todos.flatMap((r) => r.findings)),
      views: todos,
    })
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onCancel}>
          ← Sair
        </button>
        <span className="passo">
          {step + 1}/{VIEWS.length}
        </span>
      </header>

      <div className="progresso">
        {VIEWS.map((v, i) => (
          <span key={v.id} className={i < step ? 'feito' : i === step ? 'atual' : ''} />
        ))}
      </div>

      <h1>{view.label}</h1>
      <p className="dica">{view.hint}</p>
      <p className="dica-sec">Apoie o celular na altura da cintura, a uns 2 a 3 metros. Use roupa justa e prenda o cabelo.</p>

      {loadError && <p className="camera-erro">Não foi possível carregar a análise. Verifique a internet e recarregue a página.</p>}
      {!loadError && !detector && <p className="carregando">Preparando a análise de postura…</p>}

      {detector && !preview && <CameraCapture view={view.id} detector={detector} onCapture={onCapture} />}

      {preview && (
        <div className="revisao">
          <PosePhoto {...preview} />
          {valida ? (
            <p className="pill pill-ok estatico">Foto boa para análise</p>
          ) : (
            <p className="pill pill-aviso estatico">
              {preview.landmarks ? 'O corpo não apareceu inteiro. Tire de novo, da cabeça aos pés.' : 'Não encontramos uma pessoa na foto. Tente de novo.'}
            </p>
          )}
          <div className="acoes">
            <button className="botao-sec" onClick={() => setPreview(null)}>
              Refazer
            </button>
            <button className="botao" onClick={aceitar} disabled={!valida}>
              {step + 1 < VIEWS.length ? 'Usar foto' : 'Ver resultado'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
