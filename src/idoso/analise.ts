// Contas da avaliação funcional: IMC, circunferências, resumo, pontos de atenção
// e comparação entre a avaliação inicial e a reavaliação.

import type { Status } from '../pose/types'
import { ITENS_BERG, MAXIMO_BERG, classificarBerg, totalBerg } from './berg'
import { ROTULO_AREA, TESTES, classificar, type Area } from './testes'
import type { AvaliacaoIdoso, Sexo } from './tipos'

export function calcularImc(peso: number | null, estaturaCm: number | null): number | null {
  if (!peso || !estaturaCm) return null
  const m = estaturaCm / 100
  return Math.round((peso / (m * m)) * 10) / 10
}

/** IMC do idoso pelos cortes de Lipschitz (1994); abaixo de 60 anos, pela OMS. */
export function classificarImc(imc: number, idade: number | null): { status: Status; rotulo: string } {
  if (idade === null || idade >= 60) {
    if (imc < 22) return { status: 'atencao', rotulo: 'Baixo peso' }
    if (imc <= 27) return { status: 'ok', rotulo: 'Peso adequado' }
    return { status: 'atencao', rotulo: 'Sobrepeso' }
  }
  if (imc < 18.5) return { status: 'atencao', rotulo: 'Baixo peso' }
  if (imc < 25) return { status: 'ok', rotulo: 'Peso adequado' }
  if (imc < 30) return { status: 'atencao', rotulo: 'Sobrepeso' }
  return { status: 'alerta', rotulo: 'Obesidade' }
}

export function classificarCintura(cm: number, sexo: Sexo | null): { status: Status; rotulo: string } | null {
  if (!sexo) return null
  const [a, b] = sexo === 'feminino' ? [80, 88] : [94, 102]
  if (cm >= b) return { status: 'alerta', rotulo: 'Risco muito aumentado' }
  if (cm >= a) return { status: 'atencao', rotulo: 'Risco aumentado' }
  return { status: 'ok', rotulo: 'Adequada' }
}

export function relacaoCinturaQuadril(a: AvaliacaoIdoso): number | null {
  const { cintura, quadril } = a.antropometria.circ
  return cintura && quadril ? Math.round((cintura / quadril) * 100) / 100 : null
}

export function classificarRcq(rcq: number, sexo: Sexo | null): { status: Status; rotulo: string } | null {
  if (!sexo) return null
  return rcq > (sexo === 'feminino' ? 0.85 : 0.9) ? { status: 'atencao', rotulo: 'Risco aumentado' } : { status: 'ok', rotulo: 'Adequada' }
}

/** Panturrilha abaixo de 31 cm sugere perda de massa muscular no idoso. */
export const panturrilhaBaixa = (cm: number) => cm < 31

export const imcDe = (a: AvaliacaoIdoso) => calcularImc(a.antropometria.peso, a.antropometria.estatura)

export function bergDe(a: AvaliacaoIdoso) {
  const { total, faltam } = totalBerg(a.berg)
  if (faltam === ITENS_BERG.length) return null
  return { total, faltam, ...(faltam === 0 ? classificarBerg(total) : { status: 'atencao' as Status, rotulo: `Faltam ${faltam} itens` }) }
}

export type LinhaResumo = { rotulo: string; valor: string; status?: Status; classe?: string }

const fmt = (v: number, casas = 0) => v.toFixed(casas).replace('.', ',')

/** Linhas da tela "Avaliação funcional — Nome". */
export function resumo(a: AvaliacaoIdoso): LinhaResumo[] {
  const { idade, sexo } = a.anamnese
  const linhas: LinhaResumo[] = []
  const imc = imcDe(a)
  if (imc !== null) {
    const c = classificarImc(imc, idade)
    linhas.push({ rotulo: 'IMC', valor: fmt(imc, 1), status: c.status, classe: c.rotulo })
  }
  const berg = bergDe(a)
  if (berg) linhas.push({ rotulo: 'Equilíbrio Berg', valor: `${berg.total}/${MAXIMO_BERG}`, status: berg.status, classe: berg.rotulo })
  for (const t of TESTES) {
    const r = a.testes[t.id]
    if (!r) continue
    const c = classificar(t, r.valor, idade, sexo)
    linhas.push({ rotulo: t.curto, valor: `${fmt(r.valor, t.unidade === 's' ? 1 : 0)} ${t.unidade}`, status: c?.status, classe: c?.rotulo })
  }
  return linhas
}

export type Ponto = { texto: string; status: Status }
export type PontosArea = { area: Area; nome: string; status: Status | null; pontos: Ponto[]; avaliado: boolean }

const pior = (lista: Status[]): Status | null =>
  lista.includes('alerta') ? 'alerta' : lista.includes('atencao') ? 'atencao' : lista.length ? 'ok' : null

/** Pontos de atenção por área: equilíbrio, mobilidade, flexibilidade e capacidade funcional. */
export function pontosDeAtencao(a: AvaliacaoIdoso): PontosArea[] {
  const { idade, sexo } = a.anamnese
  const por: Record<Area, { pontos: Ponto[]; status: Status[] }> = {
    equilibrio: { pontos: [], status: [] },
    mobilidade: { pontos: [], status: [] },
    flexibilidade: { pontos: [], status: [] },
    capacidade: { pontos: [], status: [] },
  }
  const marcar = (area: Area, status: Status, texto?: string) => {
    por[area].status.push(status)
    if (texto && status !== 'ok') por[area].pontos.push({ texto, status })
  }

  const berg = bergDe(a)
  if (berg && berg.faltam === 0) {
    marcar('equilibrio', berg.status, `Berg ${berg.total}/${MAXIMO_BERG}: ${berg.rotulo.toLowerCase()}.`)
    const fracos = ITENS_BERG.filter((_, i) => (a.berg[i] ?? 4) <= 2).map((it) => it.titulo.toLowerCase())
    if (fracos.length) marcar('equilibrio', 'atencao', `Itens do Berg com nota 2 ou menos: ${fracos.join('; ')}.`)
  }
  if (a.anamnese.quedas) {
    const s: Status = a.anamnese.quedas >= 2 ? 'alerta' : 'atencao'
    marcar('equilibrio', s, `${a.anamnese.quedas} ${a.anamnese.quedas === 1 ? 'queda' : 'quedas'} nos últimos 12 meses.`)
  }
  if (a.anamnese.dispositivo !== 'Nenhum') marcar('mobilidade', 'atencao', `Usa ${a.anamnese.dispositivo.toLowerCase()} para se locomover.`)

  for (const t of TESTES) {
    const r = a.testes[t.id]
    if (!r) continue
    const c = classificar(t, r.valor, idade, sexo)
    for (const area of t.areas) {
      if (c) marcar(area, c.status, `${t.curto}: ${fmt(r.valor, t.unidade === 's' ? 1 : 0)} ${t.unidade}, ${c.rotulo.toLowerCase()} (${t.mede.toLowerCase()}).`)
      else por[area].status.push('ok')
    }
  }

  const imc = imcDe(a)
  if (imc !== null) {
    const c = classificarImc(imc, idade)
    marcar('capacidade', c.status, `IMC ${fmt(imc, 1)}: ${c.rotulo.toLowerCase()}.`)
  }
  const pant = a.antropometria.circ.panturrilha
  if (pant && panturrilhaBaixa(pant)) marcar('capacidade', 'atencao', `Panturrilha com ${fmt(pant)} cm (abaixo de 31 cm): possível perda de massa muscular.`)
  if (a.anamnese.dorNota !== null && a.anamnese.dorNota >= 7) marcar('capacidade', 'alerta', `Dor forte relatada (${a.anamnese.dorNota}/10).`)

  return (Object.keys(por) as Area[]).map((area) => ({
    area,
    nome: ROTULO_AREA[area],
    status: pior(por[area].status),
    pontos: por[area].pontos,
    avaliado: por[area].status.length > 0,
  }))
}

export type Metrica = {
  id: string
  rotulo: string
  unidade: string
  casas: number
  maiorMelhor: boolean | null
  valor: (a: AvaliacaoIdoso) => number | null
  status: (a: AvaliacaoIdoso) => Status
}

/** Números acompanhados na evolução, na ordem da tela. */
export const METRICAS: Metrica[] = [
  { id: 'peso', rotulo: 'Peso', unidade: 'kg', casas: 1, maiorMelhor: null, valor: (a) => a.antropometria.peso, status: () => 'ok' },
  {
    id: 'imc',
    rotulo: 'IMC',
    unidade: '',
    casas: 1,
    maiorMelhor: null,
    valor: imcDe,
    status: (a) => classificarImc(imcDe(a) ?? 0, a.anamnese.idade).status,
  },
  {
    id: 'cintura',
    rotulo: 'Cintura',
    unidade: 'cm',
    casas: 0,
    maiorMelhor: false,
    valor: (a) => a.antropometria.circ.cintura ?? null,
    status: (a) => classificarCintura(a.antropometria.circ.cintura ?? 0, a.anamnese.sexo)?.status ?? 'ok',
  },
  {
    id: 'berg',
    rotulo: 'Equilíbrio Berg',
    unidade: 'pontos',
    casas: 0,
    maiorMelhor: true,
    valor: (a) => {
      const b = bergDe(a)
      return b && b.faltam === 0 ? b.total : null
    },
    status: (a) => bergDe(a)?.status ?? 'ok',
  },
  ...TESTES.map(
    (t): Metrica => ({
      id: t.id,
      rotulo: t.curto,
      unidade: t.unidade,
      casas: t.unidade === 's' ? 1 : 0,
      maiorMelhor: t.maiorMelhor,
      valor: (a) => a.testes[t.id]?.valor ?? null,
      status: (a) => classificar(t, a.testes[t.id]?.valor ?? 0, a.anamnese.idade, a.anamnese.sexo)?.status ?? 'ok',
    }),
  ),
]

export type Comparacao = { metrica: Metrica; inicial: number; atual: number; diferenca: number; melhorou: boolean | null }

/** Avaliação inicial x reavaliação, só com os números medidos nas duas. */
export function comparar(inicial: AvaliacaoIdoso, atual: AvaliacaoIdoso): Comparacao[] {
  const saida: Comparacao[] = []
  for (const m of METRICAS) {
    const i = m.valor(inicial)
    const f = m.valor(atual)
    if (i === null || f === null) continue
    const diferenca = Math.round((f - i) * 10 ** m.casas) / 10 ** m.casas
    saida.push({ metrica: m, inicial: i, atual: f, diferenca, melhorou: m.maiorMelhor === null || diferenca === 0 ? null : m.maiorMelhor === diferenca > 0 })
  }
  return saida
}

/** Texto para mandar pelo WhatsApp. */
export function textoCompartilhar(a: AvaliacaoIdoso, anterior?: AvaliacaoIdoso): string {
  const linhas = [`AVALIAÇÃO FUNCIONAL — ${a.avaliado.toUpperCase()}`, new Date(a.date).toLocaleDateString('pt-BR'), '']
  for (const l of resumo(a)) linhas.push(`${l.rotulo}: ${l.valor}${l.classe ? ` (${l.classe})` : ''}`)
  if (anterior) {
    const c = comparar(anterior, a)
    if (c.length) {
      linhas.push('', `📈 EVOLUÇÃO desde ${new Date(anterior.date).toLocaleDateString('pt-BR')}`)
      for (const x of c) linhas.push(`${x.metrica.rotulo}: ${fmt(x.inicial, x.metrica.casas)} → ${fmt(x.atual, x.metrica.casas)} (${x.diferenca > 0 ? '+' : ''}${fmt(x.diferenca, x.metrica.casas)})`)
    }
  }
  const pontos = pontosDeAtencao(a).filter((p) => p.pontos.length)
  if (pontos.length) {
    linhas.push('', '⚠ PONTOS DE ATENÇÃO')
    for (const p of pontos) linhas.push(`${p.nome}: ${p.pontos.map((x) => x.texto).join(' ')}`)
  }
  linhas.push('', 'Triagem feita no FormaCerta. Não substitui avaliação médica.')
  return linhas.join('\n')
}
