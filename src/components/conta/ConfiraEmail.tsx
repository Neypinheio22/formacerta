import { MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { reenviarConfirmacao } from '../../nuvem/alunosNovos'

const ESPERA = 60

/** Logo depois do cadastro: mostra o e-mail, explica o que fazer e deixa reenviar o link. */
export function ConfiraEmail({ email, aguardaLiberacao, onErreiEmail, onEntrar }: { email: string; aguardaLiberacao: boolean; onErreiEmail: () => void; onEntrar: () => void }) {
  const [falta, setFalta] = useState(ESPERA)
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (falta <= 0) return
    const t = setTimeout(() => setFalta((f) => f - 1), 1000)
    return () => clearTimeout(t)
  }, [falta])

  async function reenviar() {
    setEnviando(true)
    const erro = await reenviarConfirmacao(email)
    setEnviando(false)
    setAviso(erro ? { texto: erro, erro: true } : { texto: 'Enviamos de novo. Confira a caixa de entrada e o spam.', erro: false })
    setFalta(ESPERA)
  }

  return (
    <section className="cartao destaque formulario confira-email">
      <MailCheck size={44} className="verde" />
      <h1>Confira seu e-mail</h1>
      <p>Mandamos um link de confirmação para:</p>
      <p className="email-destaque">{email}</p>
      <button type="button" className="link" onClick={onErreiEmail}>
        Este não é o meu e-mail. Corrigir
      </button>

      <ol className="passos-email">
        <li>
          Abra o <strong>e-mail de confirmação</strong> que acabamos de enviar.
        </li>
        <li>
          Toque no <strong>link de confirmação</strong> dentro dele.
        </li>
        <li>Volte aqui e entre com o seu e-mail e a sua senha.{aguardaLiberacao && ' Depois, é só esperar a liberação do acesso.'}</li>
      </ol>

      <div className="aviso-email">
        <p>
          <strong>Não chegou?</strong> Espere 1 ou 2 minutos e procure na pasta <strong>Spam</strong> ou <strong>Lixo eletrônico</strong>. No Gmail, veja
          também a aba <strong>Promoções</strong>.
        </p>
      </div>

      <button type="button" className="botao-sec" disabled={falta > 0 || enviando} onClick={reenviar}>
        {enviando ? 'Enviando…' : falta > 0 ? `Reenviar e-mail (em ${falta} s)` : 'Reenviar e-mail'}
      </button>
      {aviso && <p className={`mensagem ${aviso.erro ? 'erro' : 'ok'}`}>{aviso.texto}</p>}

      <button type="button" className="botao grande" onClick={onEntrar}>
        Já confirmei, quero entrar
      </button>
    </section>
  )
}
