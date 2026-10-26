import { useState } from 'react'
import { senhaFraca } from '../../nuvem/conta'
import { cadastrarAluno } from '../../nuvem/gestao'

/** Cria a conta do aluno no app (e-mail e senha). Com `nomeFixo`, liga à ficha que já existe com esse nome. */
export function NovoAluno({ onCancelar, onCriado, nomeFixo }: { onCancelar: () => void; onCriado: () => void; nomeFixo?: string }) {
  const [nome, setNome] = useState(nomeFixo ?? '')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const pronto = nome.trim() !== '' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && !senhaFraca(senha)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const erro = await cadastrarAluno({ nome, email, senha })
    setEnviando(false)
    if (erro) setErro(erro)
    else {
      alert(`Conta criada. Passe para ${nome.trim().split(' ')[0]} o e-mail e a senha; dá para trocar a senha depois em "Esqueci a senha".`)
      onCriado()
    }
  }

  return (
    <form className="cartao destaque formulario" onSubmit={criar}>
      <h2>{nomeFixo ? `Acesso ao app para ${nomeFixo}` : 'Novo aluno'}</h2>
      {nomeFixo ? (
        <p className="dica-sec">O aluno entra com este e-mail e senha e vê a própria ficha e os gráficos de evolução.</p>
      ) : (
        <label className="campo">
          Nome completo
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
        </label>
      )}
      <label className="campo">
        E-mail do aluno
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
      </label>
      <label className="campo">
        Senha inicial
        <input value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" />
        <span className="dica-sec">Pelo menos 8 caracteres, com letras e números. O aluno pode trocar depois.</span>
      </label>
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao" type="submit" disabled={!pronto || enviando}>
        {enviando ? 'Criando…' : 'Criar conta do aluno'}
      </button>
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}
