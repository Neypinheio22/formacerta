// Linhas de cada exercício da ficha de treino, no padrão que os personais já
// usam: o personal escolhe o tipo da linha (repetições e carga, cadência,
// observação...) e adiciona quantas quiser. Ex.: "Série/rep 4x8 · Carga
// 52/59/64 · Intervalo 60 s" e, embaixo, "Cadência: 2 s concêntrica todas rep".

export type TipoLinha = 'reps_carga' | 'reps_carga_tempo' | 'reps_tempo' | 'tempo_inclinacao' | 'corrida' | 'observacoes' | 'cadencia' | 'exercicio'

export type CampoLinha = 'serie' | 'carga' | 'tempo' | 'intervalo' | 'inclinacao' | 'velocidade' | 'distancia' | 'ritmo' | 'texto'

export type LinhaSerie = { tipo: TipoLinha } & Partial<Record<CampoLinha, string>>

type Campo = { chave: CampoLinha; rotulo: string; exemplo: string; max: number }

const c = (chave: CampoLinha, rotulo: string, exemplo: string, max = 20): Campo => ({ chave, rotulo, exemplo, max })

const SERIE = c('serie', 'Série/rep', '4x8')
const CARGA = c('carga', 'Carga', '52/59/64')
const INTERVALO = c('intervalo', 'Intervalo', '60 s')
const TEMPO = c('tempo', 'Tempo', '40 s')

export const TIPOS_LINHA: { tipo: TipoLinha; nome: string; campos: Campo[] }[] = [
  { tipo: 'reps_carga', nome: 'Repetições e carga', campos: [SERIE, CARGA, INTERVALO] },
  { tipo: 'reps_carga_tempo', nome: 'Repetições, carga e tempo', campos: [SERIE, CARGA, TEMPO, INTERVALO] },
  { tipo: 'reps_tempo', nome: 'Repetições e tempo', campos: [SERIE, TEMPO, INTERVALO] },
  { tipo: 'tempo_inclinacao', nome: 'Tempo e inclinação', campos: [c('tempo', 'Tempo', '20 min'), c('inclinacao', 'Inclinação', '5%'), c('velocidade', 'Velocidade', '6 km/h')] },
  { tipo: 'corrida', nome: 'Corrida', campos: [c('distancia', 'Distância', '5 km'), c('tempo', 'Tempo', '30 min'), c('ritmo', 'Ritmo', '6 min/km')] },
  { tipo: 'observacoes', nome: 'Observações', campos: [c('texto', 'Observações', 'Ex.: segure 2 s lá em cima', 200)] },
  { tipo: 'cadencia', nome: 'Cadência', campos: [c('texto', 'Cadência', 'Ex.: 2 s concêntrica todas rep', 200)] },
  { tipo: 'exercicio', nome: 'Exercício', campos: [c('texto', 'Exercício', 'Ex.: emendar com rosca martelo (bi-set)', 200)] },
]

export const tipoDe = (tipo: TipoLinha) => TIPOS_LINHA.find((t) => t.tipo === tipo) ?? TIPOS_LINHA[0]

export const linhaVazia = (tipo: TipoLinha = 'reps_carga'): LinhaSerie => ({ tipo })

/** Linha sem nada escrito: some ao guardar. */
export const linhaVaziaDe = (l: LinhaSerie) => tipoDe(l.tipo).campos.every((k) => !(l[k.chave] ?? '').trim())

/** Só os campos daquele tipo, sem espaços sobrando e no tamanho máximo. */
export function limparLinha(l: LinhaSerie): LinhaSerie {
  const t = tipoDe(l.tipo)
  const limpa: LinhaSerie = { tipo: t.tipo }
  for (const k of t.campos) {
    const v = (l[k.chave] ?? '').trim().slice(0, k.max)
    if (v) limpa[k.chave] = v
  }
  return limpa
}

/** Exercício antigo (séries, repetições e dica) ou novo (com linhas). */
type ComLinhas = { series?: string; reps?: string; obs?: string; linhas?: LinhaSerie[] }

/**
 * Linhas do exercício. Os treinos guardados antes das linhas tinham só
 * "séries", "repetições" e "dica": viram uma linha de repetições e carga e
 * uma de observações.
 */
export function linhasDe(ex: ComLinhas): LinhaSerie[] {
  if (ex.linhas?.length) return ex.linhas
  const linhas: LinhaSerie[] = []
  const series = (ex.series ?? '').trim()
  const reps = (ex.reps ?? '').trim()
  if (series || reps) linhas.push({ tipo: 'reps_carga', serie: series && reps ? `${series}x${reps}` : series || reps })
  if ((ex.obs ?? '').trim()) linhas.push({ tipo: 'observacoes', texto: ex.obs!.trim() })
  return linhas
}

/** Faixa de repetições da primeira linha que tem série ("4x8" → 8; "3x10 a 12" → 10 a 12). */
export function repsDe(ex: ComLinhas): string {
  const l = linhasDe(ex).find((x) => x.serie)
  if (!l?.serie) return ex.reps ?? ''
  const partes = l.serie.split(/x|×/i)
  return (partes.length > 1 ? partes.slice(1).join('x') : partes[0]).trim()
}

/** Texto curto da linha para a tela do aluno: "4x8 · 52/59/64 kg · intervalo 60 s". */
export function resumoLinha(l: LinhaSerie): { rotulo: string; texto: string } {
  const t = tipoDe(l.tipo)
  if (t.campos.length === 1) return { rotulo: t.nome, texto: l.texto ?? '' }
  const partes = t.campos
    .filter((k) => (l[k.chave] ?? '').trim())
    .map((k) => {
      const v = l[k.chave]!.trim()
      if (k.chave === 'serie') return v
      if (k.chave === 'carga') return /[a-z]/i.test(v) ? v : `${v} kg`
      return `${k.rotulo.toLowerCase()} ${v}`
    })
  return { rotulo: t.nome, texto: partes.join(' · ') }
}
