import { describe, expect, it } from 'vitest'
import { CATALOGO, CATEGORIAS, contar, ehMeu, filtrar, FILTRO_INICIAL, grupoPadrao, GRUPOS_MUSCULARES, miniaturaYoutube, montarBiblioteca } from './catalogo'
import { nomeChave, type ExercicioProprio } from './comoFazer'

const proprio = (p: Partial<ExercicioProprio>): ExercicioProprio => ({
  id: crypto.randomUUID(),
  profissional_id: 'eu',
  nome: '',
  grupo: '',
  descricao: '',
  tipo: null,
  arquivo: null,
  link: null,
  do_app: false,
  criado_em: '',
  ...p,
})

describe('catálogo', () => {
  it('não repete nomes e usa só grupos e categorias da lista', () => {
    const chaves = CATALOGO.map((c) => nomeChave(c.nome))
    expect(new Set(chaves).size).toBe(chaves.length)
    for (const c of CATALOGO) {
      expect(GRUPOS_MUSCULARES).toContain(c.grupo)
      expect(CATEGORIAS).toContain(c.categoria)
    }
    expect(CATALOGO.length).toBeGreaterThanOrEqual(150)
  })

  it('traz o vídeo do app nos exercícios que têm', () => {
    const b = montarBiblioteca([], 'eu')
    expect(b.find((i) => i.nome === 'Supino reto')?.midia?.link).toMatch(/youtube/)
    expect(b.find((i) => i.nome === 'Afundo (avanço)')?.midia?.link).toMatch(/youtube/)
    expect(b.find((i) => i.nome === 'Rosca direta')?.camera).toBe(true)
  })
})

describe('montarBiblioteca', () => {
  it('o exercício do personal com o mesmo nome toma o lugar do do app', () => {
    const b = montarBiblioteca([proprio({ nome: 'supino reto', tipo: 'video', arquivo: 'eu/x.mp4' })], 'eu')
    const s = b.filter((i) => nomeChave(i.nome) === 'supino reto')
    expect(s).toHaveLength(1)
    expect(s[0].doApp).toBe(true)
    expect(s[0].grupo).toBe('Peito')
    expect(s[0].midia?.arquivo).toBe('eu/x.mp4')
    expect(ehMeu(s[0], 'eu')).toBe(true)
  })

  it('exercício novo do personal entra com grupo antigo convertido', () => {
    const b = montarBiblioteca([proprio({ nome: 'Remada cavalinho com pegada aberta', grupo: 'Abdominal' })], 'eu')
    const i = b.find((x) => x.nome === 'Remada cavalinho com pegada aberta')!
    expect(i.grupo).toBe('Abdômen')
    expect(i.doApp).toBe(false)
  })

  it('não mostra os exercícios de outro personal', () => {
    const b = montarBiblioteca([proprio({ nome: 'Segredo do outro', profissional_id: 'outro' })], 'eu')
    expect(b.find((x) => x.nome === 'Segredo do outro')).toBeUndefined()
  })
})

describe('filtrar', () => {
  const b = montarBiblioteca([proprio({ nome: 'Meu circuito', grupo: 'Corpo inteiro', categoria: 'Funcional' })], 'eu')

  it('busca sem acento e por partes do nome', () => {
    const r = filtrar(b, { ...FILTRO_INICIAL, busca: 'triceps frances' }, new Set(), 'eu')
    expect(r.map((i) => i.nome)).toEqual(expect.arrayContaining(['Tríceps francês', 'Tríceps francês em pé']))
    expect(r.every((i) => nomeChave(i.nome).includes('triceps'))).toBe(true)
  })

  it('filtra por grupo, categoria, favoritos e meus', () => {
    expect(filtrar(b, { ...FILTRO_INICIAL, grupo: 'Panturrilha', categoria: 'Musculação' }, new Set(), 'eu').map((i) => i.nome)).toEqual(['Panturrilha em pé', 'Panturrilha no leg press', 'Panturrilha sentado'])
    expect(filtrar(b, { ...FILTRO_INICIAL, aba: 'favoritos' }, new Set(['burpee']), 'eu').map((i) => i.nome)).toEqual(['Burpee'])
    expect(filtrar(b, { ...FILTRO_INICIAL, aba: 'meus' }, new Set(), 'eu').map((i) => i.nome)).toEqual(['Meu circuito'])
    expect(filtrar(b, { ...FILTRO_INICIAL, aba: 'app' }, new Set(), 'eu').some((i) => i.nome === 'Meu circuito')).toBe(false)
  })

  it('conta por grupo', () => {
    expect(contar(b, 'grupo').get('Peito')).toBeGreaterThan(10)
  })
})

it('grupoPadrao e miniatura', () => {
  expect(grupoPadrao('abdominal')).toBe('Abdômen')
  expect(grupoPadrao('Bíceps')).toBe('Bíceps')
  expect(miniaturaYoutube('https://www.youtube.com/shorts/13rt06PvZKY')).toBe('https://i.ytimg.com/vi/13rt06PvZKY/mqdefault.jpg')
  expect(miniaturaYoutube(null)).toBeNull()
})
