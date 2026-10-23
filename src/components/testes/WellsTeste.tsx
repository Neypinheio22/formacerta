import { useMemo, useState } from 'react'
import { LM, type Point } from '../../pose/types'
import { apagar, atualizar, avaliados, carregar, doAvaliado, reduzirFoto, salvar } from '../../testes/historico'
import { CHAVE_WELLS, MARCA_PADRAO, ajustarMarca, classificarWells, medirFotoWells, melhorTentativa, type RegistroWells, type Sexo } from '../../testes/wells'
import { PosePhoto } from '../PosePhoto'
import { ComoFazerWells } from './Ilustracoes'
import { AvisoTriagem, CampoAvaliado, CampoObservacoes, GraficoEvolucao, TirarFoto } from './comum'
import { dataCurta, lerNumero, numero } from '../../testes/formato'

type Tela = { nome: 'novo' } | { nome: 'historico' } | { nome: 'detalhe'; id: string }

// Sentado de lado: ombro, quadril, joelho e tornozelo de um dos lados à vista.
function ladoVisivel(lm: Point[]) {
  const ok = (ids: number[]) => ids.every((i) => (lm[i].visibility ?? 1) > 0.5 && lm[i].x > 0 && lm[i].x < 1 && lm[i].y > 0 && lm[i].y < 1)
  return ok([LM.ombroEsq, LM.quadrilEsq, LM.joelhoEsq, LM.tornozeloEsq]) || ok([LM.ombroDir, LM.quadrilDir, LM.joelhoDir, LM.tornozeloDir])
}

export function WellsTeste({ onVoltar }: { onVoltar: () => void }) {
  const [tela, setTela] = useState<Tela>({ nome: 'novo' })
  const [lista, setLista] = useState(() => carregar<RegistroWells>(CHAVE_WELLS))
  const recarregar = () => setLista(carregar<RegistroWells>(CHAVE_WELLS))
  const ir = (t: Tela) => {
    setTela(t)
    window.scrollTo(0, 0)
  }

  const registro = tela.nome === 'detalhe' ? lista.find((r) => r.id === tela.id) : undefined

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={tela.nome === 'novo' ? onVoltar : () => ir({ nome: 'novo' })}>
          ← {tela.nome === 'novo' ? 'Início' : 'Novo teste'}
        </button>
        {tela.nome !== 'historico' && lista.length > 0 && (
          <button className="voltar" onClick={() => ir({ nome: 'historico' })}>
            Histórico ({lista.length})
          </button>
        )}
      </header>

      {tela.nome === 'novo' && (
        <NovoWells
          nomes={avaliados(lista)}
          onSalvo={(r) => {
            recarregar()
            ir({ nome: 'detalhe', id: r.id })
          }}
        />
      )}
      {tela.nome === 'historico' && <Historico lista={lista} onAbrir={(id) => ir({ nome: 'detalhe', id })} />}
      {tela.nome === 'detalhe' && registro && (
        <Detalhe
          key={registro.id}
          registro={registro}
          doMesmo={doAvaliado(lista, registro.avaliado)}
          onAbrir={(id) => ir({ nome: 'detalhe', id })}
          onMudou={recarregar}
          onApagado={() => {
            recarregar()
            ir({ nome: 'historico' })
          }}
        />
      )}
    </div>
  )
}

function NovoWells({ nomes, onSalvo }: { nomes: string[]; onSalvo: (r: RegistroWells) => void }) {
  const [avaliado, setAvaliado] = useState('')
  const [sexo, setSexo] = useState<Sexo | null>(null)
  const [idade, setIdade] = useState('')
  const [marca, setMarca] = useState(String(MARCA_PADRAO))
  const [tentativas, setTentativas] = useState(['', '', ''])
  const [observacoes, setObservacoes] = useState('')
  const [foto, setFoto] = useState<RegistroWells['foto'] | null>(null)
  const [tirandoFoto, setTirandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const valores = tentativas.map(lerNumero).filter((v): v is number => v !== null)
  const idadeN = lerNumero(idade)
  const marcaN = lerNumero(marca) ?? MARCA_PADRAO
  const resultado = valores.length ? ajustarMarca(melhorTentativa(valores), marcaN) : null
  const classe = resultado !== null && sexo && idadeN ? classificarWells(resultado, sexo, idadeN) : null
  const pronto = !!classe && avaliado.trim() !== '' && !(foto && !foto.joelhosOk && observacoes.trim() === '')

  async function salvarTeste() {
    if (!classe || resultado === null || !sexo || !idadeN) return
    setSalvando(true)
    const r: RegistroWells = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      avaliado: avaliado.trim(),
      observacoes: observacoes.trim(),
      sexo,
      idade: idadeN,
      marcaPes: marcaN,
      tentativas: valores,
      resultado,
      classe: classe.classe,
      foto: foto ? { ...foto, image: await reduzirFoto(foto.image) } : undefined,
    }
    salvar(CHAVE_WELLS, r)
    onSalvo(r)
  }

  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">Flexibilidade da cadeia posterior</span>
        <h1>Banco de Wells</h1>
        <p className="dica-sec">
          Sentado, pés descalços apoiados no banco e joelhos esticados. Com uma mão sobre a outra, deslize o mais longe possível e segure 2 segundos. Faça 3
          tentativas: vale a melhor.
        </p>
      </section>

      <ComoFazerWells />

      <section className="cartao formulario">
        <CampoAvaliado valor={avaliado} onChange={setAvaliado} nomes={nomes} />
        <div className="campo">
          Sexo
          <div className="escolha">
            {(['F', 'M'] as const).map((s) => (
              <button key={s} className={sexo === s ? 'ativo' : ''} onClick={() => setSexo(s)}>
                {s === 'F' ? 'Feminino' : 'Masculino'}
              </button>
            ))}
          </div>
        </div>
        <div className="linha-campos">
          <label className="campo">
            Idade
            <input inputMode="numeric" value={idade} onChange={(e) => setIdade(e.target.value)} placeholder="anos" />
          </label>
          <label className="campo">
            Marca dos pés no banco
            <input inputMode="decimal" value={marca} onChange={(e) => setMarca(e.target.value)} />
          </label>
        </div>
        <div className="campo">
          Alcance em cada tentativa (cm)
          <div className="linha-campos tres">
            {tentativas.map((t, i) => (
              <input
                key={i}
                inputMode="decimal"
                value={t}
                placeholder={`${i + 1}ª`}
                aria-label={`Tentativa ${i + 1}`}
                onChange={(e) => setTentativas(tentativas.map((x, k) => (k === i ? e.target.value : x)))}
              />
            ))}
          </div>
        </div>
        {marcaN !== MARCA_PADRAO && <p className="dica-sec">A leitura é convertida para a escala da tabela (pés na marca de {MARCA_PADRAO} cm).</p>}
      </section>

      <section className="cartao">
        <h2>Foto da posição final (opcional)</h2>
        {!foto && !tirandoFoto && (
          <>
            <p className="dica-sec">Celular de lado, a uns 2 metros. A foto mede o ângulo entre o tronco e a coxa e confere se os joelhos ficaram esticados.</p>
            <button className="botao-sec" onClick={() => setTirandoFoto(true)}>
              Tirar foto
            </button>
          </>
        )}
        {tirandoFoto && (
          <TirarFoto
            validar={ladoVisivel}
            textoOk="Tronco e pernas visíveis"
            textoAviso="Mostre de lado o tronco, o quadril, o joelho e o tornozelo"
            onCancelar={() => setTirandoFoto(false)}
            onFoto={(c) => {
              if (!c.landmarks) return
              setFoto({ image: c.image, width: c.width, height: c.height, landmarks: c.landmarks.map(({ x, y, visibility }) => ({ x, y, visibility })), ...medirFotoWells(c.landmarks, c.width, c.height) })
              setTirandoFoto(false)
            }}
          />
        )}
        {foto && (
          <>
            <MedidasFoto foto={foto} />
            <button className="botao-sec" onClick={() => setFoto(null)}>
              Remover foto
            </button>
          </>
        )}
      </section>

      {classe && resultado !== null && (
        <section className="cartao">
          <ResultadoWells resultado={resultado} classe={classe} />
        </section>
      )}

      <section className="cartao formulario">
        <CampoObservacoes valor={observacoes} onChange={setObservacoes} />
        {foto && !foto.joelhosOk && observacoes.trim() === '' && <p className="dica-sec">Os joelhos dobraram na foto: repita o teste ou registre nas observações.</p>}
      </section>

      <button className="botao grande" disabled={!pronto || salvando} onClick={salvarTeste}>
        Salvar no histórico
      </button>
      {!classe && <p className="dica-sec centro">Preencha sexo, idade e pelo menos uma tentativa para ver a classificação.</p>}
      <AvisoTriagem />
    </>
  )
}

function ResultadoWells({ resultado, classe }: { resultado: number; classe: ReturnType<typeof classificarWells> }) {
  return (
    <>
      <div className="resultado-teste">
        <span className="valor-grande">
          {numero(resultado)} <small>cm</small>
        </span>
        <span className={`chip chip-${classe.status}`}>{classe.classe}</span>
      </div>
      {classe.proximaClasse && (
        <p className="dica-sec">
          Faltam {numero(classe.faltam)} cm para chegar a “{classe.proximaClasse}”.
        </p>
      )}
      <table className="tabela-classes">
        <caption>Referência para {classe.faixa}</caption>
        <tbody>
          {classe.limites.map((l) => (
            <tr key={l.classe} className={l.classe === classe.classe ? 'atual' : ''}>
              <td>{l.classe}</td>
              <td>{l.texto}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {classe.foraDaTabela && <p className="dica-sec">A tabela vai de 15 a 69 anos. Para esta idade usamos a faixa mais próxima.</p>}
    </>
  )
}

function MedidasFoto({ foto }: { foto: NonNullable<RegistroWells['foto']> }) {
  return (
    <div className="vista">
      <PosePhoto image={foto.image} width={foto.width} height={foto.height} landmarks={foto.landmarks} />
      <ul className="achados">
        <li>
          <div className="achado-topo">
            <strong>Ângulo tronco-coxa</strong>
            <span className="valor">{numero(foto.quadril)}°</span>
          </div>
          <span className="achado-detalhe">Quanto menor, mais o quadril dobrou.</span>
        </li>
        <li>
          <div className="achado-topo">
            <strong>Joelhos</strong>
            <span className={`chip chip-${foto.joelhosOk ? 'ok' : 'alerta'}`}>{foto.joelhosOk ? 'Esticados' : 'Dobrados'}</span>
          </div>
          <span className="achado-detalhe">
            {foto.joelhosOk ? 'Posição válida.' : 'O joelho dobrou'} <span className="valor">{numero(foto.joelho)}°</span>
          </span>
        </li>
      </ul>
    </div>
  )
}

function Historico({ lista, onAbrir }: { lista: RegistroWells[]; onAbrir: (id: string) => void }) {
  const grupos = useMemo(() => avaliados(lista).map((n) => doAvaliado(lista, n)), [lista])
  return (
    <>
      <h1>Histórico do Banco de Wells</h1>
      {grupos.length === 0 && <p className="dica-sec">Nenhum teste salvo ainda.</p>}
      {grupos.map((g) => (
        <section className="cartao" key={g[0].avaliado}>
          <h2>{g[0].avaliado}</h2>
          <ul className="historico">
            {g.map((r) => (
              <li key={r.id}>
                <button onClick={() => onAbrir(r.id)}>
                  <span>{dataCurta(r.date)}</span>
                  <span className="nota">
                    {numero(r.resultado)} cm · {r.classe}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function Detalhe(props: { registro: RegistroWells; doMesmo: RegistroWells[]; onAbrir: (id: string) => void; onMudou: () => void; onApagado: () => void }) {
  const { registro: r, doMesmo } = props
  const [obs, setObs] = useState(r.observacoes)
  const classe = classificarWells(r.resultado, r.sexo, r.idade)
  const primeiro = doMesmo[doMesmo.length - 1]
  const ganho = r.resultado - primeiro.resultado

  return (
    <>
      <h1>{r.avaliado}</h1>
      <p className="dica-sec">
        Banco de Wells · {dataCurta(r.date)} · {r.sexo === 'F' ? 'feminino' : 'masculino'}, {r.idade} anos · tentativas: {r.tentativas.map((t) => numero(t)).join(' / ')} cm
      </p>

      <section className="cartao">
        <ResultadoWells resultado={r.resultado} classe={classe} />
      </section>

      <section className="cartao">
        <h2>Evolução da flexibilidade</h2>
        {doMesmo.length > 1 && primeiro.id !== r.id && (
          <p className="dica">
            {ganho >= 0 ? 'Ganhou' : 'Perdeu'} {numero(Math.abs(ganho))} cm desde {dataCurta(primeiro.date)}.
          </p>
        )}
        <GraficoEvolucao
          unidade="cm"
          pontos={doMesmo.map((x) => ({ date: x.date, valor: x.resultado, status: classificarWells(x.resultado, x.sexo, x.idade).status }))}
          referencias={[{ valor: classe.minimoMedia, rotulo: 'início da média' }]}
        />
        {doMesmo.length > 1 && (
          <ul className="historico">
            {doMesmo.map((x) => (
              <li key={x.id}>
                <button onClick={() => props.onAbrir(x.id)} className={x.id === r.id ? 'ativo' : ''}>
                  <span>{dataCurta(x.date)}</span>
                  <span className="nota">
                    {numero(x.resultado)} cm · {x.classe}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.foto && (
        <section className="cartao">
          <h2>Foto da posição final</h2>
          <MedidasFoto foto={r.foto} />
        </section>
      )}

      <section className="cartao formulario">
        <CampoObservacoes valor={obs} onChange={setObs} />
        <button
          className="botao"
          disabled={obs === r.observacoes}
          onClick={() => {
            atualizar<RegistroWells>(CHAVE_WELLS, r.id, { observacoes: obs.trim() })
            props.onMudou()
          }}
        >
          Salvar observações
        </button>
      </section>

      <button
        className="botao-sec perigo"
        onClick={() => {
          if (!confirm('Apagar este teste do histórico?')) return
          apagar(CHAVE_WELLS, r.id)
          props.onApagado()
        }}
      >
        Apagar teste
      </button>
      <AvisoTriagem />
    </>
  )
}
