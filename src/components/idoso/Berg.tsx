import { useState } from 'react'
import { FAIXAS_BERG, ITENS_BERG, MAXIMO_BERG, classificarBerg, totalBerg } from '../../idoso/berg'
import { useCronometro } from '../../idoso/cronometro'
import { Cronometro, VideoExplicativo } from './TesteFuncional'

const BUSCA = 'https://www.youtube.com/results?search_query=' + encodeURIComponent('escala de equilíbrio de Berg como aplicar')

type Props = {
  notas: (number | null)[]
  observacao: string
  onSalvar: (notas: (number | null)[], observacao: string) => void
  onVoltar: () => void
}

/** Escala de Equilíbrio de Berg: 14 itens de 0 a 4, soma automática. */
export function Berg({ notas: iniciais, observacao: obsInicial, onSalvar, onVoltar }: Props) {
  const [notas, setNotas] = useState(iniciais)
  const [observacao, setObservacao] = useState(obsInicial)
  const [aberto, setAberto] = useState(() => Math.max(0, iniciais.findIndex((n) => n === null)))
  const { total, faltam } = totalBerg(notas)
  const classe = faltam === 0 ? classificarBerg(total) : null

  function dar(i: number, nota: number) {
    const novas = [...notas]
    novas[i] = nota
    setNotas(novas)
    // Passa sozinho para o próximo item sem nota.
    const proximo = novas.findIndex((n, j) => j > i && n === null)
    setAberto(proximo >= 0 ? proximo : -1)
  }

  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">Equilíbrio</span>
        <h1>Escala de Equilíbrio de Berg</h1>
        <p className="dica-sec">14 tarefas do dia a dia. Dê a nota de 0 a 4 de cada uma: a soma sai sozinha. Material: cronômetro, régua, 2 cadeiras (com e sem braços), um degrau ou banquinho e um chinelo.</p>
        <VideoExplicativo id="berg" nome="Escala de Berg" busca={BUSCA} />
      </section>

      <section className="cartao placar-berg">
        <div className="resultado-teste">
          <span className="valor-grande">
            {total}
            <small>/{MAXIMO_BERG}</small>
          </span>
          {classe ? <span className={`chip chip-${classe.status}`}>{classe.rotulo}</span> : <span className="chip chip-atencao">Faltam {faltam}</span>}
        </div>
        <div className="barra">
          <span style={{ width: `${(total / MAXIMO_BERG) * 100}%` }} />
        </div>
      </section>

      <ol className="itens-berg">
        {ITENS_BERG.map((it, i) => (
          <li key={it.titulo} className={`cartao ${aberto === i ? 'aberto' : ''}`}>
            <button className="sem-botao item-berg-topo" onClick={() => setAberto(aberto === i ? -1 : i)}>
              <span>
                {i + 1}. {it.titulo}
              </span>
              {notas[i] !== null ? <span className="nota">{notas[i]}</span> : <span className="dica-sec">—</span>}
            </button>
            {aberto === i && <ItemBerg i={i} nota={notas[i]} onNota={(n) => dar(i, n)} />}
          </li>
        ))}
      </ol>

      <section className="cartao formulario">
        <table className="tabela-classes">
          <caption>Interpretação</caption>
          <tbody>
            {FAIXAS_BERG.map((f) => (
              <tr key={f.faixa} className={classe?.rotulo === f.rotulo ? 'atual' : ''}>
                <td>{f.faixa}</td>
                <td>{f.rotulo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <label className="campo">
          Observação
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Ex.: insegura nos giros, precisou de supervisão no item 13…" />
        </label>
        <button className="botao" disabled={faltam === ITENS_BERG.length} onClick={() => onSalvar(notas, observacao.trim())}>
          Salvar Escala de Berg
        </button>
        {faltam > 0 && faltam < ITENS_BERG.length && <p className="dica-sec">Dá para salvar e terminar depois. O total só é classificado com os 14 itens.</p>}
        <button className="botao-sec" onClick={onVoltar}>
          Voltar sem salvar
        </button>
      </section>
    </>
  )
}

function ItemBerg({ i, nota, onNota }: { i: number; nota: number | null; onNota: (n: number) => void }) {
  const it = ITENS_BERG[i]
  const c = useCronometro(it.tempo)
  return (
    <div className="item-berg">
      <p className="instrucao">“{it.instrucao}”</p>
      {it.tempo && <Cronometro c={c} duracao={it.tempo} />}
      <div className="notas-berg">
        {it.notas.map((texto, k) => {
          const n = 4 - k
          return (
            <button key={n} className={nota === n ? 'ativo' : ''} onClick={() => onNota(n)}>
              <strong>{n}</strong>
              <span>{texto}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
