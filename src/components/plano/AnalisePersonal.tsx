import { Brain, CalendarClock } from 'lucide-react'
import { NIVEL, ROTULO_FOCO, analisar, planoDeNuvem, type PlanoTeste } from '../../plano/plano'
import type { ResultadoNuvem } from '../../nuvem/resultados'
import type { Status } from '../../pose/types'
import { dataCurta } from '../../testes/formato'
import { LegendaNiveis, ListaExercicios, Selo } from './PlanoAcao'

/**
 * Análise do Personal IA: o aluno faz os testes sozinho, o app gera os resultados
 * e aqui eles viram um plano de treino só, com prioridades e data de reavaliação.
 */
export function AnalisePersonal({ resultados, nome }: { resultados: ResultadoNuvem[]; nome: string }) {
  const planos = resultados.map(planoDeNuvem).filter((p): p is PlanoTeste => p !== null)
  const a = analisar(planos)
  const primeiro = nome.split(' ')[0]

  if (!a)
    return (
      <section className="cartao destaque analise-ia">
        <span className="etiqueta">
          <Brain size={14} /> Análise do Personal IA
        </span>
        <p className="dica-sec">
          Ainda não há testes guardados para {primeiro}. Faça postura, flexibilidade, corrida ou outro teste e toque em “Guardar na ficha”: a análise aparece aqui com o plano de treino.
        </p>
      </section>
    )

  return (
    <>
      <section className={`cartao destaque analise-ia plano-${a.status}`}>
        <span className="etiqueta">
          <Brain size={14} /> Análise do Personal IA
        </span>
        <h2>Plano de ação de {primeiro}</h2>
        <p className="fluxo-ia">Aluno faz o teste sozinho + app gera o resultado + personal IA analisa</p>
        <div className="plano-linha">
          <span className="plano-rotulo">Situação geral</span>
          <Selo status={a.status} grande />
        </div>
        <p>{a.resumo}</p>
        <div className="placar placar-niveis">
          {(['ok', 'atencao', 'alerta'] as Status[]).map((s) => (
            <div key={s} className={`nivel-${s}`}>
              <b>{a.contagem[s]}</b>
              <span>
                {NIVEL[s].emoji} {NIVEL[s].rotulo}
              </span>
            </div>
          ))}
        </div>
        {a.condutas.map((c) => (
          <p key={c} className="conduta">
            ⚠ {c}
          </p>
        ))}
      </section>

      <section className="cartao">
        <h2>Testes avaliados</h2>
        <ul className="testes-ia">
          {a.planos.map((p) => (
            <li key={p.chave}>
              <div className="achado-topo">
                <strong>{p.teste}</strong>
                <Selo status={p.status} />
              </div>
              <span className="achado-detalhe">
                {p.resultado} · feito em {dataCurta(p.data)} · reavaliar em {dataCurta(p.reavaliarEm)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {a.prioridades.length > 0 && (
        <section className="cartao">
          <h2>Pontos de atenção, por prioridade</h2>
          <ol className="pontos-plano prioridades">
            {a.prioridades.map((p) => (
              <li key={p.teste + p.texto}>
                <span>{NIVEL[p.status].emoji}</span> {p.texto} <span className="dica-sec">· {p.teste}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="cartao">
        <h2>{a.status === 'ok' ? 'Treino de manutenção' : 'Treino corretivo sugerido'}</h2>
        <p className="dica">{a.frequencia}</p>
        {a.musculos.alongar.length > 0 && (
          <div className="grupo-musculos">
            <h3>Músculos para alongar</h3>
            <ul className="musculos alongar">
              {a.musculos.alongar.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {a.musculos.fortalecer.length > 0 && (
          <div className="grupo-musculos">
            <h3>Músculos para fortalecer</h3>
            <ul className="musculos fortalecer">
              {a.musculos.fortalecer.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {a.treino.map((g) => (
          <div key={g.foco}>
            <h3 className="sub">{ROTULO_FOCO[g.foco]}</h3>
            <ListaExercicios exercicios={g.exercicios} />
          </div>
        ))}
        {a.treino.length === 0 && <p className="dica-sec">Nenhum exercício corretivo necessário. Siga o treino normal.</p>}
        {a.proximaReavaliacao && (
          <p className="reavaliar">
            <CalendarClock size={18} /> Próxima reavaliação: <b>{dataCurta(a.proximaReavaliacao.data)}</b> ({a.proximaReavaliacao.teste.toLowerCase()})
          </p>
        )}
        <LegendaNiveis />
        <p className="dica-sec">Análise automática feita pelo app a partir dos testes. É o ponto de partida: o personal confere e ajusta o plano.</p>
      </section>
    </>
  )
}
