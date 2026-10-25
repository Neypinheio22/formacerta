import { describe, expect, it } from 'vitest'
import { linkWhatsApp, normalizarTelefone, telefoneValido } from './whatsapp'

describe('WhatsApp', () => {
  it('põe o 55 quando a pessoa digita só DDD e número', () => {
    expect(normalizarTelefone('(71) 99876-5432')).toBe('5571998765432')
    expect(normalizarTelefone('+55 71 99876-5432')).toBe('5571998765432')
    expect(normalizarTelefone('071 99876-5432')).toBe('5571998765432')
  })

  it('recusa número curto', () => {
    expect(telefoneValido('99876-5432')).toBe(false)
    expect(telefoneValido('71 99876-5432')).toBe(true)
  })

  it('monta o link com o número e o texto', () => {
    expect(linkWhatsApp('Olá Raquel', '71 99876-5432')).toBe('https://wa.me/5571998765432?text=Ol%C3%A1%20Raquel')
  })

  it('sem número, deixa o WhatsApp escolher o contato', () => {
    expect(linkWhatsApp('Oi')).toBe('https://wa.me/?text=Oi')
  })
})
