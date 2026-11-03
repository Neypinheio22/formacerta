import { supabase } from './cliente'

/** O navegador sabe receber notificação com o app fechado? (iPhone só com o app instalado.) */
export const pushSuportado = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export type EstadoPush = 'sem-suporte' | 'precisa-instalar' | 'desligado' | 'ligado' | 'bloqueado'

export const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const appInstalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function estadoPush(): EstadoPush {
  if (!pushSuportado()) return ehIphone() && !appInstalado() ? 'precisa-instalar' : 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  return Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

export function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

function paraBytes(b64url: string) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4)
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

let chaveGuardada: string | null = null
async function chavePublica() {
  if (chaveGuardada) return chaveGuardada
  const { data, error } = await supabase.functions.invoke('enviar-push', { body: { acao: 'chave' } })
  if (error || !data?.publica) throw new Error('sem chave')
  chaveGuardada = data.publica as string
  return chaveGuardada
}

async function salvar(inscricao: PushSubscription) {
  const j = inscricao.toJSON()
  const { error } = await supabase.rpc('salvar_inscricao_push', { endpoint: inscricao.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' })
  return !error
}

/** Pede permissão e inscreve este celular. Devolve null se deu certo ou a mensagem do problema. */
export async function ativarPush(): Promise<string | null> {
  if (!pushSuportado()) return ehIphone() ? 'No iPhone, instale o FormaCerta na tela de início primeiro (Compartilhar → Adicionar à Tela de Início).' : 'Este navegador não recebe notificações.'
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return 'As notificações foram bloqueadas. Libere nas configurações do navegador para este site.'
  try {
    const reg = await navigator.serviceWorker.register('./sw.js')
    await navigator.serviceWorker.ready
    let inscricao = await reg.pushManager.getSubscription()
    if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(await chavePublica()) })
    return (await salvar(inscricao)) ? null : 'Não deu para salvar agora. Tente de novo.'
  } catch {
    return 'Não deu para ativar agora. Tente de novo em instantes.'
  }
}

/** Já tinha permitido: confirma a inscrição deste celular para a conta que entrou (sem perguntar nada). */
export async function sincronizarPush() {
  if (estadoPush() !== 'ligado') return
  try {
    const reg = await navigator.serviceWorker.ready
    let inscricao = await reg.pushManager.getSubscription()
    if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(await chavePublica()) })
    await salvar(inscricao)
  } catch {
    // Sem push neste aparelho: o app continua funcionando normalmente.
  }
}

/** Ao sair da conta, este celular para de receber avisos dela. */
export async function desligarPush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const inscricao = await reg?.pushManager.getSubscription()
    if (inscricao) await supabase.rpc('apagar_inscricao_push', { endpoint: inscricao.endpoint })
  } catch {
    // Nada a fazer.
  }
}

// ---------- Instalar o app (item 12) ----------

type PedidoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let pedidoInstalar: PedidoInstalar | null = null

/** Guarda o convite de instalação do Android/Chrome para usar no botão. Chamar uma vez ao abrir o app. */
export function prepararInstalacao() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pedidoInstalar = e as PedidoInstalar
    window.dispatchEvent(new Event('formacerta:instalavel'))
  })
  window.addEventListener('appinstalled', () => {
    pedidoInstalar = null
    window.dispatchEvent(new Event('formacerta:instalavel'))
  })
}

export const podeInstalarDireto = () => !!pedidoInstalar

/** Abre a janela "Instalar o FormaCerta" do Android. true = instalou. */
export async function instalarApp() {
  if (!pedidoInstalar) return false
  const p = pedidoInstalar
  await p.prompt()
  const { outcome } = await p.userChoice
  pedidoInstalar = null
  window.dispatchEvent(new Event('formacerta:instalavel'))
  return outcome === 'accepted'
}
