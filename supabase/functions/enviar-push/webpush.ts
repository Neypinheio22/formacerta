// Web Push sem biblioteca: só WebCrypto (funciona no Deno do Supabase e no Node).
// Chaves VAPID (RFC 8292) e criptografia aes128gcm (RFC 8291).

export type ChavesVapid = { publica: string; privada: JsonWebKey }
export type Inscricao = { endpoint: string; p256dh: string; auth: string }

const te = new TextEncoder()

export function paraB64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function deB64url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texto.length + 3) % 4)
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function juntar(...partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((t, p) => t + p.length, 0))
  let i = 0
  for (const p of partes) {
    out.set(p, i)
    i += p.length
  }
  return out
}

/** Gera um par de chaves VAPID. A pública vai para o navegador; a privada fica no banco. */
export async function gerarChavesVapid(): Promise<ChavesVapid> {
  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const publica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))
  const privada = await crypto.subtle.exportKey('jwk', par.privateKey)
  return { publica: paraB64url(publica), privada }
}

async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, bits: number) {
  const chave = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, chave, bits))
}

/** Cifra a mensagem para uma inscrição (um registro só, aes128gcm). */
export async function cifrar(texto: string, inscricao: Pick<Inscricao, 'p256dh' | 'auth'>, sal = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublica = deB64url(inscricao.p256dh)
  const segredo = deB64url(inscricao.auth)
  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const chaveUa = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: chaveUa }, local.privateKey, 256))

  const ikm = await hkdf(segredo, ecdh, juntar(te.encode('WebPush: info\0'), uaPublica, asPublica), 256)
  const cek = await hkdf(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 128)
  const nonce = await hkdf(sal, ikm, te.encode('Content-Encoding: nonce\0'), 96)

  const chaveAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 = último registro, sem enchimento.
  const claro = juntar(te.encode(texto), new Uint8Array([2]))
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chaveAes, claro))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return juntar(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado)
}

/** Token VAPID (JWT ES256) para o servidor de push do navegador. */
export async function tokenVapid(endpoint: string, chaves: ChavesVapid, contato: string, agora = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin
  const cabecalho = paraB64url(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const corpo = paraB64url(te.encode(JSON.stringify({ aud, exp: agora + 12 * 3600, sub: contato })))
  const privada = await crypto.subtle.importKey('jwk', chaves.privada, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const assinatura = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privada, te.encode(`${cabecalho}.${corpo}`)))
  return `${cabecalho}.${corpo}.${paraB64url(assinatura)}`
}

/**
 * Manda uma notificação. Devolve o status HTTP do servidor de push:
 * 201 = entregue; 404 ou 410 = inscrição morta (apagar).
 */
export async function enviarPush(inscricao: Inscricao, dados: unknown, chaves: ChavesVapid, opcoes: { contato: string; ttl?: number; urgencia?: 'high' | 'normal' } ) {
  const corpo = await cifrar(JSON.stringify(dados), inscricao)
  const jwt = await tokenVapid(inscricao.endpoint, chaves, opcoes.contato)
  const r = await fetch(inscricao.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${chaves.publica}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opcoes.ttl ?? 3600),
      Urgency: opcoes.urgencia ?? 'normal',
    },
    body: corpo,
  })
  return r.status
}
