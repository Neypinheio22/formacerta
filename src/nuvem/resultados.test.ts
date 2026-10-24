import { describe, expect, it } from 'vitest'
import { resumir } from './resultados'

describe('resumir', () => {
  it('tira fotos, vídeos, pontos do corpo e o nome antes de enviar', () => {
    const r = resumir({
      id: 'a',
      score: 80,
      avaliado: 'Maria Silva',
      video: new Blob(['x']),
      quadros: [{ t: 0, lm: [{ x: 1, y: 2 }] }],
      views: [{ view: 'frente', image: 'data:image/jpeg;base64,AAAA', landmarks: [{ x: 0, y: 0 }], findings: [{ id: 'ombros', value: '3°', status: 'ok' }] }],
      foto: { image: 'data:x' },
    })
    expect(r).toEqual({ id: 'a', score: 80, views: [{ view: 'frente', findings: [{ id: 'ombros', value: '3°', status: 'ok' }] }] })
  })

  it('descarta textos enormes', () => {
    expect(resumir({ a: 'x'.repeat(500), b: 'ok' })).toEqual({ b: 'ok' })
  })
})
