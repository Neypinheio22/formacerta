// Texto de cada teste no relatório. O mesmo conteúdo vira a folha na tela
// (para imprimir) e o PDF (para baixar ou mandar no WhatsApp).

import { comparar, pontosDeAtencao, resumo as resumoIdoso } from '../idoso/analise'
import type { AvaliacaoIdoso } from '../idoso/tipos'
import { planoCorretivo } from '../pose/recomendacoes'
import { VIEWS, type Assessment, type Status } from '../pose/types'
import { anguloAdams, classificarAdams, type RegistroAdams } from '../testes/adams'
import { infoNivel, type RegistroFlex } from '../testes/flexibilidade'
import { dataCurta, numero } from '../testes/formato'

export type ItemRelatorio =
  | { tipo: 'postura'; registro: Assessment }
  | { tipo: 'flexibilidade'; registro: RegistroFlex }
  | { tipo: 'adams'; registro: RegistroAdams }
  | { tipo: 'idoso'; registro: AvaliacaoIdoso }

export type Linha = { rotulo: string; valor: string; status?: Status }

export type Secao = {
  id: string
  titulo: string
  data: string
  linhas: Linha[]
  textos: string[]
  listas: { titulo: string; itens: string[] }[]
  observacoes: string
  aviso: string
}

export const ROTULO_POSTURA: Record<Status, string> = { ok: 'Bom', atencao: 'Atenção', alerta: 'Corrigir' }

export function textoPontuacao(score: number) {
  if (score >= 85) return 'Postura muito boa'
  if (score >= 65) return 'Alguns pontos para ajustar'
  return 'Vale focar na correção'
}

const AVISO = 'Triagem, não diagnóstico médico. O resultado orienta o profissional e não substitui a avaliação de um médico ou fisioterapeuta.'
const AVISO_ADAMS = 'Triagem, não diagnóstico médico. O Teste de Adams Digital aponta sinais de assimetria nas costas; só o médico, com exame de imagem, confirma escoliose.'

const NOME_TESTE: Record<ItemRelatorio['tipo'], string> = {
  postura: 'Avaliação de postura',
  flexibilidade: 'Teste de Flexibilidade Digital',
  adams: 'Teste de Adams Digital',
  idoso: 'Avaliação funcional do idoso',
}

export const nomeTeste = (i: ItemRelatorio) => NOME_TESTE[i.tipo]

/** Resultado em poucas palavras, para a lista de escolha dos testes. */
export function resumo(i: ItemRelatorio) {
  if (i.tipo === 'postura') return `${i.registro.score} pts`
  if (i.tipo === 'flexibilidade') return i.registro.nivel
  if (i.tipo === 'idoso') return `${resumoIdoso(i.registro).length} medidas`
  const a = anguloAdams(i.registro)
  return a === null ? '' : `${numero(a)}°`
}

/** Testes anteriores do mesmo tipo e do mesmo avaliado, do mais antigo para o mais novo. */
function anteriores<T extends { id: string; date: string }>(r: T, mesmo: T[]) {
  return mesmo.filter((x) => x.id !== r.id && x.date < r.date).sort((a, b) => a.date.localeCompare(b.date))
}

export function secao(item: ItemRelatorio, mesmoAvaliado: ItemRelatorio[] = []): Secao {
  const base = { id: item.registro.id, titulo: nomeTeste(item), data: item.registro.date, textos: [] as string[], listas: [] as Secao['listas'] }

  if (item.tipo === 'postura') {
    const a = item.registro
    const achados = a.views.flatMap((v) => v.findings.map((f) => ({ v, f })))
    const problemas = achados.map((x) => x.f).filter((f) => f.status !== 'ok')
    const plano = planoCorretivo(problemas)
    const antigos = [...new Set(problemas.filter((f) => !f.correcao).flatMap((f) => f.exercises))]
    const listas = [
      { titulo: 'Alongar', itens: plano.alongar },
      { titulo: 'Fortalecer', itens: plano.fortalecer },
      { titulo: 'Exercícios', itens: [...plano.exercicios.map((e) => `${e.nome} (${e.dose})`), ...antigos] },
    ].filter((l) => l.itens.length > 0)
    return {
      ...base,
      linhas: [
        { rotulo: 'Pontuação', valor: `${a.score} de 100 · ${textoPontuacao(a.score)}` },
        ...achados.map(({ v, f }) => ({
          rotulo: `${VIEWS.find((x) => x.id === v.view)?.label ?? v.view}: ${f.title}`,
          valor: `${f.value} · ${ROTULO_POSTURA[f.status]}`,
          status: f.status,
        })),
      ],
      textos: problemas.length === 0 ? ['Nenhum desvio importante encontrado nas fotos.'] : [],
      listas,
      observacoes: '',
      aviso: AVISO,
    }
  }

  if (item.tipo === 'flexibilidade') {
    const r = item.registro
    const info = infoNivel(r.nivel)
    const antes = anteriores(
      r,
      mesmoAvaliado.flatMap((x) => (x.tipo === 'flexibilidade' ? [x.registro] : [])),
    )
    return {
      ...base,
      linhas: [
        { rotulo: 'Nível', valor: r.nivel, status: info.status },
        { rotulo: 'Até onde as mãos chegaram', valor: info.onde },
        { rotulo: 'Joelhos', valor: `${r.joelhosOk ? 'esticados' : 'dobrados'} (${numero(r.joelho)}° de dobra; vale até 15°)`, status: r.joelhosOk ? 'ok' : 'alerta' },
        ...(r.nivel !== r.nivelApp ? [{ rotulo: 'Ajuste', valor: `nível ajustado pelo profissional (o app achou “${r.nivelApp}”)` }] : []),
        ...(antes.length ? [{ rotulo: 'Testes anteriores', valor: antes.slice(-5).map((x) => `${dataCurta(x.date)}: ${x.nivel}`).join('; ') }] : []),
      ],
      textos: [info.dica],
      observacoes: r.observacoes,
      aviso: AVISO,
    }
  }

  if (item.tipo === 'idoso') {
    const a = item.registro
    const antes = anteriores(
      a,
      mesmoAvaliado.flatMap((x) => (x.tipo === 'idoso' ? [x.registro] : [])),
    )
    const anterior = antes[antes.length - 1]
    const perfil = [a.anamnese.idade !== null && `${a.anamnese.idade} anos`, a.anamnese.sexo, a.antropometria.estatura && `${numero(a.antropometria.estatura, 0)} cm`, a.antropometria.peso && `${numero(a.antropometria.peso)} kg`]
      .filter(Boolean)
      .join(' · ')
    const evolucao = anterior
      ? comparar(anterior, a).map((c) => `${c.metrica.rotulo}: ${numero(c.inicial, c.metrica.casas)} → ${numero(c.atual, c.metrica.casas)} (${c.diferenca > 0 ? '+' : ''}${numero(c.diferenca, c.metrica.casas)})`)
      : []
    const atencao = pontosDeAtencao(a)
      .filter((p) => p.pontos.length)
      .map((p) => `${p.nome}: ${p.pontos.map((x) => x.texto).join(' ')}`)
    return {
      ...base,
      linhas: [
        ...(perfil ? [{ rotulo: 'Avaliado', valor: perfil }] : []),
        ...resumoIdoso(a).map((l) => ({ rotulo: l.rotulo, valor: l.classe ? `${l.valor} · ${l.classe}` : l.valor, status: l.status })),
      ],
      textos: resumoIdoso(a).length === 0 ? ['Nenhum teste feito ainda.'] : [],
      listas: [
        { titulo: `Evolução desde ${anterior ? dataCurta(anterior.date) : ''}`, itens: evolucao },
        { titulo: 'Pontos de atenção', itens: atencao },
      ].filter((l) => l.itens.length > 0),
      observacoes: a.observacoes,
      aviso: AVISO,
    }
  }

  const r = item.registro
  const angulo = anguloAdams(r) ?? 0
  const classe = classificarAdams(angulo)
  const antes = anteriores(
    r,
    mesmoAvaliado.flatMap((x) => (x.tipo === 'adams' ? [x.registro] : [])),
  )
  return {
    ...base,
    linhas: [
      { rotulo: 'Rotação do tronco', valor: `${numero(angulo)}° · ${classe.titulo}`, status: classe.status },
      { rotulo: 'Medido', valor: r.escoliometro !== null ? 'pelo escoliômetro' : 'pela foto' },
      ...(r.atr !== null && r.escoliometro !== null ? [{ rotulo: 'Medida da foto', valor: `${numero(r.atr)}°` }] : []),
      ...(r.lado && angulo >= 3 ? [{ rotulo: 'Lado mais alto (gibosidade)', valor: r.lado }] : []),
      { rotulo: 'Pontos de corte', valor: 'menos de 5°: sem assimetria relevante; 5° a 6,9°: acompanhar; 7° ou mais: encaminhar ao médico' },
      ...(antes.length ? [{ rotulo: 'Testes anteriores', valor: antes.slice(-5).map((x) => `${dataCurta(x.date)}: ${numero(anguloAdams(x) ?? 0)}°`).join('; ') }] : []),
    ],
    textos: [classe.texto],
    observacoes: r.observacoes,
    aviso: AVISO_ADAMS,
  }
}

/** Nome do arquivo: Relatorio-Maria-Souza-2026-10-24.pdf */
export function nomeArquivo(avaliado: string, data = new Date()) {
  const nome = avaliado
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  return `Relatorio${nome ? `-${nome}` : ''}-${dia}.pdf`
}
