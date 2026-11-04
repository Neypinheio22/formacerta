import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Dumbbell, MessageSquareText, Pencil, TriangleAlert, UserRound } from 'lucide-react'
import { useState } from 'react'
import { anotarObservacao, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { dataCurta } from '../../testes/formato'
import { exerciciosDaSessao, feedbackVazio, frequenciaDeTreino, LOCAIS_DOR, rotuloDificuldade, temFeedback, type Execucao, type Feedback } from '../../treino/execucao'
import { PSES, rotuloPse, tomPse } from '../../treino/sessao'
import { numero } from '../../testes/formato'
import { hora, intensidadeComum, minutos, tempoMedio, textoDuracao } from '../../treino/retorno'

/**
 * Perguntas ao terminar o treino: percepção subjetiva de esforço (PSE, 8
 * níveis), dor (opcional) e comentário. Usado na tela de finalizar o treino e
 * no botão Avaliar de um treino já feito.
 */
export function CamposFeedback({ f, onMudar }: { f: Feedback; onMudar: (f: Feedback) => void }) {
  const locais = f.dor_local ? f.dor_local.split(', ').filter(Boolean) : []
  return (
    <>
      <fieldset className="campo">
        <legend>Selecione a intensidade do treino (PSE)</legend>
        <div className="escala-pse" role="radiogroup" aria-label="Percepção subjetiva de esforço">
          {PSES.map((p) => (
            <button key={p.n} type="button" role="radio" aria-checked={f.pse === p.n} className={`tom-${tomPse(p.n)} ${f.pse === p.n ? 'ativo' : ''}`} onClick={() => onMudar({ ...f, pse: p.n })}>
              <b>{p.n}</b>
              <span>{p.rotulo}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="campo">
        Se quiser, deixe seu comentário aqui
        <textarea value={f.comentario} onChange={(e) => onMudar({ ...f, comentario: e.target.value })} maxLength={500} rows={3} placeholder="Como você se sentiu, dificuldades, dores ou desconfortos…" />
      </label>

      <fieldset className="campo">
        <legend>Sentiu alguma dor? (opcional)</legend>
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
    </>
  )
}

/** Feedback pronto para ler: uma linha de texto e, só quando há dor, um aviso laranja. */
export function ResumoFeedback({ e }: { e: Execucao }) {
  const m = minutos(e.inicio, e.fim)
  const partes = [
    m !== null && textoDuracao(m),
    e.pse == null && e.dificuldade != null && rotuloDificuldade(e.dificuldade),
    e.pse != null ? `PSE ${e.pse} · ${rotuloPse(e.pse)}` : e.esforco != null ? `esforço ${e.esforco}/10` : e.intensidade,
    e.dor === false && 'sem dor',
  ].filter(Boolean)
  return (
    <>
      {partes.length > 0 && (
        <span className="feedback-linha">
          {partes.join(' · ')}
          {((e.pse != null && e.pse >= 8) || (e.pse == null && e.esforco != null && e.esforco >= 9)) && <b className="laranja"> · no limite</b>}
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
    ...(inicial ? { dificuldade: inicial.dificuldade ?? null, esforco: inicial.esforco ?? null, pse: inicial.pse ?? null, dor: inicial.dor ?? null, dor_local: inicial.dor_local ?? '', dor_nivel: inicial.dor_nivel ?? null, comentario: inicial.comentario ?? '' } : {}),
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
        <button className="botao" type="submit" disabled={salvando || f.pse === null}>
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

const kgTxt = (v: number) => `${numero(v, v % 1 ? 1 : 0)} kg`

/** Exercícios feitos na sessão, com as cargas, as repetições e o comparativo com a vez anterior. */
function ExerciciosDaSessao({ feitos, f }: { feitos: TreinoFeito[]; f: TreinoFeito }) {
  const lista = exerciciosDaSessao(feitos, f)
  if (!lista.length) return <p className="dica-sec">O aluno não marcou exercícios nem anotou cargas nesta sessão.</p>
  return (
    <ul className="sessao-exercicios">
      {lista.map((x, i) => (
        <li key={i}>
          <span className="sessao-ex-nome">
            {x.feito ? <CheckCircle2 size={14} className="verde" /> : <span className="sessao-ex-vazio" />} {x.nome}
          </span>
          <span className="sessao-ex-series">
            {x.series.length ? x.series.map((y) => `${y.kg != null ? numero(y.kg, y.kg % 1 ? 1 : 0) : '–'} kg × ${y.reps ?? '–'}`).join(' · ') : 'feito, sem carga anotada'}
          </span>
          {x.dif !== null && (
            <span className={`chip ${x.dif > 0 ? 'chip-ok' : x.dif < 0 ? 'chip-atencao' : 'chip-neutro'}`}>
              {x.dif > 0 ? <ArrowUpRight size={12} /> : x.dif < 0 ? <ArrowDownRight size={12} /> : <ArrowRight size={12} />} {x.dif > 0 ? '+' : ''}
              {kgTxt(x.dif)} (antes {kgTxt(x.antes!)})
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * Para o personal: histórico das sessões do aluno (data, início e fim,
 * duração, exercícios, cargas, repetições, PSE e comentário), frequência de
 * treino e espaço para a observação do personal em cada sessão.
 */
export function FeedbacksPersonal({ nome, feitos, treinos, onMudou }: { nome: string; feitos: TreinoFeito[] | null; treinos: Treino[]; onMudou: () => void }) {
  const [quantos, setQuantos] = useState(8)
  const [aberto, setAberto] = useState<string | null>(null)
  const primeiro = nome.split(' ')[0]
  const media = feitos ? tempoMedio(feitos) : null
  const comum = feitos ? intensidadeComum(feitos) : null
  const pses = (feitos ?? []).filter((f) => f.pse != null).slice(0, 10)
  const pseMedia = pses.length ? pses.reduce((a, f) => a + f.pse!, 0) / pses.length : null
  const esforcos = (feitos ?? []).filter((f) => f.esforco != null).slice(0, 10)
  const esforcoMedio = esforcos.length ? esforcos.reduce((a, f) => a + f.esforco!, 0) / esforcos.length : null
  const dores = (feitos ?? []).slice(0, 10).filter((f) => f.dor)
  const freq = feitos ? frequenciaDeTreino(feitos) : null
  const nomeDe = (f: TreinoFeito) => treinos.find((t) => t.id === f.treino_id)?.nome

  return (
    <section className="cartao">
      <h2>
        <MessageSquareText size={18} /> Histórico e feedback dos treinos
      </h2>
      <p className="dica-sec">Cada treino que {primeiro} concluiu no app: horários, exercícios, cargas, PSE e comentário. A sua observação volta para {primeiro}.</p>
      {feitos === null && <p className="carregando">Carregando…</p>}
      {feitos?.length === 0 && <p className="dica-sec">Nenhum treino concluído nos últimos 90 dias.</p>}
      {dores.length > 0 && (
        <p className="mensagem alerta-dor">
          <TriangleAlert size={16} /> {primeiro} relatou dor em {dores.length} dos últimos {Math.min(10, feitos!.length)} treinos{dores[0].dor_local ? ` (último: ${dores[0].dor_local})` : ''}.
        </p>
      )}
      {feitos && feitos.length > 0 && (
        <>
          {freq && (
            <div className="frequencia-treino">
              <span>
                <b>{freq.semana}</b>
                <small>nesta semana</small>
              </span>
              <span>
                <b>{freq.ultimos30}</b>
                <small>em 30 dias</small>
              </span>
              <span>
                <b>{numero(freq.porSemana, 1)}</b>
                <small>por semana</small>
              </span>
              <span>
                <b className={freq.diasSemTreinar !== null && freq.diasSemTreinar > 7 ? 'laranja' : ''}>{freq.diasSemTreinar === 0 ? 'hoje' : (freq.diasSemTreinar ?? '–')}</b>
                <small>{freq.diasSemTreinar === 0 ? 'último treino' : 'dias sem treinar'}</small>
              </span>
            </div>
          )}
          <div className="retorno-resumo">
            {media !== null && (
              <span>
                Tempo médio <b className="verde">{textoDuracao(media)}</b>
              </span>
            )}
            {pseMedia !== null ? (
              <span>
                PSE média <b className={pseMedia >= 7 ? 'laranja' : 'verde'}>{numero(pseMedia, 1)}/8</b>
              </span>
            ) : esforcoMedio !== null ? (
              <span>
                Esforço médio <b className={esforcoMedio >= 9 ? 'laranja' : 'verde'}>{numero(esforcoMedio, 1)}/10</b>
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
            {feitos.slice(0, quantos).map((f) => {
              const n = (f.cargas ?? []).length
              return (
                <li key={f.id} className={f.dor ? 'com-dor' : ''}>
                  <span className="linha-fim">
                    <b>
                      {f.letra && <span className="verde">{f.letra}</span>} {nomeDe(f) ?? (f.letra ? '' : 'Treino')}
                    </b>
                    <span className="dica-sec">
                      {dataCurta(f.feito_em)}
                      {f.inicio && f.fim && ` · ${hora(f.inicio)} às ${hora(f.fim)}`}
                    </span>
                  </span>
                  {temFeedback(f) ? <ResumoFeedback e={f} /> : <span className="dica-sec">Ainda sem avaliação do aluno.</span>}
                  {n > 0 && (
                    <button className="link link-discreto" onClick={() => setAberto(aberto === f.id ? null : f.id)} aria-expanded={aberto === f.id}>
                      <Dumbbell size={13} /> {n} exercício{n === 1 ? '' : 's'} · {aberto === f.id ? 'esconder' : 'ver cargas e repetições'}
                    </button>
                  )}
                  {aberto === f.id && <ExerciciosDaSessao feitos={feitos} f={f} />}
                  <ObsPersonal key={f.obs_personal ?? ''} f={f} onSalvo={onMudou} />
                </li>
              )
            })}
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
