import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronUp, History, Pencil, Plus, TrendingUp, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { Rotina } from '../../nuvem/rotinas'
import type { Treino, TreinoFeito } from '../../nuvem/treinos'
import { dataCurta } from '../../testes/formato'
import { focoEmLista, focoSugerido, haQuanto, historicoDoTreino, ROTULO_STATUS, rotuloEsforco } from '../../treino/execucao'
import { hora, minutos, textoDuracao } from '../../treino/retorno'
import { andamento, dataDia, rotuloNivel, rotuloTipo, type Situacao } from '../../treino/rotinas'
import { IconeDaRotina } from './IconeRotina'

export type AcaoRotina = 'editar' | 'duplicar' | 'biblioteca' | Situacao

/** Um treino da rotina com o histórico de execução: vezes, última, situação e lista das vezes que foi feito. */
function CartaoTreino({
  t,
  feitos,
  primeiro,
  ultimo,
  podeMexer,
  onSubir,
  onDescer,
  onEditar,
}: {
  t: Treino
  feitos: TreinoFeito[]
  primeiro: boolean
  ultimo: boolean
  podeMexer: boolean
  onSubir: () => void
  onDescer: () => void
  onEditar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const h = historicoDoTreino(t.id, feitos)
  const st = ROTULO_STATUS[h.status]
  const foco = t.foco ? focoEmLista(t.foco) : focoSugerido(t.exercicios)
  return (
    <li className="treino-gerenciar">
      <div className="treino-gerenciar-topo">
        <span className="treino-letra-grande">{t.letra}</span>
        <button className="treino-gerenciar-info" onClick={onEditar} disabled={!podeMexer}>
          <strong>{t.nome || `Treino ${t.letra}`}</strong>
          <small>
            {t.exercicios.length} exercício{t.exercicios.length === 1 ? '' : 's'}
          </small>
          {foco.length > 0 && (
            <span className="rotina-chips">
              {foco.map((g) => (
                <span key={g} className={`chip ${t.foco ? 'chip-foco' : 'chip-neutro'}`}>
                  {g}
                </span>
              ))}
            </span>
          )}
        </button>
        {podeMexer && (
          <span className="ordem-botoes">
            <button className="icone-apagar" aria-label={`Subir treino ${t.letra}`} disabled={primeiro} onClick={onSubir}>
              <ArrowUp size={16} />
            </button>
            <button className="icone-apagar" aria-label={`Descer treino ${t.letra}`} disabled={ultimo} onClick={onDescer}>
              <ArrowDown size={16} />
            </button>
          </span>
        )}
      </div>
      <div className="treino-execucao">
        <span className="execucao-numeros">
          <span>
            <b>{h.vezes}</b> {h.vezes === 1 ? 'vez' : 'vezes'}
          </span>
          <span>
            Última: <b>{h.ultima ? `${dataCurta(h.ultima)} (${haQuanto(h.ultima)})` : '–'}</b>
          </span>
        </span>
        <span className={`chip chip-${st.tom}`}>{st.rotulo.replace(' na semana', '')}</span>
      </div>
      {h.vezes > 0 && (
        <>
          <button className="link link-discreto" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
            <History size={14} /> Histórico {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {aberto && (
            <ol className="historico-execucao">
              {h.lista.slice(0, 20).map((f) => {
                const m = minutos(f.inicio, f.fim)
                return (
                  <li key={f.id}>
                    <span>{dataCurta(f.feito_em)}</span>
                    <span className="dica-sec">
                      {[f.inicio && hora(f.inicio), m !== null && textoDuracao(m), f.esforco != null ? `esforço ${f.esforco} (${rotuloEsforco(f.esforco).toLowerCase()})` : f.intensidade, f.cargas?.length ? `${f.cargas.length} carga${f.cargas.length === 1 ? '' : 's'} anotada${f.cargas.length === 1 ? '' : 's'}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {f.dor && (
                      <span className="chip chip-alerta">
                        <TriangleAlert size={11} /> dor{f.dor_local ? `: ${f.dor_local}` : ''}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </>
      )}
    </li>
  )
}

/**
 * Ficha (rotina) aberta: dados, treinos com histórico de execução e situação,
 * botões para adicionar, reordenar, editar, duplicar, excluir e ver a evolução.
 */
export function DetalheRotina({
  r,
  treinos,
  feitos,
  atual,
  onEditar,
  onAdicionar,
  onOrdenar,
  onAcao,
  onEvolucao,
  menu,
}: {
  r: Rotina
  treinos: Treino[]
  feitos: TreinoFeito[]
  atual: boolean
  onEditar: (letra?: string) => void
  onAdicionar: () => void
  onOrdenar: (ordem: Treino[]) => void
  onAcao: (a: AcaoRotina) => void
  onEvolucao: () => void
  /** Três pontinhos: duplicar, biblioteca, arquivar, excluir. */
  menu: React.ReactNode
}) {
  const a = andamento(r)
  const ordem = [...treinos].sort((x, y) => x.letra.localeCompare(y.letra))
  const podeMexer = r.situacao !== 'excluida'
  const total = feitos.length
  const mover = (i: number, passo: -1 | 1) => {
    const nova = [...ordem]
    ;[nova[i], nova[i + passo]] = [nova[i + passo], nova[i]]
    onOrdenar(nova)
  }
  return (
    <>
      <section className={`cartao rotina-detalhe ${atual ? 'atual' : ''}`}>
        <div className="rotina-detalhe-topo">
          <IconeDaRotina id={r.icone} objetivo={r.objetivo} />
          <div className="rotina-detalhe-nome">
            <h2>{r.nome}</h2>
            <small className="dica-sec">
              <CalendarDays size={13} /> {r.inicio ? dataDia(r.inicio) : 'Sem início'} até {r.fim ? dataDia(r.fim) : 'sem validade'}
            </small>
          </div>
          {menu}
        </div>
        <span className="rotina-chips">
          <span className={`chip chip-${a.tom}`}>{atual ? `Valendo · ${a.rotulo.toLowerCase()}` : a.rotulo}</span>
        </span>
        <p className="dica-sec">
          {[r.objetivo || rotuloTipo(r.icone, r.objetivo), r.nivel && rotuloNivel(r.nivel), total ? `${total} treino${total === 1 ? '' : 's'} feito${total === 1 ? '' : 's'}` : 'nenhum treino feito ainda'].filter(Boolean).join(' · ')}
        </p>
        <div className="acoes-rotina">
          <button className="botao" onClick={onEvolucao}>
            <TrendingUp size={16} /> Evolução
          </button>
          {podeMexer && (
            <button className="botao-sec" onClick={() => onEditar()}>
              <Pencil size={16} /> Editar
            </button>
          )}
        </div>
      </section>

      <section className="cartao">
        <h2>Treinos da rotina</h2>
        <ul className="treinos-gerenciar">
          {ordem.map((t, i) => (
            <CartaoTreino
              key={t.id}
              t={t}
              feitos={feitos}
              primeiro={i === 0}
              ultimo={i === ordem.length - 1}
              podeMexer={podeMexer}
              onSubir={() => mover(i, -1)}
              onDescer={() => mover(i, 1)}
              onEditar={() => onEditar(t.letra)}
            />
          ))}
        </ul>
        {podeMexer && ordem.length < 10 && (
          <button className="botao-sec" onClick={onAdicionar}>
            <Plus size={16} /> Adicionar treino
          </button>
        )}
      </section>

      {r.situacao === 'excluida' && (
        <button className="botao-sec" onClick={() => onAcao('ativa')}>
          Recuperar rotina
        </button>
      )}
    </>
  )
}
