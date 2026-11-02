import { describe, expect, it } from 'vitest'
import { buscarModelos, divisaoDe, exerciciosDe, MODELOS_DO_APP, nomeDeCopia, ordenarPastas, resumoModelo, validarPasta } from './biblioteca'
import { linhasDe } from './linhas'
import { VIDEOS_APP } from './videosApp'

describe('biblioteca de treinos', () => {
  it('modelos prontos têm treinos, exercícios em linhas e ids únicos', () => {
    expect(new Set(MODELOS_DO_APP.map((m) => m.id)).size).toBe(MODELOS_DO_APP.length)
    for (const m of MODELOS_DO_APP) {
      expect(m.doApp).toBe(true)
      expect(m.treinos.length).toBeGreaterThan(0)
      for (const t of m.treinos) for (const e of t.exercicios) expect(linhasDe(e).length).toBeGreaterThan(0)
    }
  })

  it('a maioria dos exercícios prontos tem vídeo de como fazer', () => {
    const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*\(.*\)$/, '').trim()
    const nomes = MODELOS_DO_APP.flatMap((m) => m.treinos.flatMap((t) => t.exercicios.map((e) => e.nome)))
    const comVideo = nomes.filter((n) => VIDEOS_APP[chave(n)])
    expect(comVideo.length / nomes.length).toBeGreaterThan(0.85)
  })

  it('busca por nome, objetivo e exercício, sem acento', () => {
    expect(buscarModelos(MODELOS_DO_APP, 'hipertrofia').map((m) => m.id)).toEqual(['app-hipertrofia-abc'])
    expect(buscarModelos(MODELOS_DO_APP, 'TRICEPS frances').map((m) => m.id)).toEqual(['app-hipertrofia-abc'])
    expect(buscarModelos(MODELOS_DO_APP, 'polichinelo').length).toBe(2)
    expect(buscarModelos(MODELOS_DO_APP, '  ').length).toBe(MODELOS_DO_APP.length)
    expect(buscarModelos(MODELOS_DO_APP, 'natação')).toEqual([])
  })

  it('resumo, divisão e contagem', () => {
    const m = MODELOS_DO_APP.find((x) => x.id === 'app-hipertrofia-abc')!
    expect(divisaoDe(m)).toBe('ABC')
    expect(exerciciosDe(m)).toBe(17)
    expect(resumoModelo(m)).toBe('ABC · 17 exercícios · 8 semanas')
    expect(resumoModelo({ treinos: [], semanas: null })).toBe('Sem treinos · 0 exercícios')
  })

  it('nome de cópia não repete', () => {
    expect(nomeDeCopia('Treino X', [])).toBe('Treino X (cópia)')
    expect(nomeDeCopia('Treino X', ['Treino X (cópia)'])).toBe('Treino X (cópia 2)')
    expect(nomeDeCopia('Treino X (cópia)', ['Treino X (cópia)'])).toBe('Treino X (cópia 2)')
  })

  it('valida e ordena pastas', () => {
    const pastas = [
      { id: '1', nome: 'Alongamentos' },
      { id: '2', nome: 'Circuito' },
    ]
    expect(validarPasta('  ', pastas)).toMatch(/nome/)
    expect(validarPasta('alongamentos', pastas)).toMatch(/Já existe/)
    expect(validarPasta('Alongamentos', pastas, '1')).toBeNull()
    expect(validarPasta('Esqueleto de treino', pastas)).toBeNull()
    expect(ordenarPastas([{ nome: 'Ética' }, { nome: 'abdômen' }, { nome: 'Circuito' }]).map((p) => p.nome)).toEqual(['abdômen', 'Circuito', 'Ética'])
  })
})
