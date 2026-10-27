// Dados do profissional que aparecem no cabeçalho e na assinatura do relatório.
// Ficam no aparelho, como o histórico dos testes.

export type Logo = { image: string; width: number; height: number }

export type Profissional = {
  nome: string
  /** Ex.: Personal trainer, Fisioterapeuta. */
  profissao: string
  /** Conselho do registro: CREF (Educação Física), CREFITO (Fisioterapia) ou vazio (outro). */
  conselho: string
  /** Número do registro profissional, ex.: 012345-G/SP. */
  registro: string
  telefone: string
  email: string
  /** Estúdio, academia ou cidade. */
  local: string
  logo?: Logo
}

const CHAVE = 'formacerta:profissional'

export const CONSELHOS = [
  { sigla: 'CREF', nome: 'CREF (Educação Física)' },
  { sigla: 'CREFITO', nome: 'CREFITO (Fisioterapia)' },
] as const

export const PERFIL_VAZIO: Profissional = { nome: '', profissao: '', conselho: 'CREF', registro: '', telefone: '', email: '', local: '' }

export function carregarProfissional(): Profissional {
  try {
    return { ...PERFIL_VAZIO, ...(JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Partial<Profissional>) }
  } catch {
    return PERFIL_VAZIO
  }
}

export function salvarProfissional(p: Profissional): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

/** Registro com o conselho na frente: "CREFITO 123456-F". Se o número já traz o conselho, fica como está. */
export function registroCompleto(p: Pick<Profissional, 'conselho' | 'registro'>): string {
  const r = p.registro.trim()
  const c = (p.conselho ?? '').trim()
  if (!r || !c || r.toUpperCase().startsWith(c.toUpperCase())) return r
  return `${c} ${r}`
}

export const perfilPreenchido = (p: Profissional) => p.nome.trim() !== '' && p.registro.trim() !== ''

/** Contato numa linha só: telefone · e-mail · local. */
export const contato = (p: Profissional) => [p.telefone, p.email, p.local].map((s) => s.trim()).filter(Boolean).join(' · ')

/** Reduz a logo e guarda em PNG, para manter o fundo transparente. */
export function lerLogo(arquivo: File, ladoMax = 400): Promise<Logo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * escala))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * escala))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve({ image: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('imagem inválida'))
    }
    img.src = url
  })
}
