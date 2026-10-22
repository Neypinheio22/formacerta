import type { Canal } from './conexao'
import type { Mensagem } from './tipos'

const TIPOS = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function tipoDeVideo() {
  return TIPOS.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}

/** Abre a câmera traseira em boa resolução, com som (para a palma de sincronia, se quiser). */
export async function abrirCamera(lado: 'user' | 'environment'): Promise<MediaStream> {
  const video = { facingMode: lado, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: true })
  } catch {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false })
  }
}

export type Gravacao = { video: Blob; inicio: number; duracao: number }

/** Grava o stream. `inicio` e `duracao` em ms, no relógio local. */
export function gravar(stream: MediaStream) {
  const tipo = tipoDeVideo()
  const rec = new MediaRecorder(stream, { ...(tipo && { mimeType: tipo }), videoBitsPerSecond: 2_500_000 })
  const partes: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
  rec.start(1000)
  // Marca a hora logo depois de mandar começar; o evento "start" pode chegar atrasado se o celular estiver ocupado.
  const inicio = Date.now()
  return {
    parar: () =>
      new Promise<Gravacao>((ok) => {
        rec.onstop = () => ok({ video: new Blob(partes, { type: rec.mimeType || tipo || 'video/webm' }), inicio, duracao: Date.now() - inicio })
        if (rec.state === 'inactive') rec.onstop(new Event('stop'))
        else rec.stop()
      }),
  }
}

// Abaixo do limite de 16300 bytes por mensagem do PeerJS, para não ser picado de novo.
const PARTE = 15 * 1024
const LIMITE_FILA = 1024 * 1024

/** Manda o vídeo em pedaços, esperando a fila esvaziar para não travar a ligação. */
export async function enviarVideo(canal: Canal, take: string, g: Gravacao, inicioControle: number, progresso: (p: number) => void) {
  const dados = await g.video.arrayBuffer()
  canal.enviar({ t: 'video-inicio', take, tipo: g.video.type, tamanho: dados.byteLength, inicio: inicioControle, duracao: g.duracao })
  for (let i = 0, n = 0; i < dados.byteLength; i += PARTE, n++) {
    while (canal.pendente() > LIMITE_FILA) await new Promise((r) => setTimeout(r, 30))
    canal.enviar({ t: 'video-parte', take, i: n, dados: dados.slice(i, i + PARTE) })
    if (n % 16 === 0) progresso(i / dados.byteLength)
  }
  canal.enviar({ t: 'video-fim', take })
  progresso(1)
}

export type VideoRecebido = { tipo: string; inicio: number; duracao: number; video: Blob }

/** Monta o vídeo que chega em pedaços. Devolve o vídeo pronto quando termina. */
export function receptorDeVideo(aoProgresso: (p: number) => void) {
  let atual: { take: string; tipo: string; tamanho: number; inicio: number; duracao: number; partes: ArrayBuffer[]; recebido: number } | null = null
  return (m: Mensagem): (VideoRecebido & { take: string }) | null => {
    if (m.t === 'video-inicio') {
      atual = { take: m.take, tipo: m.tipo, tamanho: m.tamanho, inicio: m.inicio, duracao: m.duracao, partes: [], recebido: 0 }
      aoProgresso(0)
    } else if (m.t === 'video-parte' && atual?.take === m.take) {
      atual.partes[m.i] = m.dados
      atual.recebido += m.dados.byteLength
      aoProgresso(atual.tamanho ? atual.recebido / atual.tamanho : 1)
    } else if (m.t === 'video-fim' && atual?.take === m.take) {
      const a = atual
      atual = null
      aoProgresso(1)
      return { take: a.take, tipo: a.tipo, inicio: a.inicio, duracao: a.duracao, video: new Blob(a.partes, { type: a.tipo }) }
    }
    return null
  }
}

/** Mantém a tela acesa enquanto o celular está no tripé. */
export async function manterTelaAcesa(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request('screen')
    return () => void lock?.release().catch(() => {})
  } catch {
    return () => {}
  }
}
