import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import {
  METRICAS,
  classificarCintura,
  comparar,
  pontosDeAtencao,
  relacaoCinturaQuadril,
  resumo,
  textoCompartilhar,
} from '../../idoso/analise'
import { ITENS_BERG } from '../../idoso/berg'
import { TESTES } from '../../idoso/testes'
import { CIRCUNFERENCIAS, type AvaliacaoIdoso } from '../../idoso/tipos'
import { dataCurta, numero } from '../../testes/formato'
import { EnviarResultado } from '../conta/EnviarResultado'
import { EnviarWhatsApp } from '../conta/EnviarWhatsApp'
import { AvisoTriagem, GraficoEvolucao } from '../testes/comum'

type Props = {
  a: AvaliacaoIdoso
  /** Avaliações da mesma pessoa, da mais nova para a mais antiga. */
  doMesmo: AvaliacaoIdoso[]
  onAbrir: (id: string) => void
  onEditar: () => void
  onReavaliar: () => void
  onApagar: () => void
}

const SINAL: Record<string, string> = { ok: '✓', atencao: '!', alerta: '!!' }

export function IdosoResultado({ a, doMesmo, onAbrir, onEditar, onReavaliar, onApagar }: Props) {
  const linhas = resumo(a)
  const anteriores = doMesmo.filter((x) => x.date < a.date)
  const [baseId, setBaseId] = useState(() => anteriores[anteriores.length - 1]?.id ?? '')
  const base = anteriores.find((x) => x.id === baseId)
  const comparacao = base ? comparar(base, a) : []
  const ate = doMesmo.filter((x) => x.date <= a.date)
  const pontos = pontosDeAtencao(a)
  const rcq = relacaoCinturaQuadril(a)

  return (
    <>
      <section className="cartao destaque resultado-final">
        <span className="etiqueta">
          <ClipboardCheck size={14} /> Resultado final · {dataCurta(a.date)}
        </span>
        <h1>Avaliação funcional — {a.avaliado}</h1>
        <p className="dica-sec">
          {[a.anamnese.idade !== null && `${a.anamnese.idade} anos`, a.anamnese.sexo, a.antropometria.estatura && `${numero(a.antropometria.estatura, 0)} cm`, a.antropometria.peso && `${numero(a.antropometria.peso)} kg`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {linhas.length === 0 && <p className="dica-sec">Nenhum teste feito ainda.</p>}
        <ul className="resumo-final">
          {linhas.map((l) => (
            <li key={l.rotulo}>
              <span>{l.rotulo}</span>
              <span className="resumo-valor">
                <b>{l.valor}</b>
                {l.classe && <span className={`chip chip-${l.status}`}>{l.classe}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="acoes">
          <button className="botao-sec" onClick={onEditar}>
            Editar
          </button>
        </div>
      </section>

      <EnviarWhatsApp texto={textoCompartilhar(a, base)} avaliado={a.avaliado} />

      <section className="cartao">
        <h2>📈 Evolução</h2>
        {anteriores.length === 0 ? (
          <p className="dica-sec">Esta é a avaliação inicial de {a.avaliado}. Faça a reavaliação daqui a algumas semanas para ver a diferença e os gráficos.</p>
        ) : (
          <>
            {anteriores.length > 1 && (
              <label className="campo">
                Comparar com
                <select value={baseId} onChange={(e) => setBaseId(e.target.value)}>
                  {anteriores.map((x, i) => (
                    <option key={x.id} value={x.id}>
                      {dataCurta(x.date)}
                      {i === anteriores.length - 1 ? ' (avaliação inicial)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {comparacao.length === 0 ? (
              <p className="dica-sec">As duas avaliações não têm testes em comum para comparar.</p>
            ) : (
              <table className="tabela-evolucao">
                <thead>
                  <tr>
                    <th></th>
                    <th>{base && anteriores.indexOf(base) === anteriores.length - 1 ? 'Inicial' : dataCurta(base!.date)}</th>
                    <th>Reavaliação</th>
                    <th>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {comparacao.map((c) => (
                    <tr key={c.metrica.id}>
                      <td>{c.metrica.rotulo}</td>
                      <td>{numero(c.inicial, c.metrica.casas)}</td>
                      <td>{numero(c.atual, c.metrica.casas)}</td>
                      <td className={c.melhorou === null ? '' : c.melhorou ? 'melhorou' : 'piorou'}>
                        {c.diferenca > 0 ? '+' : ''}
                        {numero(c.diferenca, c.metrica.casas)} {c.metrica.unidade === 'pontos' ? '' : c.metrica.unidade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {METRICAS.map((m) => {
              const pontosM = ate.map((x) => ({ date: x.date, v: m.valor(x), status: m.status(x) })).filter((p) => p.v !== null)
              if (pontosM.length < 2) return null
              return (
                <div key={m.id} className="grafico-metrica">
                  <h3>
                    {m.rotulo} {m.unidade && <small>({m.unidade})</small>}
                  </h3>
                  <GraficoEvolucao unidade={m.unidade} pontos={pontosM.map((p) => ({ date: p.date, valor: p.v!, status: p.status }))} />
                </div>
              )
            })}
          </>
        )}
        {doMesmo.length > 1 && (
          <ul className="historico">
            {doMesmo.map((x, i) => (
              <li key={x.id}>
                <button onClick={() => onAbrir(x.id)} className={x.id === a.id ? 'ativo' : ''}>
                  <span>{dataCurta(x.date)}</span>
                  <span className="nota">{i === doMesmo.length - 1 ? 'Inicial' : 'Reavaliação'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="botao" onClick={onReavaliar} style={{ marginTop: 12 }}>
          Fazer reavaliação de {a.avaliado.split(' ')[0]}
        </button>
      </section>

      <section className="cartao">
        <h2>⚠ Pontos de atenção</h2>
        <ul className="pontos-atencao">
          {pontos.map((p) => (
            <li key={p.area} className={p.status ? `area-${p.status}` : 'area-vazia'}>
              <div className="achado-topo">
                <b>{p.nome}</b>
                {p.status ? (
                  <span className={`chip chip-${p.status}`}>
                    {SINAL[p.status]} {p.status === 'ok' ? 'Sem alerta' : p.status === 'atencao' ? 'Atenção' : 'Prioridade'}
                  </span>
                ) : (
                  <span className="chip">Não avaliado</span>
                )}
              </div>
              {p.pontos.map((x) => (
                <p key={x.texto} className="achado-detalhe">
                  {x.texto}
                </p>
              ))}
              {p.avaliado && p.pontos.length === 0 && <p className="achado-detalhe">Resultados dentro ou acima do esperado.</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao">
        <h2>Testes e observações</h2>
        <ul className="achados">
          {TESTES.filter((t) => a.testes[t.id]).map((t) => (
            <li key={t.id}>
              <div className="achado-topo">
                <span>{t.nome}</span>
                <span className="valor">
                  {numero(a.testes[t.id]!.valor, t.unidade === 's' ? 1 : 0)} {t.unidade}
                </span>
              </div>
              {a.testes[t.id]!.observacao && <p className="achado-detalhe">{a.testes[t.id]!.observacao}</p>}
            </li>
          ))}
          {a.berg.some((n) => n !== null) && (
            <li>
              <div className="achado-topo">
                <span>Escala de Berg, por item</span>
              </div>
              <p className="achado-detalhe">
                {ITENS_BERG.map((it, i) => `${i + 1}. ${it.titulo}: ${a.berg[i] ?? '—'}`).join(' · ')}
              </p>
              {a.bergObservacao && <p className="achado-detalhe">{a.bergObservacao}</p>}
            </li>
          )}
        </ul>
      </section>

      <section className="cartao">
        <h2>Antropometria</h2>
        <ul className="achados">
          {CIRCUNFERENCIAS.filter((c) => a.antropometria.circ[c.id]).map((c) => {
            const cm = a.antropometria.circ[c.id]!
            const cl = c.id === 'cintura' ? classificarCintura(cm, a.anamnese.sexo) : null
            return (
              <li key={c.id} className="achado-topo">
                <span>{c.nome}</span>
                <span className="valor">
                  {numero(cm, 0)} cm {cl && <span className={`chip chip-${cl.status}`}>{cl.rotulo}</span>}
                </span>
              </li>
            )
          })}
          {rcq && (
            <li className="achado-topo">
              <span>Relação cintura/quadril</span>
              <span className="valor">{numero(rcq, 2)}</span>
            </li>
          )}
          {Object.keys(a.antropometria.circ).length === 0 && <li className="dica-sec">Circunferências não medidas.</li>}
        </ul>
      </section>

      <details className="cartao anamnese-resumo">
        <summary>
          <h2>Anamnese</h2>
        </summary>
        <dl>
          {(
            [
              ['Objetivo', a.anamnese.objetivo],
              ['Atividade física', a.anamnese.atividade],
              ['Medicamentos', a.anamnese.medicamentos],
              ['Doenças e condições', a.anamnese.doencas],
              ['Quedas (12 meses)', a.anamnese.quedas === null ? '' : `${a.anamnese.quedas}${a.anamnese.quedasDetalhe ? ` · ${a.anamnese.quedasDetalhe}` : ''}`],
              ['Dores', `${a.anamnese.dores}${a.anamnese.dorNota !== null ? ` (${a.anamnese.dorNota}/10)` : ''}`],
              ['Cirurgias', a.anamnese.cirurgias],
              ['Dispositivo auxiliar', a.anamnese.dispositivo],
              ['Observações', a.anamnese.observacoes],
            ] as const
          )
            .filter(([, v]) => v.trim())
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      </details>

      <EnviarResultado tipo="idoso" id={a.id} feitoEm={a.date} resultado={a} avaliado={a.avaliado} altura={a.antropometria.estatura ?? undefined} />

      <button className="botao-sec perigo" onClick={onApagar}>
        Apagar avaliação
      </button>
      <AvisoTriagem>Os testes orientam o profissional e não substituem a avaliação de um médico ou fisioterapeuta.</AvisoTriagem>
    </>
  )
}
