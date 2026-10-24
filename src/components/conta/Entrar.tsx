import { useState } from 'react'
import { cadastrar, entrar, esqueciSenha, senhaFraca } from '../../nuvem/conta'
import { Logo } from '../Logo'
import { Privacidade } from './Privacidade'

type Modo = 'entrar' | 'cadastrar' | 'esqueci'

export function Entrar() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [papel, setPapel] = useState<'profissional' | 'aluno'>('profissional')
  const [nome, setNome] = useState('')
  const [registro, setRegistro] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceito, setAceito] = useState(false)
  const [verPrivacidade, setVerPrivacidade] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const trocar = (m: Modo) => {
    setModo(m)
    setErro(null)
    setAviso(null)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setAviso(null)
    setEnviando(true)
    if (modo === 'entrar') {
      setErro(await entrar(email, senha))
    } else if (modo === 'esqueci') {
      const erro = await esqueciSenha(email)
      if (erro) setErro(erro)
      else setAviso('Se este e-mail tiver cadastro, chega um link para você criar uma senha nova.')
    } else {
      const r = await cadastrar({ email, senha, nome, papel, registro })
      if (r.erro) setErro(r.erro)
      else if (r.confirmar) {
        setAviso('Cadastro feito. Abra o link que chegou no seu e-mail para confirmar. Depois disso, o administrador libera o seu acesso.')
        setModo('entrar')
      }
    }
    setEnviando(false)
  }

  if (verPrivacidade) return <Privacidade onVoltar={() => setVerPrivacidade(false)} />

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const pronto =
    emailOk &&
    (modo === 'esqueci' ||
      (modo === 'entrar' && senha.length > 0) ||
      (modo === 'cadastrar' && nome.trim() !== '' && !senhaFraca(senha) && aceito))

  return (
    <div className="tela">
      <header className="marca">
        <Logo size={30} />
        <p className="slogan">
          Treine certo. <span className="verde">Evolua sempre.</span>
        </p>
      </header>

      <form className="cartao destaque formulario" onSubmit={enviar}>
        <h1>{modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Criar conta' : 'Esqueci a senha'}</h1>

        {modo === 'cadastrar' && (
          <>
            <div className="campo">
              Eu sou
              <div className="escolha">
                <button type="button" className={papel === 'profissional' ? 'ativo' : ''} onClick={() => setPapel('profissional')}>
                  Profissional
                </button>
                <button type="button" className={papel === 'aluno' ? 'ativo' : ''} onClick={() => setPapel('aluno')}>
                  Aluno
                </button>
              </div>
            </div>
            <label className="campo">
              Nome completo
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={120} />
            </label>
            {papel === 'profissional' && (
              <label className="campo">
                Número de registro (CREF ou outro)
                <input value={registro} onChange={(e) => setRegistro(e.target.value)} maxLength={40} placeholder="Ex.: 012345-G/CE" />
              </label>
            )}
          </>
        )}

        <label className="campo">
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
        </label>

        {modo !== 'esqueci' && (
          <label className="campo">
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            />
            {modo === 'cadastrar' && <span className="dica-sec">Pelo menos 8 caracteres, com letras e números.</span>}
          </label>
        )}

        {modo === 'cadastrar' && (
          <label className="aceite">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>
              Li e aceito a{' '}
              <button type="button" className="link" onClick={() => setVerPrivacidade(true)}>
                política de privacidade
              </button>
              .
            </span>
          </label>
        )}

        {erro && <p className="mensagem erro">{erro}</p>}
        {aviso && <p className="mensagem ok">{aviso}</p>}

        <button className="botao grande" type="submit" disabled={!pronto || enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'cadastrar' ? 'Criar conta' : 'Enviar link'}
        </button>

        {modo === 'cadastrar' && (
          <p className="dica-sec">
            {papel === 'profissional'
              ? 'Depois do cadastro, o administrador confere os seus dados e libera o acesso.'
              : 'Se o seu personal já usa o FormaCerta, peça para ele cadastrar você: assim o acesso sai na hora.'}
          </p>
        )}
      </form>

      <div className="opcoes">
        {modo !== 'entrar' && (
          <button className="botao-sec" onClick={() => trocar('entrar')}>
            Já tenho conta
          </button>
        )}
        {modo !== 'cadastrar' && (
          <button className="botao-sec" onClick={() => trocar('cadastrar')}>
            Criar conta
          </button>
        )}
        {modo === 'entrar' && (
          <button className="link" onClick={() => trocar('esqueci')}>
            Esqueci a senha
          </button>
        )}
      </div>

      <p className="rodape">
        Seu corpo em movimento <span className="verde">certo.</span>
      </p>
    </div>
  )
}
