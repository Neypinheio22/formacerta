import { useEffect, useState } from 'react'
import { ROTULO_PAPEL, sair, useConta } from '../../nuvem/conta'
import { excluirMinhaConta, salvarMeuPerfil } from '../../nuvem/gestao'
import { ROTULO_TIPO, apagarResultado, listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { baixarMeusDados, definirLembretes } from '../../nuvem/privacidade'
import { usePlanosLiberados } from '../planos/usePlanosLiberados'
import { Privacidade } from './Privacidade'
import { Suporte } from './Suporte'
import { Termos } from './Termos'

export function MinhaConta({ onVoltar, onPlanos }: { onVoltar: () => void; onPlanos: () => void }) {
  const { perfil, recarregar } = useConta()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [registro, setRegistro] = useState(perfil?.registro ?? '')
  const [meus, setMeus] = useState<ResultadoNuvem[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ver, setVer] = useState<'termos' | 'privacidade' | null>(null)
  const verPlanos = usePlanosLiberados(perfil)
  const [lembretes, setLembretes] = useState(perfil?.lembretes_email !== false)

  useEffect(() => {
    if (!perfil) return
    listarResultados().then((r) => {
      setMeus(r.lista.filter((x) => x.aluno_id === perfil.id || (perfil.papel === 'aluno' && x.enviado_por === perfil.id)))
      setErro(r.erro)
    })
  }, [perfil])

  if (!perfil) return null
  if (ver === 'termos') return <Termos onVoltar={() => setVer(null)} />
  if (ver === 'privacidade') return <Privacidade onVoltar={() => setVer(null)} />

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

  async function trocarLembretes(ligado: boolean) {
    setLembretes(ligado)
    const erro = await definirLembretes(perfil!.id, ligado)
    if (erro) {
      setErro(erro)
      setLembretes(!ligado)
    } else recarregar()
  }

  async function baixar() {
    setErro(await baixarMeusDados(perfil!))
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

      {'lembretes_email' in perfil && (
        <section className="cartao">
          <h2>Lembrete de reavaliação</h2>
          <label className="aceite">
            <input type="checkbox" checked={lembretes} onChange={(e) => trocarLembretes(e.target.checked)} />
            <span>
              {perfil.papel === 'aluno'
                ? 'Receber um e-mail quando chegar a data de refazer os meus testes.'
                : 'Receber um e-mail quando chegar a data de reavaliar os meus alunos.'}
            </span>
          </label>
        </section>
      )}

      <section className="cartao">
        <h2>Privacidade e meus dados</h2>
        <p className="dica-sec">
          Pela LGPD você pode ver, levar e apagar os seus dados quando quiser.
          {perfil.termos_aceitos_em && ` Você aceitou os termos em ${new Date(perfil.termos_aceitos_em).toLocaleDateString('pt-BR')}.`}
        </p>
        <div className="botoes-coluna">
          <button className="botao-sec" onClick={baixar}>
            Baixar meus dados
          </button>
          <button className="botao-sec" onClick={() => setVer('termos')}>
            Termos de uso
          </button>
          <button className="botao-sec" onClick={() => setVer('privacidade')}>
            Política de privacidade
          </button>
        </div>
      </section>
      {perfil.papel !== 'admin' && verPlanos && (
        <button className="botao-sec" onClick={onPlanos}>
          Meu plano e pagamentos
        </button>
      )}
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
