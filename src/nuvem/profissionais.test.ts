import { describe, expect, it } from 'vitest'
import { filtrarProfissionais, listaEspecialidades, type ProfissionalHabilitado } from './profissionais'

const p = (nome: string, cidade: string, especialidade = ''): ProfissionalHabilitado => ({ id: nome, nome, registro: '000000-G/SP', cidade, especialidade, bio: '', whatsapp: '', liberado_desde: '' })
const lista = [p('Romildo Souza', 'São Paulo', 'Idosos'), p('Ana Lima', 'Santos', 'Corrida'), p('João Prado', 'São Paulo', 'Hipertrofia')]

describe('busca de profissionais', () => {
  it('sem busca mostra todos', () => expect(filtrarProfissionais(lista, ' ')).toHaveLength(3))
  it('acha pela cidade sem acento', () => expect(filtrarProfissionais(lista, 'sao paulo').map((x) => x.nome)).toEqual(['Romildo Souza', 'João Prado']))
  it('junta cidade e especialidade', () => expect(filtrarProfissionais(lista, 'paulo idosos').map((x) => x.nome)).toEqual(['Romildo Souza']))
  it('acha pelo nome', () => expect(filtrarProfissionais(lista, 'ana')).toHaveLength(1))
})

describe('especialidades', () => {
  it('separa por vírgula e ponto e vírgula', () => expect(listaEspecialidades('Idosos, hipertrofia; corrida ,')).toEqual(['Idosos', 'hipertrofia', 'corrida']))
  it('vazio vira lista vazia', () => expect(listaEspecialidades('  ')).toEqual([]))
})
