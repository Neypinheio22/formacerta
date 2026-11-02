import { describe, expect, it } from 'vitest'
import { exercicioPdf, linhaPdf, nomeArquivoFicha, registroComConselho, tituloFicha } from './fichaPdf'

describe('ficha de treino em PDF', () => {
  it('linhas de números viram colunas com kg na carga', () => {
    expect(linhaPdf({ tipo: 'reps_carga', serie: '4x8', carga: '52/59/64', intervalo: '60 s' })).toEqual({
      campos: [
        { rotulo: 'Séries x reps', valor: '4x8' },
        { rotulo: 'Carga', valor: '52/59/64 kg' },
        { rotulo: 'Intervalo', valor: '60 s' },
      ],
    })
    expect(linhaPdf({ tipo: 'reps_carga', carga: 'elástico forte' })).toEqual({ campos: [{ rotulo: 'Carga', valor: 'elástico forte' }] })
  })

  it('observação e cadência viram frase', () => {
    expect(linhaPdf({ tipo: 'cadencia', texto: '2 s concêntrica' })).toEqual({ frase: { rotulo: 'Cadência', valor: '2 s concêntrica' } })
  })

  it('exercício antigo (séries, reps e dica) entra com as linhas convertidas e sem linhas vazias', () => {
    expect(exercicioPdf({ nome: 'Supino', series: '3', reps: '12', obs: 'devagar' }).linhas).toEqual([
      { tipo: 'reps_carga', serie: '3x12' },
      { tipo: 'observacoes', texto: 'devagar' },
    ])
    expect(exercicioPdf({ nome: 'Remada', series: '', reps: '', obs: '', linhas: [{ tipo: 'reps_carga' }, { tipo: 'observacoes', texto: ' ' }] }).linhas).toEqual([])
  })

  it('nome do arquivo sem acento', () => {
    const rotina = { nome: 'Hipertrofia Março', objetivo: '', nivel: '', tipo: '' }
    expect(nomeArquivoFicha({ tipo: 'treino', aluno: 'João da Silva', rotina, treinos: [{ letra: 'B', nome: '', foco: '', exercicios: [] }] })).toBe('Treino-B-Joao-da-Silva.pdf')
    expect(nomeArquivoFicha({ tipo: 'rotina', aluno: 'Ana', rotina, treinos: [] })).toBe('Rotina-Hipertrofia-Marco-Ana.pdf')
  })

  it('título do PDF', () => {
    expect(tituloFicha({ tipo: 'treino', treinos: [{ letra: 'A', nome: 'Peito', foco: '', exercicios: [] }] })).toBe('Treino A · Peito')
    expect(tituloFicha({ tipo: 'rotina', treinos: [{ letra: 'A', nome: '', foco: '', exercicios: [] }, { letra: 'B', nome: '', foco: '', exercicios: [] }] })).toBe('Rotina completa · 2 treinos')
  })

  it('registro ganha o conselho pelo final do número', () => {
    expect(registroComConselho('012345-G/SP')).toBe('CREF 012345-G/SP')
    expect(registroComConselho('123456-F')).toBe('CREFITO 123456-F')
    expect(registroComConselho('CREF 012345-G/BA')).toBe('CREF 012345-G/BA')
    expect(registroComConselho('')).toBe('')
  })
})
