// Ligação de vídeo direta entre os dois celulares (WebRTC pelo PeerJS, o mesmo
// do modo estúdio). O servidor do PeerJS só apresenta os dois aparelhos; a
// imagem e o som vão direto de um para o outro (ou por um retransmissor quando
// a rede não deixa). O personal liga para o aluno e tenta de novo até conectar.

import type { MediaConnection, Peer as TipoPeer } from 'peerjs'

const PREFIXO = 'formacerta-video-'

export type Lado = 'aluno' | 'personal'

export type EstadoLigacao = 'abrindo-camera' | 'conectando' | 'conectado' | 'reconectando' | 'erro'

export type Ligacao = {
  local: MediaStream
  virarCamera: () => Promise<void>
  ligarMicrofone: (ligado: boolean) => void
  ligarCamera: (ligada: boolean) => void
  fechar: () => void
}

type Eventos = {
  aoEstado: (e: EstadoLigacao, detalhe?: string) => void
  aoRemoto: (s: MediaStream) => void
  /** A própria câmera já abriu (mostra no canto antes de conectar). */
  aoLocal?: (s: MediaStream) => void
}

const idDe = (chamada: string, lado: Lado) => PREFIXO + chamada + '-' + lado

// Servidor próprio de apresentação (opcional). Sem ele, usa o servidor gratuito do PeerJS.
const HOST = import.meta.env.VITE_PEERJS_HOST as string | undefined
const opcoesPeer = () =>
  HOST ? { host: HOST, port: Number(import.meta.env.VITE_PEERJS_PORT ?? 443), path: (import.meta.env.VITE_PEERJS_PATH as string | undefined) ?? '/', secure: import.meta.env.VITE_PEERJS_SECURE !== 'false' } : {}

async function abrirCamera(frente: boolean) {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { facingMode: frente ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
  })
}

/** sinal: a tela fechou antes de conectar (desiste e libera a câmera). */
export async function iniciarLigacao(chamada: string, lado: Lado, ev: Eventos, sinal?: AbortSignal): Promise<Ligacao> {
  ev.aoEstado('abrindo-camera')
  let frente = true
  let local: MediaStream
  try {
    local = await abrirCamera(frente)
  } catch {
    ev.aoEstado('erro', 'Libere a câmera e o microfone para o FormaCerta nas configurações do navegador.')
    throw new Error('sem-camera')
  }
  const desistir = () => {
    local.getTracks().forEach((t) => t.stop())
    return new Error('cancelada')
  }
  if (sinal?.aborted) throw desistir()

  ev.aoLocal?.(local)
  ev.aoEstado('conectando')
  const { Peer } = await import('peerjs')
  let fechado = false
  let peer: TipoPeer | null = null
  let atual: MediaConnection | null = null
  let tentativa: ReturnType<typeof setTimeout> | undefined

  const usar = (c: MediaConnection) => {
    const velha = atual
    atual = c
    velha?.close()
    c.on('stream', (s) => {
      ev.aoRemoto(s)
      ev.aoEstado('conectado')
    })
    c.on('close', () => {
      if (fechado || atual !== c) return
      ev.aoEstado('reconectando')
      if (lado === 'personal') agendar(1500)
    })
    c.on('error', () => {
      if (!fechado && lado === 'personal') agendar(2000)
    })
  }

  const ligar = () => {
    if (fechado || !peer || peer.destroyed) return
    usar(peer.call(idDe(chamada, 'aluno'), local))
    // Sem resposta em 8 segundos, tenta de novo (o aluno pode estar abrindo a câmera).
    agendar(8000, true)
  }

  function agendar(ms: number, soSeNaoConectou = false) {
    clearTimeout(tentativa)
    tentativa = setTimeout(() => {
      if (soSeNaoConectou && atual?.remoteStream) return
      ligar()
    }, ms)
  }

  const abrirPeer = () =>
    new Promise<TipoPeer>((ok, falha) => {
      const p = new Peer(idDe(chamada, lado), opcoesPeer())
      p.once('open', () => ok(p))
      p.on('error', (e) => {
        // O aluno ainda não entrou: o personal tenta de novo daqui a pouco.
        if (e.type === 'peer-unavailable') return agendar(2500)
        if (e.type === 'unavailable-id') return falha(e)
        if (!fechado) ev.aoEstado('reconectando')
      })
      p.on('disconnected', () => {
        if (!p.destroyed && !fechado) p.reconnect()
      })
      if (lado === 'aluno') {
        p.on('call', (c) => {
          if (c.peer !== idDe(chamada, 'personal')) return c.close()
          c.answer(local)
          usar(c)
        })
      }
    })

  // O mesmo nome pode ficar preso alguns segundos depois de recarregar a página.
  for (let i = 0; i < 6 && !peer && !sinal?.aborted; i++) {
    try {
      peer = await abrirPeer()
    } catch {
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  if (sinal?.aborted) {
    peer?.destroy()
    throw desistir()
  }
  if (!peer) {
    local.getTracks().forEach((t) => t.stop())
    ev.aoEstado('erro', 'Não deu para conectar. Confira a internet e tente de novo.')
    throw new Error('sem-conexao')
  }
  if (lado === 'personal') ligar()

  return {
    local,
    async virarCamera() {
      frente = !frente
      let nova: MediaStream
      try {
        nova = await navigator.mediaDevices.getUserMedia({ video: { facingMode: frente ? 'user' : 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
      } catch {
        frente = !frente
        return
      }
      const trilha = nova.getVideoTracks()[0]
      const velha = local.getVideoTracks()[0]
      trilha.enabled = velha?.enabled ?? true
      const envio = atual?.peerConnection?.getSenders().find((s) => s.track?.kind === 'video')
      await envio?.replaceTrack(trilha)
      if (velha) {
        local.removeTrack(velha)
        velha.stop()
      }
      local.addTrack(trilha)
    },
    ligarMicrofone: (ligado) => local.getAudioTracks().forEach((t) => (t.enabled = ligado)),
    ligarCamera: (ligada) => local.getVideoTracks().forEach((t) => (t.enabled = ligada)),
    fechar() {
      fechado = true
      clearTimeout(tentativa)
      atual?.close()
      peer?.destroy()
      local.getTracks().forEach((t) => t.stop())
    },
  }
}
