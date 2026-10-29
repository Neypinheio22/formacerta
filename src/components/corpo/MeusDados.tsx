import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { corpoDaFicha, perfilTreino, type ItemCorpo } from '../../corpo/corpo'
import { PERIMETRIA, type DadosMedidas } from '../../evolucao/evolucao'
import type { Circunferencia } from '../../idoso/tipos'
import { OBJETIVOS, fichaVazia, idadeDe, salvarMeusDados, type DadosFicha, type Ficha } from '../../nuvem/fichas'
import { enviarResultado, listarResultados, type ResultadoNuvem } from '../../nuvem/resultados'
import { minhaFicha } from '../../nuvem/treinos'
import { lerNumero } from '../../testes/formato'
import { ComoMedir } from '../alunos/ComoMedir'
import { MeuCorpoCartao } from './MeuCorpoCartao'

type Props = {
  meuId: string
  nome: string
  /** "antes": aparece antes da primeira avaliação, com a opção de pular. */
  modo?: 'antes' | 'editar'
  textoVoltar?: string
  onVoltar: () => void
  /** Depois de salvar (ou pular): segue para a avaliação ou volta. */
  onPronto: () => void
  textoPronto?: string
}

type Topico = 'voce' | 'objetivo' | 'saude' | 'medidas'

/** Medidas que entram nas contas (gordura pela Marinha e cintura/altura). */
const PRINCIPAIS: Circunferencia[] = ['pescoco', 'cintura', 'abdomen', 'quadril']

const numeroBr = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

function Campo({ rotulo, valor, onChange, dica }: { rotulo: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  return (
    <label className="campo">
      {rotulo}
      <input inputMode="decimal" value={valor} placeholder={dica} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))} maxLength={6} />
    </label>
  )
}

/** Cabeçalho de cada tópico: número, título, se já está preenchido, e abre/fecha. */
function Cabeca({ n, titulo, feito, opcional, aberto, onClick }: { n: number; titulo: string; feito: boolean; opcional?: boolean; aberto: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`topico-cabeca${aberto ? ' aberto' : ''}`} aria-expanded={aberto} onClick={onClick}>
      <span className={`topico-num${feito ? ' feito' : ''}`}>{feito ? <Check size={14} strokeWidth={3} /> : n}</span>
      <span className="topico-titulo">
        {titulo}
        {opcional && <span className="dica-sec"> · opcional</span>}
      </span>
      <ChevronDown size={18} className="topico-seta" />
    </button>
  )
}

function OQueE({ children }: { children: React.ReactNode }) {
  return (
    <details className="o-que-e">
      <summary>O que é isso?</summary>
      <p className="dica-sec">{children}</p>
    </details>
  )
}

/**
 * Meus dados: o aluno preenche, em 4 tópicos curtos, o que deixa a avaliação
 * completa. No fim o app mostra "Meu corpo hoje" e como a série sugerida mudou.
 */
export function MeusDados({ meuId, nome, modo = 'editar', textoVoltar = 'Início', onVoltar, onPronto, textoPronto }: Props) {
  const [ficha, setFicha] = useState<Ficha | null | undefined>(undefined)
  const [medidas, setMedidas] = useState<ResultadoNuvem[]>([])
  const [d, setD] = useState<DadosFicha>(fichaVazia(nome))
  const [aberto, setAberto] = useState<Topico | null>('voce')
  const [peso, setPeso] = useState('')
  const [gordura, setGordura] = useState('')
  const [circ, setCirc] = useState<Partial<Record<Circunferencia, string>>>({})
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [pronto, setPronto] = useState<ItemCorpo[] | null>(null)
  const [motivos, setMotivos] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    minhaFicha(meuId).then(async (f) => {
      const m = f ? (await listarResultados({ fichaId: f.id, tipo: 'medidas' })).lista : []
      if (!vivo) return
      setFicha(f)
      setMedidas(m)
      if (f) {
        setD({ ...f })
        setAceito(!!f.consentimento_em)
      }
    })
    return () => {
      vivo = false
    }
  }, [meuId])

  const muda = <K extends keyof DadosFicha>(k: K, v: DadosFicha[K]) => setD((x) => ({ ...x, [k]: v }))
  const abre = (t: Topico) => setAberto((x) => (x === t ? null : t))
  const ultimo = (k: 'peso' | Circunferencia): number | null => {
    for (const r of medidas) {
      const m = (r.dados ?? {}) as DadosMedidas
      const v = k === 'peso' ? m.peso : m.circ?.[k]
      if (typeof v === 'number') return v
    }
    return null
  }
  const dica = (k: 'peso' | Circunferencia) => {
    const v = ultimo(k)
    return v === null ? undefined : `última: ${numeroBr(v)}`
  }

  const novasMedidas: DadosMedidas = {
    peso: lerNumero(peso),
    gordura: lerNumero(gordura),
    circ: Object.fromEntries(Object.entries(circ).map(([k, v]) => [k, lerNumero(v ?? '')]).filter(([, v]) => v !== null)),
    observacoes: '',
  }
  const temMedida = novasMedidas.peso !== null || novasMedidas.gordura !== null || Object.keys(novasMedidas.circ!).length > 0

  const alturaErrada = d.altura_cm !== null && (d.altura_cm < 50 || d.altura_cm > 250)
  const feitoVoce = !!(d.nascimento && d.sexo && d.altura_cm && (peso || ultimo('peso') !== null))
  const feitoObjetivo = !!d.objetivo
  const feitoSaude = d.saude.trim() !== ''
  const feitoMedidas = PRINCIPAIS.some((k) => circ[k] || ultimo(k) !== null)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    let err = await salvarMeusDados(d)
    let f = ficha ?? null
    if (!err) f = await minhaFicha(meuId)
    let lista = medidas
    if (!err && f && temMedida) {
      const agora = new Date().toISOString()
      err = await enviarResultado({
        tipo: 'medidas',
        feitoEm: agora,
        resultado: novasMedidas,
        enviadoPor: meuId,
        alunoId: meuId,
        fichaId: f.id,
        apelido: '',
        idade: idadeDe(d.nascimento),
        sexo: d.sexo,
        alturaCm: d.altura_cm,
      })
      if (!err) lista = (await listarResultados({ fichaId: f.id, tipo: 'medidas' })).lista
    }
    setSalvando(false)
    if (err) return setErro(err)
    setFicha(f)
    setMedidas(lista)
    const itens = corpoDaFicha(d, lista, idadeDe(d.nascimento))
    setMotivos(perfilTreino(itens, d.objetivo).motivos)
    setPronto(itens)
    window.scrollTo(0, 0)
  }

  if (ficha === undefined) return <p className="carregando">Carregando…</p>

  if (pronto) {
    return (
      <div className="tela">
        <header className="topo">
          <button className="voltar" onClick={onVoltar}>
            ← {textoVoltar}
          </button>
        </header>
        <section className="cartao destaque">
          <h1>Dados salvos ✓</h1>
          <p className="dica-sec">O seu personal vê o que você preencheu. Dá para mudar quando quiser em "Meus dados".</p>
        </section>
        <MeuCorpoCartao itens={pronto} vazio="Preencha altura e peso para o app calcular o seu IMC e a gordura estimada." />
        {motivos.length > 0 && (
          <section className="cartao">
            <h2>O que muda no seu treino</h2>
            <ul className="lista-motivos">
              {motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="dica-sec">Vale para a série sugerida pelo app. Quando o seu personal montar o seu treino, vale o dele.</p>
          </section>
        )}
        <button className="botao grande" onClick={onPronto}>
          {textoPronto ?? 'Pronto'}
        </button>
      </div>
    )
  }

  const outras = PERIMETRIA.filter((c) => !PRINCIPAIS.includes(c.id))

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← {textoVoltar}
        </button>
      </header>

      <section className="cartao destaque">
        <h1>{modo === 'antes' ? 'Antes de começar' : 'Meus dados'}</h1>
        <p className="dica-sec">
          {modo === 'antes'
            ? 'Um minuto para a sua avaliação vir completa: com estes dados o app calcula o seu corpo e ajusta os exercícios ao seu objetivo.'
            : 'Com estes dados a avaliação fica completa e o app ajusta os exercícios ao seu corpo e ao seu objetivo.'}
        </p>
      </section>

      <form className="formulario topicos" onSubmit={salvar}>
        <section className="cartao topico">
          <Cabeca n={1} titulo="Sobre você" feito={feitoVoce} aberto={aberto === 'voce'} onClick={() => abre('voce')} />
          {aberto === 'voce' && (
            <div className="topico-corpo">
              <OQueE>Idade, sexo, altura e peso são a base de tudo: com eles o app calcula o IMC e estima a sua gordura corporal.</OQueE>
              <div className="dois-campos">
                <label className="campo">
                  Nascimento
                  <input type="date" value={d.nascimento ?? ''} onChange={(e) => muda('nascimento', e.target.value || null)} />
                </label>
                <label className="campo">
                  Sexo
                  <select value={d.sexo ?? ''} onChange={(e) => muda('sexo', (e.target.value || null) as DadosFicha['sexo'])}>
                    <option value="">—</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
              </div>
              <div className="dois-campos">
                <label className="campo">
                  Altura (cm)
                  <input
                    inputMode="numeric"
                    value={d.altura_cm ?? ''}
                    placeholder="Ex.: 165"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      muda('altura_cm', v ? Number(v) : null)
                    }}
                    maxLength={3}
                  />
                </label>
                <Campo rotulo="Peso hoje (kg)" valor={peso} onChange={setPeso} dica={dica('peso') ?? 'Ex.: 70,5'} />
              </div>
              {alturaErrada && <p className="mensagem erro">A altura vai em centímetros, por exemplo 165.</p>}
              <label className="campo">
                WhatsApp
                <input value={d.telefone} onChange={(e) => muda('telefone', e.target.value)} inputMode="tel" maxLength={30} placeholder="(11) 91234-5678" />
              </label>
              <button type="button" className="botao-sec" onClick={() => setAberto('objetivo')}>
                Próximo: meu objetivo
              </button>
            </div>
          )}
        </section>

        <section className="cartao topico">
          <Cabeca n={2} titulo="Meu objetivo" feito={feitoObjetivo} aberto={aberto === 'objetivo'} onClick={() => abre('objetivo')} />
          {aberto === 'objetivo' && (
            <div className="topico-corpo">
              <OQueE>O objetivo decide as séries e repetições sugeridas e o que conta como melhora nos gráficos. Escolha o principal.</OQueE>
              <div className="lista-objetivos" role="radiogroup">
                {OBJETIVOS.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    role="radio"
                    aria-checked={d.objetivo === o.id}
                    className={`objetivo${d.objetivo === o.id ? ' ativo' : ''}`}
                    onClick={() => {
                      muda('objetivo', o.id)
                      setAberto('saude')
                    }}
                  >
                    <b>{o.rotulo}</b>
                    <span>{o.texto}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="cartao topico">
          <Cabeca n={3} titulo="Saúde" opcional feito={feitoSaude} aberto={aberto === 'saude'} onClick={() => abre('saude')} />
          {aberto === 'saude' && (
            <div className="topico-corpo">
              <OQueE>Dores, doenças, remédios ou cirurgias ajudam o seu personal a evitar exercícios que podem piorar algo. Se tiver um problema sério, fale com um médico antes de treinar.</OQueE>
              <label className="campo">
                Doenças, dores, remédios e restrições
                <textarea value={d.saude} onChange={(e) => muda('saude', e.target.value)} rows={3} maxLength={2000} placeholder="Ex.: dor no joelho direito, pressão alta" />
              </label>
              <button type="button" className="botao-sec" onClick={() => setAberto('medidas')}>
                Próximo: medidas
              </button>
            </div>
          )}
        </section>

        <section className="cartao topico">
          <Cabeca n={4} titulo="Medidas com fita" opcional feito={feitoMedidas} aberto={aberto === 'medidas'} onClick={() => abre('medidas')} />
          {aberto === 'medidas' && (
            <div className="topico-corpo">
              <OQueE>Com pescoço, cintura e quadril o app estima a sua gordura com mais precisão (fórmula da Marinha dos EUA) e calcula a relação cintura/altura. Sem elas, a gordura sai só aproximada pelo IMC.</OQueE>
              <div className="dois-campos">
                {PRINCIPAIS.map((k) => (
                  <Campo key={k} rotulo={`${PERIMETRIA.find((c) => c.id === k)?.nome} (cm)`} valor={circ[k] ?? ''} dica={dica(k)} onChange={(v) => setCirc((x) => ({ ...x, [k]: v }))} />
                ))}
              </div>
              <Campo rotulo="Gordura (%) se a sua balança mostrar" valor={gordura} onChange={setGordura} />
              <ComoMedir />
              <details className="perimetria">
                <summary>Outras medidas (braço, coxa, panturrilha...)</summary>
                <div className="tres-campos">
                  {outras.map((c) => (
                    <Campo key={c.id} rotulo={c.nome} valor={circ[c.id] ?? ''} dica={dica(c.id)} onChange={(v) => setCirc((x) => ({ ...x, [c.id]: v }))} />
                  ))}
                </div>
              </details>
            </div>
          )}
        </section>

        {!ficha?.consentimento_em && (
          <label className="aceite">
            <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
            <span>Autorizo guardar estes dados e os números das minhas avaliações (sem foto e sem vídeo) no FormaCerta, para acompanhar a minha evolução. Dá para apagar quando eu quiser.</span>
          </label>
        )}
        {erro && <p className="mensagem erro">{erro}</p>}
        <button className="botao grande" type="submit" disabled={!aceito || salvando || alturaErrada}>
          {salvando ? 'Salvando…' : 'Salvar e ver meu corpo'}
        </button>
        {modo === 'antes' && (
          <button className="link" type="button" onClick={onPronto}>
            Pular por agora
          </button>
        )}
      </form>
    </div>
  )
}
