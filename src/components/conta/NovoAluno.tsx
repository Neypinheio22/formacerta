import { useState } from 'react'
import { senhaFraca } from '../../nuvem/conta'
import { cadastrarAluno } from '../../nuvem/gestao'
import { dominioRecebeEmail, emailValidoParaCadastro } from '../../nuvem/email'
import { CamposEmail } from './CamposEmail'

/** Cria a conta do aluno e vincula à ficha aberta. */
export function NovoAluno({ onCancelar, onCriado, nomeFixo, fichaId }: { onCancelar: () => void; onCriado: () => void; nomeFixo?: string; fichaId: string }) {
  const [nome, setNome] = useState(nomeFixo ?? '')
  const [email, setEmail] = useState('')
  const [confirma, setConfirma] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const pronto = nome.trim() !== '' && emailValidoParaCadastro(email, confirma) && !senhaFraca(senha)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    if (!(await dominioRecebeEmail(email))) {
      setEnviando(false)
      setErro(`O endereço "${email.trim().split('@')[1]}" não recebe e-mails. Confira o que vem depois do @.`)
      return
    }
    const { erro, retomado } = await cadastrarAluno({ nome, email, senha, fichaId })
    setEnviando(false)
    if (erro) setErro(erro)
    else {
      alert(retomado
        ? 'Cadastro concluído. O aluno entra com a senha da primeira tentativa ou pode usar "Esqueci a senha".'
        : `Conta criada. Passe para ${nome.trim().split(' ')[0]} o e-mail e a senha; dá para trocar a senha depois em "Esqueci a senha".`)
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
      <CamposEmail rotulo="E-mail do aluno" email={email} confirma={confirma} onEmail={setEmail} onConfirma={setConfirma} />
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
