import { describe, expect, it } from 'vitest'
import { acharExercicio, buscaYoutube, idYoutube, nomeChave, tipoDoArquivo, type ExercicioProprio } from './comoFazer'

const ex = (p: Partial<ExercicioProprio>): ExercicioProprio => ({
  id: crypto.randomUUID(),
  profissional_id: 'romildo',
  nome: 'Remada cavalinho',
  grupo: '',
  descricao: '',
  tipo: null,
  arquivo: null,
  link: null,
  do_app: false,
  criado_em: '',
  ...p,
})

describe('nomeChave', () => {
  it('ignora acento, maiúscula e espaço', () => {
    expect(nomeChave('  Elevação   Pélvica ')).toBe('elevacao pelvica')
  })
})

describe('acharExercicio', () => {
  it('acha pelo nome escrito de outro jeito', () => {
    const e = ex({ nome: 'Elevação pélvica', tipo: 'video', arquivo: 'a.mp4' })
    expect(acharExercicio([e], 'elevacao pelvica')).toBe(e)
  })

  it('prefere o do personal ao do app', () => {
    const app = ex({ profissional_id: 'ney', do_app: true, tipo: 'video', arquivo: 'app.mp4' })
    const meu = ex({ tipo: 'imagem', arquivo: 'meu.jpg' })
    expect(acharExercicio([app, meu], 'Remada cavalinho', 'romildo')).toBe(meu)
  })

  it('prefere o que tem foto ou vídeo', () => {
    const semMidia = ex({})
    const app = ex({ profissional_id: 'ney', do_app: true, tipo: 'link', link: 'https://youtu.be/abcdefghijk' })
    expect(acharExercicio([semMidia, app], 'Remada cavalinho', 'romildo')).toBe(app)
  })

  it('não acha com nome vazio ou diferente', () => {
    expect(acharExercicio([ex({})], '')).toBeUndefined()
    expect(acharExercicio([ex({})], 'Remada baixa')).toBeUndefined()
  })
})

describe('idYoutube', () => {
  it('entende os formatos de link', () => {
    expect(idYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ')
    expect(idYoutube('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ')
    expect(idYoutube('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(idYoutube('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('outros sites e links quebrados não são YouTube', () => {
    expect(idYoutube('https://instagram.com/p/abc')).toBeNull()
    expect(idYoutube('youtube')).toBeNull()
  })
})

describe('buscaYoutube e tipoDoArquivo', () => {
  it('monta a busca pelo nome', () => {
    expect(buscaYoutube('Rosca direta')).toBe('https://www.youtube.com/results?search_query=Rosca%20direta%20execu%C3%A7%C3%A3o%20correta')
  })

  it('separa foto de vídeo', () => {
    expect(tipoDoArquivo({ type: 'video/mp4' })).toBe('video')
    expect(tipoDoArquivo({ type: 'image/jpeg' })).toBe('imagem')
    expect(tipoDoArquivo({ type: 'application/pdf' })).toBeNull()
  })
})
