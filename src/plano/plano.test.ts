import { describe, expect, it } from 'vitest'
import { novaAvaliacao } from '../idoso/tipos'
import type { ResultadoNuvem } from '../nuvem/resultados'
import type { Finding } from '../pose/types'
import { NIVEL, analisar, planoAdams, planoDeNuvem, planoFlex, planoIdoso, planoPostura, separarDose, statusNota } from './plano'

const DATA = '2026-10-26T12:00:00Z'

const ombro: Finding = { id: 'ombros', title: 'Ombros', value: '4,0°', status: 'alerta', detail: 'Ombro direito mais alto.', exercises: [], correcao: 'ombroElevado', lado: 'direito' }

function nuvem(tipo: ResultadoNuvem['tipo'], dados: Record<string, unknown>, feito_em = DATA): ResultadoNuvem {
  return { id: `${tipo}-${feito_em}`, tipo, feito_em, apelido: 'Ana', aluno_id: null, ficha_id: 'f', enviado_por: 'p', idade: null, sexo: null, altura_cm: null, dados }
}

describe('plano de ação', () => {
  it('três níveis com os nomes pedidos pelo personal', () => {
    expect(NIVEL.ok).toEqual({ emoji: '🟢', rotulo: 'Adequado' })
    expect(NIVEL.atencao).toEqual({ emoji: '🟡', rotulo: 'Precisa melhorar' })
    expect(NIVEL.alerta).toEqual({ emoji: '🔴', rotulo: 'Atenção' })
    expect([statusNota(90), statusNota(70), statusNota(50)]).toEqual(['ok', 'atencao', 'alerta'])
  })

  it('postura: pontos de atenção, músculos, exercícios e reavaliação em 30 dias', () => {
    const p = planoPostura({ id: 'p', date: DATA, score: 70, views: [{ view: 'frente', findings: [ombro] }] })
    expect(p.status).toBe('atencao')
    expect(p.pontos[0]).toMatchObject({ texto: 'Ombro elevado (frente, 4,0°)', status: 'alerta' })
    expect(p.musculos.alongar[0]).toContain('Trapézio superior')
    expect(p.exercicios.some((e) => e.foco === 'alongar')).toBe(true)
    expect(p.reavaliarDias).toBe(30)
    expect(p.reavaliarEm.slice(0, 10)).toBe('2026-11-25')
  })

  it('postura boa, mas com um ponto vermelho, não fica como adequada', () => {
    expect(planoPostura({ id: 'p', date: DATA, score: 90, views: [{ view: 'frente', findings: [ombro] }] }).status).toBe('atencao')
    expect(planoPostura({ id: 'p', date: DATA, score: 95, views: [{ view: 'frente', findings: [{ ...ombro, status: 'ok' }] }] }).status).toBe('ok')
  })

  it('flexibilidade: joelho dobrado vira ponto de atenção', () => {
    const p = planoFlex({ id: 'f', date: DATA, nivel: 'Boa', joelhosOk: false, joelho: 25 })
    expect(p.status).toBe('atencao')
    expect(p.pontos[0].texto).toContain('Joelhos dobraram 25°')
    expect(planoFlex({ id: 'f', date: DATA, nivel: 'Muito limitada', joelhosOk: true, joelho: 5 }).status).toBe('alerta')
  })

  it('Adams com 7° ou mais pede o ortopedista', () => {
    const p = planoAdams({ id: 'a', date: DATA, atr: 8, escoliometro: null, lado: 'direito' })!
    expect(p.status).toBe('alerta')
    expect(p.conduta).toContain('ortopedista')
    expect(planoAdams({ id: 'a', date: DATA, atr: null, escoliometro: null, lado: null })).toBeNull()
  })

  it('idoso: exercícios da área com problema', () => {
    const base = novaAvaliacao()
    const a = { ...base, id: 'i', date: DATA, avaliado: 'Raquel', anamnese: { ...base.anamnese, idade: 70, sexo: 'feminino' as const, quedas: 2 } }
    const p = planoIdoso(a)!
    expect(p.status).toBe('alerta')
    expect(p.exercicios.some((e) => e.foco === 'equilibrio')).toBe(true)
    expect(p.conduta).toContain('médico')
  })

  it('separa nome e dose do texto do exercício', () => {
    expect(separarDose('Prancha frontal (3x30 s)')).toEqual({ nome: 'Prancha frontal', dose: '3x30 s' })
    expect(separarDose('Correr pensando em crescer')).toEqual({ nome: 'Correr pensando em crescer', dose: '' })
  })

  it('lê os resultados guardados na ficha', () => {
    expect(planoDeNuvem(nuvem('flexibilidade', { nivel: 'Limitada', joelhosOk: true, joelho: 3, alcance: 10 }))?.status).toBe('atencao')
    expect(planoDeNuvem(nuvem('postura', { score: 60, views: [{ view: 'frente', findings: [ombro] }] }))?.status).toBe('alerta')
    expect(planoDeNuvem(nuvem('corrida', { score: 80, vista: 'lado', achados: [{ title: 'Cadência', value: '150 passos/min', status: 'atencao', exercises: ['Pular corda (3x1 min)'] }] }))?.exercicios[0]).toMatchObject({
      nome: 'Pular corda',
      dose: '3x1 min',
    })
    expect(planoDeNuvem(nuvem('corrida', { score: 80, falha: 'Corpo fora do quadro' }))).toBeNull()
    expect(planoDeNuvem(nuvem('medidas', { peso: 70 }))).toBeNull()
  })

  it('análise geral usa só o teste mais recente de cada tipo e ordena por prioridade', () => {
    const planos = [
      planoDeNuvem(nuvem('flexibilidade', { nivel: 'Muito limitada', joelhosOk: true, joelho: 0 }, '2026-09-01T12:00:00Z'))!,
      planoDeNuvem(nuvem('flexibilidade', { nivel: 'Boa', joelhosOk: true, joelho: 0 }, DATA))!,
      planoDeNuvem(nuvem('adams', { atr: 6, escoliometro: null, lado: 'esquerdo' }))!,
      planoDeNuvem(nuvem('postura', { score: 50, views: [{ view: 'frente', findings: [ombro] }] }))!,
    ]
    const a = analisar(planos)!
    expect(a.planos.map((p) => p.tipo)).toEqual(['postura', 'adams', 'flexibilidade'])
    expect(a.status).toBe('alerta')
    expect(a.contagem).toEqual({ ok: 1, atencao: 1, alerta: 1 })
    expect(a.prioridades[0].status).toBe('alerta')
    expect(a.resumo).toContain('Prioridade: postura')
    // Treino corretivo só com os testes que precisam: sem os exercícios de manutenção da flexibilidade.
    expect(a.treino.flatMap((g) => g.exercicios).some((e) => e.nome === 'Stiff com halter')).toBe(false)
    expect(a.proximaReavaliacao?.teste).toBe('Avaliação de postura')
    expect(analisar([])).toBeNull()
  })
})
