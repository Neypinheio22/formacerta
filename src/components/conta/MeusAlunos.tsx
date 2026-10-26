import { LineChart, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { criarFicha, fichaVazia, listarFichas, type Ficha } from '../../nuvem/fichas'
import { listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { dataCurta } from '../../testes/formato'
import { FichaAluno } from '../alunos/FichaAluno'
import { FichaForm } from '../alunos/FichaForm'

/** Tela do profissional: a ficha de cada aluno, com a evolução de todas as avaliações. */
export function MeusAlunos({ onVoltar, meuId }: { onVoltar: () => void; meuId: string }) {
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [resultados, setResultados] = useState<ResultadoNuvem[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<Ficha | null>(null)
  const [busca, setBusca] = useState('')

  async function carregar() {
    const [f, r] = await Promise.all([listarFichas(), listarResultados()])
    setFichas(f.fichas)
    setResultados(r.lista)
    setErro(f.erro ?? r.erro)
  }

  useEffect(() => {
    carregar()
  }, [])

  if (aberta)
    return (
      <FichaAluno
        ficha={aberta}
        meuId={meuId}
        podeEditar
        nome={aberta.nome}
        textoVoltar="Meus alunos"
        onVoltar={() => {
          setAberta(null)
          window.scrollTo(0, 0)
        }}
        onMudou={carregar}
      />
    )

  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const lista = (fichas ?? []).filter((f) => !termo || f.nome.toLocaleLowerCase('pt-BR').includes(termo))

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <h1>Meus alunos</h1>
      <p className="dica-sec">Cada aluno tem uma ficha com os dados pessoais e todas as avaliações guardadas. Toque no nome para ver os gráficos de evolução.</p>

      {erro && <p className="mensagem erro">{erro}</p>}

      {nova ? (
        <FichaForm
          inicial={fichaVazia()}
          titulo="Nova ficha de aluno"
          textoSalvar="Criar ficha"
          onCancelar={() => setNova(false)}
          onSalvar={async (dados) => {
            const r = await criarFicha(meuId, dados)
            if (r.ficha) {
              setNova(false)
              setFichas((x) => [...(x ?? []), r.ficha!].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
              setAberta(r.ficha)
            }
            return r.erro
          }}
        />
      ) : (
        <button className="botao grande" onClick={() => setNova(true)}>
          <UserPlus size={20} /> Nova ficha de aluno
        </button>
      )}

      {fichas === null && !erro && <p className="carregando">Carregando alunos…</p>}
      {fichas?.length === 0 && !nova && <p className="dica-sec">Você ainda não tem alunos. Crie a primeira ficha acima.</p>}
      {(fichas?.length ?? 0) > 5 && (
        <label className="campo">
          Procurar aluno
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" />
        </label>
      )}

      {lista.map((f) => {
        const dele = resultados.filter((r) => r.ficha_id === f.id)
        const ultima = dele[0]
        return (
          <button className="cartao pessoa sem-botao" key={f.id} onClick={() => setAberta(f)}>
            <div className="pessoa-topo">
              <div>
                <h3>{f.nome}</h3>
                <p className="dica-sec">
                  {dele.length === 0 ? 'Nenhuma avaliação guardada' : `${dele.length} ${dele.length === 1 ? 'avaliação' : 'avaliações'} · última em ${dataCurta(ultima.feito_em)}`}
                </p>
              </div>
              <span className="chip chip-ok">
                <LineChart size={12} /> Evolução
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
