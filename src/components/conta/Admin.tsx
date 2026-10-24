import { useEffect, useMemo, useState } from 'react'
import { ROTULO_PAPEL, ROTULO_SITUACAO, useConta, type Perfil, type Situacao } from '../../nuvem/conta'
import { definirSituacao, excluirConta, listarPerfis } from '../../nuvem/gestao'
import { ModerarVitrine } from '../vitrine/ModerarVitrine'
import { ROTULO_TIPO, listarResultados, type ResultadoNuvem, type TipoResultado } from '../../nuvem/resultados'

type Aba = 'aguardando' | 'profissionais' | 'alunos' | 'resultados' | 'vitrine'

/** Tela do administrador: libera, bloqueia e exclui profissionais e alunos. */
export function Admin({ onVoltar }: { onVoltar: () => void }) {
  const { perfil: eu } = useConta()
  const [aba, setAba] = useState<Aba>('aguardando')
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [resultados, setResultados] = useState<ResultadoNuvem[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  async function carregar() {
    setCarregando(true)
    const [p, r] = await Promise.all([listarPerfis(), listarResultados()])
    setPerfis(p.perfis.filter((x) => x.id !== eu?.id))
    setResultados(r.lista)
    setErro(p.erro ?? r.erro)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nomePorId = useMemo(() => new Map(perfis.map((p) => [p.id, p.nome || p.email])), [perfis])
  const aguardando = perfis.filter((p) => p.situacao === 'pendente')
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const filtrar = (lista: Perfil[]) => (termo ? lista.filter((p) => `${p.nome} ${p.email}`.toLocaleLowerCase('pt-BR').includes(termo)) : lista)
  const lista =
    aba === 'aguardando' ? aguardando : aba === 'profissionais' ? filtrar(perfis.filter((p) => p.papel === 'profissional')) : filtrar(perfis.filter((p) => p.papel === 'aluno'))

  async function mudar(p: Perfil, nova: Situacao) {
    const erro = await definirSituacao(p.id, nova)
    if (erro) setErro(erro)
    else setPerfis((ps) => ps.map((x) => (x.id === p.id ? { ...x, situacao: nova } : x)))
  }

  async function excluir(p: Perfil) {
    const qtd = resultados.filter((r) => r.enviado_por === p.id || r.aluno_id === p.id).length
    const texto = `Excluir ${p.nome || p.email} (${ROTULO_PAPEL[p.papel].toLowerCase()})?\n\nApaga a conta e ${qtd} resultado(s) dela. Não tem como desfazer.`
    if (!confirm(texto)) return
    const erro = await excluirConta(p.id)
    if (erro) setErro(erro)
    else carregar()
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
        <button className="voltar" onClick={carregar}>
          Atualizar
        </button>
      </header>

      <h1>Administração</h1>
      <p className="dica-sec">Você gerencia todos os profissionais, alunos, resultados e fotos da vitrine do FormaCerta.</p>

      <div className="numeros">
        <div>
          <strong>{perfis.filter((p) => p.papel === 'profissional').length}</strong> profissionais
        </div>
        <div>
          <strong>{perfis.filter((p) => p.papel === 'aluno').length}</strong> alunos
        </div>
        <div>
          <strong>{resultados.length}</strong> resultados
        </div>
      </div>

      <div className="escolha abas">
        <button className={aba === 'aguardando' ? 'ativo' : ''} onClick={() => setAba('aguardando')}>
          Aguardando{aguardando.length > 0 && ` (${aguardando.length})`}
        </button>
        <button className={aba === 'profissionais' ? 'ativo' : ''} onClick={() => setAba('profissionais')}>
          Profissionais
        </button>
        <button className={aba === 'alunos' ? 'ativo' : ''} onClick={() => setAba('alunos')}>
          Alunos
        </button>
        <button className={aba === 'resultados' ? 'ativo' : ''} onClick={() => setAba('resultados')}>
          Resultados
        </button>
        <button className={aba === 'vitrine' ? 'ativo' : ''} onClick={() => setAba('vitrine')}>
          Vitrine
        </button>
      </div>

      {erro && <p className="mensagem erro">{erro}</p>}
      {carregando && <p className="carregando">Carregando…</p>}

      {!carregando && aba !== 'resultados' && aba !== 'vitrine' && (
        <>
          {aba !== 'aguardando' && (
            <label className="campo">
              <input placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
          )}
          {lista.length === 0 && <p className="dica-sec">{aba === 'aguardando' ? 'Ninguém aguardando liberação.' : 'Ninguém por aqui ainda.'}</p>}
          {lista.map((p) => (
            <section className="cartao pessoa" key={p.id}>
              <div className="pessoa-topo">
                <div>
                  <h3>{p.nome || 'Sem nome'}</h3>
                  <p className="dica-sec">
                    {p.email}
                    {p.registro && ` · registro ${p.registro}`}
                  </p>
                  <p className="dica-sec">
                    {ROTULO_PAPEL[p.papel]} · desde {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                    {p.profissional_id && ` · aluno de ${nomePorId.get(p.profissional_id) ?? 'profissional excluído'}`}
                  </p>
                </div>
                <span className={`chip ${p.situacao === 'liberado' ? 'chip-ok' : p.situacao === 'pendente' ? 'chip-atencao' : 'chip-alerta'}`}>
                  {ROTULO_SITUACAO[p.situacao]}
                </span>
              </div>
              <div className="acoes-linha">
                {p.situacao !== 'liberado' && (
                  <button className="botao" onClick={() => mudar(p, 'liberado')}>
                    Liberar
                  </button>
                )}
                {p.situacao === 'liberado' && (
                  <button className="botao-sec" onClick={() => mudar(p, 'bloqueado')}>
                    Bloquear
                  </button>
                )}
                <button className="botao-sec perigo" onClick={() => excluir(p)}>
                  Excluir
                </button>
              </div>
            </section>
          ))}
        </>
      )}

      {!carregando && aba === 'resultados' && <ResumoResultados resultados={resultados} nomePorId={nomePorId} />}

      {!carregando && aba === 'vitrine' && <ModerarVitrine nomePorId={nomePorId} />}
    </div>
  )
}

function ResumoResultados({ resultados, nomePorId }: { resultados: ResultadoNuvem[]; nomePorId: Map<string, string> }) {
  const porTipo = (Object.keys(ROTULO_TIPO) as TipoResultado[]).map((t) => ({ t, n: resultados.filter((r) => r.tipo === t).length }))
  return (
    <>
      <section className="cartao">
        <h2>Por tipo de teste</h2>
        <ul className="historico">
          {porTipo.map(({ t, n }) => (
            <li key={t}>
              <span className="linha">
                <span>{ROTULO_TIPO[t]}</span>
                <span className="nota">{n}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="cartao">
        <h2>Últimos enviados</h2>
        {resultados.length === 0 && <p className="dica-sec">Nenhum resultado enviado ainda.</p>}
        <ul className="historico">
          {resultados.slice(0, 50).map((r) => (
            <li key={r.id}>
              <span className="linha">
                <span>
                  {ROTULO_TIPO[r.tipo]} · {r.apelido || (r.aluno_id && nomePorId.get(r.aluno_id)) || 'sem nome'}
                  <br />
                  <small className="dica-sec">
                    {new Date(r.feito_em).toLocaleDateString('pt-BR')} · por {nomePorId.get(r.enviado_por) ?? 'você'}
                  </small>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
