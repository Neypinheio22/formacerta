import { useEffect, useState } from 'react'
import { ROTULO_PAPEL, sair, useConta } from '../../nuvem/conta'
import { excluirMinhaConta, salvarMeuPerfil } from '../../nuvem/gestao'
import { ROTULO_TIPO, apagarResultado, listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { Privacidade } from './Privacidade'
import { Suporte } from './Suporte'

export function MinhaConta({ onVoltar, onPlanos }: { onVoltar: () => void; onPlanos: () => void }) {
  const { perfil, recarregar } = useConta()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [registro, setRegistro] = useState(perfil?.registro ?? '')
  const [meus, setMeus] = useState<ResultadoNuvem[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [verPrivacidade, setVerPrivacidade] = useState(false)

  useEffect(() => {
    if (!perfil) return
    listarResultados().then((r) => {
      setMeus(r.lista.filter((x) => x.aluno_id === perfil.id || (perfil.papel === 'aluno' && x.enviado_por === perfil.id)))
      setErro(r.erro)
    })
  }, [perfil])

  if (!perfil) return null
  if (verPrivacidade) return <Privacidade onVoltar={() => setVerPrivacidade(false)} />

  async function salvar() {
    const erro = await salvarMeuPerfil(perfil!.id, { nome: nome.trim(), registro: registro.trim() })
    if (erro) setErro(erro)
    else recarregar()
  }

  async function apagar(id: string) {
    if (!confirm('Apagar este resultado do banco do FormaCerta?')) return
    const erro = await apagarResultado(id)
    if (erro) setErro(erro)
    else setMeus((m) => m.filter((x) => x.id !== id))
  }

  async function excluirTudo() {
    if (!confirm('Apagar a sua conta e todos os seus resultados do FormaCerta? Não tem como desfazer.')) return
    const erro = await excluirMinhaConta()
    if (erro) setErro(erro)
    else await sair()
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <h1>Minha conta</h1>
      <p className="dica-sec">
        {perfil.email} · {ROTULO_PAPEL[perfil.papel]}
      </p>

      {erro && <p className="mensagem erro">{erro}</p>}

      <section className="cartao formulario">
        <label className="campo">
          Nome completo
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
        </label>
        {perfil.papel !== 'aluno' && (
          <label className="campo">
            Número de registro (CREF ou outro)
            <input value={registro} onChange={(e) => setRegistro(e.target.value)} maxLength={40} />
          </label>
        )}
        <button className="botao" disabled={nome.trim() === perfil.nome && registro.trim() === perfil.registro} onClick={salvar}>
          Salvar
        </button>
      </section>

      {perfil.papel === 'aluno' && (
        <section className="cartao">
          <h2>Meus resultados no banco</h2>
          {meus.length === 0 && <p className="dica-sec">Nenhum resultado enviado ainda.</p>}
          <ul className="historico">
            {meus.map((r) => (
              <li key={r.id}>
                <span className="linha">
                  <span>
                    {ROTULO_TIPO[r.tipo]}
                    <br />
                    <small className="dica-sec">{new Date(r.feito_em).toLocaleDateString('pt-BR')}</small>
                  </span>
                  <button className="link" onClick={() => apagar(r.id)}>
                    Apagar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {perfil.papel !== 'admin' && (
        <button className="botao-sec" onClick={onPlanos}>
          Meu plano e pagamentos
        </button>
      )}
      <button className="botao-sec" onClick={() => setVerPrivacidade(true)}>
        Política de privacidade
      </button>
      <button className="botao-sec" onClick={() => sair()}>
        Sair da conta
      </button>
      {perfil.papel !== 'admin' && (
        <button className="botao-sec perigo" onClick={excluirTudo}>
          Apagar minha conta e meus dados
        </button>
      )}
      {perfil.papel !== 'admin' && <Suporte />}
    </div>
  )
}
