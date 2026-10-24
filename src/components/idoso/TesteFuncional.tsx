import { useState } from 'react'
import { embutirYoutube, useCronometro } from '../../idoso/cronometro'
import { classificar, linkVideo, ROTULO_GRUPO, grupoIdade, type DefTeste } from '../../idoso/testes'
import type { ResultadoTeste, Sexo } from '../../idoso/tipos'
import { lerNumero, numero } from '../../testes/formato'

const VIDEOS = 'formacerta:videos-idoso'

function videosProprios(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VIDEOS) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function guardarVideo(id: string, url: string) {
  try {
    const v = videosProprios()
    if (url) v[id] = url
    else delete v[id]
    localStorage.setItem(VIDEOS, JSON.stringify(v))
  } catch {
    /* ignora */
  }
}

/** Vídeo explicativo: o do profissional, se ele cadastrou, ou uma busca no YouTube. */
export function VideoExplicativo({ id, nome, busca }: { id: string; nome: string; busca: string }) {
  const [url, setUrl] = useState(() => videosProprios()[id] ?? '')
  const [aberto, setAberto] = useState(false)
  const embutido = url ? embutirYoutube(url) : null

  function trocar() {
    const novo = prompt(`Cole o link do seu vídeo de "${nome}" (YouTube, Instagram, Google Drive…). Deixe vazio para voltar ao padrão.`, url)
    if (novo === null) return
    guardarVideo(id, novo.trim())
    setUrl(novo.trim())
    setAberto(false)
  }

  return (
    <div className="video-explicativo">
      {embutido ? (
        aberto ? (
          <iframe src={embutido} title={`Vídeo: ${nome}`} allow="encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button className="botao-sec" onClick={() => setAberto(true)}>
            ▶ Ver vídeo explicativo
          </button>
        )
      ) : (
        <a className="botao-sec" href={url || busca} target="_blank" rel="noreferrer">
          ▶ {url ? 'Ver vídeo explicativo' : 'Ver vídeos explicativos no YouTube'}
        </a>
      )}
      <button className="link" onClick={trocar}>
        {url ? 'Trocar o vídeo' : 'Usar um vídeo meu'}
      </button>
    </div>
  )
}

const relogio = (s: number, decimos = false) => {
  const m = Math.floor(s / 60)
  const r = s - m * 60
  return `${m}:${(decimos ? r.toFixed(1) : String(Math.floor(r))).padStart(decimos ? 4 : 2, '0')}`
}

export function Cronometro({ c, duracao }: { c: ReturnType<typeof useCronometro>; duracao?: number }) {
  const mostrar = duracao ? Math.max(0, duracao - c.passado) : c.passado
  return (
    <div className="cronometro">
      <span className={`cronometro-tempo ${c.acabou ? 'fim' : ''}`}>{c.acabou ? 'Tempo!' : relogio(duracao ? Math.ceil(mostrar - 0.001) : mostrar, !duracao)}</span>
      {duracao && <div className="barra">
          <span style={{ width: `${Math.min(100, (c.passado / duracao) * 100)}%` }} />
        </div>}
      <div className="acoes">
        {c.rodando ? (
          <button className="botao" onClick={c.pausar}>
            {duracao ? 'Pausar' : 'Parar'}
          </button>
        ) : (
          <button className="botao" onClick={c.iniciar} disabled={c.acabou}>
            {c.passado > 0 && !c.acabou ? 'Continuar' : 'Iniciar'}
          </button>
        )}
        <button className="botao-sec" onClick={c.zerar} disabled={c.rodando || c.passado === 0}>
          Zerar
        </button>
      </div>
    </div>
  )
}

export function Contador({ valor, onChange, rotulo }: { valor: number; onChange: (v: number) => void; rotulo: string }) {
  return (
    <div className="contador">
      <button
        className="contador-mais"
        onClick={() => {
          navigator.vibrate?.(30)
          onChange(valor + 1)
        }}
      >
        <strong>{valor}</strong>
        <span>{rotulo} · toque para contar</span>
      </button>
      <button className="botao-sec contador-menos" onClick={() => onChange(Math.max(0, valor - 1))} disabled={valor === 0}>
        − 1
      </button>
    </div>
  )
}

const PERCURSO = 'formacerta:percurso-caminhada'

type Props = {
  def: DefTeste
  inicial?: ResultadoTeste
  idade: number | null
  sexo: Sexo | null
  onSalvar: (r: ResultadoTeste | null) => void
  onVoltar: () => void
}

/** Um teste da bateria: como fazer, vídeo, cronômetro, contador, resultado e observação. */
export function TesteFuncional({ def, inicial, idade, sexo, onSalvar, onVoltar }: Props) {
  const [texto, setTexto] = useState(inicial ? String(inicial.valor).replace('.', ',') : '')
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '')
  const [contagem, setContagem] = useState(0)
  const [percurso, setPercurso] = useState(() => {
    try {
      return localStorage.getItem(PERCURSO) ?? '30'
    } catch {
      return '30'
    }
  })
  const [extra, setExtra] = useState('')
  const [tentativas, setTentativas] = useState<number[]>([])
  const c = useCronometro(def.modo === 'cronometro' ? undefined : def.duracao)

  const valor = lerNumero(texto)
  const classe = valor !== null ? classificar(def, valor, idade, sexo) : null

  function contar(n: number) {
    setContagem(n)
    if (def.modo === 'contagem') setTexto(String(n))
    if (def.modo === 'distancia') distancia(n, percurso, extra)
  }

  function distancia(voltas: number, p: string, e: string) {
    const total = voltas * (lerNumero(p) ?? 0) + (lerNumero(e) ?? 0)
    setTexto(total > 0 ? String(Math.round(total)) : '')
  }

  function guardarTentativa() {
    const t = Math.round(c.passado * 10) / 10
    const lista = [...tentativas, t]
    setTentativas(lista)
    setTexto(numero(Math.min(...lista)))
    c.zerar()
  }

  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">{def.mede}</span>
        <h1>{def.nome}</h1>
        <p className="dica-sec">
          <b>Material:</b> {def.material}
        </p>
        <VideoExplicativo id={def.id} nome={def.nome} busca={linkVideo(def)} />
      </section>

      <section className="cartao">
        <h2>Como fazer</h2>
        <ol className="passos-teste">
          {def.passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>

      <section className="cartao">
        <h2>{def.modo === 'cronometro' ? 'Cronômetro' : `Cronômetro de ${def.duracao! >= 60 ? `${def.duracao! / 60} min` : `${def.duracao} s`}`}</h2>
        <Cronometro c={c} duracao={def.modo === 'cronometro' ? undefined : def.duracao} />
        {def.modo === 'cronometro' && !c.rodando && c.passado > 0 && (
          <button className="botao-sec" onClick={guardarTentativa} style={{ marginTop: 10 }}>
            Guardar {numero(c.passado)} s como {tentativas.length + 1}ª tentativa
          </button>
        )}
        {def.modo === 'cronometro' && c.rodando && (
          <button className="contador-mais" onClick={c.pausar}>
            <strong>Sentou</strong>
            <span>toque quando a pessoa sentar</span>
          </button>
        )}
        {tentativas.length > 0 && (
          <p className="dica-sec">
            Tentativas: {tentativas.map((t) => `${numero(t)} s`).join(' · ')}. Vale o menor tempo.
          </p>
        )}
        {def.modo === 'contagem' && <Contador valor={contagem} onChange={contar} rotulo={def.unidade} />}
        {def.modo === 'distancia' && (
          <>
            <label className="campo">
              Tamanho de uma volta no percurso (m)
              <input
                inputMode="decimal"
                value={percurso}
                onChange={(e) => {
                  setPercurso(e.target.value)
                  try {
                    localStorage.setItem(PERCURSO, e.target.value)
                  } catch {
                    /* ignora */
                  }
                  distancia(contagem, e.target.value, extra)
                }}
              />
            </label>
            <Contador valor={contagem} onChange={contar} rotulo="voltas" />
            <label className="campo">
              Metros da última volta incompleta
              <input
                inputMode="decimal"
                value={extra}
                onChange={(e) => {
                  setExtra(e.target.value)
                  distancia(contagem, percurso, e.target.value)
                }}
              />
            </label>
          </>
        )}
      </section>

      <section className="cartao formulario">
        <h2>Resultado</h2>
        <label className="campo">
          {def.modo === 'medida' ? `Melhor de 2 tentativas (${def.unidade}; negativo se não alcançou)` : `Resultado (${def.unidade})`}
          <input inputMode={def.modo === 'medida' ? 'text' : 'decimal'} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: 14" />
        </label>
        {valor !== null && (
          <div className="resultado-teste">
            <span className="valor-grande">
              {numero(valor, def.unidade === 's' ? 1 : 0)} <small>{def.unidade}</small>
            </span>
            {classe && <span className={`chip chip-${classe.status}`}>{classe.rotulo}</span>}
          </div>
        )}
        {classe?.faixa && idade !== null && sexo && (
          <p className="dica-sec">
            Esperado para {sexo === 'feminino' ? 'mulheres' : 'homens'} de {ROTULO_GRUPO[grupoIdade(idade)]} anos: {numero(classe.faixa[0], def.unidade === 's' ? 1 : 0)} a{' '}
            {numero(classe.faixa[1], def.unidade === 's' ? 1 : 0)} {def.unidade}.
          </p>
        )}
        {(idade === null || !sexo) && <p className="dica-sec">Preencha idade e sexo na anamnese para comparar com o esperado para a idade.</p>}
        <label className="campo">
          Observação
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Ex.: apoiou a mão na parede, sentiu dor no joelho…" />
        </label>
        <button className="botao" disabled={valor === null} onClick={() => onSalvar({ valor: valor!, observacao: observacao.trim() })}>
          Salvar resultado
        </button>
        {inicial && (
          <button className="botao-sec perigo" onClick={() => onSalvar(null)}>
            Tirar este teste da avaliação
          </button>
        )}
        <button className="botao-sec" onClick={onVoltar}>
          Voltar sem salvar
        </button>
      </section>
    </>
  )
}
