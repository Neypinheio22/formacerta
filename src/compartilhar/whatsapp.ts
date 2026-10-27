import { classificarAdams, anguloAdams, type RegistroAdams } from '../testes/adams'
import { infoNivel, type RegistroFlex } from '../testes/flexibilidade'
import { dataCurta, numero } from '../testes/formato'
import { planoCorretivo } from '../pose/recomendacoes'
import { VIEWS, type Assessment } from '../pose/types'
import { NIVEL, ROTULO_NIVEL, comEmoji, planoAdams, planoFlex, planoPostura, type PlanoTeste } from '../plano/plano'

const RODAPE = 'Triagem feita no FormaCerta. Não substitui avaliação médica.'

/** Deixa só os dígitos e põe o 55 do Brasil quando a pessoa digitou só DDD + número. */
export function normalizarTelefone(texto: string): string {
  const d = texto.replace(/\D/g, '').replace(/^0+/, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

/** O número precisa ter DDI + DDD + telefone (12 ou 13 dígitos no Brasil). */
export const telefoneValido = (texto: string) => {
  const n = normalizarTelefone(texto)
  return n.length >= 12 && n.length <= 15
}

/** Link que abre o WhatsApp já com a mensagem escrita. Sem número, o próprio WhatsApp pede o contato. */
export function linkWhatsApp(texto: string, telefone = ''): string {
  const numero = telefoneValido(telefone) ? normalizarTelefone(telefone) : ''
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

// Telefone de cada pessoa avaliada, para não precisar digitar de novo na reavaliação.
const CHAVE_TELEFONES = 'formacerta:telefones'
const chaveNome = (nome: string) => nome.trim().toLocaleLowerCase('pt-BR')

export function telefoneGuardado(nome: string): string {
  if (!nome.trim()) return ''
  try {
    return (JSON.parse(localStorage.getItem(CHAVE_TELEFONES) ?? '{}') as Record<string, string>)[chaveNome(nome)] ?? ''
  } catch {
    return ''
  }
}

export function guardarTelefone(nome: string, telefone: string) {
  if (!nome.trim()) return
  try {
    const mapa = JSON.parse(localStorage.getItem(CHAVE_TELEFONES) ?? '{}') as Record<string, string>
    mapa[chaveNome(nome)] = telefone.trim()
    localStorage.setItem(CHAVE_TELEFONES, JSON.stringify(mapa))
  } catch {
    /* ignora */
  }
}

const ROTULO = ROTULO_NIVEL

/** Classificação, exercícios e data de reavaliação no fim da mensagem. */
function fimPlano(linhas: string[], p: PlanoTeste | null, exercicios = true) {
  if (!p) return
  if (exercicios && p.exercicios.length) {
    linhas.push('', p.status === 'ok' ? 'PARA MANTER' : 'EXERCÍCIOS RECOMENDADOS')
    for (const e of p.exercicios) linhas.push(`• ${e.nome}${e.dose ? ` — ${e.dose}` : ''}`)
  }
  if (p.conduta) linhas.push('', `⚠ ${p.conduta}`)
  linhas.push('', `📅 Reavaliar em ${dataCurta(p.reavaliarEm)} (${p.reavaliarDias} dias)`)
}

export function textoPostura(a: Assessment, nome = ''): string {
  const linhas = [`AVALIAÇÃO DE POSTURA${nome.trim() ? ` — ${nome.trim().toUpperCase()}` : ''}`, dataCurta(a.date), '', `Nota da postura: ${a.score}/100`, `Classificação: ${comEmoji(planoPostura(a).status)}`]
  const problemas = a.views.flatMap((v) => v.findings).filter((f) => f.status !== 'ok')
  for (const v of a.views) {
    const achados = v.findings.filter((f) => f.status !== 'ok')
    if (!achados.length) continue
    linhas.push('', VIEWS.find((x) => x.id === v.view)?.label.toUpperCase() ?? v.view)
    for (const f of achados) linhas.push(`• ${f.title}: ${f.value} (${NIVEL[f.status].emoji} ${ROTULO[f.status]})`)
  }
  if (!problemas.length) linhas.push('', 'Nenhum desvio importante encontrado.')
  const plano = planoCorretivo(problemas)
  if (plano.alongar.length) linhas.push('', `Alongar: ${plano.alongar.join(', ')}`)
  if (plano.fortalecer.length) linhas.push(`Fortalecer: ${plano.fortalecer.join(', ')}`)
  if (plano.exercicios.length) {
    linhas.push('', 'EXERCÍCIOS')
    for (const e of plano.exercicios) linhas.push(`• ${e.nome} — ${e.dose}`)
  }
  fimPlano(linhas, planoPostura(a), false)
  linhas.push('', RODAPE)
  return linhas.join('\n')
}

export function textoFlex(r: RegistroFlex): string {
  const info = infoNivel(r.nivel)
  const linhas = [`TESTE DE FLEXIBILIDADE — ${r.avaliado.toUpperCase()}`, dataCurta(r.date), '', `Nível: ${r.nivel}`, `Classificação: ${comEmoji(planoFlex(r).status)}`, info.onde, '', info.dica]
  fimPlano(linhas, planoFlex(r))
  if (r.observacoes.trim()) linhas.push('', `Observações: ${r.observacoes.trim()}`)
  linhas.push('', RODAPE)
  return linhas.join('\n')
}

export function textoAdams(r: RegistroAdams): string {
  const angulo = anguloAdams(r)!
  const classe = classificarAdams(angulo)
  const linhas = [
    `TESTE DE ADAMS — ${r.avaliado.toUpperCase()}`,
    dataCurta(r.date),
    '',
    `Rotação do tronco: ${numero(angulo)}°${r.lado ? ` (lado ${r.lado} mais alto)` : ''}`,
    `Classificação: ${comEmoji(classe.status)} (${classe.titulo.toLowerCase()})`,
    '',
    classe.texto,
  ]
  fimPlano(linhas, planoAdams(r))
  if (r.observacoes.trim()) linhas.push('', `Observações: ${r.observacoes.trim()}`)
  linhas.push('', RODAPE)
  return linhas.join('\n')
}
