import { Dumbbell, TrendingDown, TrendingUp, Minus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { dataCurta, lerNumero, numero } from '../../testes/formato'
import {
  OBJETIVOS,
  REPS_CONFIAVEL,
  SUGESTOES_EXERCICIO,
  arredondar,
  carregarSeries,
  cargaPara,
  doExercicio,
  exercicios,
  gravarSeries,
  melhorPorDia,
  projetar,
  proximaCarga,
  type Serie,
} from '../../treino/carga'
import { GraficoEvolucao } from '../testes/comum'

const CHAVE_AJUSTES = 'formacerta:cargas-ajustes'
const PASSOS = [1, 2, 2.5, 5]
const REPS_TABELA = [1, 3, 5, 8, 10, 12, 15]

type Ajustes = { objetivo: string; passo: number }

function lerAjustes(): Ajustes {
  try {
    return { objetivo: 'hipertrofia', passo: 2, ...JSON.parse(localStorage.getItem(CHAVE_AJUSTES) ?? '{}') }
  } catch {
    return { objetivo: 'hipertrofia', passo: 2 }
  }
}

const kg = (v: number) => `${numero(v, v % 1 ? 1 : 0)} kg`

export function ProjecaoCarga({ onVoltar }: { onVoltar: () => void }) {
  const [series, setSeries] = useState(carregarSeries)
  const nomes = useMemo(() => exercicios(series), [series])
  const [exercicio, setExercicio] = useState(() => nomes[0] ?? '')
  const [cargaTxt, setCargaTxt] = useState('')
  const [repsTxt, setRepsTxt] = useState('')
  const [ajustes, setAjustes] = useState(lerAjustes)
  const [erro, setErro] = useState('')

  const objetivo = OBJETIVOS.find((o) => o.id === ajustes.objetivo) ?? OBJETIVOS[1]
  const doAtual = useMemo(() => doExercicio(series, exercicio), [series, exercicio])
  const ultima = doAtual[doAtual.length - 1]

  const mudarAjustes = (a: Partial<Ajustes>) => {
    const novo = { ...ajustes, ...a }
    setAjustes(novo)
    try {
      localStorage.setItem(CHAVE_AJUSTES, JSON.stringify(novo))
    } catch {
      /* ignora */
    }
  }

  const salvarLista = (lista: Serie[]) => {
    if (!gravarSeries(lista)) return setErro('O celular está sem espaço para guardar. Apague séries antigas.')
    setSeries(lista)
  }

  const anotar = () => {
    const carga = lerNumero(cargaTxt)
    const reps = lerNumero(repsTxt)
    if (!exercicio.trim()) return setErro('Escreva o nome do exercício.')
    if (!carga || carga <= 0 || carga > 1000) return setErro('Digite a carga em kg (ex.: 40 ou 22,5).')
    if (!reps || reps < 1 || reps > 50 || !Number.isInteger(reps)) return setErro('Digite quantas repetições você fez (1 a 50).')
    setErro('')
    salvarLista([...series, { id: crypto.randomUUID(), date: new Date().toISOString(), exercicio: exercicio.trim(), kg: carga, reps }])
    setRepsTxt('')
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>

      <section className="cartao destaque">
        <span className="etiqueta">
          <Dumbbell size={14} /> Projeção de carga
        </span>
        <h1>Diário de cargas</h1>
        <p className="dica-sec">Anote a carga e as repetições de cada série. O app estima a sua carga máxima, diz quanto colocar no próximo treino e projeta as próximas semanas.</p>

        <label className="campo">
          Exercício
          <input value={exercicio} onChange={(e) => setExercicio(e.target.value)} placeholder="Ex.: Supino reto" list="exercicios-carga" autoComplete="off" />
          <datalist id="exercicios-carga">
            {[...nomes, ...SUGESTOES_EXERCICIO.filter((s) => !nomes.some((n) => n.toLowerCase() === s.toLowerCase()))].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        {nomes.length > 1 && (
          <div className="chips-exercicio">
            {nomes.map((n) => (
              <button key={n} className={n.toLowerCase() === exercicio.trim().toLowerCase() ? 'ativo' : ''} onClick={() => setExercicio(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
        <div className="linha-campos">
          <label className="campo">
            Carga (kg)
            <input inputMode="decimal" value={cargaTxt} onChange={(e) => setCargaTxt(e.target.value)} placeholder={ultima ? numero(ultima.kg, ultima.kg % 1 ? 1 : 0) : 'Ex.: 40'} />
          </label>
          <label className="campo">
            Repetições
            <input inputMode="numeric" value={repsTxt} onChange={(e) => setRepsTxt(e.target.value)} placeholder="Ex.: 10" />
          </label>
        </div>
        {erro && <p className="mensagem erro">{erro}</p>}
        <button className="botao" onClick={anotar}>
          Anotar série
        </button>
      </section>

      {ultima ? (
        <Analise series={doAtual} ultima={ultima} objetivo={objetivo} passo={ajustes.passo} />
      ) : (
        <p className="dica-sec">Anote a primeira série deste exercício para ver a carga máxima e a sugestão do próximo treino.</p>
      )}

      <section className="cartao destaque">
        <h2>Seu objetivo</h2>
        <div className="escolha">
          {OBJETIVOS.map((o) => (
            <button key={o.id} className={o.id === objetivo.id ? 'ativo' : ''} onClick={() => mudarAjustes({ objetivo: o.id })}>
              {o.nome}
            </button>
          ))}
        </div>
        <p className="dica-sec">{objetivo.texto}. O app sobe a carga quando você passar do topo da faixa.</p>
        <label className="campo">
          Menor aumento possível no aparelho ou halter
          <select value={ajustes.passo} onChange={(e) => mudarAjustes({ passo: Number(e.target.value) })}>
            {PASSOS.map((p) => (
              <option key={p} value={p}>
                {kg(p)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {doAtual.length > 0 && (
        <section className="cartao destaque">
          <h2>Séries anotadas</h2>
          <ul className="lista-series">
            {[...doAtual]
              .reverse()
              .slice(0, 12)
              .map((s) => (
                <li key={s.id}>
                  <span>
                    {dataCurta(s.date)} · {kg(s.kg)} × {s.reps}
                  </span>
                  <button aria-label="Apagar série" onClick={() => salvarLista(series.filter((x) => x.id !== s.id))}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="aviso-legal">
        As contas são estimativas (fórmulas de Epley e Brzycki) e servem de guia. Só suba a carga mantendo a técnica, e combine o plano com o seu professor.
      </p>
    </div>
  )
}

function Analise({ series, ultima, objetivo, passo }: { series: Serie[]; ultima: Serie; objetivo: (typeof OBJETIVOS)[number]; passo: number }) {
  const sugestao = proximaCarga(ultima, objetivo.faixa, passo)
  const dias = melhorPorDia(series)
  const rm = dias[dias.length - 1].rm
  const projecao = projetar(series)
  const Icone = sugestao.tipo === 'subir' ? TrendingUp : sugestao.tipo === 'baixar' ? TrendingDown : Minus

  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">
          <Icone size={14} /> Próximo treino
        </span>
        <div className="resultado-teste">
          <span className="valor-grande">
            {kg(sugestao.kg)} <small>× {sugestao.reps}</small>
          </span>
        </div>
        <p className="dica">{sugestao.texto}</p>
        <p className="dica-sec">
          Último registro: {kg(ultima.kg)} × {ultima.reps} em {dataCurta(ultima.date)}.
        </p>
      </section>

      <section className="cartao destaque">
        <h2>Carga máxima estimada</h2>
        <div className="resultado-teste">
          <span className="valor-grande">
            {kg(arredondar(rm, 0.5))} <small>para 1 repetição</small>
          </span>
        </div>
        {ultima.reps > REPS_CONFIAVEL && <p className="dica-sec">Com mais de {REPS_CONFIAVEL} repetições a estimativa fica menos precisa.</p>}
        <p className="dica-sec">Não precisa testar a carga máxima: o app calcula pela melhor série do dia. Quanto dá para fazer em cada faixa:</p>
        <table className="tabela-carga">
          <thead>
            <tr>
              <th>Repetições</th>
              <th>Carga</th>
            </tr>
          </thead>
          <tbody>
            {REPS_TABELA.map((r) => (
              <tr key={r} className={r >= objetivo.faixa.min && r <= objetivo.faixa.max ? 'na-faixa' : ''}>
                <td>{r}</td>
                <td>{kg(arredondar(cargaPara(rm, r), passo))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="cartao destaque">
        <h2>Evolução e projeção</h2>
        <GraficoEvolucao pontos={dias.map((d) => ({ date: d.date, valor: d.rm, status: 'ok' as const }))} unidade="kg (máx.)" />
        {projecao ? (
          <>
            <p className="dica">
              No seu ritmo atual, a carga máxima {projecao.porSemana >= 0 ? 'sobe' : 'cai'} cerca de <strong>{kg(Math.abs(projecao.porSemana))}</strong> por semana.
            </p>
            <table className="tabela-carga">
              <thead>
                <tr>
                  <th>Daqui a</th>
                  <th>Máxima</th>
                  <th>
                    Para {objetivo.faixa.min} reps
                  </th>
                </tr>
              </thead>
              <tbody>
                {projecao.semanas.map((s) => (
                  <tr key={s.semana}>
                    <td>
                      {s.semana} {s.semana === 1 ? 'semana' : 'semanas'}
                    </td>
                    <td>{kg(arredondar(s.rm, 0.5))}</td>
                    <td>{kg(arredondar(cargaPara(s.rm, objetivo.faixa.min), passo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dica-sec">A projeção segue os treinos anotados e não passa de 3% por semana, que é o que dá para sustentar.</p>
          </>
        ) : (
          <p className="dica-sec">Anote este exercício em pelo menos 3 dias diferentes, ao longo de uma semana ou mais, para ver a projeção das próximas semanas.</p>
        )}
      </section>
    </>
  )
}
