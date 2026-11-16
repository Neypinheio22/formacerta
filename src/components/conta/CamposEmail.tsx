import { useState } from 'react'
import { conferirEmail, emailsIguais } from '../../nuvem/email'

/** Os dois campos de e-mail do cadastro, com aviso de erro de digitação e botão para corrigir. */
export function CamposEmail({
  email,
  confirma,
  onEmail,
  onConfirma,
  rotulo = 'E-mail',
}: {
  email: string
  confirma: string
  onEmail: (v: string) => void
  onConfirma: (v: string) => void
  rotulo?: string
}) {
  const [saiuEmail, setSaiuEmail] = useState(false)
  const [saiuConfirma, setSaiuConfirma] = useState(false)
  const conf = conferirEmail(email)
  const mostrarErro = !conf.ok && email.trim() !== '' && (saiuEmail || 'sugestao' in conf)
  const diferentes = confirma.trim() !== '' && !emailsIguais(email, confirma)

  function usarSugestao(s: string) {
    onEmail(s)
    // Se a pessoa digitou o mesmo erro nos dois campos, corrige os dois.
    if (emailsIguais(confirma, email)) onConfirma(s)
  }

  return (
    <>
      <label className="campo">
        {rotulo}
        <input
          type="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          onBlur={() => setSaiuEmail(true)}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={mostrarErro}
        />
      </label>
      {mostrarErro && !conf.ok && (
        <div className="aviso-email">
          <p>{conf.erro}</p>
          {conf.sugestao && (
            <button type="button" className="botao-sec" onClick={() => usarSugestao(conf.sugestao!)}>
              Sim, usar {conf.sugestao}
            </button>
          )}
        </div>
      )}
      <label className="campo">
        Confirme o e-mail
        <input
          type="email"
          value={confirma}
          onChange={(e) => onConfirma(e.target.value)}
          onBlur={() => setSaiuConfirma(true)}
          onPaste={(e) => e.preventDefault()}
          autoComplete="off"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={diferentes}
        />
        <span className="dica-sec">Digite de novo, sem copiar. É por este e-mail que chegam a confirmação e os avisos.</span>
      </label>
      {diferentes && (saiuConfirma || confirma.length >= email.length) && <p className="mensagem erro">Os dois e-mails não estão iguais.</p>}
    </>
  )
}
