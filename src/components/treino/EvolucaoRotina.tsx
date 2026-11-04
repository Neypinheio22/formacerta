import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Treino, TreinoFeito } from '../../nuvem/treinos'
import { dataCurta, numero } from '../../testes/formato'
import { compararPeriodos, exerciciosAnotados, PERIODOS, pontosDoExercicio, progressoDoExercicio, variacao, type PontoExercicio, type ResumoPeriodo } from '../../treino/execucao'
import { dataDia } from '../../treino/rotinas'
import { textoDuracao } from '../../treino/retorno'
import { nomeChave } from '../../treino/comoFazer'
import { GraficoEvolucao } from '../testes/comum'
import { diaLocal, inicioDaSemana } from '../../treino/semana'

type Metrica = 'cargaMax' | 'rm' | 'reps' | 'volume'

const METRICAS: { id: Metrica; rotulo: string; unidade: string }[] = [
  { id: 'cargaMax', rotulo: 'Carga máxima', unidade: 'kg' },
  { id: 'rm', rotulo: '1RM estimado', unidade: 'kg' },
  { id: 'reps', rotulo: 'Repetições', unidade: 'reps' },
  { id: 'volume', rotulo: 'Volume', unidade: 'kg' },
]

const kg = (v: number) => `${numero(v, v % 1 ? 1 : 0)} kg`
const mil = (v: number) => (v >= 10000 ? `${numero(v / 1000, 1)} t` : `${Math.round(v).toLocaleString('pt-BR')} kg`)

/** Seta e % da mudança. Em "dores" e "esforço", subir não é bom: a cor inverte. */
function Mudanca({ atual, anterior, inverso = false }: { atual: number | null; anterior: number | null; inverso?: boolean }) {
  const v = variacao(atual, anterior)
  if (v === null) return <span className="dica-sec">–</span>
  const bom = inverso ? v < 0 : v > 0
  const tom = Math.abs(v) < 2 ? 'neutro' : bom ? 'ok' : 'alerta'
  const Icone = Math.abs(v) < 2 ? ArrowRight : v > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`mudanca mudanca-${tom}`}>
      <Icone size={13} /> {v > 0 ? '+' : ''}
      {numero(v, 0)}%
    </span>
  )
}

function Comparacao({ execucoes }: { execucoes: TreinoFeito[] }) {
  const [dias, setDias] = useState<number>(30)
  const c = useMemo(() => compararPeriodos(execucoes, dias), [execucoes, dias])
  const linhas: { rotulo: string; v: (r: ResumoPeriodo) => number | null; txt: (n: number) => string; inverso?: boolean }[] = [
    { rotulo: 'Treinos feitos', v: (r) => r.execucoes, txt: (n) => String(n) },
    { rotulo: 'Por semana', v: (r) => (r.execucoes ? r.porSemana : null), txt: (n) => numero(n, 1) },
    { rotulo: 'Volume (kg × reps)', v: (r) => (r.volume ? r.volume : null), txt: mil },
    { rotulo: 'Repetições', v: (r) => (r.reps ? r.reps : null), txt: (n) => String(Math.round(n)) },
    { rotulo: 'Carga média', v: (r) => r.cargaMedia, txt: kg },
    { rotulo: 'PSE média', v: (r) => r.pse, txt: (n) => `${numero(n, 1)}/8`, inverso: true },
    { rotulo: 'Esforço médio', v: (r) => r.esforco, txt: (n) => `${numero(n, 1)}/10`, inverso: true },
    { rotulo: 'Dificuldade média', v: (r) => r.dificuldade, txt: (n) => `${numero(n, 1)}/5`, inverso: true },
    { rotulo: 'Tempo médio', v: (r) => r.minutos, txt: textoDuracao },
    { rotulo: 'Treinos com dor', v: (r) => (r.execucoes ? r.dores : null), txt: (n) => String(n), inverso: true },
  ]
  return (
    <section className="cartao">
      <h2>Comparação entre períodos</h2>
      <div className="atalhos-data" role="radiogroup" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p.dias} type="button" role="radio" aria-checked={dias === p.dias} className={`chip-botao ${dias === p.dias ? 'ativo' : ''}`} onClick={() => setDias(p.dias)}>
            Últimos {p.rotulo}
          </button>
        ))}
      </div>
      <table className="tabela-comparar">
        <thead>
          <tr>
            <th />
            <th>
              Antes
              <small>
                {dataDia(c.anteriorDe).slice(0, 5)} a {dataDia(c.anteriorAte).slice(0, 5)}
              </small>
            </th>
            <th>
              Agora
              <small>
                {dataDia(c.atualDe).slice(0, 5)} a {dataDia(c.ate).slice(0, 5)}
              </small>
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const a = l.v(c.anterior)
            const b = l.v(c.atual)
            return (
              <tr key={l.rotulo}>
                <th>{l.rotulo}</th>
                <td>{a === null ? '–' : l.txt(a)}</td>
                <td>
                  <b>{b === null ? '–' : l.txt(b)}</b>
                </td>
                <td>
                  <Mudanca atual={b} anterior={a} inverso={l.inverso} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function valorDe(p: PontoExercicio, m: Metrica) {
  return p[m]
}

function ProgressaoExercicio({ execucoes, nomes }: { execucoes: TreinoFeito[]; nomes: string[] }) {
  const [nome, setNome] = useState(nomes[0])
  const [metrica, setMetrica] = useState<Metrica>('cargaMax')
  const pontos = useMemo(() => pontosDoExercicio(execucoes, nome), [execucoes, nome])
  const prog = progressoDoExercicio(pontos)
  const met = METRICAS.find((m) => m.id === metrica)!
  const comValor = pontos.filter((p) => valorDe(p, metrica) > 0)
  return (
    <section className="cartao">
      <h2>
        <Dumbbell size={18} /> Progressão por exercício
      </h2>
      <label className="campo">
        Exercício
        <select value={nome} onChange={(e) => setNome(e.target.value)}>
          {nomes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="atalhos-data" role="radiogroup" aria-label="O que ver">
        {METRICAS.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={metrica === m.id} className={`chip-botao ${metrica === m.id ? 'ativo' : ''}`} onClick={() => setMetrica(m.id)}>
            {m.rotulo}
          </button>
        ))}
      </div>
      <GraficoEvolucao unidade={met.unidade} pontos={comValor.map((p) => ({ date: p.feito_em, valor: valorDe(p, metrica), status: 'ok' as const }))} />
      {prog && (
        <div className="progresso-exercicio">
          <span>
            Carga: {kg(prog.primeiro.cargaMax)} → <b className="verde">{kg(prog.ultimo.cargaMax)}</b>
            {prog.difCarga !== 0 && ` (${prog.difCarga > 0 ? '+' : ''}${kg(prog.difCarga)})`}
          </span>
          <span>
            Repetições: {prog.primeiro.reps} → <b className="verde">{prog.ultimo.reps}</b>
          </span>
          {prog.pctRm !== null && (
            <span>
              Força estimada (1RM): <b className={prog.pctRm >= 0 ? 'verde' : 'laranja'}>{`${prog.pctRm > 0 ? '+' : ''}${numero(prog.pctRm, 0)}%`}</b>
            </span>
          )}
        </div>
      )}
      <ul className="historico-cargas">
        {[...pontos]
          .reverse()
          .slice(0, 6)
          .map((p) => (
            <li key={p.feito_em}>
              <span>{dataCurta(p.feito_em)}</span>
              <span>
                {p.cargaMax ? kg(p.cargaMax) : '–'} · {p.reps} reps
              </span>
              <span className="dica-sec">{p.volume ? mil(p.volume) : ''}</span>
            </li>
          ))}
      </ul>
    </section>
  )
}

/** Volume de cada semana (soma de carga × repetições de todos os treinos): o desempenho geral da rotina. */
function Desempenho({ execucoes }: { execucoes: TreinoFeito[] }) {
  const semanas = new Map<string, number>()
  for (const e of execucoes) {
    const v = (e.cargas ?? []).reduce((s, c) => s + c.series.reduce((x, k) => x + (k.kg ?? 0) * (k.reps ?? 0), 0), 0)
    if (!v) continue
    const seg = diaLocal(inicioDaSemana(new Date(e.feito_em)))
    semanas.set(seg, (semanas.get(seg) ?? 0) + v)
  }
  const pontos = [...semanas.entries()].map(([d, valor]) => ({ date: `${d}T12:00:00`, valor, status: 'ok' as const }))
  if (pontos.length < 2) return null
  return (
    <section className="cartao">
      <h2>
        <TrendingUp size={18} /> Evolução do desempenho
      </h2>
      <p className="dica-sec">Volume de cada semana: soma de carga × repetições de todos os treinos da rotina. A semana atual ainda está em andamento.</p>
      <GraficoEvolucao unidade="kg" pontos={pontos} />
    </section>
  )
}

/** Evolução de uma rotina (ficha): cargas, repetições, desempenho e comparação entre períodos. */
export function EvolucaoRotina({ nomeRotina, nomeAluno, treinos, feitos }: { nomeRotina: string; nomeAluno: string; treinos: Treino[]; feitos: TreinoFeito[] }) {
  // Exercícios da rotina primeiro, depois outros que o aluno anotou nesses treinos.
  const nomes = useMemo(() => {
    const anotados = exerciciosAnotados(feitos)
    // Na ordem da ficha (A, B, C e os exercícios de cada um), depois os outros anotados.
    const ordem = [...treinos].sort((a, b) => a.letra.localeCompare(b.letra)).flatMap((t) => t.exercicios.map((e) => nomeChave(e.nome)))
    const pos = (n: string) => {
      const i = ordem.indexOf(nomeChave(n))
      return i < 0 ? 999 : i
    }
    return [...anotados].sort((a, b) => pos(a) - pos(b))
  }, [feitos, treinos])
  return (
    <>
      <section className="cartao destaque">
        <h2>
          <TrendingUp size={18} /> Evolução · {nomeRotina}
        </h2>
        <p className="dica-sec">
          {feitos.length
            ? `${feitos.length} treino${feitos.length === 1 ? '' : 's'} concluído${feitos.length === 1 ? '' : 's'} nesta rotina, desde ${dataCurta(feitos[feitos.length - 1].feito_em)}.`
            : `${nomeAluno} ainda não concluiu nenhum treino desta rotina.`}
        </p>
      </section>
      <Comparacao execucoes={feitos} />
      {nomes.length ? (
        <>
          <ProgressaoExercicio key={nomes[0]} execucoes={feitos} nomes={nomes} />
          <Desempenho execucoes={feitos} />
        </>
      ) : (
        <section className="cartao">
          <h2>
            <Dumbbell size={18} /> Progressão de cargas
          </h2>
          <p className="dica-sec">Quando {nomeAluno} anotar a carga e as repetições de cada série durante o treino, os gráficos de carga, repetições e força aparecem aqui sozinhos.</p>
        </section>
      )}
    </>
  )
}
