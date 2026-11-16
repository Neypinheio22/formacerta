// Confere o e-mail antes do cadastro, para não criar conta com e-mail digitado errado
// (ex.: "@gmai.com", "@hotmial.com", "@gmail.con"). O aluno só recebe a confirmação,
// os lembretes e os recibos se o e-mail estiver certo.

/** Provedores mais usados no Brasil. Um domínio "quase igual" a um destes é quase sempre erro de digitação. */
const POPULARES = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'yahoo.com.br',
  'icloud.com',
  'live.com',
  'hotmail.com.br',
  'outlook.com.br',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'msn.com',
]

/** Domínios de verdade parecidos com os populares: não são erro. */
const LEGITIMOS = new Set([
  ...POPULARES,
  'mail.com',
  'email.com',
  'ymail.com',
  'gmx.com',
  'gmx.net',
  'me.com',
  'mac.com',
  'aol.com',
  'ig.com.br',
  'globo.com',
  'globomail.com',
  'zipmail.com.br',
  'r7.com',
  'proton.me',
  'protonmail.com',
  'live.com.br',
  'yahoo.com.ar',
  'outlook.pt',
  'hotmail.co.uk',
])

/** Erros comuns na terminação, corrigidos direto. */
const FINAIS: [RegExp, string][] = [
  [/\.(con|cm|cmo|ocm|vom|xom|comm|co|om|c0m)$/, '.com'],
  [/\.com\.(bt|be|vr|brr|b)$/, '.com.br'],
  [/\.(br|bt)\.com$/, '.com.br'],
]

/** Quantas letras é preciso trocar, tirar, pôr ou inverter de lugar para ir de `a` a `b`. */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

export type ConferenciaEmail = { ok: true } | { ok: false; erro: string; sugestao?: string }

const FORMATO = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/

/** Confere formato e domínio. Quando acha erro de digitação, devolve o e-mail certo como sugestão. */
export function conferirEmail(bruto: string): ConferenciaEmail {
  const email = bruto.trim().toLowerCase()
  if (!email) return { ok: false, erro: 'Digite o e-mail.' }
  if (/\s/.test(email)) return { ok: false, erro: 'O e-mail não pode ter espaço.' }
  if ((email.match(/@/g) ?? []).length !== 1) return { ok: false, erro: 'O e-mail precisa ter um @, como nome@gmail.com.' }
  if (!FORMATO.test(email) || /\.\./.test(email) || /^\.|\.@|@\.|@-/.test(email))
    return { ok: false, erro: 'Este e-mail não está completo. Confira: deve ser como nome@gmail.com.' }

  const [usuario, dominio] = email.split('@')
  if (LEGITIMOS.has(dominio)) return { ok: true }

  // Terminação errada: gmail.con → gmail.com
  for (const [re, certo] of FINAIS) {
    if (re.test(dominio)) {
      const corrigido = dominio.replace(re, certo)
      if (corrigido !== dominio && LEGITIMOS.has(corrigido))
        return erroDigitacao(usuario, corrigido)
    }
  }

  // Parecido com um provedor conhecido: gmai.com, gmial.com, hotmial.com, outlok.com…
  let melhor: { d: string; n: number } | null = null
  for (const d of POPULARES) {
    const n = distancia(dominio, d)
    if (!melhor || n < melhor.n) melhor = { d, n }
  }
  const limite = melhor && melhor.d.length <= 9 ? 1 : 2
  if (melhor && melhor.n > 0 && melhor.n <= limite) return erroDigitacao(usuario, melhor.d)

  // Provedor conhecido escrito sem a terminação certa: "gmail.com.br", "hotmail.br"…
  const nomeProvedor = dominio.split('.')[0]
  if (['gmail', 'gmal', 'gmai', 'gamil'].includes(nomeProvedor) && dominio !== 'gmail.com') return erroDigitacao(usuario, 'gmail.com')

  return { ok: true }
}

function erroDigitacao(usuario: string, dominio: string): ConferenciaEmail {
  const sugestao = `${usuario}@${dominio}`
  return { ok: false, erro: `Parece que o e-mail foi digitado errado. Você quis dizer ${sugestao}?`, sugestao }
}

/** Os dois campos de e-mail batem? (sem diferença de maiúscula e espaço) */
export const emailsIguais = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Confere na internet se o domínio recebe e-mail (registro MX). Só o domínio sai do app,
 * nunca o e-mail inteiro. Se a consulta falhar (sem internet), deixa passar.
 */
export async function dominioRecebeEmail(email: string): Promise<boolean> {
  const dominio = email.trim().toLowerCase().split('@')[1]
  if (!dominio) return false
  if (LEGITIMOS.has(dominio)) return true
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dominio)}&type=MX`, {
      headers: { accept: 'application/dns-json' },
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!r.ok) return true
    const j = (await r.json()) as { Status?: number; Answer?: { type: number }[] }
    if (j.Status === 3) return false // o domínio não existe
    return (j.Answer ?? []).some((a) => a.type === 15)
  } catch {
    return true
  }
}

/** E-mail pronto para cadastrar: formato certo, sem erro de digitação no domínio e igual nos dois campos. */
export const emailValidoParaCadastro = (email: string, confirma: string) => conferirEmail(email).ok && emailsIguais(email, confirma)
