import { ArrowRight, Dumbbell, Droplet, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Treino } from '../../nuvem/treinos'
import { COPO_ML, diaLocal, litros, metaAguaPorPeso } from '../../treino/semana'

/** Treinos da semana: barra que enche a cada dia treinado. */
export function SemanaCartao({ feitos, meta, podeMudar, onMudar }: { feitos: number; meta: number; podeMudar: boolean; onMudar: (n: number) => void }) {
  const pct = Math.min(100, Math.round((feitos / meta) * 100))
  const bateu = feitos >= meta
  return (
    <section className="cartao semana-cartao">
      <span className="semana-icone">
        <Dumbbell size={22} />
      </span>
      <div className="semana-corpo">
        <div className="semana-topo">
          <strong>Treinos da semana</strong>
          {podeMudar && (
            <span className="semana-meta">
              <button aria-label="Diminuir meta" onClick={() => onMudar(meta - 1)} disabled={meta <= 1}>
                <Minus size={12} />
              </button>
              meta {meta}
              <button aria-label="Aumentar meta" onClick={() => onMudar(meta + 1)} disabled={meta >= 7}>
                <Plus size={12} />
              </button>
            </span>
          )}
        </div>
        <div className="barra-meta" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={feitos}>
          <span style={{ width: `${pct}%` }} />
          <b>
            {feitos}/{meta}
          </b>
        </div>
        {bateu && <p className="semana-parabens">Meta batida! Corpo agradece. 💚</p>}
      </div>
    </section>
  )
}

/** Próximo treino da ficha montada pelo personal. */
export function ProximoTreinoCartao({ treino, onAbrir }: { treino: Treino; onAbrir: () => void }) {
  return (
    <section className="cartao destaque proximo-treino">
      <span className="dica-sec">Próximo treino</span>
      <h2>
        <span className="verde">{treino.letra}</span>
        {treino.nome && ` · ${treino.nome}`}
      </h2>
      <p className="dica-sec">
        {treino.exercicios.length} exercício{treino.exercicios.length === 1 ? '' : 's'}
      </p>
      <button className="botao" onClick={onAbrir}>
        Ir para o treino <ArrowRight size={18} strokeWidth={2.5} />
      </button>
    </section>
  )
}

const CHAVE_AGUA = 'formacerta:agua'
const CHAVE_META_AGUA = 'formacerta:agua-meta'

function lerAgua(): number {
  try {
    const a = JSON.parse(localStorage.getItem(CHAVE_AGUA) ?? '{}') as { dia?: string; ml?: number }
    return a.dia === diaLocal(new Date()) ? (a.ml ?? 0) : 0
  } catch {
    return 0
  }
}

function lerMetaAgua(): number {
  try {
    return Number(localStorage.getItem(CHAVE_META_AGUA)) || metaAguaPorPeso(null)
  } catch {
    return metaAguaPorPeso(null)
  }
}

function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor)
  } catch {
    // Sem espaço no aparelho: só não guarda.
  }
}

/** Água do dia: um toque por copo de 250 ml. Fica no aparelho e zera no dia seguinte. */
export function AguaCartao() {
  const [ml, setMl] = useState(lerAgua)
  const [meta, setMeta] = useState(lerMetaAgua)
  const [ajustando, setAjustando] = useState(false)
  const [peso, setPeso] = useState('')

  function mudar(novo: number) {
    const v = Math.max(0, Math.min(10000, novo))
    setMl(v)
    gravar(CHAVE_AGUA, JSON.stringify({ dia: diaLocal(new Date()), ml: v }))
  }

  function mudarMeta(novo: number) {
    const v = Math.max(1000, Math.min(6000, novo))
    setMeta(v)
    gravar(CHAVE_META_AGUA, String(v))
  }

  const pct = Math.min(100, Math.round((ml / meta) * 100))
  const copos = Math.round(ml / COPO_ML)

  return (
    <section className="cartao agua-cartao">
      <div className="agua-topo">
        <h2>
          <Droplet size={20} className="verde" /> Água
        </h2>
        <button className="agua-meta" onClick={() => setAjustando(!ajustando)}>
          Meta {litros(meta)}
        </button>
      </div>
      {ajustando && (
        <div className="agua-ajuste">
          <span className="semana-meta">
            <button aria-label="Diminuir meta de água" onClick={() => mudarMeta(meta - 250)}>
              <Minus size={12} />
            </button>
            {litros(meta)}
            <button aria-label="Aumentar meta de água" onClick={() => mudarMeta(meta + 250)}>
              <Plus size={12} />
            </button>
          </span>
          <label className="agua-peso">
            ou pelo peso
            <input inputMode="decimal" placeholder="kg" value={peso} maxLength={5} onChange={(e) => setPeso(e.target.value.replace(/[^\d,.]/g, ''))} />
            <button className="link" disabled={!Number(peso.replace(',', '.'))} onClick={() => mudarMeta(metaAguaPorPeso(Number(peso.replace(',', '.'))))}>
              calcular
            </button>
          </label>
        </div>
      )}
      <div className="barra-meta agua" role="progressbar" aria-valuemin={0} aria-valuemax={meta} aria-valuenow={ml}>
        <span style={{ width: `${pct}%` }} />
        <b>{litros(ml)}</b>
      </div>
      <div className="agua-botoes">
        <button className="botao-sec" onClick={() => mudar(ml - COPO_ML)} disabled={ml <= 0} aria-label="Tirar um copo">
          <Minus size={16} />
        </button>
        <button className="botao" onClick={() => mudar(ml + COPO_ML)}>
          <Plus size={18} /> 1 copo (250 ml)
        </button>
      </div>
      <p className="dica-sec">
        {ml >= meta ? 'Meta de água batida hoje! 💧' : `${copos} copo${copos === 1 ? '' : 's'} hoje. Faltam ${litros(meta - ml)}.`}
      </p>
    </section>
  )
}
