import { useEffect, useState } from 'react'
import { senhaFraca, type Perfil } from '../../nuvem/conta'
import { cadastrarAluno, listarPerfis } from '../../nuvem/gestao'
import { ROTULO_TIPO, listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'

/** Tela do profissional: os seus alunos e o cadastro de novos. */
export function MeusAlunos({ onVoltar, meuId }: { onVoltar: () => void; meuId: string }) {
  const [alunos, setAlunos] = useState<Perfil[]>([])
  const [resultados, setResultados] = useState<ResultadoNuvem[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  async function carregar() {
    const [p, r] = await Promise.all([listarPerfis(), listarResultados()])
    setAlunos(p.perfis.filter((x) => x.id !== meuId))
    setResultados(r.lista)
    setErro(p.erro ?? r.erro)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <h1>Meus alunos</h1>
      <p className="dica-sec">Os alunos que você cadastra já entram liberados e veem os próprios resultados.</p>

      {erro && <p className="mensagem erro">{erro}</p>}

      {novo ? (
        <NovoAluno
          onCancelar={() => setNovo(false)}
          onCriado={() => {
            setNovo(false)
            carregar()
          }}
        />
      ) : (
        <button className="botao grande" onClick={() => setNovo(true)}>
          Cadastrar aluno
        </button>
      )}

      {alunos.length === 0 && !novo && <p className="dica-sec">Você ainda não cadastrou nenhum aluno.</p>}
      {alunos.map((a) => {
        const dele = resultados.filter((r) => r.aluno_id === a.id)
        return (
          <section className="cartao pessoa" key={a.id}>
            <button className="pessoa-topo sem-botao" onClick={() => setAberto(aberto === a.id ? null : a.id)}>
              <div>
                <h3>{a.nome || a.email}</h3>
                <p className="dica-sec">
                  {a.email} · {dele.length} resultado(s)
                </p>
              </div>
              {a.situacao !== 'liberado' && <span className="chip chip-alerta">Bloqueado</span>}
            </button>
            {aberto === a.id && (
              <ul className="historico">
                {dele.length === 0 && <li className="dica-sec">Nenhum resultado enviado ainda.</li>}
                {dele.map((r) => (
                  <li key={r.id}>
                    <span className="linha">
                      <span>{ROTULO_TIPO[r.tipo]}</span>
                      <span className="nota">{new Date(r.feito_em).toLocaleDateString('pt-BR')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function NovoAluno({ onCancelar, onCriado }: { onCancelar: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState('')
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
      <h2>Novo aluno</h2>
      <label className="campo">
        Nome completo
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
      </label>
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
