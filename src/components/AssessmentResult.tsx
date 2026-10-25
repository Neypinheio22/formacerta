import { planoCorretivo, recomendacao } from '../pose/recomendacoes'
import { VIEWS, type Assessment } from '../pose/types'
import { textoPostura } from '../compartilhar/whatsapp'
import { ROTULO_POSTURA as ROTULO, textoPontuacao as scoreText } from '../relatorio/conteudo'
import { EnviarResultado } from './conta/EnviarResultado'
import { EnviarWhatsApp } from './conta/EnviarWhatsApp'
import { PosePhoto } from './PosePhoto'

export function AssessmentResult({ assessment, onBack, onRelatorio }: { assessment: Assessment; onBack: () => void; onRelatorio: () => void }) {
  const problemas = assessment.views.flatMap((v) => v.findings).filter((f) => f.status !== 'ok')
  const plano = planoCorretivo(problemas)
  // Avaliações salvas antes das recomendações por músculo só têm a lista de exercícios.
  const antigos = problemas.some((f) => !f.correcao) ? [...new Set(problemas.filter((f) => !f.correcao).flatMap((f) => f.exercises))] : []
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

      <EnviarWhatsApp texto={textoPostura(assessment)} onPdf={onRelatorio} />

      {problemas.length > 0 && (
        <section className="cartao">
          <h2>Seu plano de correção</h2>
          {plano.alongar.length > 0 && (
            <div className="grupo-musculos">
              <h3>Alongar</h3>
              <ul className="musculos alongar">
                {plano.alongar.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {plano.fortalecer.length > 0 && (
            <div className="grupo-musculos">
              <h3>Fortalecer</h3>
              <ul className="musculos fortalecer">
                {plano.fortalecer.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {(plano.exercicios.length > 0 || antigos.length > 0) && <h3 className="sub">Exercícios</h3>}
          <ul className="exercicios">
            {plano.exercicios.map((e) => (
              <li key={e.nome}>
                <span className={`foco foco-${e.foco}`}>{e.foco === 'alongar' ? 'Alongar' : 'Fortalecer'}</span> {e.nome} <span className="valor">{e.dose}</span>
              </li>
            ))}
            {antigos.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="dica-sec">Faça 3 a 4 vezes por semana e repita a avaliação em 30 dias para ver sua evolução. Os músculos indicados são uma triagem pelas fotos: o personal confirma na avaliação presencial.</p>
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
                  <MusculosDoAchado rec={recomendacao(f)} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <section className="cartao personal">
        <h2>Acompanhamento do personal</h2>
        <p className="dica-sec">Gere o relatório com a logo e o registro do profissional para imprimir, salvar em PDF ou mandar no WhatsApp.</p>
        <button className="botao" onClick={onRelatorio}>
          Relatório para imprimir ou enviar
        </button>
      </section>

      <EnviarResultado tipo="postura" id={assessment.id} feitoEm={assessment.date} resultado={assessment} />

      <p className="aviso-legal">
        Esta avaliação é uma triagem e não é um diagnóstico médico. A análise é automática e serve como orientação. Ela não substitui a avaliação de um profissional de educação física ou de saúde. Em caso de dor, procure um profissional.
      </p>
    </div>
  )
}

function MusculosDoAchado({ rec }: { rec: ReturnType<typeof recomendacao> }) {
  if (!rec) return null
  return (
    <span className="achado-musculos">
      <span>
        <b>Alongar:</b> {rec.alongar.join(', ')}
      </span>
      <span>
        <b>Fortalecer:</b> {rec.fortalecer.join(', ')}
      </span>
    </span>
  )
}
