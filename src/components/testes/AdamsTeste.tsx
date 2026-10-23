import { useMemo, useState } from 'react'
import { detectarComMascara, loadDetectorComMascara, loadSegmentador, segmentar, type Mascara } from '../../pose/detector'
import { LM, type Point } from '../../pose/types'
import { CHAVE_ADAMS, analisarAdams, anguloAdams, classificarAdams, type RegistroAdams, type ResultadoAdams, type VistaAdams } from '../../testes/adams'
import { apagar, atualizar, avaliados, carregar, doAvaliado, reduzirFoto, salvar } from '../../testes/historico'
import type { Capture } from '../CameraCapture'
import { ComoFazerAdams } from './Ilustracoes'
import { AvisoTriagem, CampoAvaliado, CampoObservacoes, GraficoEvolucao, TirarFoto } from './comum'
import { ROTULO_STATUS, dataCurta, lerNumero, numero } from '../../testes/formato'

type Tela = { nome: 'novo' } | { nome: 'historico' } | { nome: 'detalhe'; id: string }

// Inclinado para frente: ombros e quadril precisam aparecer para achar o meio das costas.
function costasVisiveis(lm: Point[]) {
  return [LM.ombroEsq, LM.ombroDir, LM.quadrilEsq, LM.quadrilDir].filter((i) => (lm[i].visibility ?? 1) > 0.5).length >= 3
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function AdamsTeste({ onVoltar }: { onVoltar: () => void }) {
  const [tela, setTela] = useState<Tela>({ nome: 'novo' })
  const [lista, setLista] = useState(() => carregar<RegistroAdams>(CHAVE_ADAMS))
  const recarregar = () => setLista(carregar<RegistroAdams>(CHAVE_ADAMS))
  const ir = (t: Tela) => {
    setTela(t)
    window.scrollTo(0, 0)
  }
  const registro = tela.nome === 'detalhe' ? lista.find((r) => r.id === tela.id) : undefined

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={tela.nome === 'novo' ? onVoltar : () => ir({ nome: 'novo' })}>
          ← {tela.nome === 'novo' ? 'Início' : 'Novo teste'}
        </button>
        {tela.nome !== 'historico' && lista.length > 0 && (
          <button className="voltar" onClick={() => ir({ nome: 'historico' })}>
            Histórico ({lista.length})
          </button>
        )}
      </header>

      {tela.nome === 'novo' && (
        <NovoAdams
          nomes={avaliados(lista)}
          onSalvo={(r) => {
            recarregar()
            ir({ nome: 'detalhe', id: r.id })
          }}
        />
      )}
      {tela.nome === 'historico' && <Historico lista={lista} onAbrir={(id) => ir({ nome: 'detalhe', id })} />}
      {tela.nome === 'detalhe' && registro && (
        <Detalhe
          key={registro.id}
          registro={registro}
          doMesmo={doAvaliado(lista, registro.avaliado)}
          onAbrir={(id) => ir({ nome: 'detalhe', id })}
          onMudou={recarregar}
          onApagado={() => {
            recarregar()
            ir({ nome: 'historico' })
          }}
        />
      )}
    </div>
  )
}

type Analise = { foto: Capture; landmarks: Point[] | null; mascara: Mascara } | { foto: Capture; falhou: true }

function NovoAdams({ nomes, onSalvo }: { nomes: string[]; onSalvo: (r: RegistroAdams) => void }) {
  const [avaliado, setAvaliado] = useState('')
  const [vista, setVista] = useState<VistaAdams>('costas')
  const [tirandoFoto, setTirandoFoto] = useState(false)
  const [analisando, setAnalisando] = useState(false)
  const [analise, setAnalise] = useState<Analise | null>(null)
  const [escoliometro, setEscoliometro] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)

  const resultado = useMemo(() => (analise && !('falhou' in analise) ? analisarAdams(analise.mascara, analise.landmarks, vista) : null), [analise, vista])
  const leitura = lerNumero(escoliometro)
  const angulo = anguloAdams({ atr: resultado?.atr ?? null, escoliometro: leitura })
  const classe = angulo !== null ? classificarAdams(angulo) : null

  async function analisar(c: Capture) {
    setTirandoFoto(false)
    setAnalisando(true)
    try {
      const img = await carregarImagem(c.image)
      const comPose = detectarComMascara(await loadDetectorComMascara(), img)
      // Se não achar os pontos do corpo (cabeça para baixo), mede só pelo recorte da pessoa.
      const mascara = comPose ? null : segmentar(await loadSegmentador(), img)
      setAnalise(comPose ? { foto: c, ...comPose } : mascara ? { foto: c, landmarks: null, mascara } : { foto: c, falhou: true })
    } catch {
      setAnalise({ foto: c, falhou: true })
    }
    setAnalisando(false)
  }

  async function salvarTeste() {
    if (angulo === null) return
    setSalvando(true)
    const foto =
      analise && resultado && !('falhou' in analise)
        ? {
            image: await reduzirFoto(analise.foto.image),
            width: analise.foto.width,
            height: analise.foto.height,
            landmarks: (analise.landmarks ?? []).map(({ x, y, visibility }) => ({ x, y, visibility })),
            resultado,
          }
        : undefined
    const r: RegistroAdams = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      avaliado: avaliado.trim(),
      observacoes: observacoes.trim(),
      vista,
      atr: resultado?.atr ?? null,
      lado: resultado?.lado ?? null,
      escoliometro: leitura,
      foto,
    }
    salvar(CHAVE_ADAMS, r)
    onSalvo(r)
  }

  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">Triagem de escoliose</span>
        <h1>Teste de Adams</h1>
        <p className="dica-sec">
          A pessoa fica em pé, pés juntos, e inclina o tronco para frente até as costas ficarem quase na horizontal, com os braços soltos e as palmas unidas. O
          app compara a altura dos dois lados das costas para achar gibosidade e rotação vertebral.
        </p>
      </section>

      <ComoFazerAdams />

      <section className="cartao formulario">
        <CampoAvaliado valor={avaliado} onChange={setAvaliado} nomes={nomes} />
        <div className="campo">
          Posição do celular
          <div className="escolha">
            <button className={vista === 'costas' ? 'ativo' : ''} onClick={() => setVista('costas')}>
              Atrás da pessoa
            </button>
            <button className={vista === 'frente' ? 'ativo' : ''} onClick={() => setVista('frente')}>
              Na frente da pessoa
            </button>
          </div>
        </div>
        <ul className="exercicios dicas-foto">
          <li>Celular parado na altura das costas inclinadas (uns 80 a 90 cm do chão), a 1,5 m, bem no meio.</li>
          <li>Costas à mostra ou roupa justa, cabelo preso e fundo liso atrás.</li>
          <li>A câmera deve olhar ao longo das costas, na horizontal, como o avaliador olha no teste.</li>
        </ul>
      </section>

      <section className="cartao">
        <h2>Foto na flexão do tronco</h2>
        {!analise && !tirandoFoto && !analisando && (
          <button className="botao" onClick={() => setTirandoFoto(true)}>
            Tirar foto
          </button>
        )}
        {tirandoFoto && (
          <TirarFoto
            validar={costasVisiveis}
            textoOk="Costas e quadril visíveis"
            textoAviso="Enquadre as costas e o quadril da pessoa inclinada"
            semPoseOk
            onCancelar={() => setTirandoFoto(false)}
            onFoto={analisar}
          />
        )}
        {analisando && <p className="carregando">Medindo o contorno das costas…</p>}
        {analise && 'falhou' in analise && (
          <p className="pill pill-aviso estatico">Não conseguimos recortar as costas nesta foto. Tente com fundo liso e mais luz, ou use o escoliômetro abaixo.</p>
        )}
        {analise && !('falhou' in analise) && !resultado && <p className="pill pill-aviso estatico">As costas não apareceram inteiras. Tire a foto de novo.</p>}
        {analise && !('falhou' in analise) && resultado && <FotoAdams image={analise.foto.image} resultado={resultado} />}
        {resultado?.flexaoOk === false && <p className="dica-sec">O tronco parece pouco inclinado. Para o teste valer, as costas devem ficar quase na horizontal.</p>}
        {analise && (
          <button className="botao-sec" onClick={() => setAnalise(null)}>
            Tirar outra foto
          </button>
        )}
      </section>

      <section className="cartao formulario">
        <label className="campo">
          Escoliômetro (opcional, em graus)
          <input inputMode="decimal" value={escoliometro} onChange={(e) => setEscoliometro(e.target.value)} placeholder="Ex.: 4" />
        </label>
        <p className="dica-sec">Se você usou um escoliômetro, a leitura dele vale para a classificação. A medida da foto fica registrada para comparar.</p>
      </section>

      {classe && angulo !== null && (
        <section className="cartao">
          <ResultadoAdamsCartao angulo={angulo} classe={classe} lado={resultado?.lado ?? null} fonte={leitura !== null ? 'pelo escoliômetro' : 'pela foto'} />
        </section>
      )}

      <section className="cartao formulario">
        <CampoObservacoes valor={observacoes} onChange={setObservacoes} />
      </section>

      <button className="botao grande" disabled={angulo === null || avaliado.trim() === '' || salvando} onClick={salvarTeste}>
        Salvar no histórico
      </button>
      <AvisoTriagem>
        O Teste de Adams aponta sinais de assimetria nas costas. Só o médico, com exame de imagem, confirma escoliose.
      </AvisoTriagem>
    </>
  )
}

function ResultadoAdamsCartao({ angulo, classe, lado, fonte }: { angulo: number; classe: ReturnType<typeof classificarAdams>; lado: string | null; fonte: string }) {
  return (
    <>
      <div className="resultado-teste">
        <span className="valor-grande">{numero(angulo)}°</span>
        <span className={`chip chip-${classe.status}`}>{classe.titulo}</span>
      </div>
      <p className="dica">{classe.texto}</p>
      <p className="dica-sec">
        Ângulo de rotação do tronco medido {fonte}.{lado && angulo >= 3 ? ` Lado mais alto (gibosidade): ${lado}.` : ''}
      </p>
      <table className="tabela-classes">
        <caption>Pontos de corte (escoliômetro)</caption>
        <tbody>
          <tr className={classe.status === 'ok' ? 'atual' : ''}>
            <td>Menos de 5°</td>
            <td>Sem assimetria relevante</td>
          </tr>
          <tr className={classe.status === 'atencao' ? 'atual' : ''}>
            <td>5° a 6,9°</td>
            <td>Acompanhar e reavaliar</td>
          </tr>
          <tr className={classe.status === 'alerta' ? 'atual' : ''}>
            <td>7° ou mais</td>
            <td>Encaminhar ao médico</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

/** Foto com o contorno das costas, os dois pontos mais altos e a linha entre eles. */
function FotoAdams({ image, resultado: r }: { image: string; resultado: ResultadoAdams }) {
  const t = Math.max(r.largura, r.altura) / 160
  const { xEsq, yEsq, xDir, yDir, xMeio } = r.picos
  return (
    <svg className="pose-foto" viewBox={`0 0 ${r.largura} ${r.altura}`}>
      <image href={image} width={r.largura} height={r.altura} />
      <line x1={xMeio} x2={xMeio} y1={0} y2={r.altura} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={t * 0.5} strokeDasharray={`${t * 2} ${t * 2}`} />
      <polyline points={r.contorno.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#36F294" strokeWidth={t * 0.8} strokeLinejoin="round" />
      <line x1={xEsq} y1={yEsq} x2={xDir} y2={yDir} stroke="#FB8D1A" strokeWidth={t} strokeLinecap="round" />
      <line x1={xEsq} y1={Math.min(yEsq, yDir)} x2={xDir} y2={Math.min(yEsq, yDir)} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={t * 0.5} />
      {[
        [xEsq, yEsq],
        [xDir, yDir],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={t * 1.6} fill="#FB8D1A" stroke="#020B16" strokeWidth={t * 0.5} />
      ))}
    </svg>
  )
}

function Historico({ lista, onAbrir }: { lista: RegistroAdams[]; onAbrir: (id: string) => void }) {
  const grupos = useMemo(() => avaliados(lista).map((n) => doAvaliado(lista, n)), [lista])
  return (
    <>
      <h1>Histórico do Teste de Adams</h1>
      {grupos.map((g) => (
        <section className="cartao" key={g[0].avaliado}>
          <h2>{g[0].avaliado}</h2>
          <ul className="historico">
            {g.map((r) => {
              const a = anguloAdams(r)!
              return (
                <li key={r.id}>
                  <button onClick={() => onAbrir(r.id)}>
                    <span>{dataCurta(r.date)}</span>
                    <span className="nota">
                      {numero(a)}° · {ROTULO_STATUS[classificarAdams(a).status]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

function Detalhe(props: { registro: RegistroAdams; doMesmo: RegistroAdams[]; onAbrir: (id: string) => void; onMudou: () => void; onApagado: () => void }) {
  const { registro: r, doMesmo } = props
  const [obs, setObs] = useState(r.observacoes)
  const angulo = anguloAdams(r)!
  return (
    <>
      <h1>{r.avaliado}</h1>
      <p className="dica-sec">
        Teste de Adams · {dataCurta(r.date)} · celular {r.vista === 'costas' ? 'atrás' : 'na frente'}
        {r.atr !== null ? ` · foto: ${numero(r.atr)}°` : ''}
        {r.escoliometro !== null ? ` · escoliômetro: ${numero(r.escoliometro)}°` : ''}
      </p>
      <section className="cartao">
        <ResultadoAdamsCartao angulo={angulo} classe={classificarAdams(angulo)} lado={r.lado} fonte={r.escoliometro !== null ? 'pelo escoliômetro' : 'pela foto'} />
      </section>
      {r.foto && (
        <section className="cartao">
          <h2>Foto na flexão do tronco</h2>
          <FotoAdams image={r.foto.image} resultado={r.foto.resultado} />
        </section>
      )}
      <section className="cartao">
        <h2>Evolução</h2>
        <GraficoEvolucao
          unidade="graus"
          pontos={doMesmo.map((x) => {
            const a = anguloAdams(x)!
            return { date: x.date, valor: a, status: classificarAdams(a).status }
          })}
          referencias={[{ valor: 7, rotulo: 'encaminhar (7°)' }]}
        />
        {doMesmo.length > 1 && (
          <ul className="historico">
            {doMesmo.map((x) => (
              <li key={x.id}>
                <button onClick={() => props.onAbrir(x.id)} className={x.id === r.id ? 'ativo' : ''}>
                  <span>{dataCurta(x.date)}</span>
                  <span className="nota">{numero(anguloAdams(x)!)}°</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="cartao formulario">
        <CampoObservacoes valor={obs} onChange={setObs} />
        <button
          className="botao"
          disabled={obs === r.observacoes}
          onClick={() => {
            atualizar<RegistroAdams>(CHAVE_ADAMS, r.id, { observacoes: obs.trim() })
            props.onMudou()
          }}
        >
          Salvar observações
        </button>
      </section>
      <button
        className="botao-sec perigo"
        onClick={() => {
          if (!confirm('Apagar este teste do histórico?')) return
          apagar(CHAVE_ADAMS, r.id)
          props.onApagado()
        }}
      >
        Apagar teste
      </button>
      <AvisoTriagem>O Teste de Adams aponta sinais de assimetria nas costas. Só o médico, com exame de imagem, confirma escoliose.</AvisoTriagem>
    </>
  )
}
