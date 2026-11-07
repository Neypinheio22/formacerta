import { useCallback, useEffect, useState } from 'react'
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
import { Reavaliacoes } from './components/plano/Reavaliacoes'
import { MeusAlunos } from './components/conta/MeusAlunos'
import { MinhaEvolucao } from './components/alunos/MinhaEvolucao'
import { MeusDados } from './components/corpo/MeusDados'
import { minhaFicha } from './nuvem/treinos'
import { MinhaConta } from './components/conta/MinhaConta'
import { Portao } from './components/conta/Portao'
import { BarraInferior, type Aba } from './components/BarraInferior'
import { Home } from './components/Home'
import { EncontrarPersonal } from './components/conta/EncontrarPersonal'
import { Conversa } from './components/chat/Conversa'
import { Conversas } from './components/chat/Conversas'
import { CentralChamadas } from './components/video/CentralChamadas'
import { sincronizarPush } from './nuvem/push'
import { Notificacoes } from './components/notificacoes/Notificacoes'
import { Avisos } from './components/notificacoes/Avisos'
import { RetornoPagamento } from './components/planos/RetornoPagamento'
import type { Conversa as ConversaNuvem } from './nuvem/chat'
import { TelaTreino } from './components/treino/TelaTreino'
import { Vitrine } from './components/vitrine/Vitrine'
import { Pagamento, type Pedido } from './components/planos/Pagamento'
import { Planos } from './components/planos/Planos'
import { TravaPro, type RecursoPro } from './components/planos/TravaPro'
import { travadoNoPro, useDireitos } from './components/planos/useDireitos'
import { PostureAssessment } from './components/PostureAssessment'
import { PerfilProfissional } from './components/relatorio/PerfilProfissional'
import { Relatorio } from './components/relatorio/Relatorio'
import { ProjecaoCarga } from './components/treino/ProjecaoCarga'
import type { ConfigCorrida, ResultadoCorrida, VistaCorrida } from './corrida/tipos'
import type { ExercicioId, ResultadoExercicio } from './movimento/tipos'
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
  | { name: 'exercicio'; exercicio?: ExercicioId }
  | { name: 'treino'; abrir?: string }
  | { name: 'personais'; voltar: Screen }
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
  | { name: 'reavaliacoes' }
  | { name: 'evolucao' }
  | { name: 'meus-dados'; depois?: Screen }
  | { name: 'conta' }
  | { name: 'vitrine' }
  | { name: 'planos' }
  | { name: 'pagamento'; pedido: Pedido; voltar?: Screen }
  | { name: 'retorno-pagamento'; pagamento: string; falhou: boolean }
  | { name: 'conversas' }
  | { name: 'notificacoes'; criar?: boolean }
  | { name: 'avisos' }
  | { name: 'conversa'; conversa: ConversaNuvem; voltar: Screen }
  | { name: 'perfil'; voltar: Screen }
  | { name: 'relatorio'; avaliado?: string; marcados?: string[]; voltar: Screen }

// Telas do Aluno Pro: no plano grátis, o aluno vê o convite para assinar no lugar delas.
const TELAS_PRO: Partial<Record<Screen['name'], RecursoPro>> = {
  corrida: 'corrida',
  'corrida-arquivo': 'corrida',
  exercicio: 'exercicio',
  'exercicio-vivo': 'exercicio',
  'exercicio-arquivo': 'exercicio',
  evolucao: 'evolucao',
}

// Telas de câmera e gravação: ocupam a tela inteira, sem menu, também no computador.
const TELA_CHEIA: Screen['name'][] = ['avaliacao', 'estudio-controle', 'estudio-camera', 'exercicio-vivo', 'exercicio-arquivo', 'corrida-arquivo']

// Link enviado pelo celular de controle: ...?estudio=123456 abre direto como câmera.
// Toque na notificação: ...?abrir=conversas abre o chat.
function telaInicial(): Screen {
  const busca = new URLSearchParams(window.location.search)
  const codigo = busca.get('estudio')
  if (codigo) return { name: 'estudio-camera', codigo }
  // Volta da página do Mercado Pago (cartão ou boleto): ...?pagamento=<id>
  const pagamento = busca.get('pagamento')
  if (pagamento && /^[0-9a-f-]{36}$/i.test(pagamento)) {
    const falhou = busca.get('falhou') === '1' || ['rejected', 'failure', 'null'].includes(busca.get('collection_status') ?? '')
    window.history.replaceState(null, '', window.location.pathname)
    return { name: 'retorno-pagamento', pagamento, falhou }
  }
  if (busca.get('abrir')) {
    // Tira o ?abrir= do endereço para não voltar ao chat num recarregar.
    // O ?cadastro= fica: a tela de entrar ainda lê (botão da página de captação).
    const cadastro = busca.get('cadastro')
    window.history.replaceState(null, '', window.location.pathname + (cadastro ? `?cadastro=${encodeURIComponent(cadastro)}` : ''))
    if (busca.get('abrir') === 'conversas') return { name: 'conversas' }
    if (busca.get('abrir') === 'avisos') return { name: 'avisos' }
    // Página "personal trainer online": depois de criar a conta, o aluno cai direto na lista de personais.
    if (busca.get('abrir') === 'personal') return { name: 'personais', voltar: { name: 'inicio' } }
  }
  return { name: 'inicio' }
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
  const direitos = useDireitos(perfil)
  const [history, setHistory] = useState(loadAssessments)
  const [dadosOk, setDadosOk] = useState(true)
  const [versaoDados, setVersaoDados] = useState(0)

  // Aluno sem altura, nascimento, sexo ou objetivo: antes da avaliação o app pede os dados.
  useEffect(() => {
    if (perfil?.papel !== 'aluno') return setDadosOk(true)
    minhaFicha(perfil.id).then((f) => setDadosOk(!!(f?.altura_cm && f.nascimento && f.sexo && f.objetivo)))
  }, [perfil?.id, perfil?.papel, versaoDados])

  const go = useCallback((s: Screen) => {
    setScreen(s)
    window.scrollTo(0, 0)
  }, [])

  // Notificações: confirma este celular para a conta que entrou e abre o chat ao tocar no aviso com o app aberto.
  useEffect(() => {
    if (perfil?.id) sincronizarPush()
  }, [perfil?.id])
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const aoAviso = (e: MessageEvent) => {
      if (e.data?.tipo !== 'abrir') return
      const abrir = new URL(String(e.data.url), window.location.href).searchParams.get('abrir')
      if (abrir === 'conversas') go({ name: 'conversas' })
      else if (abrir === 'avisos') go({ name: 'avisos' })
      else go({ name: 'inicio' })
    }
    navigator.serviceWorker.addEventListener('message', aoAviso)
    return () => navigator.serviceWorker.removeEventListener('message', aoAviso)
  }, [go])
  /** Abre o teste, passando antes por "Meus dados" se faltar o básico (uma vez por visita). */
  const comDados = (s: Screen) => {
    // Recurso do Aluno Pro no plano grátis: mostra o convite antes de pedir os dados.
    if (TELAS_PRO[s.name] && travadoNoPro(perfil, direitos)) return go(s)
    let pulou = false
    try {
      pulou = sessionStorage.getItem('formacerta:pulou-dados') === '1'
    } catch {
      // Sem acesso ao aparelho: pergunta de novo, sem problema.
    }
    go(dadosOk || pulou ? s : { name: 'meus-dados', depois: s })
  }
  const verResultado = useCallback((resultado: ResultadoExercicio) => go({ name: 'exercicio-resultado', resultado }), [go])
  const verCorrida = useCallback((resultado: ResultadoCorrida) => go({ name: 'corrida-resultado', resultado }), [go])

  const aba: Aba | null = (['inicio', 'treino', 'conversas', 'evolucao', 'alunos', 'conta'] as const).find((a) => a === screen.name) ?? null
  const conteudo = desenhar()
  // Chamada de vídeo: toca no celular do personal e abre por cima de qualquer tela.
  const chamadas = perfil ? <CentralChamadas perfil={perfil} /> : null
  if (!perfil || (!aba && TELA_CHEIA.includes(screen.name)))
    return (
      <>
        {conteudo}
        {chamadas}
      </>
    )
  // Telas internas: no celular continuam sem a barra; no computador ganham o menu lateral.
  if (!aba)
    return (
      <div className="com-lateral">
        {conteudo}
        <BarraInferior atual={null} soComputador aluno={perfil.papel === 'aluno'} onIr={(a) => go({ name: a })} />
        {chamadas}
      </div>
    )
  return (
    <div className="com-barra com-lateral">
      {conteudo}
      <BarraInferior atual={aba} aluno={perfil.papel === 'aluno'} onIr={(a) => go({ name: a })} />
      {chamadas}
    </div>
  )

  function desenhar() {
    const recursoPro = TELAS_PRO[screen.name]
    if (recursoPro && travadoNoPro(perfil, direitos)) return <TravaPro recurso={recursoPro} onPlanos={() => go({ name: 'planos' })} onVoltar={() => go({ name: 'inicio' })} />

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
          inicial={screen.exercicio}
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
    if (screen.name === 'personais') return <EncontrarPersonal meuId={perfil?.id ?? ''} meuNome={perfil?.nome ?? ''} onVoltar={() => go(screen.voltar)} onConversa={(conversa) => go({ name: 'conversa', conversa, voltar: { name: 'conversas' } })} />

    if (screen.name === 'notificacoes' && perfil)
      return <Notificacoes key={screen.criar ? 'criar' : 'ver'} meuId={perfil.id} meuNome={perfil.nome || perfil.email} criar={screen.criar} onVoltar={() => go({ name: 'inicio' })} />

    if (screen.name === 'avisos') return <Avisos onVoltar={() => go({ name: 'inicio' })} />

    if (screen.name === 'conversas' && perfil)
      return <Conversas perfil={perfil} onAbrir={(conversa) => go({ name: 'conversa', conversa, voltar: screen })} onPersonais={() => go({ name: 'personais', voltar: screen })} />

    if (screen.name === 'conversa' && perfil)
      return <Conversa perfil={perfil} conversa={screen.conversa} onVoltar={() => go(screen.voltar)} onPagar={(servico) => go({ name: 'pagamento', pedido: { tipo: 'avaliacao', servico }, voltar: screen })} />

    if (screen.name === 'treino')
      return (
        <TelaTreino
          perfil={perfil}
          abrir={screen.abrir}
          onVoltar={() => go({ name: 'inicio' })}
          onCamera={(exercicio) => go({ name: 'exercicio', exercicio })}
          onCarga={() => go({ name: 'carga' })}
          onPersonais={() => go({ name: 'personais', voltar: screen })}
        />
      )

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

    if (screen.name === 'alunos' && perfil) return <MeusAlunos meuId={perfil.id} onVoltar={() => go({ name: 'inicio' })} onPlanos={() => go({ name: 'planos' })} />

    if (screen.name === 'reavaliacoes' && perfil) return <Reavaliacoes perfil={perfil} onVoltar={() => go({ name: 'inicio' })} />

    if (screen.name === 'evolucao' && perfil) return <MinhaEvolucao meuId={perfil.id} nome={perfil.nome || perfil.email} onVoltar={() => go({ name: 'inicio' })} />

    if (screen.name === 'meus-dados' && perfil) {
      const depois = screen.depois
      return (
        <MeusDados
          meuId={perfil.id}
          nome={perfil.nome || perfil.email}
          modo={depois ? 'antes' : 'editar'}
          textoPronto={depois ? 'Começar a avaliação' : 'Voltar ao início'}
          onVoltar={() => go({ name: 'inicio' })}
          onPronto={() => {
            if (depois) {
              try {
                sessionStorage.setItem('formacerta:pulou-dados', '1')
              } catch {
                // Sem acesso ao aparelho: pode perguntar de novo.
              }
            }
            setVersaoDados((v) => v + 1)
            go(depois ?? { name: 'inicio' })
          }}
        />
      )
    }

    if (screen.name === 'vitrine') return <Vitrine onVoltar={() => go({ name: 'inicio' })} />

    if (screen.name === 'conta') return <MinhaConta onVoltar={() => go({ name: 'inicio' })} onPlanos={() => go({ name: 'planos' })} />

    if (screen.name === 'planos') return <Planos onVoltar={() => go({ name: 'inicio' })} onPagar={(pedido) => go({ name: 'pagamento', pedido })} />

    if (screen.name === 'retorno-pagamento')
      return <RetornoPagamento pagamento={screen.pagamento} falhou={screen.falhou} onInicio={() => go({ name: 'inicio' })} onPlanos={() => go({ name: 'planos' })} />
    if (screen.name === 'pagamento') {
      const voltar = screen.voltar ?? { name: 'planos' }
      return <Pagamento pedido={screen.pedido} textoPronto={screen.voltar ? (screen.voltar.name === 'inicio' ? 'Voltar ao início' : 'Voltar para a conversa') : undefined} onVoltar={() => go(voltar)} onPronto={() => go(voltar)} />
    }

    return (
      <Home
        history={history}
        onStart={() => comDados({ name: 'avaliacao' })}
        onOpen={(a) => go({ name: 'resultado', assessment: a })}
        onEstudio={() => go({ name: 'estudio' })}
        onExercicio={() => comDados({ name: 'exercicio' })}
        onCarga={() => go({ name: 'carga' })}
        onCorrida={() => comDados({ name: 'corrida' })}
        onFlexibilidade={() => comDados({ name: 'flexibilidade' })}
        onAdams={() => comDados({ name: 'adams' })}
        onIdoso={() => go({ name: 'idoso' })}
        perfil={perfil}
        onAdmin={() => go({ name: 'admin' })}
        onAlunos={() => go({ name: 'alunos' })}
        onReavaliacoes={() => go({ name: 'reavaliacoes' })}
        onEvolucao={() => go({ name: 'evolucao' })}
        onMeusDados={() => go({ name: 'meus-dados' })}
        onVitrine={() => go({ name: 'vitrine' })}
        onPlanos={() => go({ name: 'planos' })}
        onRelatorio={() => go({ name: 'relatorio', voltar: screen })}
        onTreino={(abrir) => go({ name: 'treino', abrir })}
        onPersonais={() => go({ name: 'personais', voltar: screen })}
        direitos={direitos}
        onChat={() => go({ name: 'conversas' })}
        onNotificacoes={(criar) => go({ name: 'notificacoes', criar })}
        onAvisos={() => go({ name: 'avisos' })}
        onPagarServico={(servico) => go({ name: 'pagamento', pedido: { tipo: 'avaliacao', servico }, voltar: { name: 'inicio' } })}
      />
    )
  }
}
