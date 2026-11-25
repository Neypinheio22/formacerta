import { describe, expect, it } from 'vitest'
import { deveEncaminharAudio, orientacaoContraRepeticao, respostaInicialLead, type TurnoTriagem } from './triagem'

const entrada = (texto: string): TurnoTriagem => ({ autor: 'entrada', texto })
const robo = (texto: string): TurnoTriagem => ({ autor: 'robo', texto })

describe('triagem do WhatsApp', () => {
  it('responde com convite curto ao primeiro pedido genérico', () => {
    const resposta = respostaInicialLead([entrada('Olá! Posso ter mais informações sobre isso?')], 'Joan Pereira')
    expect(resposta).toContain('Olá, Joan!')
    expect(resposta).toContain('primeira avaliação é grátis')
    expect(resposta).toContain('https://formacerta.app.br')
    expect(resposta).toContain('aluno ou personal?')
    expect(resposta!.length).toBeLessThan(430)
  })

  it('orienta diretamente quem pergunta como fazer avaliação grátis', () => {
    const resposta = respostaInicialLead([entrada('Como faço minha avaliação grátis?')], 'Ana')
    expect(resposta).toContain('Olá, Ana!')
    expect(resposta).toContain('Criar conta')
    expect(resposta).toContain('https://formacerta.app.br')
    expect(resposta).toContain('Você já conseguiu criar sua conta?')
    expect(resposta).not.toContain('inteligência artificial')
  })

  it('explica brevemente como funciona a avaliação postural', () => {
    const resposta = respostaInicialLead([entrada('Como funciona a avaliação de postura?')], 'João')
    expect(resposta).toContain('fotos de frente, costas e dos dois lados')
    expect(resposta).toContain('avaliação clínica')
  })

  it('não substitui uma resposta sobre preço, cadastro ou mensagens posteriores', () => {
    expect(respostaInicialLead([entrada('Como funciona o plano e o preço?')], 'José')).toBeNull()
    expect(respostaInicialLead([entrada('Quero informações sobre cadastro')], 'José')).toBeNull()
    expect(respostaInicialLead([entrada('Oi')], 'José')).toBeNull()
    expect(respostaInicialLead([entrada('Quero saber mais'), robo('Como posso ajudar?')], 'José')).toBeNull()
  })

  it('não insere nome inválido no texto', () => {
    const resposta = respostaInicialLead([entrada('Quero saber mais')], '123 😄')
    expect(resposta).toMatch(/^Olá!/)
  })

  it('direciona áudio sem transcrição ao humano, sem afetar mensagens de texto', () => {
    expect(deveEncaminharAudio('audio', '')).toBe(true)
    expect(deveEncaminharAudio('audio', 'Transcrição recebida')).toBe(false)
    expect(deveEncaminharAudio('text', '')).toBe(false)
  })

  it('impede repetir perguntas de classificação após duas tentativas', () => {
    const h = [entrada('Olá'), robo('É aluno ou personal?'), entrada('Oi ❤️'), robo('Você é aluna ou personal?'), entrada('Oi 😘')]
    expect(orientacaoContraRepeticao(h)).toContain('Não repita essa classificação')
    expect(orientacaoContraRepeticao([entrada('Olá'), robo('É aluno ou personal?')])).toBe('')
  })
})
