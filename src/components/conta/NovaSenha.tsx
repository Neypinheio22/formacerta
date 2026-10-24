import { useState } from 'react'
import { novaSenha, senhaFraca } from '../../nuvem/conta'

/** Aberta pelo link de "esqueci a senha". */
export function NovaSenha({ onPronto }: { onPronto: () => void }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const erro = await novaSenha(senha)
    setEnviando(false)
    if (erro) setErro(erro)
    else onPronto()
  }

  return (
    <div className="tela">
      <form className="cartao destaque formulario" onSubmit={salvar}>
        <h1>Criar senha nova</h1>
        <label className="campo">
          Senha nova
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          <span className="dica-sec">Pelo menos 8 caracteres, com letras e números.</span>
        </label>
        {erro && <p className="mensagem erro">{erro}</p>}
        <button className="botao grande" type="submit" disabled={senhaFraca(senha) || enviando}>
          Salvar senha
        </button>
      </form>
    </div>
  )
}
