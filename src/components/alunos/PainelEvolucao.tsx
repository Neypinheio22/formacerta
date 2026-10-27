import { ArrowDown, ArrowUp, Equal } from 'lucide-react'
import { useState } from 'react'
import { GRUPOS, ROTULO_TENDENCIA, evolucao, placar, type Contexto, type Serie, type Tendencia } from '../../evolucao/evolucao'
import type { ResultadoNuvem } from '../../nuvem/resultados'
import { dataCurta, numero } from '../../testes/formato'
import { GraficoEvolucao } from '../testes/comum'

const CLASSE: Record<Tendencia, string> = { melhorou: 'chip-ok', piorou: 'chip-alerta', manteve: 'chip-neutro', subiu: 'chip-neutro', desceu: 'chip-neutro' }

function Seta({ t }: { t: Tendencia }) {
  if (t === 'manteve') return <Equal size={12} strokeWidth={3} />
  const sobe = t === 'subiu' || t === 'melhorou'
  return sobe ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />
}

const unidadeCurta = (u: string) => (u === 'pontos' ? '' : u)

function LinhaSerie({ s, comparar }: { s: Serie; comparar: 'vsAnterior' | 'vsPrimeira' }) {
  const atual = s.pontos[s.pontos.length - 1]
  const v = s[comparar]
  // Os gráficos principais abrem sozinhos; os detalhes da postura ficam fechados.
  const [aberto, setAberto] = useState(s.pontos.length > 1 && (s.grupo !== 'postura' || s.id === 'postura'))
  return (
    <details className="serie" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary>
        <span className="serie-nome">{s.rotulo}</span>
        <span className="serie-valor">
          <b>
            {numero(atual.valor, s.casas)}
            {unidadeCurta(s.unidade) && <small> {unidadeCurta(s.unidade)}</small>}
          </b>
          {v ? (
            <span className={`chip ${CLASSE[v.tendencia]}`}>
              <Seta t={v.tendencia} /> {ROTULO_TENDENCIA[v.tendencia]}
              {v.diferenca !== 0 && ` ${v.diferenca > 0 ? '+' : ''}${numero(v.diferenca, s.casas)}`}
            </span>
          ) : (
            <span className="chip chip-neutro">1ª medida</span>
          )}
        </span>
      </summary>
      {s.pontos.length > 1 ? (
        <GraficoEvolucao unidade={unidadeCurta(s.unidade)} pontos={s.pontos} />
      ) : (
        <p className="dica-sec">Medido em {dataCurta(atual.date)}. Na próxima avaliação aparece o gráfico.</p>
      )}
    </details>
  )
}

/** Placar e gráficos de evolução de um aluno, juntando todas as avaliações guardadas. */
export function PainelEvolucao({ resultados, contexto, nome }: { resultados: ResultadoNuvem[]; contexto: Contexto; nome: string }) {
  const [comparar, setComparar] = useState<'vsAnterior' | 'vsPrimeira'>('vsAnterior')
  const series = evolucao(resultados, contexto)
  const comMaisDeUma = series.filter((s) => s.pontos.length > 1)
  const p = placar(series, comparar)
  const datas = [...new Set(resultados.map((r) => r.feito_em.slice(0, 10)))].sort()

  if (series.length === 0)
    return (
      <section className="cartao">
        <h2>📈 Evolução</h2>
        <p className="dica-sec">
          Ainda não há avaliações guardadas para {nome}. Faça um teste e toque em “Guardar na ficha”, ou registre as medidas do corpo aqui mesmo.
        </p>
      </section>
    )

  return (
    <>
      <section className="cartao destaque">
        <h2>📈 Evolução de {nome.split(' ')[0]}</h2>
        <p className="dica-sec">
          {datas.length} {datas.length === 1 ? 'dia de avaliação' : 'dias de avaliação'}
          {datas.length > 1 && `, de ${dataCurta(datas[0] + 'T12:00:00')} a ${dataCurta(datas[datas.length - 1] + 'T12:00:00')}`}.
        </p>
        {comMaisDeUma.length === 0 ? (
          <p className="dica-sec">Cada item foi medido uma vez só. Na próxima avaliação o app mostra o que melhorou e o que piorou.</p>
        ) : (
          <>
            <div className="seletor-comparar" role="tablist">
              <button role="tab" aria-selected={comparar === 'vsAnterior'} className={comparar === 'vsAnterior' ? 'ativo' : ''} onClick={() => setComparar('vsAnterior')}>
                Desde a anterior
              </button>
              <button role="tab" aria-selected={comparar === 'vsPrimeira'} className={comparar === 'vsPrimeira' ? 'ativo' : ''} onClick={() => setComparar('vsPrimeira')}>
                Desde a primeira
              </button>
            </div>
            <div className="placar">
              <div className="melhorou">
                <b>{p.melhorou}</b>
                <span>{p.melhorou === 1 ? 'melhorou' : 'melhoraram'}</span>
              </div>
              <div className="piorou">
                <b>{p.piorou}</b>
                <span>{p.piorou === 1 ? 'piorou' : 'pioraram'}</span>
              </div>
              <div>
                <b>{p.manteve}</b>
                <span>{p.manteve === 1 ? 'igual' : 'iguais'}</span>
              </div>
            </div>
            <p className="dica-sec">
              Verde: melhorou. Vermelho: piorou. Peso e medidas dos braços e pernas seguem o objetivo do aluno; sem objetivo na ficha, o app só mostra se subiu ou desceu.
            </p>
          </>
        )}
      </section>

      {GRUPOS.map((g) => {
        const doGrupo = series.filter((s) => s.grupo === g.id)
        if (!doGrupo.length) return null
        return (
          <section className="cartao" key={g.id}>
            <h2>{g.rotulo}</h2>
            {doGrupo.map((s) => (
              <LinhaSerie key={s.id} s={s} comparar={comparar} />
            ))}
          </section>
        )
      })}
    </>
  )
}
