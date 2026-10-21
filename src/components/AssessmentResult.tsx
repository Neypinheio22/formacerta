import { VIEWS, type Assessment, type Status } from '../pose/types'
import { PosePhoto } from './PosePhoto'

const ROTULO: Record<Status, string> = { ok: 'Bom', atencao: 'Atenção', alerta: 'Corrigir' }

function scoreText(score: number) {
  if (score >= 85) return 'Postura muito boa'
  if (score >= 65) return 'Alguns pontos para ajustar'
  return 'Vale focar na correção'
}

export function AssessmentResult({ assessment, onBack }: { assessment: Assessment; onBack: () => void }) {
  const problemas = assessment.views.flatMap((v) => v.findings).filter((f) => f.status !== 'ok')
  const exercicios = [...new Set(problemas.flatMap((f) => f.exercises))]
  const data = new Date(assessment.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onBack}>
          ← Início
        </button>
        <span className="passo">{data}</span>
      </header>

      <section className="placar">
        <div className="anel" style={{ '--p': assessment.score } as React.CSSProperties}>
          <span>{assessment.score}</span>
        </div>
        <div>
          <h1>{scoreText(assessment.score)}</h1>
          <p className="dica">
            {problemas.length === 0 ? 'Nenhum desvio importante encontrado.' : `${problemas.length} ponto${problemas.length > 1 ? 's' : ''} para melhorar.`}
          </p>
        </div>
      </section>

      {exercicios.length > 0 && (
        <section className="cartao">
          <h2>Seu plano de correção</h2>
          <ul className="exercicios">
            {exercicios.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="dica-sec">Faça 3 a 4 vezes por semana e repita a avaliação em 30 dias para ver sua evolução.</p>
        </section>
      )}

      {assessment.views.map((v) => (
        <section className="cartao" key={v.view}>
          <h2>{VIEWS.find((x) => x.id === v.view)?.label}</h2>
          <div className="vista">
            <PosePhoto image={v.image} width={v.width} height={v.height} landmarks={v.landmarks} />
            <ul className="achados">
              {v.findings.map((f) => (
                <li key={f.id}>
                  <div className="achado-topo">
                    <strong>{f.title}</strong>
                    <span className={`chip chip-${f.status}`}>{ROTULO[f.status]}</span>
                  </div>
                  <span className="achado-detalhe">
                    {f.detail} <span className="valor">{f.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="cartao personal">
        <h2>Acompanhamento do personal</h2>
        <p className="dica-sec">Em breve: enviar esta avaliação para o seu personal revisar e emitir o relatório, ou chamar um personal de plantão por vídeo.</p>
        <button className="botao" disabled>
          Enviar para o personal (em breve)
        </button>
      </section>

      <p className="aviso-legal">
        A análise é automática e serve como orientação. Ela não substitui a avaliação de um profissional de educação física ou de saúde. Em caso de dor, procure um profissional.
      </p>
    </div>
  )
}
