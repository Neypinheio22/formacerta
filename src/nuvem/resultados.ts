import { supabase } from './cliente'
import { erroAmigavel } from './conta'

export type TipoResultado = 'postura' | 'corrida' | 'exercicio' | 'flexibilidade' | 'adams' | 'idoso' | 'medidas' | 'estrategia'

export const ROTULO_TIPO: Record<TipoResultado, string> = {
  postura: 'Avaliação de postura',
  corrida: 'Avaliação da corrida',
  exercicio: 'Exercício em movimento',
  flexibilidade: 'Teste de Flexibilidade',
  adams: 'Teste de Adams',
  idoso: 'Avaliação funcional do idoso',
  medidas: 'Medidas do corpo',
  estrategia: 'Estratégia do professor',
}

// Fotos, vídeos e os pontos do corpo quadro a quadro ficam só no celular.
const FORA = new Set(['image', 'foto', 'landmarks', 'lm', 'mundo', 'quadros', 'contorno', 'video', 'avaliado'])

/** Copia só os números e textos curtos do resultado, sem foto nem vídeo. */
export function resumir(valor: unknown): unknown {
  if (valor === null || typeof valor === 'number' || typeof valor === 'boolean') return valor
  if (typeof valor === 'string') return valor.startsWith('data:') || valor.length > 400 ? undefined : valor
  if (Array.isArray(valor)) return valor.map(resumir).filter((v) => v !== undefined)
  if (typeof valor === 'object' && !(valor instanceof Blob)) {
    const saida: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(valor)) {
      if (FORA.has(k)) continue
      const r = resumir(v)
      if (r !== undefined) saida[k] = r
    }
    return saida
  }
  return undefined
}

export type Envio = {
  tipo: TipoResultado
  feitoEm: string
  resultado: unknown
  enviadoPor: string
  alunoId: string | null
  /** Ficha do aluno onde o resultado entra. */
  fichaId?: string | null
  apelido: string
  idade: number | null
  sexo: 'feminino' | 'masculino' | 'outro' | null
  alturaCm: number | null
}

export async function enviarResultado(e: Envio) {
  const { error } = await supabase.from('resultados').insert({
    enviado_por: e.enviadoPor,
    aluno_id: e.alunoId,
    ficha_id: e.fichaId ?? null,
    apelido: e.apelido.trim().slice(0, 60),
    tipo: e.tipo,
    feito_em: e.feitoEm,
    // A estratégia do professor é texto longo e não tem foto: vai inteira.
    dados: e.tipo === 'estrategia' ? e.resultado : resumir(e.resultado),
    idade: e.idade,
    sexo: e.sexo,
    altura_cm: e.alturaCm,
    consentimento_em: new Date().toISOString(),
  })
  return error ? erroAmigavel(error) : null
}

export type ResultadoNuvem = {
  id: string
  tipo: TipoResultado
  feito_em: string
  apelido: string
  aluno_id: string | null
  ficha_id: string | null
  enviado_por: string
  idade: number | null
  sexo: string | null
  altura_cm: number | null
  dados: Record<string, unknown>
}

export async function listarResultados(filtro: { alunoId?: string; fichaId?: string } = {}): Promise<{ lista: ResultadoNuvem[]; erro: string | null }> {
  let q = supabase.from('resultados').select('*').order('feito_em', { ascending: false }).limit(500)
  if (filtro.alunoId) q = q.eq('aluno_id', filtro.alunoId)
  if (filtro.fichaId) q = q.eq('ficha_id', filtro.fichaId)
  const { data, error } = await q
  return { lista: (data ?? []) as ResultadoNuvem[], erro: error ? erroAmigavel(error) : null }
}

export async function apagarResultado(id: string) {
  const { error } = await supabase.from('resultados').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}
