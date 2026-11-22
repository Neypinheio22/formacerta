import { describe, expect, it } from 'vitest'
import { lerAviso } from './whatsapp'

describe('webhook WhatsApp: áudio do contato', () => {
  it('preserva o ID de mídia enviado pela Meta para que o áudio seja salvo', () => {
    const aviso = {
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: '111' },
            contacts: [{ wa_id: '5511999999999', profile: { name: 'Aluno' } }],
            messages: [{
              id: 'wamid.123',
              from: '5511999999999',
              type: 'audio',
              audio: { id: '123456789012345', mime_type: 'audio/ogg; codecs=opus' },
            }],
          },
        }],
      }],
    }
    const resultado = lerAviso(aviso)
    expect(resultado.recebidas).toHaveLength(1)
    expect(resultado.recebidas[0]).toMatchObject({
      tipo: 'audio',
      midiaId: '123456789012345',
      numeroId: '111',
      texto: '',
    })
  })

  it('não inclui conteúdo de áudio em mensagens comuns', () => {
    const aviso = { entry: [{ changes: [{ field: 'messages', value: {
      messages: [{ id: 'w1', from: '55', type: 'text', text: { body: 'Oi' } }],
    } }] }] }
    expect(lerAviso(aviso).recebidas[0].midiaId).toBeUndefined()
    expect(lerAviso(aviso).recebidas[0].texto).toBe('Oi')
  })
})
