import { useCallback, useState } from 'react'
import { AssessmentResult } from './components/AssessmentResult'
import { CorridaArquivo } from './components/corrida/CorridaArquivo'
import { CorridaInicio } from './components/corrida/CorridaInicio'
import { CorridaResultado } from './components/corrida/CorridaResultado'
import { ExercicioAoVivo } from './components/exercicio/ExercicioAoVivo'
import { ExercicioArquivo } from './components/exercicio/ExercicioArquivo'
import { ExercicioInicio, type ConfigExercicio } from './components/exercicio/ExercicioInicio'
import { ExercicioResultado } from './components/exercicio/ExercicioResultado'
import { EstudioCamera } from './components/estudio/EstudioCamera'
import { EstudioControle } from './components/estudio/EstudioControle'
import { EstudioInicio } from './components/estudio/EstudioInicio'
import { Referencias } from './components/estudio/Referencias'
import { Admin } from './components/conta/Admin'
import { MeusAlunos } from './components/conta/MeusAlunos'
import { MinhaEvolucao } from './components/alunos/MinhaEvolucao'
import { MinhaConta } from './components/conta/MinhaConta'
import { Portao } from './components/conta/Portao'
import { Home } from './components/Home'
import { Vitrine } from './components/vitrine/Vitrine'
import { PostureAssessment } from './components/PostureAssessment'
import { PerfilProfissional } from './components/relatorio/PerfilProfissional'
import { Relatorio } from './components/relatorio/Relatorio'
import { ProjecaoCarga } from './components/treino/ProjecaoCarga'
import type { ConfigCorrida, ResultadoCorrida, VistaCorrida } from './corrida/tipos'
import type { ResultadoExercicio } from './movimento/tipos'
import { AdamsTeste } from './components/testes/AdamsTeste'
import { FlexTeste } from './components/testes/FlexTeste'
import { IdosoModulo } from './components/idoso/IdosoModulo'
import type { Assessment } from './pose/types'
import { useConta } from './nuvem/conta'
import { loadAssessments, saveAssessment } from './storage'

type Screen =
  | { name: 'inicio' }
  | { name: 'avaliacao' }
  | { name: 'resultado'; assessment: Assessment }
  | { name: 'estudio' }
  | { name: 'estudio-controle' }
  | { name: 'estudio-camera'; codigo?: string }
  | { name: 'referencias'; abrir?: string }
  | { name: 'exercicio' }
  | { name: 'exercicio-vivo'; config: ConfigExercicio }
  | { name: 'exercicio-arquivo'; config: ConfigExercicio; arquivo: File }
  | { name: 'exercicio-resultado'; resultado: ResultadoExercicio }
  | { name: 'corrida'; vista?: VistaCorrida }
  | { name: 'corrida-arquivo'; config: ConfigCorrida; arquivo: File }
  | { name: 'corrida-resultado'; resultado: ResultadoCorrida }
  | { name: 'carga' }
  | { name: 'flexibilidade' }
  | { name: 'adams' }
  | { name: 'idoso' }
  | { name: 'admin' }
  | { name: 'alunos' }
  | { name: 'evolucao' }
  | { name: 'conta' }
  | { name: 'vitrine' }
  | { name: 'perfil'; voltar: Screen }
  | { name: 'relatorio'; avaliado?: string; marcados?: string[]; voltar: Screen }

// Link enviado pelo celular de controle: ...?estudio=123456 abre direto como câmera.
function telaInicial(): Screen {
  const codigo = new URLSearchParams(window.location.search).get('estudio')
  return codigo ? { name: 'estudio-camera', codigo } : { name: 'inicio' }
}

export default function App() {
  const [inicial] = useState<Screen>(telaInicial)
  // O celular que só filma no modo estúdio abre pelo link, sem login.
  if (inicial.name === 'estudio-camera') return <Telas inicial={inicial} />
  return (
    <Portao>
      <Telas inicial={inicial} />
    </Portao>
  )
}

function Telas({ inicial }: { inicial: Screen }) {
  const [screen, setScreen] = useState<Screen>(inicial)
  const { perfil } = useConta()
  const [history, setHistory] = useState(loadAssessments)

  const go = useCallback((s: Screen) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }, [])
  const verResultado = useCallback((resultado: ResultadoExercicio) => go({ name: 'exercicio-resultado', resultado }), [go])
  const verCorrida = useCallback((resultado: ResultadoCorrida) => go({ name: 'corrida-resultado', resultado }), [go])

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
    return (
      <AssessmentResult
        assessment={screen.assessment}
        onBack={() => go({ name: 'inicio' })}
        onRelatorio={() => go({ name: 'relatorio', marcados: [screen.assessment.id], voltar: screen })}
      />
    )
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

  if (screen.name === 'exercicio') {
    return (
      <ExercicioInicio
        onVoltar={() => go({ name: 'inicio' })}
        onAoVivo={(config) => go({ name: 'exercicio-vivo', config })}
        onArquivo={(config, arquivo) => go({ name: 'exercicio-arquivo', config, arquivo })}
      />
    )
  }

  if (screen.name === 'exercicio-vivo') {
    return <ExercicioAoVivo {...screen.config} onCancel={() => go({ name: 'exercicio' })} onDone={verResultado} />
  }

  if (screen.name === 'exercicio-arquivo') {
    return <ExercicioArquivo {...screen.config} arquivo={screen.arquivo} onCancel={() => go({ name: 'exercicio' })} onDone={verResultado} />
  }

  if (screen.name === 'exercicio-resultado') {
    return <ExercicioResultado resultado={screen.resultado} onVoltar={() => go({ name: 'inicio' })} onRefazer={() => go({ name: 'exercicio' })} />
  }

  if (screen.name === 'corrida') {
    return <CorridaInicio key={screen.vista} vistaInicial={screen.vista} onVoltar={() => go({ name: 'inicio' })} onArquivo={(config, arquivo) => go({ name: 'corrida-arquivo', config, arquivo })} />
  }

  if (screen.name === 'corrida-arquivo') {
    return <CorridaArquivo config={screen.config} arquivo={screen.arquivo} onCancel={() => go({ name: 'corrida', vista: screen.config.vista })} onDone={verCorrida} />
  }

  if (screen.name === 'corrida-resultado') {
    return <CorridaResultado resultado={screen.resultado} onVoltar={() => go({ name: 'inicio' })} onOutraVista={(vista) => go({ name: 'corrida', vista })} />
  }
  if (screen.name === 'carga') return <ProjecaoCarga onVoltar={() => go({ name: 'inicio' })} />

  if (screen.name === 'flexibilidade')
    return <FlexTeste onVoltar={() => go({ name: 'inicio' })} onRelatorio={(r) => go({ name: 'relatorio', avaliado: r.avaliado, marcados: [r.id], voltar: screen })} />

  if (screen.name === 'adams')
    return <AdamsTeste onVoltar={() => go({ name: 'inicio' })} onRelatorio={(r) => go({ name: 'relatorio', avaliado: r.avaliado, marcados: [r.id], voltar: screen })} />

  if (screen.name === 'perfil') return <PerfilProfissional textoVoltar="Voltar" onVoltar={() => go(screen.voltar)} />

  if (screen.name === 'relatorio')
    return (
      <Relatorio
        key={screen.marcados?.join()}
        avaliadoInicial={screen.avaliado}
        marcados={screen.marcados}
        textoVoltar="Voltar"
        onVoltar={() => go(screen.voltar)}
        onPerfil={() => go({ name: 'perfil', voltar: screen })}
      />
    )

  if (screen.name === 'idoso') return <IdosoModulo onVoltar={() => go({ name: 'inicio' })} onRelatorio={(a) => go({ name: 'relatorio', avaliado: a.avaliado, marcados: [a.id], voltar: screen })} />

  if (screen.name === 'admin') return <Admin onVoltar={() => go({ name: 'inicio' })} />

  if (screen.name === 'alunos' && perfil) return <MeusAlunos meuId={perfil.id} onVoltar={() => go({ name: 'inicio' })} />

  if (screen.name === 'evolucao' && perfil) return <MinhaEvolucao meuId={perfil.id} nome={perfil.nome || perfil.email} onVoltar={() => go({ name: 'inicio' })} />

  if (screen.name === 'vitrine') return <Vitrine onVoltar={() => go({ name: 'inicio' })} />

  if (screen.name === 'conta') return <MinhaConta onVoltar={() => go({ name: 'inicio' })} />

  return (
    <Home
      history={history}
      onStart={() => go({ name: 'avaliacao' })}
      onOpen={(a) => go({ name: 'resultado', assessment: a })}
      onEstudio={() => go({ name: 'estudio' })}
      onExercicio={() => go({ name: 'exercicio' })}
      onCarga={() => go({ name: 'carga' })}
      onCorrida={() => go({ name: 'corrida' })}
      onFlexibilidade={() => go({ name: 'flexibilidade' })}
      onAdams={() => go({ name: 'adams' })}
      onIdoso={() => go({ name: 'idoso' })}
      perfil={perfil}
      onAdmin={() => go({ name: 'admin' })}
      onAlunos={() => go({ name: 'alunos' })}
      onEvolucao={() => go({ name: 'evolucao' })}
      onConta={() => go({ name: 'conta' })}
      onVitrine={() => go({ name: 'vitrine' })}
      onRelatorio={() => go({ name: 'relatorio', voltar: screen })}
    />
  )
}
