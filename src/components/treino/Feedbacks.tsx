import { CheckCircle2, MessageSquareText, Pencil, TriangleAlert, UserRound } from 'lucide-react'
import { useState } from 'react'
import { anotarObservacao, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { dataCurta } from '../../testes/formato'
import { DIFICULDADES, ESFORCOS, feedbackVazio, LOCAIS_DOR, rotuloDificuldade, rotuloEsforco, temFeedback, tomEsforco, type Execucao, type Feedback } from '../../treino/execucao'
import { hora, intensidadeComum, minutos, tempoMedio, textoDuracao } from '../../treino/retorno'

/**
 * Perguntas do feedback: dificuldade, esforço (0 a 10), dores e observações.
 * Usado na tela "Treino finalizado" e no botão Avaliar de um treino já feito.
 */
export function CamposFeedback({ f, onMudar }: { f: Feedback; onMudar: (f: Feedback) => void }) {
  const locais = f.dor_local ? f.dor_local.split(', ').filter(Boolean) : []
  return (
    <>
      <fieldset className="campo">
        <legend>Nível de dificuldade</legend>
        <div className="escala-5" role="radiogroup" aria-label="Nível de dificuldade">
          {DIFICULDADES.map((d) => (
            <button key={d.n} type="button" role="radio" aria-checked={f.dificuldade === d.n} className={f.dificuldade === d.n ? 'ativo' : ''} onClick={() => onMudar({ ...f, dificuldade: d.n })}>
              <b>{d.n}</b>
              <small>{d.rotulo}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="campo">
        <legend>Percepção de esforço (0 a 10)</legend>
        <div className="escala-esforco" role="radiogroup" aria-label="Percepção de esforço">
          {ESFORCOS.map((e) => (
            <button key={e.n} type="button" role="radio" aria-checked={f.esforco === e.n} aria-label={`${e.n}: ${e.rotulo}`} className={`tom-${tomEsforco(e.n)} ${f.esforco === e.n ? 'ativo' : ''}`} onClick={() => onMudar({ ...f, esforco: e.n })}>
              {e.n}
            </button>
          ))}
        </div>
        <small className="dica-sec">{f.esforco !== null ? `${f.esforco} · ${rotuloEsforco(f.esforco)}` : '0 é repouso e 10 é o máximo que você aguenta.'}</small>
      </fieldset>

      <fieldset className="campo">
        <legend>Sentiu alguma dor ou desconforto?</legend>
        <div className="atalhos-data">
          <button type="button" className={`chip-botao ${f.dor === false ? 'ativo' : ''}`} aria-pressed={f.dor === false} onClick={() => onMudar({ ...f, dor: false, dor_local: '', dor_nivel: null })}>
            Não
          </button>
          <button type="button" className={`chip-botao ${f.dor ? 'ativo alerta' : ''}`} aria-pressed={!!f.dor} onClick={() => onMudar({ ...f, dor: true })}>
            Sim
          </button>
        </div>
        {f.dor && (
          <div className="dor-detalhe">
            <small className="dica-sec">Onde?</small>
            <div className="atalhos-data">
              {LOCAIS_DOR.map((l) => {
                const marcado = locais.includes(l)
                return (
                  <button key={l} type="button" className={`chip-botao ${marcado ? 'ativo alerta' : ''}`} aria-pressed={marcado} onClick={() => onMudar({ ...f, dor_local: (marcado ? locais.filter((x) => x !== l) : [...locais, l]).join(', ') })}>
                    {l}
                  </button>
                )
              })}
            </div>
            <label className="campo">
              <span>
                Quanto doeu? <b className="laranja">{f.dor_nivel ?? '–'}</b> de 10
              </span>
              <input type="range" min={0} max={10} value={f.dor_nivel ?? 0} onChange={(e) => onMudar({ ...f, dor_nivel: Number(e.target.value) })} />
            </label>
          </div>
        )}
      </fieldset>

      <label className="campo">
        Observações gerais
        <textarea value={f.comentario} onChange={(e) => onMudar({ ...f, comentario: e.target.value })} maxLength={500} rows={3} placeholder="Ex.: deu para subir a carga no supino, senti o joelho no afundo…" />
      </label>
    </>
  )
}

/** Feedback pronto para ler: uma linha de texto e, só quando há dor, um aviso laranja. */
export function ResumoFeedback({ e }: { e: Execucao }) {
  const m = minutos(e.inicio, e.fim)
  const partes = [
    m !== null && textoDuracao(m),
    e.dificuldade != null && rotuloDificuldade(e.dificuldade),
    e.esforco != null ? `esforço ${e.esforco}/10` : e.intensidade,
    e.dor === false && 'sem dor',
  ].filter(Boolean)
  return (
    <>
      {partes.length > 0 && (
        <span className="feedback-linha">
          {partes.join(' · ')}
          {e.esforco != null && e.esforco >= 9 && <b className="laranja"> · quase no máximo</b>}
        </span>
      )}
      {e.dor && (
        <span className="chip chip-alerta dor-chip">
          <TriangleAlert size={12} /> Dor{e.dor_local ? `: ${e.dor_local}` : ''}
          {e.dor_nivel != null ? ` (${e.dor_nivel}/10)` : ''}
        </span>
      )}
      {e.comentario && <span className="retorno-comentario">“{e.comentario}”</span>}
    </>
  )
}

/** Avaliar depois um treino já concluído. */
export function FormAvaliar({ inicial, onSalvar, onCancelar }: { inicial?: Execucao; onSalvar: (f: Feedback) => Promise<string | null>; onCancelar: () => void }) {
  const [f, setF] = useState<Feedback>(() => ({
    ...feedbackVazio(),
    ...(inicial ? { dificuldade: inicial.dificuldade ?? null, esforco: inicial.esforco ?? null, dor: inicial.dor ?? null, dor_local: inicial.dor_local ?? '', dor_nivel: inicial.dor_nivel ?? null, comentario: inicial.comentario ?? '' } : {}),
  }))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  return (
    <form
      className="formulario avaliar-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setSalvando(true)
        const e2 = await onSalvar(f)
        setSalvando(false)
        setErro(e2)
      }}
    >
      <CamposFeedback f={f} onMudar={setF} />
      {erro && <p className="mensagem erro">{erro}</p>}
      <div className="acoes-linha">
        <button className="botao" type="submit" disabled={salvando || f.dificuldade === null || f.esforco === null}>
          <CheckCircle2 size={16} /> {salvando ? 'Guardando…' : 'Enviar avaliação'}
        </button>
        <button className="botao-sec" type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** Observação do personal sobre um treino feito. */
function ObsPersonal({ f, onSalvo }: { f: TreinoFeito; onSalvo: () => void }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(f.obs_personal ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  if (!editando)
    return f.obs_personal ? (
      <span className="obs-personal">
        <UserRound size={13} /> {f.obs_personal}{' '}
        <button className="link" onClick={() => setEditando(true)} aria-label="Editar observação">
          <Pencil size={12} />
        </button>
      </span>
    ) : (
      <button className="link link-discreto" onClick={() => setEditando(true)}>
        <Pencil size={13} /> Responder
      </button>
    )
  return (
    <form
      className="obs-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setSalvando(true)
        const e2 = await anotarObservacao(f.id, texto)
        setSalvando(false)
        if (e2) return setErro(e2)
        setEditando(false)
        onSalvo()
      }}
    >
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={2} placeholder="Ex.: na próxima, baixar a carga do afundo e fazer amplitude menor." autoFocus />
      {erro && <p className="mensagem erro">{erro}</p>}
      <div className="acoes-linha">
        <button className="botao" type="submit" disabled={salvando}>
          {salvando ? 'Guardando…' : 'Salvar observação'}
        </button>
        <button className="botao-sec" type="button" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/**
 * Para o personal: como o aluno sentiu os treinos (tempo, dificuldade, esforço,
 * dores e comentário), com espaço para a observação do personal em cada um.
 */
export function FeedbacksPersonal({ nome, feitos, treinos, onMudou }: { nome: string; feitos: TreinoFeito[] | null; treinos: Treino[]; onMudou: () => void }) {
  const [quantos, setQuantos] = useState(8)
  const primeiro = nome.split(' ')[0]
  const media = feitos ? tempoMedio(feitos) : null
  const comum = feitos ? intensidadeComum(feitos) : null
  const esforcos = (feitos ?? []).filter((f) => f.esforco != null).slice(0, 10)
  const esforcoMedio = esforcos.length ? esforcos.reduce((a, f) => a + f.esforco!, 0) / esforcos.length : null
  const dores = (feitos ?? []).slice(0, 10).filter((f) => f.dor)
  const nomeDe = (f: TreinoFeito) => treinos.find((t) => t.id === f.treino_id)?.nome

  return (
    <section className="cartao">
      <h2>
        <MessageSquareText size={18} /> Feedback dos treinos
      </h2>
      <p className="dica-sec">Como {primeiro} sentiu cada treino. A sua observação volta para {primeiro} no app.</p>
      {feitos === null && <p className="carregando">Carregando…</p>}
      {feitos?.length === 0 && <p className="dica-sec">Nenhum treino concluído nos últimos 90 dias.</p>}
      {dores.length > 0 && (
        <p className="mensagem alerta-dor">
          <TriangleAlert size={16} /> {primeiro} relatou dor em {dores.length} dos últimos {Math.min(10, feitos!.length)} treinos{dores[0].dor_local ? ` (último: ${dores[0].dor_local})` : ''}.
        </p>
      )}
      {feitos && feitos.length > 0 && (
        <>
          <div className="retorno-resumo">
            {media !== null && (
              <span>
                Tempo médio <b className="verde">{textoDuracao(media)}</b>
              </span>
            )}
            {esforcoMedio !== null ? (
              <span>
                Esforço médio <b className={esforcoMedio >= 9 ? 'laranja' : 'verde'}>{esforcoMedio.toFixed(1).replace('.', ',')}/10</b>
              </span>
            ) : (
              comum && (
                <span>
                  Intensidade mais comum <b className="verde">{comum}</b>
                </span>
              )
            )}
          </div>
          <ul className="retornos">
            {feitos.slice(0, quantos).map((f) => (
              <li key={f.id} className={f.dor ? 'com-dor' : ''}>
                <span className="linha-fim">
                  <b>
                    {f.letra && <span className="verde">{f.letra}</span>} {nomeDe(f) ?? (f.letra ? '' : 'Treino')}
                  </b>
                  <span className="dica-sec">
                    {dataCurta(f.feito_em)}
                    {f.inicio && f.fim && ` · ${hora(f.inicio)}`}
                  </span>
                </span>
                {temFeedback(f) ? <ResumoFeedback e={f} /> : <span className="dica-sec">Ainda sem avaliação do aluno.</span>}
                <ObsPersonal key={f.obs_personal ?? ''} f={f} onSalvo={onMudou} />
              </li>
            ))}
          </ul>
          {feitos.length > quantos && (
            <button className="botao-sec" onClick={() => setQuantos(quantos + 10)}>
              Ver mais
            </button>
          )}
        </>
      )}
    </section>
  )
}
