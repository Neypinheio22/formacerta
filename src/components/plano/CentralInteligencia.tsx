import { Brain, CalendarClock, ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { useConta } from '../../nuvem/conta'
import { idadeDe, type Ficha } from '../../nuvem/fichas'
import { enviarResultado, type ResultadoNuvem } from '../../nuvem/resultados'
import { montarCentral, type AreaId, type CartaoArea, type Estrategia } from '../../plano/central'
import { NIVEL, ROTULO_FOCO } from '../../plano/plano'
import type { Status } from '../../pose/types'
import { dataCurta } from '../../testes/formato'
import { LegendaNiveis, ListaExercicios, Selo } from './PlanoAcao'

type Props = {
  resultados: ResultadoNuvem[]
  nome: string
  ficha: Ficha | null
  /** Profissional ou administrador: revisa a análise e define a estratégia. */
  podeEditar: boolean
  onSalvo: () => void
}

const NIVEIS: Status[] = ['ok', 'atencao', 'alerta']

/**
 * Central de Inteligência: o aluno faz os testes, o app reúne os resultados por
 * área e sugere o treino; o professor revisa e define a estratégia.
 */
export function CentralInteligencia({ resultados, nome, ficha, podeEditar, onSalvo }: Props) {
  const { analise: a, cartoes, revisao, testesNovos, status } = montarCentral(resultados)
  const primeiro = nome.split(' ')[0]

  return (
    <>
      <section className={`cartao destaque analise-ia${status ? ` plano-${status}` : ''}`}>
        <span className="etiqueta">
          <Brain size={14} /> Central de Inteligência
        </span>
        <h2>{nome}</h2>
        <p className="fluxo-ia">O app coleta, organiza e sugere. A decisão final é do professor.</p>
        {a && status ? (
          <>
            <div className="plano-linha">
              <span className="plano-rotulo">Situação geral</span>
              <Selo status={status} grande />
            </div>
            <p>{a.resumo}</p>
          </>
        ) : (
          <p className="dica-sec">Ainda não há testes guardados para {primeiro}. Faça um teste e toque em “Guardar na ficha”: os resultados aparecem aqui, por área.</p>
        )}
        {revisao ? (
          <p className={`mensagem ${testesNovos ? 'aviso' : 'ok'}`}>
            {testesNovos
              ? `Há testes novos depois da revisão de ${dataCurta(revisao.data)}. Revise a análise de novo.`
              : `✓ Análise revisada${revisao.profissional ? ` por ${revisao.profissional}` : ''} em ${dataCurta(revisao.data)}.`}
          </p>
        ) : (
          a && <p className="dica-sec">Sugestão automática, ainda não revisada pelo professor.</p>
        )}
      </section>

      <div className="areas-central">
        {cartoes.map((c) => (
          <Area key={c.id} c={c} />
        ))}
      </div>

      {a && a.condutas.length > 0 && (
        <section className="cartao">
          {a.condutas.map((c) => (
            <p key={c} className="conduta">
              ⚠ {c}
            </p>
          ))}
        </section>
      )}

      {a && (
        <section className="cartao">
          <h2>Treinamento</h2>
          <p className="dica-sec">Sugestões de exercícios relacionadas aos achados.</p>
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
        </section>
      )}

      {revisao?.texto && (
        <section className="cartao estrategia">
          <h2>
            <ClipboardCheck size={18} /> Estratégia do professor
          </h2>
          <p className="ficha-texto">{revisao.texto}</p>
          <p className="dica-sec">
            {revisao.profissional && `${revisao.profissional} · `}
            {dataCurta(revisao.data)}
          </p>
        </section>
      )}

      {podeEditar && ficha && a && <Revisar key={revisao?.id ?? 'nova'} ficha={ficha} cartoes={cartoes} textoAnterior={revisao?.texto ?? ''} onSalvo={onSalvo} />}
    </>
  )
}

function Area({ c }: { c: CartaoArea }) {
  return (
    <section className={`area-cartao ${c.status ? `area-${c.status}` : 'area-vazia'}`}>
      <span className="area-nome">{c.nome}</span>
      {c.status ? <Selo status={c.status} /> : <span className="chip">Não avaliado</span>}
      <p>{c.achado}</p>
      {c.ajustado && c.statusApp && (
        <span className="area-ajuste">
          Ajustado pelo professor (app: {NIVEL[c.statusApp].emoji} {NIVEL[c.statusApp].rotulo})
        </span>
      )}
    </section>
  )
}

function Revisar({ ficha, cartoes, textoAnterior, onSalvo }: { ficha: Ficha; cartoes: CartaoArea[]; textoAnterior: string; onSalvo: () => void }) {
  const { perfil } = useConta()
  const avaliadas = cartoes.filter((c) => c.status)
  const [areas, setAreas] = useState<Partial<Record<AreaId, Status>>>(() => Object.fromEntries(avaliadas.map((c) => [c.id, c.status!])))
  const [texto, setTexto] = useState(textoAnterior)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!perfil) return
    setSalvando(true)
    const estrategia: Estrategia = { areas, texto: texto.trim(), profissional: perfil.nome || perfil.email }
    const e = await enviarResultado({
      tipo: 'estrategia',
      feitoEm: new Date().toISOString(),
      resultado: estrategia,
      enviadoPor: perfil.id,
      alunoId: ficha.aluno_id,
      fichaId: ficha.id,
      apelido: ficha.nome,
      idade: idadeDe(ficha.nascimento),
      sexo: ficha.sexo,
      alturaCm: ficha.altura_cm,
    })
    setSalvando(false)
    if (e) setErro(e.includes('check') || e.includes('tipo') ? 'O banco ainda não aceita a estratégia: rode o arquivo central-inteligencia.sql no Supabase.' : e)
    else onSalvo()
  }

  return (
    <section className="cartao formulario revisar">
      <h2>Revisar análise e definir estratégia</h2>
      <p className="dica-sec">Confira cada área: mantenha a cor que o app sugeriu ou troque, se a sua avaliação presencial mostrou outra coisa.</p>
      {avaliadas.map((c) => (
        <div className="revisar-area" key={c.id}>
          <span>{c.nome}</span>
          <div className="niveis-botoes" role="radiogroup" aria-label={c.nome}>
            {NIVEIS.map((s) => (
              <button key={s} role="radio" aria-checked={areas[c.id] === s} className={areas[c.id] === s ? `ativo selo-${s}` : ''} title={NIVEL[s].rotulo} onClick={() => setAreas({ ...areas, [c.id]: s })}>
                {NIVEL[s].emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
      <label className="campo">
        Estratégia de treino
        <textarea
          rows={5}
          maxLength={2000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: 4 semanas focando em mobilidade de quadril e fortalecimento de glúteo médio, 3x por semana no aquecimento. Reavaliar postura e corrida no fim do mês."
        />
      </label>
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao" disabled={salvando || !texto.trim()} onClick={salvar}>
        {salvando ? 'Salvando…' : 'Salvar estratégia na ficha'}
      </button>
    </section>
  )
}
