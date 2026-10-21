import { useState } from 'react'
import { AssessmentResult } from './components/AssessmentResult'
import { Home } from './components/Home'
import { PostureAssessment } from './components/PostureAssessment'
import type { Assessment } from './pose/types'
import { loadAssessments, saveAssessment } from './storage'

type Screen = { name: 'inicio' } | { name: 'avaliacao' } | { name: 'resultado'; assessment: Assessment }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'inicio' })
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

  return <Home history={history} onStart={() => go({ name: 'avaliacao' })} onOpen={(a) => go({ name: 'resultado', assessment: a })} />
}
