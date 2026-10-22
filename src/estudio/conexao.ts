import type { Mensagem } from './tipos'

/** Ligação entre o celular de controle e um celular câmera. */
export type Canal = {
  enviar(m: Mensagem): void
  aoReceber(cb: (m: Mensagem) => void): void
  aoFechar(cb: () => void): void
  /** Bytes ainda na fila de envio (para não entupir ao mandar vídeo). */
  pendente(): number
  fechar(): void
}

export type Sala = {
  codigo: string
  aoConectar(cb: (c: Canal) => void): void
  fechar(): void
}

export class ErroConexao extends Error {
  tipo: 'codigo-em-uso' | 'codigo-nao-encontrado' | 'sem-internet'
  constructor(tipo: ErroConexao['tipo'], mensagem: string) {
    super(mensagem)
    this.tipo = tipo
  }
}

const PREFIXO = 'formacerta-estudio-'

export function gerarCodigo() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * Com ?local=1 no endereço, os "celulares" são abas do mesmo navegador.
 * Serve para testar sem internet. No uso normal, os celulares se ligam
 * direto entre si (WebRTC), e o servidor gratuito do PeerJS só apresenta um ao outro.
 */
const modoLocal = () => new URLSearchParams(window.location.search).has('local')

export function abrirSala(codigo: string): Promise<Sala> {
  return modoLocal() ? abrirSalaLocal(codigo) : abrirSalaPeer(codigo)
}

export function entrarSala(codigo: string): Promise<Canal> {
  return modoLocal() ? entrarSalaLocal(codigo) : entrarSalaPeer(codigo)
}

/** Guarda mensagens que chegam antes de alguém começar a ouvir. */
function filaDeEntrada() {
  let cb: ((m: Mensagem) => void) | null = null
  const fila: Mensagem[] = []
  return {
    chegou(m: Mensagem) {
      if (cb) cb(m)
      else fila.push(m)
    },
    ouvir(novo: (m: Mensagem) => void) {
      cb = novo
      fila.splice(0).forEach(novo)
    },
  }
}

// ---------- PeerJS (uso real, entre celulares) ----------

async function abrirSalaPeer(codigo: string): Promise<Sala> {
  const { Peer } = await import('peerjs')
  const peer = new Peer(PREFIXO + codigo)
  let aoConectar: (c: Canal) => void = () => {}
  await new Promise<void>((ok, falha) => {
    peer.once('open', () => ok())
    peer.once('error', (e) =>
      falha(
        e.type === 'unavailable-id'
          ? new ErroConexao('codigo-em-uso', 'Esse código já está em uso.')
          : new ErroConexao('sem-internet', 'Não foi possível abrir o estúdio. Verifique a internet.'),
      ),
    )
  })
  peer.on('connection', (conn) => {
    conn.on('open', () => aoConectar(canalPeer(conn)))
  })
  // Se a ligação com o servidor cair, os celulares já ligados continuam; tenta voltar.
  peer.on('disconnected', () => {
    if (!peer.destroyed) peer.reconnect()
  })
  return {
    codigo,
    aoConectar: (cb) => (aoConectar = cb),
    fechar: () => peer.destroy(),
  }
}

async function entrarSalaPeer(codigo: string): Promise<Canal> {
  const { Peer } = await import('peerjs')
  const peer = new Peer()
  return new Promise((ok, falha) => {
    peer.once('error', (e) =>
      falha(
        e.type === 'peer-unavailable'
          ? new ErroConexao('codigo-nao-encontrado', 'Estúdio não encontrado. Confira o código no celular de controle.')
          : new ErroConexao('sem-internet', 'Não foi possível conectar. Verifique a internet.'),
      ),
    )
    peer.once('open', () => {
      const conn = peer.connect(PREFIXO + codigo, { reliable: true, serialization: 'binary' })
      conn.once('open', () => {
        const canal = canalPeer(conn)
        const fechar = canal.fechar
        canal.fechar = () => {
          fechar()
          peer.destroy()
        }
        ok(canal)
      })
    })
  })
}

type ConexaoPeer = import('peerjs').DataConnection

function canalPeer(conn: ConexaoPeer): Canal {
  const entrada = filaDeEntrada()
  conn.on('data', (d) => entrada.chegou(d as Mensagem))
  return {
    enviar: (m) => conn.send(m),
    aoReceber: entrada.ouvir,
    aoFechar: (cb) => {
      conn.on('close', cb)
      conn.on('error', cb)
    },
    // O PeerJS segura mensagens na própria fila antes de passar ao canal.
    pendente: () => (conn.dataChannel?.bufferedAmount ?? 0) + ('bufferSize' in conn ? (conn.bufferSize as number) * 16 * 1024 : 0),
    fechar: () => conn.close(),
  }
}

// ---------- Local (abas do mesmo navegador, para testes) ----------

type Envelope =
  | { k: 'conectar'; de: string }
  | { k: 'aceito'; para: string }
  | { k: 'msg'; de: string; para: string; m: Mensagem }
  | { k: 'fechar'; de: string }

function canalLocal(bc: BroadcastChannel, eu: string, outro: string): Canal & { chegou(e: Envelope): void } {
  const entrada = filaDeEntrada()
  const fechados: (() => void)[] = []
  let aberto = true
  return {
    chegou(e) {
      if (e.k === 'msg' && e.de === outro && e.para === eu) entrada.chegou(e.m)
      if (e.k === 'fechar' && e.de === outro && aberto) {
        aberto = false
        fechados.forEach((cb) => cb())
      }
    },
    enviar: (m) => aberto && bc.postMessage({ k: 'msg', de: eu, para: outro, m } satisfies Envelope),
    aoReceber: entrada.ouvir,
    aoFechar: (cb) => fechados.push(cb),
    pendente: () => 0,
    fechar: () => {
      aberto = false
      bc.postMessage({ k: 'fechar', de: eu } satisfies Envelope)
    },
  }
}

async function abrirSalaLocal(codigo: string): Promise<Sala> {
  const bc = new BroadcastChannel(PREFIXO + codigo)
  const eu = 'controle'
  const canais = new Map<string, ReturnType<typeof canalLocal>>()
  let aoConectar: (c: Canal) => void = () => {}
  bc.onmessage = ({ data }: MessageEvent<Envelope>) => {
    if (data.k === 'conectar') {
      const c = canalLocal(bc, eu, data.de)
      canais.set(data.de, c)
      bc.postMessage({ k: 'aceito', para: data.de } satisfies Envelope)
      aoConectar(c)
      return
    }
    if (data.k === 'msg' || data.k === 'fechar') canais.get(data.de)?.chegou(data)
  }
  return {
    codigo,
    aoConectar: (cb) => (aoConectar = cb),
    fechar: () => {
      bc.postMessage({ k: 'fechar', de: eu } satisfies Envelope)
      bc.close()
    },
  }
}

function entrarSalaLocal(codigo: string): Promise<Canal> {
  const bc = new BroadcastChannel(PREFIXO + codigo)
  const eu = crypto.randomUUID()
  const canal = canalLocal(bc, eu, 'controle')
  return new Promise((ok, falha) => {
    const espera = setTimeout(() => {
      bc.close()
      falha(new ErroConexao('codigo-nao-encontrado', 'Estúdio não encontrado. Confira o código no celular de controle.'))
    }, 2000)
    bc.onmessage = ({ data }: MessageEvent<Envelope>) => {
      if (data.k === 'aceito' && data.para === eu) {
        clearTimeout(espera)
        const fechar = canal.fechar
        canal.fechar = () => {
          fechar()
          bc.close()
        }
        ok(canal)
        return
      }
      canal.chegou(data)
    }
    bc.postMessage({ k: 'conectar', de: eu } satisfies Envelope)
  })
}

// ---------- Par na memória (o próprio celular de controle também grava) ----------

export function canalPar(): [Canal, Canal] {
  const fechados: (() => void)[][] = [[], []]
  const entradas = [filaDeEntrada(), filaDeEntrada()]
  let aberto = true
  const lado = (eu: 0 | 1): Canal => ({
    // Assíncrono, como numa ligação de verdade.
    enviar: (m) => aberto && queueMicrotask(() => entradas[1 - eu].chegou(m)),
    aoReceber: entradas[eu].ouvir,
    aoFechar: (cb) => fechados[eu].push(cb),
    pendente: () => 0,
    fechar: () => {
      if (!aberto) return
      aberto = false
      fechados.flat().forEach((cb) => cb())
    },
  })
  return [lado(0), lado(1)]
}
