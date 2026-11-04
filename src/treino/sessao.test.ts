import { describe, expect, it } from 'vitest'
import { alternarFeito, blocosDe, cargasPrescritas, descansoDe, intensidadeDaPse, lerSessao, nomeDoCombinado, segundosDe, textoCronometro, textoDescanso } from './sessao'

const ex = (nome: string, junto = false, carga = '', intervalo = '') => ({ nome, junto, linhas: [{ tipo: 'reps_carga' as const, serie: '3x10', carga, intervalo }] })

describe('sessão de treino', () => {
  it('agrupa os exercícios combinados em blocos', () => {
    expect(blocosDe([ex('a'), ex('b', true), ex('c'), ex('d', true), ex('e', true), ex('f')])).toEqual([[0], [1, 2], [3, 4, 5]])
    expect(blocosDe([ex('a', true)])).toEqual([[0]])
    expect(nomeDoCombinado(2)).toBe('Bi-set')
    expect(nomeDoCombinado(3)).toBe('Tri-set')
  })

  it('entende o descanso escrito pelo personal', () => {
    expect(segundosDe('60 s')).toBe(60)
    expect(segundosDe('90')).toBe(90)
    expect(segundosDe('1 min')).toBe(60)
    expect(segundosDe("1'30")).toBe(90)
    expect(segundosDe('1:30')).toBe(90)
    expect(segundosDe('1min30')).toBe(90)
    expect(segundosDe('45 seg')).toBe(45)
    expect(segundosDe('1,5 min')).toBe(90)
    expect(segundosDe('livre')).toBeNull()
    expect(segundosDe('')).toBeNull()
    expect(descansoDe(ex('a', false, '', '45 s'))).toBe(45)
  })

  it('separa a carga prescrita por série', () => {
    expect(cargasPrescritas(ex('a', false, '52/59/64'), 3)).toEqual(['52', '59', '64'])
    expect(cargasPrescritas(ex('a', false, '40 kg'), 3)).toEqual(['40', '40', '40'])
    expect(cargasPrescritas(ex('a', false, '10/12'), 4)).toEqual(['10', '12', '12', '12'])
    expect(cargasPrescritas(ex('a', false, 'elástico forte'), 2)).toEqual(['', ''])
    expect(cargasPrescritas(ex('a'), 2)).toEqual(['', ''])
  })

  it('mostra o cronômetro e o descanso', () => {
    expect(textoCronometro(4000)).toBe('0m 04s')
    expect(textoCronometro(750000)).toBe('12m 30s')
    expect(textoCronometro(3900000)).toBe('1h 05m')
    expect(textoDescanso(90)).toBe('1:30')
  })

  it('leva a PSE para a intensidade antiga', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(intensidadeDaPse)).toEqual(['Muito leve', 'Leve', 'Moderada', 'Moderada', 'Intensa', 'Intensa', 'Muito intensa', 'Muito intensa'])
  })

  it('recupera a sessão salva só do mesmo treino e se ainda vale', () => {
    const agora = new Date('2026-11-04T10:00:00Z').getTime()
    const s = JSON.stringify({ treinoId: 't1', inicio: '2026-11-04T09:00:00Z', feitos: [0, 2], cargas: { 0: [{ kg: '40', reps: '10' }] }, em: '2026-11-04T09:30:00Z' })
    expect(lerSessao(s, 't1', agora)?.feitos).toEqual([0, 2])
    expect(lerSessao(s, 't2', agora)).toBeNull()
    expect(lerSessao(s, 't1', agora + 6 * 3600000)).toBeNull()
    expect(lerSessao('lixo', 't1', agora)).toBeNull()
  })

  it('marca o combinado inteiro de uma vez', () => {
    expect(alternarFeito([0], [1, 2])).toEqual([0, 1, 2])
    expect(alternarFeito([0, 1, 2], [1, 2])).toEqual([0])
    expect(alternarFeito([1], [1, 2])).toEqual([1, 2])
  })
})
