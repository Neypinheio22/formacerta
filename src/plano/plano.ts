// Plano de ação: transforma cada teste numa avaliação que gera ação no treino.
// Teste → Resultado → Classificação (🟢 🟡 🔴) → Pontos de atenção →
// Exercícios recomendados → Reavaliação. A "Análise do Personal IA" junta os
// planos de todos os testes do aluno num plano de treino só.
// As regras são automáticas e servem de ponto de partida: o personal ajusta.

import { pontosDeAtencao } from '../idoso/analise'
import type { Area } from '../idoso/testes'
import type { AvaliacaoIdoso } from '../idoso/tipos'
import type { ResultadoCorrida } from '../corrida/tipos'
import { exercicioPorId } from '../movimento/exercicios'
import type { ResultadoExercicio } from '../movimento/tipos'
import type { ResultadoNuvem } from '../nuvem/resultados'
import { planoCorretivo, recomendacao } from '../pose/recomendacoes'
import { VIEWS, type Assessment, type Finding, type Status } from '../pose/types'
import { anguloAdams, classificarAdams, type RegistroAdams } from '../testes/adams'
import { infoNivel, type RegistroFlex } from '../testes/flexibilidade'
import { numero } from '../testes/formato'

export const NIVEL: Record<Status, { emoji: string; rotulo: string }> = {
  ok: { emoji: '🟢', rotulo: 'Adequado' },
  atencao: { emoji: '🟡', rotulo: 'Precisa melhorar' },
  alerta: { emoji: '🔴', rotulo: 'Atenção' },
}

export const ROTULO_NIVEL: Record<Status, string> = { ok: NIVEL.ok.rotulo, atencao: NIVEL.atencao.rotulo, alerta: NIVEL.alerta.rotulo }

export const comEmoji = (s: Status) => `${NIVEL[s].emoji} ${NIVEL[s].rotulo}`

export type TipoTeste = 'postura' | 'flexibilidade' | 'adams' | 'corrida' | 'exercicio' | 'idoso'

export type Foco = 'alongar' | 'fortalecer' | 'tecnica' | 'equilibrio' | 'condicionamento'

export const ROTULO_FOCO: Record<Foco, string> = {
  alongar: 'Alongar e soltar',
  fortalecer: 'Fortalecer',
  tecnica: 'Técnica e educativos',
  equilibrio: 'Equilíbrio',
  condicionamento: 'Condicionamento',
}

export type ExercicioPlano = { nome: string; dose: string; foco: Foco }

export type PontoAtencao = { texto: string; status: Status }

export type PlanoTeste = {
  tipo: TipoTeste
  /** Um plano por chave na análise geral: só vale o teste mais recente de cada chave. */
  chave: string
  teste: string
  data: string
  resultado: string
  status: Status
  pontos: PontoAtencao[]
  musculos: { alongar: string[]; fortalecer: string[] }
  exercicios: ExercicioPlano[]
  /** O que fazer antes dos exercícios, quando o caso pede outro profissional. */
  conduta?: string
  reavaliarDias: number
  reavaliarEm: string
}

/** Dias até a reavaliação, pelo teste e pela classificação. */
export const REAVALIAR: Record<TipoTeste, Record<Status, number>> = {
  postura: { alerta: 30, atencao: 30, ok: 90 },
  flexibilidade: { alerta: 30, atencao: 30, ok: 90 },
  adams: { alerta: 90, atencao: 90, ok: 180 },
  corrida: { alerta: 30, atencao: 30, ok: 90 },
  exercicio: { alerta: 14, atencao: 14, ok: 30 },
  idoso: { alerta: 60, atencao: 90, ok: 90 },
}

export const statusNota = (nota: number): Status => (nota >= 85 ? 'ok' : nota >= 65 ? 'atencao' : 'alerta')

export const piorStatus = (lista: Status[]): Status => (lista.includes('alerta') ? 'alerta' : lista.includes('atencao') ? 'atencao' : 'ok')

const ordem: Record<Status, number> = { alerta: 0, atencao: 1, ok: 2 }

function somarDias(iso: string, dias: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + dias)
  return d.toISOString()
}

/** Exercício escrito como "Nome (3x12)" vira nome e dose. */
export function separarDose(texto: string): { nome: string; dose: string } {
  const m = texto.match(/^(.*\S)\s*\(([^()]*)\)\s*$/)
  return m ? { nome: m[1], dose: m[2] } : { nome: texto, dose: '' }
}

const unico = (xs: string[]) => [...new Set(xs)]

function semRepetir(lista: ExercicioPlano[]) {
  const m = new Map<string, ExercicioPlano>()
  for (const e of lista) if (!m.has(e.nome)) m.set(e.nome, e)
  return [...m.values()]
}

function montar(p: Omit<PlanoTeste, 'reavaliarDias' | 'reavaliarEm'>): PlanoTeste {
  const reavaliarDias = REAVALIAR[p.tipo][p.status]
  return {
    ...p,
    pontos: [...p.pontos].sort((a, b) => ordem[a.status] - ordem[b.status]),
    exercicios: semRepetir(p.exercicios),
    reavaliarDias,
    reavaliarEm: somarDias(p.data, reavaliarDias),
  }
}

// ---------- Postura ----------

type VistaSimples = { view: string; findings: Finding[] }

export function planoPostura(a: Pick<Assessment, 'id' | 'date' | 'score'> & { views: VistaSimples[] }): PlanoTeste {
  const achados = a.views.flatMap((v) => v.findings.map((f) => ({ v, f })))
  const problemas = achados.filter(({ f }) => f.status !== 'ok')
  const plano = planoCorretivo(problemas.map((x) => x.f))
  // Avaliações antigas, sem a alteração marcada, só têm a lista de exercícios.
  const antigos = problemas.filter(({ f }) => !f.correcao).flatMap(({ f }) => f.exercises.map((e) => ({ ...separarDose(e), foco: 'fortalecer' as Foco })))
  let status = statusNota(a.score)
  if (status === 'ok' && problemas.some(({ f }) => f.status === 'alerta')) status = 'atencao'
  return montar({
    tipo: 'postura',
    chave: 'postura',
    teste: 'Avaliação de postura',
    data: a.date,
    resultado: `${a.score} de 100 pontos`,
    status,
    pontos: problemas.map(({ v, f }) => {
      const vista = VIEWS.find((x) => x.id === v.view)?.label ?? v.view
      return { texto: `${recomendacao(f)?.alteracao ?? f.title} (${vista.toLowerCase()}, ${f.value})`, status: f.status }
    }),
    musculos: { alongar: plano.alongar, fortalecer: plano.fortalecer },
    exercicios: [...plano.exercicios, ...antigos],
  })
}

// ---------- Flexibilidade ----------

const FLEX_MELHORAR: ExercicioPlano[] = [
  { nome: 'Alongamento de posterior de coxa (perna apoiada, tronco reto)', dose: '3x30 s cada perna', foco: 'alongar' },
  { nome: 'Alongamento da panturrilha na parede', dose: '3x30 s cada perna', foco: 'alongar' },
  { nome: 'Gato e camelo (mobilidade da coluna)', dose: '2x10', foco: 'alongar' },
  { nome: 'Bom-dia sem peso (dobrar o quadril com as costas retas)', dose: '3x10', foco: 'fortalecer' },
  { nome: 'Stiff com halter leve', dose: '3x10', foco: 'fortalecer' },
]

const FLEX_MANTER: ExercicioPlano[] = [
  { nome: 'Alongamento de posterior de coxa (perna apoiada, tronco reto)', dose: '2x30 s cada perna, 2 a 3 vezes por semana', foco: 'alongar' },
  { nome: 'Stiff com halter', dose: '3x10', foco: 'fortalecer' },
]

export function planoFlex(r: Pick<RegistroFlex, 'id' | 'date' | 'nivel' | 'joelhosOk' | 'joelho'>): PlanoTeste {
  const info = infoNivel(r.nivel)
  const pontos: PontoAtencao[] = []
  if (info.status !== 'ok') pontos.push({ texto: `Flexibilidade ${r.nivel.toLowerCase()}: ${info.onde.toLowerCase()}. ${info.dica}`, status: info.status })
  if (!r.joelhosOk) pontos.push({ texto: `Joelhos dobraram ${numero(r.joelho, 0)}° no teste (vale até 15°): o resultado pode estar melhor do que a flexibilidade real.`, status: 'atencao' })
  const status = info.status === 'ok' && !r.joelhosOk ? 'atencao' : info.status
  return montar({
    tipo: 'flexibilidade',
    chave: 'flexibilidade',
    teste: 'Teste de Flexibilidade',
    data: r.date,
    resultado: r.nivel,
    status,
    pontos,
    musculos: info.status === 'ok' ? { alongar: [], fortalecer: [] } : { alongar: ['Posteriores da coxa', 'Panturrilha', 'Lombar'], fortalecer: ['Glúteo máximo', 'Posteriores da coxa (na amplitude nova)'] },
    exercicios: info.status === 'ok' ? FLEX_MANTER : FLEX_MELHORAR,
  })
}

// ---------- Adams ----------

const ADAMS_EXERCICIOS: ExercicioPlano[] = [
  { nome: 'Gato e camelo (mobilidade da coluna)', dose: '2x10', foco: 'alongar' },
  { nome: 'Alongamento lateral do tronco em pé', dose: '3x30 s cada lado', foco: 'alongar' },
  { nome: 'Prancha lateral', dose: '3x20 s cada lado', foco: 'fortalecer' },
  { nome: 'Perdigueiro (bird-dog)', dose: '3x10 cada lado', foco: 'fortalecer' },
  { nome: 'Remada com elástico', dose: '3x12', foco: 'fortalecer' },
]

export function planoAdams(r: Pick<RegistroAdams, 'id' | 'date' | 'atr' | 'escoliometro' | 'lado'>): PlanoTeste | null {
  const angulo = anguloAdams(r)
  if (angulo === null) return null
  const c = classificarAdams(angulo)
  const lado = r.lado && angulo >= 3 ? `, lado ${r.lado} mais alto` : ''
  return montar({
    tipo: 'adams',
    chave: 'adams',
    teste: 'Teste de Adams (coluna)',
    data: r.date,
    resultado: `${numero(angulo)}° de rotação do tronco`,
    status: c.status,
    pontos: c.status === 'ok' ? [] : [{ texto: `${c.titulo} nas costas (${numero(angulo)}°${lado}). ${c.texto}`, status: c.status }],
    musculos: c.status === 'ok' ? { alongar: [], fortalecer: [] } : { alongar: [], fortalecer: ['Core (abdômen, oblíquos e paravertebrais)', 'Musculatura das costas'] },
    exercicios: c.status === 'ok' ? [] : ADAMS_EXERCICIOS,
    conduta: c.status === 'alerta' ? 'Encaminhar ao ortopedista antes de exercícios específicos para a coluna. Enquanto isso, só exercícios sem dor e liberados.' : undefined,
  })
}

// ---------- Corrida ----------

type AchadoSimples = { title: string; value: string; status: Status; exercises: string[]; musculos?: { alongar: string[]; fortalecer: string[] } }

export function planoCorrida(r: Pick<ResultadoCorrida, 'id' | 'date' | 'score' | 'vista' | 'passos' | 'falha'> & { achados: AchadoSimples[] }): PlanoTeste | null {
  if (r.falha) return null
  const problemas = r.achados.filter((a) => a.status !== 'ok')
  return montar({
    tipo: 'corrida',
    chave: `corrida:${r.vista}`,
    teste: `Avaliação da corrida (${r.vista === 'lado' ? 'de lado' : 'de trás'})`,
    data: r.date,
    resultado: `${r.score} de 100 pontos`,
    status: statusNota(r.score),
    pontos: problemas.map((a) => ({ texto: `${a.title} (${a.value})`, status: a.status })),
    musculos: {
      alongar: unico(problemas.flatMap((a) => a.musculos?.alongar ?? [])),
      fortalecer: unico(problemas.flatMap((a) => a.musculos?.fortalecer ?? [])),
    },
    exercicios: problemas.flatMap((a) => a.exercises.map((e) => ({ ...separarDose(e), foco: focoDoTexto(e) }))),
  })
}

/** Corrida e exercícios só têm o texto: adivinha o foco pelas palavras. */
function focoDoTexto(texto: string): Foco {
  const t = texto.toLowerCase()
  if (t.includes('alongamento') || t.includes('liberação') || t.includes('mobilidade')) return 'alongar'
  if (t.includes('equilíbrio')) return 'equilibrio'
  if (t.includes('educativo') || t.includes('correr') || t.includes('cadência') || t.includes('lent') || t.includes('espelho') || t.includes('skipping')) return 'tecnica'
  return 'fortalecer'
}

// ---------- Exercício em vídeo ----------

type ResumoSimples = { title: string; detail: string; status: Status; exercises: string[] }

export function planoExercicio(r: Pick<ResultadoExercicio, 'id' | 'date' | 'score' | 'exercicio'> & { resumo: ResumoSimples[] }): PlanoTeste {
  const nome = exercicioPorId(r.exercicio)?.nome ?? 'Exercício'
  const problemas = r.resumo.filter((f) => f.status !== 'ok')
  return montar({
    tipo: 'exercicio',
    chave: `exercicio:${r.exercicio}`,
    teste: `Execução: ${nome}`,
    data: r.date,
    resultado: `${r.score} de 100 pontos`,
    status: statusNota(r.score),
    pontos: problemas.map((f) => ({ texto: `${f.title}: ${f.detail}`, status: f.status })),
    musculos: { alongar: [], fortalecer: [] },
    exercicios: problemas.flatMap((f) => f.exercises.map((e) => ({ ...separarDose(e), foco: focoDoTexto(e) }))),
  })
}

// ---------- Idoso ----------

const IDOSO_EXERCICIOS: Record<Area, ExercicioPlano[]> = {
  equilibrio: [
    { nome: 'Apoio numa perna só, segurando no encosto da cadeira', dose: '3x20 s cada perna', foco: 'equilibrio' },
    { nome: 'Caminhada em linha, calcanhar encostando na ponta do pé', dose: '3x10 passos', foco: 'equilibrio' },
    { nome: 'Transferência de peso de um pé para o outro', dose: '2x10', foco: 'equilibrio' },
  ],
  mobilidade: [
    { nome: 'Marcha parada com elevação de joelhos', dose: '3x30 s', foco: 'condicionamento' },
    { nome: 'Subir e descer degrau com apoio', dose: '3x10 cada perna', foco: 'fortalecer' },
    { nome: 'Levantar da cadeira, andar 3 metros e voltar', dose: '5 vezes', foco: 'equilibrio' },
  ],
  flexibilidade: [
    { nome: 'Alongamento de posterior de coxa sentado na cadeira', dose: '3x30 s cada perna', foco: 'alongar' },
    { nome: 'Alongamento de ombros com toalha atrás das costas', dose: '3x30 s', foco: 'alongar' },
  ],
  capacidade: [
    { nome: 'Sentar e levantar da cadeira', dose: '3x10', foco: 'fortalecer' },
    { nome: 'Rosca de bíceps com halter leve ou garrafa', dose: '3x12', foco: 'fortalecer' },
    { nome: 'Caminhada em ritmo confortável', dose: '20 a 30 min, 3 a 5 vezes por semana', foco: 'condicionamento' },
  ],
}

export function planoIdoso(a: AvaliacaoIdoso): PlanoTeste | null {
  const areas = pontosDeAtencao(a).filter((p) => p.avaliado)
  if (!areas.length) return null
  const comProblema = areas.filter((p) => p.status && p.status !== 'ok')
  const status = piorStatus(areas.map((p) => p.status ?? 'ok'))
  const dorForte = a.anamnese.dorNota !== null && a.anamnese.dorNota >= 7
  const quedas = (a.anamnese.quedas ?? 0) >= 2
  return montar({
    tipo: 'idoso',
    chave: 'idoso',
    teste: 'Avaliação funcional do idoso',
    data: a.date,
    resultado: areas.map((p) => `${p.nome}: ${NIVEL[p.status ?? 'ok'].emoji}`).join(' · '),
    status,
    pontos: comProblema.flatMap((p) => p.pontos.map((x) => ({ texto: `${p.nome}: ${x.texto}`, status: x.status }))),
    musculos: { alongar: [], fortalecer: [] },
    exercicios: comProblema.flatMap((p) => IDOSO_EXERCICIOS[p.area]),
    conduta: dorForte || quedas ? 'Dor forte ou quedas repetidas: conversar com o médico antes de aumentar a carga do treino.' : undefined,
  })
}

// ---------- Resultados guardados no banco ----------

/** Plano de um resultado guardado na ficha (sem fotos nem vídeo, mas com os achados). */
export function planoDeNuvem(r: ResultadoNuvem): PlanoTeste | null {
  const d = (r.dados ?? {}) as Record<string, unknown>
  const base = { id: r.id, date: r.feito_em }
  try {
    switch (r.tipo) {
      case 'postura':
        if (typeof d.score !== 'number') return null
        return planoPostura({ ...base, score: d.score, views: ((Array.isArray(d.views) ? d.views : []) as VistaSimples[]).map((v) => ({ ...v, findings: v.findings ?? [] })) })
      case 'flexibilidade':
        if (typeof d.nivel !== 'string') return null
        return planoFlex({ ...base, nivel: d.nivel as RegistroFlex['nivel'], joelhosOk: d.joelhosOk !== false, joelho: typeof d.joelho === 'number' ? d.joelho : 0 })
      case 'adams':
        return planoAdams({ ...base, atr: typeof d.atr === 'number' ? d.atr : null, escoliometro: typeof d.escoliometro === 'number' ? d.escoliometro : null, lado: (d.lado as RegistroAdams['lado']) ?? null })
      case 'corrida':
        if (typeof d.score !== 'number') return null
        return planoCorrida({
          ...base,
          score: d.score,
          vista: d.vista === 'tras' ? 'tras' : 'lado',
          passos: typeof d.passos === 'number' ? d.passos : 0,
          falha: typeof d.falha === 'string' ? d.falha : undefined,
          achados: ((d.achados ?? []) as AchadoSimples[]).map((a) => ({ ...a, exercises: a.exercises ?? [] })),
        })
      case 'exercicio':
        if (typeof d.score !== 'number' || typeof d.exercicio !== 'string') return null
        return planoExercicio({
          ...base,
          score: d.score,
          exercicio: d.exercicio as ResultadoExercicio['exercicio'],
          resumo: ((d.resumo ?? []) as ResumoSimples[]).map((f) => ({ ...f, exercises: f.exercises ?? [] })),
        })
      case 'idoso': {
        const a = d as unknown as AvaliacaoIdoso
        if (!a.anamnese || !a.antropometria) return null
        return planoIdoso({ ...a, ...base, avaliado: r.apelido, observacoes: a.observacoes ?? '', antropometria: { ...a.antropometria, circ: a.antropometria.circ ?? {} }, testes: a.testes ?? {}, berg: a.berg ?? [] })
      }
    }
  } catch {
    /* resultado com formato antigo ou incompleto */
  }
  return null
}

// ---------- Análise do Personal IA ----------

export type Prioridade = PontoAtencao & { teste: string }

export type Analise = {
  /** Só o teste mais recente de cada tipo, do mais urgente para o mais tranquilo. */
  planos: PlanoTeste[]
  status: Status
  contagem: Record<Status, number>
  prioridades: Prioridade[]
  condutas: string[]
  musculos: { alongar: string[]; fortalecer: string[] }
  /** Treino corretivo juntando todos os testes, sem repetir exercício. */
  treino: { foco: Foco; exercicios: ExercicioPlano[] }[]
  frequencia: string
  proximaReavaliacao: { data: string; teste: string } | null
  resumo: string
}

const ORDEM_FOCO: Foco[] = ['alongar', 'fortalecer', 'equilibrio', 'tecnica', 'condicionamento']

export function analisar(todos: PlanoTeste[]): Analise | null {
  const recentes = new Map<string, PlanoTeste>()
  for (const p of [...todos].sort((a, b) => b.data.localeCompare(a.data))) if (!recentes.has(p.chave)) recentes.set(p.chave, p)
  const planos = [...recentes.values()].sort((a, b) => ordem[a.status] - ordem[b.status] || b.data.localeCompare(a.data))
  if (!planos.length) return null

  const contagem: Record<Status, number> = { ok: 0, atencao: 0, alerta: 0 }
  for (const p of planos) contagem[p.status]++
  const status = piorStatus(planos.map((p) => p.status))

  const prioridades = planos.flatMap((p) => p.pontos.map((x) => ({ ...x, teste: p.teste }))).sort((a, b) => ordem[a.status] - ordem[b.status])
  const precisam = planos.filter((p) => p.status !== 'ok')
  // Treino corretivo só com os testes que precisam; se tudo está adequado, mantém.
  const fonte = precisam.length ? precisam : planos
  const exercicios = semRepetir(fonte.flatMap((p) => p.exercicios))
  const treino = ORDEM_FOCO.map((foco) => ({ foco, exercicios: exercicios.filter((e) => e.foco === foco) })).filter((g) => g.exercicios.length)

  const proxima = [...planos].sort((a, b) => a.reavaliarEm.localeCompare(b.reavaliarEm))[0]

  const frequencia =
    status === 'ok'
      ? 'Manutenção: 2 vezes por semana, 15 minutos, no aquecimento ou no fim do treino.'
      : status === 'atencao'
        ? '3 vezes por semana, 20 minutos, no aquecimento ou no fim do treino.'
        : '3 a 4 vezes por semana, 20 a 30 minutos, antes do treino principal. Comece leve e sem dor.'

  const curto: Record<TipoTeste, string> = { postura: 'postura', flexibilidade: 'flexibilidade', adams: 'coluna (Adams)', corrida: 'corrida', exercicio: '', idoso: 'avaliação funcional' }
  const nomes = (ps: PlanoTeste[]) => unico(ps.map((p) => curto[p.tipo] || p.teste.replace('Execução: ', 'execução do ').toLowerCase()))
  const alerta = planos.filter((p) => p.status === 'alerta')
  const atencao = planos.filter((p) => p.status === 'atencao')
  const partes: string[] = []
  if (alerta.length) partes.push(`Prioridade: ${nomes(alerta).join(', ')}.`)
  if (atencao.length) partes.push(`Precisa melhorar: ${nomes(atencao).join(', ')}.`)
  if (!alerta.length && !atencao.length) partes.push('Todos os testes estão adequados. O foco é manter e evoluir a carga do treino.')
  else partes.push(`O treino corretivo abaixo junta ${exercicios.length} exercícios para corrigir esses pontos.`)

  return {
    planos,
    status,
    contagem,
    prioridades,
    condutas: unico(planos.flatMap((p) => (p.conduta ? [p.conduta] : []))),
    musculos: {
      alongar: unico(fonte.flatMap((p) => p.musculos.alongar)),
      fortalecer: unico(fonte.flatMap((p) => p.musculos.fortalecer)),
    },
    treino,
    frequencia,
    proximaReavaliacao: proxima ? { data: proxima.reavaliarEm, teste: proxima.teste } : null,
    resumo: partes.join(' '),
  }
}

/** Texto do plano de um teste, para o relatório e o WhatsApp. */
export function linhasPlano(p: PlanoTeste): string[] {
  return [
    `Classificação: ${comEmoji(p.status)}`,
    ...(p.pontos.length ? [`Pontos de atenção: ${p.pontos.map((x) => x.texto).join('; ')}`] : []),
    ...(p.conduta ? [`Conduta: ${p.conduta}`] : []),
    ...(p.exercicios.length ? [`Exercícios recomendados: ${p.exercicios.map((e) => (e.dose ? `${e.nome} (${e.dose})` : e.nome)).join('; ')}`] : []),
    `Reavaliar em ${p.reavaliarDias} dias (${new Date(p.reavaliarEm).toLocaleDateString('pt-BR')})`,
  ]
}
