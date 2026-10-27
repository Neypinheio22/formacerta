import { Pencil, Ruler, Trash2, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { apagarFicha, editarFicha, idadeDe, listarFichas, rotuloObjetivo, type Ficha } from '../../nuvem/fichas'
import { ROTULO_TIPO, apagarResultado, listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { dataCurta } from '../../testes/formato'
import { NovoAluno } from '../conta/NovoAluno'
import { FichaForm } from './FichaForm'
import { MedidasForm } from './MedidasForm'
import { PainelEvolucao } from './PainelEvolucao'
import { CentralInteligencia } from '../plano/CentralInteligencia'
import { EditorTreinos } from '../treino/EditorTreinos'

type Props = {
  /** Null quando o aluno entrou sozinho no app e ainda não tem ficha de um profissional. */
  ficha: Ficha | null
  /** Conta de quem está vendo. */
  meuId: string
  /** Profissional ou administrador: edita a ficha e anota medidas. */
  podeEditar: boolean
  nome: string
  textoVoltar: string
  onVoltar: () => void
  /** A ficha mudou ou foi apagada: a lista de alunos precisa recarregar. */
  onMudou?: () => void
}

type Modo = 'ver' | 'editar' | 'medidas' | 'acesso'

/** Ficha do aluno: dados pessoais, gráficos de evolução e todas as avaliações guardadas. */
export function FichaAluno({ ficha, meuId, podeEditar, nome, textoVoltar, onVoltar, onMudou }: Props) {
  const [resultados, setResultados] = useState<ResultadoNuvem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [modo, setModo] = useState<Modo>('ver')
  const [aba, setAba] = useState<'analise' | 'evolucao' | 'treino'>('analise')
  const [dados, setDados] = useState(ficha)

  const carregar = useCallback(async () => {
    const r = await listarResultados(ficha ? { fichaId: ficha.id } : { alunoId: meuId })
    setResultados(r.lista)
    setErro(r.erro)
  }, [ficha, meuId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function apagarAvaliacao(r: ResultadoNuvem) {
    if (!confirm(`Apagar ${ROTULO_TIPO[r.tipo].toLowerCase()} de ${dataCurta(r.feito_em)}? Os números somem dos gráficos.`)) return
    const e = await apagarResultado(r.id)
    if (e) setErro(e)
    else carregar()
  }

  async function apagarTudo() {
    if (!dados) return
    if (!confirm(`Apagar a ficha de ${dados.nome} e todas as avaliações guardadas nela? Não tem como desfazer.`)) return
    const e = await apagarFicha(dados.id)
    if (e) return setErro(e)
    onMudou?.()
    onVoltar()
  }

  const idade = dados ? idadeDe(dados.nascimento) : null
  const contexto = {
    objetivo: dados?.objetivo ?? '',
    altura: dados?.altura_cm ?? null,
    idade,
    sexo: dados?.sexo ?? null,
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← {textoVoltar}
        </button>
      </header>

      {modo === 'editar' && dados && (
        <FichaForm
          inicial={dados}
          titulo={`Ficha de ${dados.nome}`}
          textoSalvar="Salvar ficha"
          onCancelar={() => setModo('ver')}
          onSalvar={async (novos) => {
            const e = await editarFicha(dados.id, novos)
            if (!e) {
              setDados({ ...dados, ...novos })
              setModo('ver')
              onMudou?.()
            }
            return e
          }}
        />
      )}

      {modo === 'medidas' && dados && (
        <MedidasForm
          ficha={dados}
          meuId={meuId}
          onCancelar={() => setModo('ver')}
          onSalvo={() => {
            setModo('ver')
            carregar()
          }}
        />
      )}

      {modo === 'acesso' && dados && (
        <NovoAluno
          nomeFixo={dados.nome}
          onCancelar={() => setModo('ver')}
          onCriado={async () => {
            setModo('ver')
            // O banco liga a conta nova a esta ficha pelo nome.
            const { fichas } = await listarFichas()
            const nova = fichas.find((f) => f.id === dados.id)
            if (nova) setDados(nova)
            onMudou?.()
          }}
        />
      )}

      {modo === 'ver' && (
        <section className="cartao ficha-topo">
          <h1>{dados?.nome ?? nome}</h1>
          {dados ? (
            <>
              <p className="dica-sec">
                {[idade !== null && `${idade} anos`, dados.sexo, dados.altura_cm && `${dados.altura_cm} cm`, rotuloObjetivo(dados.objetivo) && `Objetivo: ${rotuloObjetivo(dados.objetivo)}`]
                  .filter(Boolean)
                  .join(' · ') || 'Dados pessoais ainda não preenchidos.'}
              </p>
              {dados.telefone && <p className="dica-sec">WhatsApp: {dados.telefone}</p>}
              {dados.saude && (
                <p className="ficha-texto">
                  <b>Saúde:</b> {dados.saude}
                </p>
              )}
              {dados.observacoes && (
                <p className="ficha-texto">
                  <b>Observações:</b> {dados.observacoes}
                </p>
              )}
              {podeEditar && (
                <>
                  <div className="acoes-linha">
                    <button className="botao" onClick={() => setModo('medidas')}>
                      <Ruler size={18} /> Medidas
                    </button>
                    <button className="botao-sec" onClick={() => setModo('editar')}>
                      <Pencil size={16} /> Editar ficha
                    </button>
                  </div>
                  {dados.aluno_id ? (
                    <p className="dica-sec">✓ Tem acesso ao app e vê a própria evolução.</p>
                  ) : (
                    <button className="link" onClick={() => setModo('acesso')}>
                      <UserPlus size={14} /> Criar acesso ao app para {dados.nome.split(' ')[0]} ver a evolução
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="dica-sec">Os resultados que você guarda no app aparecem aqui, com a sua evolução.</p>
          )}
        </section>
      )}

      {erro && <p className="mensagem erro">{erro}</p>}
      {resultados === null && <p className="carregando">Carregando avaliações…</p>}

      {modo === 'ver' && resultados && (
        <>
          <div className="seletor-comparar abas-ficha" role="tablist">
            <button role="tab" aria-selected={aba === 'analise'} className={aba === 'analise' ? 'ativo' : ''} onClick={() => setAba('analise')}>
              🧠 Central IA
            </button>
            <button role="tab" aria-selected={aba === 'evolucao'} className={aba === 'evolucao' ? 'ativo' : ''} onClick={() => setAba('evolucao')}>
              📈 Evolução
            </button>
            {podeEditar && dados && (
              <button role="tab" aria-selected={aba === 'treino'} className={aba === 'treino' ? 'ativo' : ''} onClick={() => setAba('treino')}>
                🏋️ Treino
              </button>
            )}
          </div>
          {aba === 'treino' && podeEditar && dados ? (
            <EditorTreinos ficha={dados} meuId={meuId} />
          ) : aba === 'analise' ? (
            <CentralInteligencia resultados={resultados} nome={dados?.nome ?? nome} ficha={dados} podeEditar={podeEditar} onSalvo={carregar} />
          ) : (
            <PainelEvolucao resultados={resultados} contexto={contexto} nome={dados?.nome ?? nome} />
          )}

          {resultados.length > 0 && (
            <section className="cartao">
              <h2>Avaliações guardadas</h2>
              <ul className="historico">
                {resultados.map((r) => (
                  <li key={r.id}>
                    <span className="linha">
                      <span>{ROTULO_TIPO[r.tipo]}</span>
                      <span className="linha-fim">
                        <span className="nota">{dataCurta(r.feito_em)}</span>
                        {podeEditar && (
                          <button className="icone-apagar" aria-label="Apagar avaliação" onClick={() => apagarAvaliacao(r)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {podeEditar && dados && (
            <button className="botao-sec perigo" onClick={apagarTudo}>
              Apagar ficha de {dados.nome.split(' ')[0]}
            </button>
          )}
        </>
      )}
    </div>
  )
}
