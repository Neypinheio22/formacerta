import { useState } from 'react'
import { AssessmentResult } from './components/AssessmentResult'
import { EstudioCamera } from './components/estudio/EstudioCamera'
import { EstudioControle } from './components/estudio/EstudioControle'
import { EstudioInicio } from './components/estudio/EstudioInicio'
import { Referencias } from './components/estudio/Referencias'
import { Home } from './components/Home'
import { PostureAssessment } from './components/PostureAssessment'
import type { Assessment } from './pose/types'
import { loadAssessments, saveAssessment } from './storage'

type Screen =
  | { name: 'inicio' }
  | { name: 'avaliacao' }
  | { name: 'resultado'; assessment: Assessment }
  | { name: 'estudio' }
  | { name: 'estudio-controle' }
  | { name: 'estudio-camera'; codigo?: string }
  | { name: 'referencias'; abrir?: string }

// Link enviado pelo celular de controle: ...?estudio=123456 abre direto como câmera.
function telaInicial(): Screen {
  const codigo = new URLSearchParams(window.location.search).get('estudio')
  return codigo ? { name: 'estudio-camera', codigo } : { name: 'inicio' }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(telaInicial)
  const [history, setHistory] = useState(loadAssessments)

  const go = (s: Screen) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }

  if (screen.name === 'avaliacao') {
    return (
      <PostureAssessment
        onCancel={() => go({ name: 'inicio' })}
        onDone={(a) => {
          saveAssessment(a)
          setHistory(loadAssessments())
          go({ name: 'resultado', assessment: a })
        }}
      />
    )
  }

  if (screen.name === 'resultado') {
    return <AssessmentResult assessment={screen.assessment} onBack={() => go({ name: 'inicio' })} />
  }

  if (screen.name === 'estudio') {
    return (
      <EstudioInicio
        onVoltar={() => go({ name: 'inicio' })}
        onControle={() => go({ name: 'estudio-controle' })}
        onCamera={() => go({ name: 'estudio-camera' })}
        onReferencias={() => go({ name: 'referencias' })}
      />
    )
  }

  if (screen.name === 'estudio-controle') {
    return <EstudioControle onSair={() => go({ name: 'estudio' })} onSalvo={(r) => go({ name: 'referencias', abrir: r.id })} />
  }

  if (screen.name === 'estudio-camera') {
    return <EstudioCamera codigoInicial={screen.codigo} onSair={() => go({ name: 'estudio' })} />
  }

  if (screen.name === 'referencias') {
    return <Referencias abrir={screen.abrir} onVoltar={() => go({ name: 'estudio' })} onGravar={() => go({ name: 'estudio-controle' })} />
  }

  return (
    <Home
      history={history}
      onStart={() => go({ name: 'avaliacao' })}
      onOpen={(a) => go({ name: 'resultado', assessment: a })}
      onEstudio={() => go({ name: 'estudio' })}
    />
  )
}
