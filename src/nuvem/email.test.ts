import { describe, expect, it } from 'vitest'
import { conferirEmail, emailsIguais } from './email'

const sug = (e: string) => {
  const r = conferirEmail(e)
  return r.ok ? null : (r.sugestao ?? 'erro')
}

describe('conferirEmail', () => {
  it('aceita e-mails certos', () => {
    for (const e of ['maria@gmail.com', 'Joao.Silva@Hotmail.com', 'ana@yahoo.com.br', 'x@outlook.com', 'contato@academia-forte.com.br', 'a@ymail.com', 'b@mail.com', 'c@empresa.co', 'd@uol.com.br'])
      expect(conferirEmail(e)).toEqual({ ok: true })
  })

  it('pega domínio digitado errado e sugere o certo', () => {
    expect(sug('raquelcristina0398@gmai.com')).toBe('raquelcristina0398@gmail.com')
    expect(sug('ana@gmial.com')).toBe('ana@gmail.com')
    expect(sug('ana@gamil.com')).toBe('ana@gmail.com')
    expect(sug('ana@hotmial.com')).toBe('ana@hotmail.com')
    expect(sug('ana@hotmai.com')).toBe('ana@hotmail.com')
    expect(sug('ana@outlok.com')).toBe('ana@outlook.com')
    expect(sug('ana@gmail.con')).toBe('ana@gmail.com')
    expect(sug('ana@hotmail.co')).toBe('ana@hotmail.com')
    expect(sug('ana@yahoo.com.bt')).toBe('ana@yahoo.com.br')
    expect(sug('ana@gmail.com.br')).toBe('ana@gmail.com')
  })

  it('recusa formato quebrado', () => {
    for (const e of ['', 'ana', 'ana@', 'ana@gmail', 'ana gmail.com', 'ana@@gmail.com', 'ana@gmail..com', 'ana @gmail.com', '.ana@gmail.com'])
      expect(conferirEmail(e).ok).toBe(false)
  })

  it('confere se os dois campos batem', () => {
    expect(emailsIguais(' Ana@Gmail.com', 'ana@gmail.com ')).toBe(true)
    expect(emailsIguais('ana@gmail.com', 'ana@gmai.com')).toBe(false)
  })
})
