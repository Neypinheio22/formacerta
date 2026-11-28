import { describe, expect, it } from 'vitest'
import { deveEncaminharAudio, orientacaoContraRepeticao, recebeuEmailParaAcesso, respostaDireta, respostaInicialLead, type TurnoTriagem } from './triagem'

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
    expect(resposta).toContain('Você já tem conta no FormaCerta')
    expect(resposta!.length).toBeLessThan(150)
    const conversa = [entrada('Como faço minha avaliação grátis?'), robo(resposta!)]
    expect(respostaDireta([...conversa, entrada('Já tenho conta')])).toContain('Começar avaliação')
    expect(respostaDireta([...conversa, entrada('Não tenho conta')])).toContain('Criar conta')
    expect(resposta).not.toContain('inteligência artificial')
  })

  it('não pede novo cadastro quando usuário informa já ter conta', () => {
    const resposta = respostaInicialLead([entrada('Já fiz o cadastro')], 'Ana')
    expect(resposta).toContain('Você já conseguiu entrar')
    expect(resposta).not.toContain('Criar conta')
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

describe('continuidade do atendimento', () => {
  it('continua o diagnóstico após receber o e-mail solicitado para erro de acesso', () => {
    const historico = [
      entrada('Não consegui entrar'),
      robo('Me manda o e-mail que você usou no cadastro que eu confiro o acesso.'),
      entrada('O meu mail é aluno@example.com'),
    ]

    expect(recebeuEmailParaAcesso(historico)).toBe(true)
    expect(recebeuEmailParaAcesso(historico.slice(1))).toBe(false)
    expect(recebeuEmailParaAcesso([entrada('Quero pagar com Pix'), ...historico.slice(1)])).toBe(false)
  })

  it('explica o canal de pagamento sem iniciar uma assinatura', () => {
    const resposta = respostaDireta([entrada('Posso pagar por aqui?')])
    expect(resposta).toContain('Pix nesta conversa')
    expect(resposta).toContain('cartão')
    expect(respostaDireta([entrada('Paguei por aqui, mas não liberou')])).toBeNull()
  })

  it('responde à saudação e depois à intenção específica', () => {
    const oi = entrada('Oi')
    const saudacao = respostaDireta([oi])
    expect(saudacao).toContain('Como posso te ajudar hoje?')
    const conversa = [oi, robo(saudacao!)]
    expect(respostaDireta([...conversa, entrada('Aprendendo fazer agachamento')])).toContain('Ver vídeo')
    expect(respostaDireta([...conversa, entrada('Fazer avaliação')])).toContain('Começar avaliação')
    expect(respostaDireta([...conversa, entrada('Você pode mandar um vídeo que eu faço perna segunda e quarta?')])).toContain('Qual exercício')
    expect(respostaDireta([...conversa, entrada('Pode mandar um vídeo de agachamento?')])).toContain('Ver vídeo')
    expect(respostaDireta([...conversa, entrada('Quero gravar meu agachamento')])).toBeNull()
  })
})
