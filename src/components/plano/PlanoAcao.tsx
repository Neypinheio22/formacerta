import { CalendarClock, ClipboardList } from 'lucide-react'
import { NIVEL, ROTULO_FOCO, type ExercicioPlano, type PlanoTeste } from '../../plano/plano'
import type { Status } from '../../pose/types'
import { dataCurta } from '../../testes/formato'

const ETAPAS = ['Teste', 'Resultado', 'Classificação', 'Pontos de atenção', 'Exercícios', 'Reavaliação']

/** Selo 🟢 Adequado / 🟡 Precisa melhorar / 🔴 Atenção. */
export function Selo({ status, grande = false }: { status: Status; grande?: boolean }) {
  return (
    <span className={`selo selo-${status}${grande ? ' grande' : ''}`}>
      {NIVEL[status].emoji} {NIVEL[status].rotulo}
    </span>
  )
}

export function LegendaNiveis() {
  return (
    <p className="legenda-niveis">
      {(['ok', 'atencao', 'alerta'] as Status[]).map((s) => (
        <span key={s}>
          {NIVEL[s].emoji} {NIVEL[s].rotulo}
        </span>
      ))}
    </p>
  )
}

export function ListaExercicios({ exercicios }: { exercicios: ExercicioPlano[] }) {
  return (
    <ul className="exercicios">
      {exercicios.map((e) => (
        <li key={e.nome}>
          <span className={`foco foco-${e.foco}`}>{ROTULO_FOCO[e.foco]}</span> {e.nome} {e.dose && <span className="valor">{e.dose}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Bloco no fim de cada teste: classificação, pontos de atenção, exercícios e reavaliação. */
export function PlanoAcao({ plano }: { plano: PlanoTeste }) {
  const { musculos } = plano
  return (
    <section className={`cartao plano-acao plano-${plano.status}`}>
      <span className="etiqueta">
        <ClipboardList size={14} /> Plano de ação
      </span>
      <ol className="trilha" aria-label="Etapas da avaliação">
        {ETAPAS.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>

      <div className="plano-linha">
        <span className="plano-rotulo">Resultado</span>
        <b>{plano.resultado}</b>
      </div>
      <div className="plano-linha">
        <span className="plano-rotulo">Classificação</span>
        <Selo status={plano.status} grande />
      </div>

      {plano.conduta && <p className="conduta">⚠ {plano.conduta}</p>}

      <h3 className="sub">Pontos de atenção</h3>
      {plano.pontos.length ? (
        <ul className="pontos-plano">
          {plano.pontos.map((p) => (
            <li key={p.texto}>
              <span aria-label={NIVEL[p.status].rotulo}>{NIVEL[p.status].emoji}</span> {p.texto}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dica-sec">Nenhum ponto de atenção neste teste.</p>
      )}

      {(musculos.alongar.length > 0 || musculos.fortalecer.length > 0) && (
        <>
          {musculos.alongar.length > 0 && (
            <div className="grupo-musculos">
              <h3>Alongar</h3>
              <ul className="musculos alongar">
                {musculos.alongar.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {musculos.fortalecer.length > 0 && (
            <div className="grupo-musculos">
              <h3>Fortalecer</h3>
              <ul className="musculos fortalecer">
                {musculos.fortalecer.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <h3 className="sub">{plano.status === 'ok' ? 'Para manter' : 'Exercícios recomendados'}</h3>
      {plano.exercicios.length ? <ListaExercicios exercicios={plano.exercicios} /> : <p className="dica-sec">Siga o treino normal. Nenhum exercício corretivo necessário.</p>}

      <p className="reavaliar">
        <CalendarClock size={18} /> Reavaliar em <b>{dataCurta(plano.reavaliarEm)}</b> ({plano.reavaliarDias} dias)
      </p>
      <LegendaNiveis />
    </section>
  )
}
