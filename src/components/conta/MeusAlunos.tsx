import { LineChart, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { linkWhatsApp, telefoneValido } from '../../compartilhar/whatsapp'
import { criarFicha, fichaVazia, listarFichas, type Ficha } from '../../nuvem/fichas'
import { listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { dataCurta } from '../../testes/formato'
import { FichaAluno } from '../alunos/FichaAluno'
import { FichaForm } from '../alunos/FichaForm'
import { useConta } from '../../nuvem/conta'
import { recarregarDireitos, useDireitos } from '../planos/useDireitos'

/** Tela do profissional: a ficha de cada aluno, com a evolução de todas as avaliações. */
export function MeusAlunos({ onVoltar, meuId, onPlanos }: { onVoltar: () => void; meuId: string; onPlanos?: () => void }) {
  const { perfil } = useConta()
  const direitos = useDireitos(perfil)
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
  const limite = direitos?.travado ? direitos.limite_alunos : null
  const total = fichas?.length ?? direitos?.alunos ?? 0
  const noLimite = limite !== null && total >= limite
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

      {limite !== null && (
        <section className={`cartao limite-alunos ${noLimite ? 'plano-vencido' : ''}`}>
          <span>
            <strong>
              {total} de {limite} alunos
            </strong>
            <br />
            <small className="dica-sec">
              {noLimite ? `Seu plano ${direitos?.plano_nome ?? ''} chegou no limite. Mude de plano para cadastrar mais alunos.` : `Plano ${direitos?.plano_nome ?? ''}`}
            </small>
          </span>
          {onPlanos && (
            <button className={noLimite ? 'botao' : 'botao-sec'} onClick={onPlanos}>
              Ver planos
            </button>
          )}
        </section>
      )}

      {nova ? (
        <FichaForm
          inicial={fichaVazia()}
          titulo="Nova ficha de aluno"
          textoSalvar="Criar ficha"
          onCancelar={() => setNova(false)}
          onSalvar={async (dados) => {
            const r = await criarFicha(meuId, dados)
            if (r.ficha) {
              recarregarDireitos()
              setNova(false)
              setFichas((x) => [...(x ?? []), r.ficha!].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
              setAberta(r.ficha)
            }
            return r.erro
          }}
        />
      ) : (
        <button className="botao grande" disabled={noLimite} onClick={() => setNova(true)}>
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
          <div className="cartao pessoa sem-botao aluno-cartao" key={f.id}>
            <button className="sem-botao aluno-abrir" onClick={() => setAberta(f)}>
              <h3>{f.nome}</h3>
              <p className="dica-sec">
                {dele.length === 0 ? 'Nenhuma avaliação guardada' : `${dele.length} ${dele.length === 1 ? 'avaliação' : 'avaliações'} · última em ${dataCurta(ultima.feito_em)}`}
              </p>
            </button>
            <div className="aluno-acoes">
              {telefoneValido(f.telefone ?? '') ? (
                <a
                  className="whats-redondo"
                  href={linkWhatsApp(`Olá, ${f.nome.trim().split(/\s+/)[0]}! Tudo bem?`, f.telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Mandar mensagem no WhatsApp para ${f.nome}`}
                  aria-label={`Mandar mensagem no WhatsApp para ${f.nome}`}
                >
                  <IconeWhatsApp />
                </a>
              ) : (
                <button
                  className="whats-redondo sem-numero"
                  onClick={() => setAberta(f)}
                  title="Sem WhatsApp na ficha. Toque para abrir a ficha e colocar o número."
                  aria-label={`${f.nome} sem WhatsApp na ficha`}
                >
                  <IconeWhatsApp />
                </button>
              )}
              <button className="chip chip-ok" onClick={() => setAberta(f)}>
                <LineChart size={12} /> Evolução
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Logo do WhatsApp (balão com telefone). */
function IconeWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.6-.91-2.19-.24-.58-.48-.5-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.5 2 2 6.48 2 12c0 1.77.47 3.5 1.36 5.02L2 22l5.12-1.34A10.04 10.04 0 0 0 12.04 22C17.58 22 22 17.52 22 12S17.58 2 12.04 2zm0 18.2c-1.6 0-3.17-.43-4.54-1.24l-.33-.2-3.04.8.81-2.96-.21-.34A8.15 8.15 0 0 1 3.84 12c0-4.53 3.68-8.2 8.2-8.2 4.52 0 8.16 3.67 8.16 8.2 0 4.52-3.64 8.2-8.16 8.2z" />
    </svg>
  )
}
