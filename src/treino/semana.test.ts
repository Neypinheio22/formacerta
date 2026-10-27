import { describe, expect, it } from 'vitest'
import { diasTreinadosNaSemana, inicioDaSemana, litros, metaAguaPorPeso, noCatalogo, proximaLetra, proximoTreino } from './semana'

// Terça, 27/10/2026.
const terca = new Date(2026, 9, 27, 10)

describe('semana', () => {
  it('começa na segunda', () => expect(inicioDaSemana(terca).getDate()).toBe(26))
  it('domingo ainda é da semana que começou na segunda anterior', () => expect(inicioDaSemana(new Date(2026, 10, 1)).getDate()).toBe(26))
  it('conta dias diferentes desta semana', () => {
    const datas = ['2026-10-26', new Date(2026, 9, 26, 19).toISOString(), new Date(2026, 9, 27, 7), '2026-10-25', '2026-10-28']
    expect(diasTreinadosNaSemana(datas, terca)).toBe(2)
  })
})

describe('próximo treino', () => {
  const treinos = [{ letra: 'B' }, { letra: 'A' }, { letra: 'C' }]
  it('sem nenhum feito, começa no A', () => expect(proximoTreino(treinos, null)?.letra).toBe('A'))
  it('depois do A vem o B', () => expect(proximoTreino(treinos, 'A')?.letra).toBe('B'))
  it('depois do último volta para o A', () => expect(proximoTreino(treinos, 'C')?.letra).toBe('A'))
  it('treino feito que foi apagado: segue para o seguinte', () => expect(proximoTreino([{ letra: 'A' }, { letra: 'C' }], 'B')?.letra).toBe('C'))
  it('ficha vazia', () => expect(proximoTreino([], 'A')).toBeNull())
  it('letra livre para um treino novo', () => expect(proximaLetra(['A', 'C'])).toBe('B'))
})

describe('catálogo da câmera', () => {
  const catalogo = [{ nome: 'Elevação lateral' }, { nome: 'Afundo (avanço)' }, { nome: 'Rosca direta' }]
  it('acha sem acento e sem maiúscula', () => expect(noCatalogo(catalogo, 'elevacao LATERAL')?.nome).toBe('Elevação lateral'))
  it('ignora o que está entre parênteses', () => expect(noCatalogo(catalogo, 'Afundo')?.nome).toBe('Afundo (avanço)'))
  it('aceita variação no fim do nome', () => expect(noCatalogo(catalogo, 'Rosca direta com barra W')?.nome).toBe('Rosca direta'))
  it('não acha o que não tem', () => expect(noCatalogo(catalogo, 'Leg press')).toBeUndefined())
})

describe('água', () => {
  it('35 ml por kg', () => expect(metaAguaPorPeso(70)).toBe(2500))
  it('sem peso usa 2,5 L', () => expect(metaAguaPorPeso(null)).toBe(2500))
  it('tem teto', () => expect(metaAguaPorPeso(200)).toBe(4500))
  it('mostra em litros', () => expect(litros(1750)).toBe('1,8 L'))
})

describe('série sugerida', async () => {
  const { SERIE_SUGERIDA } = await import('./sugerida')
  const { EXERCICIOS } = await import('../movimento/exercicios')
  it('todo exercício abre na câmera', () => {
    for (const t of SERIE_SUGERIDA) for (const e of t.exercicios) expect(noCatalogo(EXERCICIOS, e.nome), e.nome).toBeDefined()
  })
  it('depois do B volta para o A', () => expect(proximoTreino(SERIE_SUGERIDA, 'B')?.letra).toBe('A'))
})
