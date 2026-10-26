import { HeartPulse } from 'lucide-react'
import { useMemo, useState } from 'react'
import { bergDe, imcDe } from '../../idoso/analise'
import { MAXIMO_BERG } from '../../idoso/berg'
import { TESTES, classificar, teste } from '../../idoso/testes'
import { CHAVE_IDOSO, CHAVE_RASCUNHO_IDOSO, novaAvaliacao, type AvaliacaoIdoso, type IdTeste } from '../../idoso/tipos'
import { apagar, avaliados, carregar, doAvaliado, salvar } from '../../testes/historico'
import { dataCurta, numero } from '../../testes/formato'
import { AvisoTriagem } from '../testes/comum'
import { Berg } from './Berg'
import { FichaAnamnese, FichaAntropometria } from './Fichas'
import { IdosoResultado } from './IdosoResultado'
import { TesteFuncional } from './TesteFuncional'

type Tela =
  | { nome: 'inicio' }
  | { nome: 'anamnese' }
  | { nome: 'antropometria' }
  | { nome: 'testes' }
  | { nome: 'teste'; id: IdTeste }
  | { nome: 'berg' }
  | { nome: 'resultado'; id: string }

function lerRascunho(): AvaliacaoIdoso | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RASCUNHO_IDOSO) ?? 'null') as AvaliacaoIdoso | null
  } catch {
    return null
  }
}

function gravarRascunho(a: AvaliacaoIdoso | null) {
  try {
    if (a) localStorage.setItem(CHAVE_RASCUNHO_IDOSO, JSON.stringify(a))
    else localStorage.removeItem(CHAVE_RASCUNHO_IDOSO)
  } catch {
    /* ignora */
  }
}

/** Avaliação funcional do idoso: anamnese, antropometria, testes, Berg e resultado. */
export function IdosoModulo({ onVoltar, onRelatorio }: { onVoltar: () => void; onRelatorio: (a: AvaliacaoIdoso) => void }) {
  const [tela, setTela] = useState<Tela>({ nome: 'inicio' })
  const [lista, setLista] = useState(() => carregar<AvaliacaoIdoso>(CHAVE_IDOSO))
  const [rascunho, setRascunhoEstado] = useState(lerRascunho)
  const ir = (t: Tela) => {
    setTela(t)
    window.scrollTo(0, 0)
  }
  const setRascunho = (a: AvaliacaoIdoso | null) => {
    setRascunhoEstado(a)
    gravarRascunho(a)
  }
  const mudar = (m: Partial<AvaliacaoIdoso>) => setRascunho({ ...rascunho!, ...m })
  const nomes = useMemo(() => avaliados(lista), [lista])

  function comecar(a: AvaliacaoIdoso) {
    setRascunho(a)
    ir({ nome: 'anamnese' })
  }

  function concluir() {
    if (!rascunho) return
    salvar(CHAVE_IDOSO, { ...rascunho, avaliado: rascunho.avaliado.trim() })
    setLista(carregar<AvaliacaoIdoso>(CHAVE_IDOSO))
    setRascunho(null)
    ir({ nome: 'resultado', id: rascunho.id })
  }

  const topo = (voltar: () => void, rotulo: string) => (
    <header className="topo">
      <button className="voltar" onClick={voltar}>
        ← {rotulo}
      </button>
    </header>
  )

  if (tela.nome === 'resultado') {
    const a = lista.find((x) => x.id === tela.id)
    if (!a) return null
    return (
      <div className="tela">
        {topo(() => ir({ nome: 'inicio' }), 'Avaliações')}
        <IdosoResultado
          key={a.id}
          a={a}
          doMesmo={doAvaliado(lista, a.avaliado)}
          onAbrir={(id) => ir({ nome: 'resultado', id })}
          onRelatorio={() => onRelatorio(a)}
          onEditar={() => comecar(structuredClone(a))}
          onReavaliar={() => comecar(novaAvaliacao(a))}
          onApagar={() => {
            if (!confirm(`Apagar a avaliação de ${a.avaliado} do dia ${dataCurta(a.date)}?`)) return
            apagar(CHAVE_IDOSO, a.id)
            setLista(carregar<AvaliacaoIdoso>(CHAVE_IDOSO))
            ir({ nome: 'inicio' })
          }}
        />
      </div>
    )
  }

  if (tela.nome === 'inicio' || !rascunho) {
    return (
      <div className="tela">
        {topo(onVoltar, 'Início')}
        <Inicio
          lista={lista}
          rascunho={rascunho}
          onNova={() => comecar(novaAvaliacao())}
          onContinuar={() => ir({ nome: 'testes' })}
          onDescartar={() => {
            if (confirm('Descartar a avaliação em andamento?')) setRascunho(null)
          }}
          onAbrir={(id) => ir({ nome: 'resultado', id })}
          onReavaliar={(a) => comecar(novaAvaliacao(a))}
        />
      </div>
    )
  }

  const { idade, sexo } = rascunho.anamnese

  if (tela.nome === 'teste') {
    return (
      <div className="tela">
        {topo(() => ir({ nome: 'testes' }), 'Testes')}
        <TesteFuncional
          def={teste(tela.id)}
          inicial={rascunho.testes[tela.id]}
          idade={idade}
          sexo={sexo}
          onVoltar={() => ir({ nome: 'testes' })}
          onSalvar={(r) => {
            const testes = { ...rascunho.testes }
            if (r) testes[tela.id] = r
            else delete testes[tela.id]
            mudar({ testes })
            ir({ nome: 'testes' })
          }}
        />
      </div>
    )
  }

  if (tela.nome === 'berg') {
    return (
      <div className="tela">
        {topo(() => ir({ nome: 'testes' }), 'Testes')}
        <Berg
          notas={rascunho.berg}
          observacao={rascunho.bergObservacao}
          onVoltar={() => ir({ nome: 'testes' })}
          onSalvar={(berg, bergObservacao) => {
            mudar({ berg, bergObservacao })
            ir({ nome: 'testes' })
          }}
        />
      </div>
    )
  }

  const etapas = ['anamnese', 'antropometria', 'testes'] as const
  const atual = etapas.indexOf(tela.nome)

  return (
    <div className="tela">
      {topo(atual === 0 ? () => ir({ nome: 'inicio' }) : () => ir({ nome: etapas[atual - 1] }), atual === 0 ? 'Avaliações' : 'Voltar')}
      <div className="progresso">
        {etapas.map((e, i) => (
          <span key={e} className={i < atual ? 'feito' : i === atual ? 'atual' : ''} />
        ))}
      </div>
      <p className="passo">
        Etapa {atual + 1} de 3 · {['Anamnese do idoso', 'Antropometria', 'Testes'][atual]}
      </p>

      {tela.nome === 'anamnese' && (
        <>
          <h1>Anamnese do idoso</h1>
          <FichaAnamnese
            avaliado={rascunho.avaliado}
            onAvaliado={(avaliado) => mudar({ avaliado })}
            nomes={nomes}
            anamnese={rascunho.anamnese}
            onAnamnese={(anamnese) => mudar({ anamnese })}
            antropometria={rascunho.antropometria}
            onAntropometria={(antropometria) => mudar({ antropometria })}
          />
          <button className="botao grande" disabled={!rascunho.avaliado.trim()} onClick={() => ir({ nome: 'antropometria' })}>
            Próximo: antropometria
          </button>
          {!rascunho.avaliado.trim() && <p className="dica-sec centro">Preencha o nome do avaliado para continuar.</p>}
        </>
      )}

      {tela.nome === 'antropometria' && (
        <>
          <h1>Antropometria{rascunho.avaliado.trim() ? ` de ${rascunho.avaliado.trim()}` : ''}</h1>
          <FichaAntropometria valor={rascunho.antropometria} onChange={(antropometria) => mudar({ antropometria })} idade={idade} sexo={sexo} />
          <button className="botao grande" onClick={() => ir({ nome: 'testes' })}>
            Próximo: testes
          </button>
        </>
      )}

      {tela.nome === 'testes' && (
        <>
          <h1>Testes de {rascunho.avaliado.split(' ')[0]}</h1>
          <p className="dica-sec">Faça os testes na ordem que quiser e pule os que não der. Cada um tem vídeo explicativo, cronômetro e contador.</p>
          <section className="cartao">
            <div className="opcoes">
              <button className="opcao" onClick={() => ir({ nome: 'berg' })}>
                <ItemLista titulo="Escala de Equilíbrio de Berg" sub="Equilíbrio · 14 itens de 0 a 4" feito={bergTexto(rascunho)} />
              </button>
              {TESTES.map((t) => {
                const r = rascunho.testes[t.id]
                const c = r ? classificar(t, r.valor, idade, sexo) : null
                return (
                  <button key={t.id} className="opcao" onClick={() => ir({ nome: 'teste', id: t.id })}>
                    <ItemLista titulo={t.nome} sub={t.mede} feito={r ? `${numero(r.valor, t.unidade === 's' ? 1 : 0)} ${t.unidade}` : null} status={c?.status} />
                  </button>
                )
              })}
            </div>
          </section>
          <button className="botao grande" onClick={concluir}>
            Ver resultado final
          </button>
          <button className="botao-sec" onClick={() => ir({ nome: 'anamnese' })}>
            Revisar anamnese
          </button>
          <AvisoTriagem />
        </>
      )}
    </div>
  )
}

function bergTexto(a: AvaliacaoIdoso) {
  const b = bergDe(a)
  return b ? `${b.total}/${MAXIMO_BERG}${b.faltam ? ` · faltam ${b.faltam}` : ''}` : null
}

function ItemLista({ titulo, sub, feito, status }: { titulo: string; sub: string; feito: string | null; status?: string }) {
  return (
    <span className="item-lista">
      <span className="item-lista-texto">
        <b>{titulo}</b>
        <span>{sub}</span>
      </span>
      {feito ? <span className={`chip chip-${status ?? 'ok'}`}>{feito}</span> : <span className="chip">Fazer</span>}
    </span>
  )
}

type PropsInicio = {
  lista: AvaliacaoIdoso[]
  rascunho: AvaliacaoIdoso | null
  onNova: () => void
  onContinuar: () => void
  onDescartar: () => void
  onAbrir: (id: string) => void
  onReavaliar: (a: AvaliacaoIdoso) => void
}

function Inicio({ lista, rascunho, onNova, onContinuar, onDescartar, onAbrir, onReavaliar }: PropsInicio) {
  const grupos = useMemo(() => avaliados(lista).map((n) => doAvaliado(lista, n)), [lista])
  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">
          <HeartPulse size={14} /> Terceira idade
        </span>
        <h1>Avaliação funcional do idoso</h1>
        <p className="dica-sec">
          Anamnese, antropometria com IMC automático, Escala de Equilíbrio de Berg e a bateria de testes funcionais (levantar e sentar, flexão de cotovelo, marcha
          estacionária, caminhada de 6 minutos, levantar-caminhar-sentar e flexibilidade). No fim, o resultado, a evolução em gráficos e os pontos de atenção.
        </p>
        {rascunho ? (
          <>
            <p className="mensagem ok">
              Avaliação em andamento{rascunho.avaliado ? ` de ${rascunho.avaliado}` : ''}.
            </p>
            <button className="botao grande" onClick={onContinuar}>
              Continuar avaliação
            </button>
            <button className="botao-sec" onClick={onDescartar}>
              Descartar e começar outra
            </button>
          </>
        ) : (
          <button className="botao grande" onClick={onNova}>
            Nova avaliação
          </button>
        )}
      </section>

      {grupos.length > 0 && <h2 className="secao">Avaliados</h2>}
      {grupos.map((g) => {
        const ultima = g[0]
        const imc = imcDe(ultima)
        const berg = bergDe(ultima)
        return (
          <section className="cartao" key={ultima.avaliado}>
            <div className="pessoa-topo">
              <div>
                <h3>{ultima.avaliado}</h3>
                <p className="dica-sec">
                  {g.length} {g.length === 1 ? 'avaliação' : 'avaliações'}
                  {imc !== null && ` · IMC ${numero(imc)}`}
                  {berg && berg.faltam === 0 && ` · Berg ${berg.total}/${MAXIMO_BERG}`}
                </p>
              </div>
            </div>
            <ul className="historico">
              {g.map((a, i) => (
                <li key={a.id}>
                  <button onClick={() => onAbrir(a.id)}>
                    <span>{dataCurta(a.date)}</span>
                    <span className="nota">{i === g.length - 1 ? 'Inicial' : 'Reavaliação'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!rascunho && (
              <button className="botao-sec" onClick={() => onReavaliar(ultima)} style={{ marginTop: 10 }}>
                Reavaliar
              </button>
            )}
          </section>
        )
      })}
      <AvisoTriagem />
    </>
  )
}
