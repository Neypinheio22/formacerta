import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { abrirSala, canalPar, ErroConexao, gerarCodigo, type Canal, type Sala } from '../../estudio/conexao'
import { receptorDeVideo } from '../../estudio/gravador'
import { salvarReferencia } from '../../estudio/biblioteca'
import { formatarTempo } from '../../estudio/relogio'
import { ANGULOS, nomeAngulo, type Angulo, type EstadoCamera, type Referencia, type VideoAngulo } from '../../estudio/tipos'
import { speak } from '../../voz'
import { PainelCamera } from './PainelCamera'
import { PlayerSincronizado } from './PlayerSincronizado'

type Props = { onSair: () => void; onSalvo: (r: Referencia) => void }

type Camera = { id: string; angulo: Angulo | null; estado: EstadoCamera; progresso: number; canal: Canal }

type Fase = 'pronto' | 'contagem' | 'gravando' | 'recebendo' | 'revisao'

const CONTAGEM = 3
const PERSONAL = 'formacerta:personal'

/** Celular de controle: abre o estúdio, mostra as câmeras e grava em todas ao mesmo tempo. */
export function EstudioControle({ onSair, onSalvo }: Props) {
  const [sala, setSala] = useState<Sala | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [fase, setFase] = useState<Fase>('pronto')
  const [contagem, setContagem] = useState(0)
  const [take, setTake] = useState('')
  const [recebidos, setRecebidos] = useState<VideoAngulo[]>([])
  const [esperando, setEsperando] = useState<string[]>([])
  const [local, setLocal] = useState<Angulo | null>(null)
  const [nome, setNome] = useState('')
  const [personal, setPersonal] = useState(() => localStorage.getItem(PERSONAL) ?? '')
  const [copiado, setCopiado] = useState(false)
  const [inicioGravacao, setInicioGravacao] = useState(0)
  const [agora, setAgora] = useState(0)
  const takeRef = useRef('')

  const atualizar = (id: string, mudanca: Partial<Camera>) => setCameras((cs) => cs.map((c) => (c.id === id ? { ...c, ...mudanca } : c)))

  // Cada câmera que entra (de outro celular ou deste mesmo) passa por aqui.
  const receber = useCallback((canal: Canal) => {
    const id = crypto.randomUUID()
    const receptor = receptorDeVideo((p) => atualizar(id, { progresso: p }))
    let angulo: Angulo | null = null
    setCameras((cs) => [...cs, { id, angulo: null, estado: 'pronta', progresso: 0, canal }])
    canal.aoReceber((m) => {
      if (m.t === 'ping') return canal.enviar({ t: 'pong', id: m.id, enviado: m.enviado, controle: Date.now() })
      if (m.t === 'ola') {
        angulo = m.angulo
        return atualizar(id, { angulo })
      }
      if (m.t === 'estado') return atualizar(id, { estado: m.estado })
      const pronto = receptor(m)
      if (!pronto || pronto.take !== takeRef.current) return
      canal.enviar({ t: 'recebido', take: pronto.take })
      const a = angulo
      if (a) setRecebidos((r) => [...r, { angulo: a, video: pronto.video, inicio: pronto.inicio, duracao: pronto.duracao }])
      setEsperando((e) => e.filter((x) => x !== id))
    })
    canal.aoFechar(() => {
      setCameras((cs) => cs.filter((c) => c.id !== id))
      setEsperando((e) => e.filter((x) => x !== id))
    })
  }, [])

  // Abre o estúdio com um código novo.
  useEffect(() => {
    let aberta: Sala | null = null
    let cancelado = false
    ;(async () => {
      for (let tentativa = 0; tentativa < 4 && !cancelado; tentativa++) {
        try {
          const s = await abrirSala(gerarCodigo())
          if (cancelado) return s.fechar()
          aberta = s
          s.aoConectar(receber)
          setSala(s)
          return
        } catch (e) {
          if (!(e instanceof ErroConexao && e.tipo === 'codigo-em-uso')) {
            setErro(e instanceof Error ? e.message : 'Não foi possível abrir o estúdio.')
            return
          }
        }
      }
    })()
    return () => {
      cancelado = true
      aberta?.fechar()
    }
  }, [receber])

  // Este celular também pode ser uma das câmeras.
  const parLocal = useMemo(() => (local ? canalPar() : null), [local])
  useEffect(() => {
    if (!parLocal) return
    receber(parLocal[0])
    return () => {
      parLocal[0].fechar()
      parLocal[1].fechar()
    }
  }, [parLocal, receber])

  // Terminou de receber de todas as câmeras.
  useEffect(() => {
    if (fase === 'recebendo' && esperando.length === 0) setFase(recebidos.length ? 'revisao' : 'pronto')
  }, [fase, esperando, recebidos])

  useEffect(() => {
    if (fase !== 'contagem') return
    if (contagem === 0) {
      speak('Já')
      setFase('gravando')
      return
    }
    speak(String(contagem))
    const id = setTimeout(() => setContagem(contagem - 1), 1000)
    return () => clearTimeout(id)
  }, [fase, contagem])

  useEffect(() => {
    if (fase !== 'gravando') return
    const id = setInterval(() => setAgora(Date.now()), 250)
    return () => clearInterval(id)
  }, [fase])

  const prontas = cameras.filter((c) => c.angulo && c.estado === 'pronta')
  const repetidos = ANGULOS.filter((a) => cameras.filter((c) => c.angulo === a.id).length > 1)

  function gravar() {
    const novo = crypto.randomUUID()
    const em = Date.now() + CONTAGEM * 1000
    setTake(novo)
    takeRef.current = novo
    setRecebidos([])
    setEsperando(prontas.map((c) => c.id))
    setInicioGravacao(em)
    prontas.forEach((c) => c.canal.enviar({ t: 'gravar', take: novo, em }))
    setContagem(CONTAGEM)
    setFase('contagem')
  }

  function parar() {
    if (fase === 'contagem') {
      cameras.forEach((c) => c.canal.enviar({ t: 'cancelar' }))
      setEsperando([])
      setFase('pronto')
      return
    }
    speak('Pronto')
    cameras.forEach((c) => c.canal.enviar({ t: 'parar', take }))
    setFase('recebendo')
  }

  async function salvar() {
    localStorage.setItem(PERSONAL, personal.trim())
    const ordem = ANGULOS.map((a) => a.id)
    const r: Referencia = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      personal: personal.trim(),
      data: new Date().toISOString(),
      videos: [...recebidos].sort((a, b) => ordem.indexOf(a.angulo) - ordem.indexOf(b.angulo)),
    }
    try {
      await salvarReferencia(r)
      onSalvo(r)
    } catch {
      setErro('Não deu para salvar: o celular está sem espaço. Apague referências antigas e tente de novo.')
    }
  }

  function compartilhar() {
    if (!sala) return
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('estudio', sala.codigo)
    if (new URLSearchParams(window.location.search).has('local')) url.searchParams.set('local', '1')
    const texto = `Câmera do estúdio FormaCerta, código ${sala.codigo}`
    if (navigator.share) navigator.share({ title: 'FormaCerta', text: texto, url: url.href }).catch(() => {})
    else
      navigator.clipboard?.writeText(url.href).then(
        () => setCopiado(true),
        () => {},
      )
  }

  if (fase === 'revisao') {
    const ordenados = [...recebidos].sort((a, b) => ANGULOS.findIndex((x) => x.id === a.angulo) - ANGULOS.findIndex((x) => x.id === b.angulo))
    return (
      <div className="tela">
        <header className="topo">
          <button className="voltar" onClick={() => setFase('pronto')}>
            ← Gravar de novo
          </button>
          <span className="passo">Revisão</span>
        </header>
        <h1>Ficou bom?</h1>
        <PlayerSincronizado videos={ordenados} />
        <label className="campo">
          Nome do exercício
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Agachamento livre" />
        </label>
        <label className="campo">
          Personal
          <input value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="Seu nome" />
        </label>
        {erro && <p className="pill pill-aviso estatico">{erro}</p>}
        <div className="acoes">
          <button className="botao-sec" onClick={() => setFase('pronto')}>
            Descartar
          </button>
          <button className="botao" onClick={salvar} disabled={!nome.trim()}>
            Salvar referência
          </button>
        </div>
      </div>
    )
  }

  const ocupado = fase !== 'pronto'

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onSair} disabled={ocupado}>
          ← Sair
        </button>
        <span className="passo">Controle do estúdio</span>
      </header>

      {erro && <p className="camera-erro">{erro}</p>}
      {!sala && !erro && <p className="carregando">Abrindo o estúdio…</p>}

      {sala && (
        <>
          <section className="cartao destaque codigo-estudio">
            <span className="etiqueta">Código do estúdio</span>
            <strong className="codigo" data-testid="codigo">
              {sala.codigo}
            </strong>
            <p className="dica-sec">
              Nos outros celulares, abra o FormaCerta, toque em <b>Modo estúdio → Este celular é uma câmera</b> e digite este código.
            </p>
            <button className="botao-sec" onClick={compartilhar}>
              {copiado ? 'Link copiado' : 'Enviar link para os celulares'}
            </button>
          </section>

          <section className="cartao">
            <h2>Câmeras ({cameras.filter((c) => c.angulo).length})</h2>
            {cameras.length === 0 && <p className="dica-sec">Nenhuma câmera conectada ainda.</p>}
            <ul className="lista-cameras">
              {cameras.map((c) => (
                <li key={c.id}>
                  <span>{c.angulo ? nomeAngulo(c.angulo) : 'Conectando…'}</span>
                  <span className={`chip chip-${c.estado === 'gravando' ? 'alerta' : c.estado === 'sem-camera' ? 'atencao' : 'ok'}`}>
                    {c.estado === 'enviando' ? `Enviando ${Math.round(c.progresso * 100)}%` : ROTULO[c.estado]}
                  </span>
                </li>
              ))}
            </ul>
            {repetidos.length > 0 && (
              <p className="pill pill-aviso estatico">Dois celulares estão como {repetidos.map((a) => a.label).join(' e ')}. Troque o ângulo de um deles.</p>
            )}
          </section>

          <section className="cartao">
            <h2>Este celular também grava?</h2>
            <div className="timer esquerda">
              <button className={local === null ? 'ativo' : ''} onClick={() => setLocal(null)} disabled={ocupado}>
                Não
              </button>
              {ANGULOS.map((a) => (
                <button key={a.id} className={local === a.id ? 'ativo' : ''} onClick={() => setLocal(a.id)} disabled={ocupado}>
                  {a.label}
                </button>
              ))}
            </div>
            {parLocal && local && <PainelCamera key={local} canal={parLocal[1]} angulo={local} compacto />}
          </section>

          <div className="gravar-estudio">
            {fase === 'contagem' && <span className="contagem-estudio">{contagem}</span>}
            {fase === 'gravando' && <span className="tempo-gravando">● {formatarTempo(Math.max(0, agora - inicioGravacao) / 1000)}</span>}
            {fase === 'recebendo' && <span className="dica-sec">Recebendo os vídeos… ({recebidos.length} de {recebidos.length + esperando.length})</span>}
            <button
              className={`disparo ${fase === 'gravando' || fase === 'contagem' ? 'parar' : ''}`}
              onClick={fase === 'pronto' ? gravar : parar}
              disabled={fase === 'recebendo' || (fase === 'pronto' && prontas.length === 0)}
              aria-label={fase === 'pronto' ? 'Gravar em todas as câmeras' : 'Parar'}
            >
              <span />
            </button>
            <p className="dica-sec">
              {fase === 'pronto'
                ? prontas.length
                  ? `Toque para gravar nas ${prontas.length} câmera(s) ao mesmo tempo.`
                  : 'Conecte ao menos uma câmera para gravar.'
                : fase === 'recebendo'
                  ? 'Não feche o app nos celulares.'
                  : 'Toque para parar.'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

const ROTULO: Record<EstadoCamera, string> = {
  pronta: 'Pronta',
  'sem-camera': 'Sem câmera',
  gravando: 'Gravando',
  enviando: 'Enviando',
}

