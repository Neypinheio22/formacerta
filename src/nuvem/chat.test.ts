import { describe, expect, it } from 'vitest'
import { OCULTO, ocultarContato, outroLado, quando, temContato, type Conversa } from './chat'

describe('esconder contato no chat', () => {
  it('telefone com e sem separadores', () => {
    expect(ocultarContato('liga 11 98765-4321')).toBe(`liga ${OCULTO}`)
    expect(ocultarContato('(11)987654321')).toBe(OCULTO)
    expect(ocultarContato('+55 11 9 8765 4321')).toBe(OCULTO)
  })
  it('e-mail e links', () => {
    expect(ocultarContato('ana@gmail.com')).toBe(OCULTO)
    expect(ocultarContato('veja https://wa.me/5511')).toBe(`veja ${OCULTO}`)
    expect(ocultarContato('wa.me/5511')).toBe(OCULTO)
  })
  it('pedidos de levar para fora do app', () => {
    expect(ocultarContato('me chama no zap')).toBe(`me chama no ${OCULTO}`)
    expect(ocultarContato('manda no WhatsApp')).toBe(`manda no ${OCULTO}`)
    expect(ocultarContato('me segue no insta')).toBe(`me segue no ${OCULTO}`)
  })
  it('não mexe em treino, preço e data', () => {
    const texto = 'Faço 3x12 com 10kg, R$ 120,00, dia 29/10/2026. Vou instalar o app.'
    expect(ocultarContato(texto)).toBe(texto)
    expect(temContato(texto)).toBe(false)
  })
})

const c: Conversa = { id: '1', aluno_id: 'a', profissional_id: 'p', aluno_nome: 'Ana', profissional_nome: 'Romildo', profissional_foto: 'f.jpg', ultima_em: '', ultima_previa: '', nao_lidas: 0 }

describe('conversa', () => {
  it('o aluno vê o personal', () => expect(outroLado(c, 'a')).toEqual({ nome: 'Romildo', foto: 'f.jpg', sou: 'aluno' }))
  it('o personal vê o aluno', () => expect(outroLado(c, 'p').nome).toBe('Ana'))
  it('hora de hoje, ontem e data', () => {
    const agora = new Date(2026, 9, 29, 15, 0)
    expect(quando(new Date(2026, 9, 29, 9, 5).toISOString(), agora)).toMatch(/09:05/)
    expect(quando(new Date(2026, 9, 28, 22, 0).toISOString(), agora)).toBe('ontem')
    expect(quando(new Date(2026, 9, 20, 22, 0).toISOString(), agora)).toBe('20/10')
  })
})
