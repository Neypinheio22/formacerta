import { describe, expect, it } from 'vitest'
import { dominioAudioConfiavel, tipoAudio } from './audio'

describe('proteção ao baixar mídias da Meta', () => {
  it('permite URLs HTTPS dos domínios reais de mídia', () => {
    expect(dominioAudioConfiavel('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123')).toBe(true)
    expect(dominioAudioConfiavel('https://scontent.whatsapp.net/file')).toBe(true)
  })
  it('bloqueia redirecionamento arbitrário ou não HTTPS', () => {
    expect(dominioAudioConfiavel('http://lookaside.fbsbx.com/')).toBe(false)
    expect(dominioAudioConfiavel('https://lookaside.fbsbx.com.evil.test/')).toBe(false)
    expect(dominioAudioConfiavel('https://127.0.0.1/')).toBe(false)
  })
  it('normaliza codec Opus do WhatsApp', () => {
    expect(tipoAudio('audio/ogg; codecs=opus')).toBe('audio/ogg')
    expect(() => tipoAudio('text/html')).toThrow()
  })
})
