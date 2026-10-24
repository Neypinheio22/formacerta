import { EnviarResultado } from '../conta/EnviarResultado'
import { useMemo, useState } from 'react'
import type { Point } from '../../pose/types'
import { apagar, atualizar, avaliados, carregar, doAvaliado, reduzirFoto, salvar } from '../../testes/historico'
import { CHAVE_FLEX, NIVEIS, alturasFlex, fotoFlexValida, infoNivel, medirFlex, type MedidaFlex, type NivelFlex, type RegistroFlex } from '../../testes/flexibilidade'
import { PosePhoto } from '../PosePhoto'
import { ComoFazerFlex } from './Ilustracoes'
import { AvisoTriagem, CampoAvaliado, CampoObservacoes, GraficoEvolucao, TirarFoto } from './comum'
import { dataCurta, numero } from '../../testes/formato'

type Tela = { nome: 'novo' } | { nome: 'historico' } | { nome: 'detalhe'; id: string }

type Foto = { image: string; width: number; height: number; landmarks: Point[] }

export function FlexTeste({ onVoltar }: { onVoltar: () => void }) {
  const [tela, setTela] = useState<Tela>({ nome: 'novo' })
  const [lista, setLista] = useState(() => carregar<RegistroFlex>(CHAVE_FLEX))
  const recarregar = () => setLista(carregar<RegistroFlex>(CHAVE_FLEX))
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
        <NovoFlex
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

function NovoFlex({ nomes, onSalvo }: { nomes: string[]; onSalvo: (r: RegistroFlex) => void }) {
  const [avaliado, setAvaliado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [foto, setFoto] = useState<(Foto & { medida: MedidaFlex }) | null>(null)
  const [ajuste, setAjuste] = useState<NivelFlex | null>(null)
  const [tirandoFoto, setTirandoFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const nivel = ajuste ?? foto?.medida.nivel
  const joelhoDobrado = !!foto && !foto.medida.joelhosOk
  const pronto = !!foto && !!nivel && avaliado.trim() !== '' && !(joelhoDobrado && observacoes.trim() === '')

  async function salvarTeste() {
    if (!foto || !nivel) return
    setSalvando(true)
    const { medida, ...f } = foto
    const r: RegistroFlex = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      avaliado: avaliado.trim(),
      observacoes: observacoes.trim(),
      nivel,
      nivelApp: medida.nivel,
      alcance: medida.alcance,
      joelho: medida.joelho,
      joelhosOk: medida.joelhosOk,
      foto: { ...f, image: await reduzirFoto(f.image) },
    }
    salvar(CHAVE_FLEX, r)
    onSalvo(r)
  }

  return (
    <>
      <section className="cartao destaque">
        <span className="etiqueta">Flexibilidade da cadeia posterior</span>
        <h1>Teste de Flexibilidade Digital</h1>
        <p className="dica-sec">
          Em pé, sem equipamento. A pessoa inclina o tronco com os joelhos esticados e o app vê, pela foto de lado, até onde as mãos chegam: joelho, canela,
          tornozelo ou chão.
        </p>
      </section>

      <ComoFazerFlex />

      <section className="cartao formulario">
        <CampoAvaliado valor={avaliado} onChange={setAvaliado} nomes={nomes} />
      </section>

      <section className="cartao">
        <h2>Foto da posição final</h2>
        {!foto && !tirandoFoto && (
          <>
            <p className="dica-sec">
              Celular de lado, na altura do quadril, a uns 2 a 3 metros, com o corpo inteiro e os pés na foto. Tire a foto quando a pessoa chegar ao limite
              confortável, sem balançar.
            </p>
            <button className="botao" onClick={() => setTirandoFoto(true)}>
              Tirar foto
            </button>
          </>
        )}
        {tirandoFoto && (
          <TirarFoto
            validar={fotoFlexValida}
            textoOk="Corpo de lado e inclinado"
            textoAviso="De lado, inclinado à frente, com mãos, joelhos e pés na foto"
            onCancelar={() => setTirandoFoto(false)}
            onFoto={(c) => {
              if (!c.landmarks) return
              const landmarks = c.landmarks.map(({ x, y, visibility }) => ({ x, y, visibility }))
              setFoto({ image: c.image, width: c.width, height: c.height, landmarks, medida: medirFlex(landmarks, c.width, c.height) })
              setAjuste(null)
              setTirandoFoto(false)
            }}
          />
        )}
        {foto && (
          <>
            <FotoMedida foto={foto} />
            <button className="botao-sec" onClick={() => setFoto(null)}>
              Refazer foto
            </button>
          </>
        )}
      </section>

      {foto && nivel && (
        <section className="cartao">
          <ResultadoFlex nivel={nivel} joelhosOk={foto.medida.joelhosOk} joelho={foto.medida.joelho} />
          <div className="campo">
            O nível não bateu com o que você viu? Ajuste:
            <div className="escolha niveis">
              {NIVEIS.map((n) => (
                <button key={n.nivel} className={nivel === n.nivel ? 'ativo' : ''} onClick={() => setAjuste(n.nivel === foto.medida.nivel ? null : n.nivel)}>
                  {n.nivel}
                </button>
              ))}
            </div>
          </div>
          {ajuste && <p className="dica-sec">O app achou “{foto.medida.nivel}”. Vai ficar salvo o nível que você escolheu.</p>}
        </section>
      )}

      <section className="cartao formulario">
        <CampoObservacoes valor={observacoes} onChange={setObservacoes} />
        {joelhoDobrado && observacoes.trim() === '' && <p className="dica-sec">Os joelhos dobraram na foto: repita o teste ou registre nas observações.</p>}
      </section>

      <button className="botao grande" disabled={!pronto || salvando} onClick={salvarTeste}>
        Salvar no histórico
      </button>
      {!foto && <p className="dica-sec centro">Tire a foto da posição final para ver a classificação.</p>}
      <AvisoTriagem />
    </>
  )
}

/** Foto com o esqueleto e as linhas do joelho, da canela, do tornozelo e do chão. */
function FotoMedida({ foto }: { foto: Foto }) {
  const a = alturasFlex(foto.landmarks)
  const { width: w, height: h } = foto
  const t = Math.max(w, h) / 26
  const linhas = [
    { y: a.joelho, rotulo: 'joelho' },
    { y: (a.joelho + a.tornozelo) / 2, rotulo: 'canela' },
    { y: a.tornozelo, rotulo: 'tornozelo' },
    { y: a.chao, rotulo: 'chão' },
  ]
  return (
    <PosePhoto {...foto}>
      <g className="linhas-flex" fontSize={t} strokeWidth={t / 7}>
        {linhas.map((l) => (
          <g key={l.rotulo}>
            <line x1={0} x2={w} y1={l.y * h} y2={l.y * h} stroke="#ffffff" strokeOpacity={0.75} strokeDasharray={`${t / 2} ${t / 3}`} />
            <text x={t / 3} y={l.y * h - t / 4} fill="#ffffff" stroke="#020B16" strokeWidth={t / 6} paintOrder="stroke">
              {l.rotulo}
            </text>
          </g>
        ))}
        <line x1={0} x2={w} y1={a.dedos * h} y2={a.dedos * h} stroke="#fb8d1a" strokeWidth={t / 4} />
        <text x={w - t / 3} y={a.dedos * h - t / 4} textAnchor="end" fill="#fb8d1a" stroke="#020B16" strokeWidth={t / 6} paintOrder="stroke" fontWeight={700}>
          mãos
        </text>
      </g>
    </PosePhoto>
  )
}

function ResultadoFlex({ nivel, joelhosOk, joelho }: { nivel: NivelFlex; joelhosOk: boolean; joelho: number }) {
  const info = infoNivel(nivel)
  return (
    <>
      <div className="resultado-teste">
        <span className="valor-grande texto">{nivel}</span>
        <span className={`chip chip-${info.status}`}>{info.onde}</span>
      </div>
      <p className="dica-sec">{info.dica}</p>
      <p className="dica-sec">
        Joelhos: <span className={`chip chip-${joelhosOk ? 'ok' : 'alerta'}`}>{joelhosOk ? 'esticados' : 'dobrados'}</span> ({numero(joelho)}° de dobra; vale até 15°)
      </p>
      <table className="tabela-classes">
        <caption>Classificação</caption>
        <tbody>
          {[...NIVEIS].reverse().map((n) => (
            <tr key={n.nivel} className={n.nivel === nivel ? 'atual' : ''}>
              <td>{n.nivel}</td>
              <td>{n.onde}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Historico({ lista, onAbrir }: { lista: RegistroFlex[]; onAbrir: (id: string) => void }) {
  const grupos = useMemo(() => avaliados(lista).map((n) => doAvaliado(lista, n)), [lista])
  return (
    <>
      <h1>Histórico do Teste de Flexibilidade Digital</h1>
      {grupos.length === 0 && <p className="dica-sec">Nenhum teste salvo ainda.</p>}
      {grupos.map((g) => (
        <section className="cartao" key={g[0].avaliado}>
          <h2>{g[0].avaliado}</h2>
          <ul className="historico">
            {g.map((r) => (
              <li key={r.id}>
                <button onClick={() => onAbrir(r.id)}>
                  <span>{dataCurta(r.date)}</span>
                  <span className="nota">{r.nivel}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

const ordemNivel = (n: NivelFlex) => NIVEIS.findIndex((x) => x.nivel === n) + 1

function Detalhe(props: { registro: RegistroFlex; doMesmo: RegistroFlex[]; onAbrir: (id: string) => void; onMudou: () => void; onApagado: () => void }) {
  const { registro: r, doMesmo } = props
  const [obs, setObs] = useState(r.observacoes)
  const primeiro = doMesmo[doMesmo.length - 1]
  const subiu = ordemNivel(r.nivel) - ordemNivel(primeiro.nivel)

  return (
    <>
      <h1>{r.avaliado}</h1>
      <p className="dica-sec">
        Teste de Flexibilidade Digital · {dataCurta(r.date)}
        {r.nivel !== r.nivelApp && ` · nível ajustado pelo profissional (o app achou “${r.nivelApp}”)`}
      </p>

      <section className="cartao">
        <ResultadoFlex nivel={r.nivel} joelhosOk={r.joelhosOk} joelho={r.joelho} />
      </section>

      <section className="cartao">
        <h2>Evolução da flexibilidade</h2>
        {doMesmo.length > 1 && primeiro.id !== r.id && (
          <p className="dica">
            {subiu > 0 ? `Subiu ${subiu} ${subiu === 1 ? 'nível' : 'níveis'}` : subiu < 0 ? `Caiu ${-subiu} ${subiu === -1 ? 'nível' : 'níveis'}` : 'Mesmo nível'} desde {dataCurta(primeiro.date)}.
          </p>
        )}
        <GraficoEvolucao
          unidade="alcance"
          pontos={doMesmo.map((x) => ({ date: x.date, valor: x.alcance, status: infoNivel(x.nivel).status }))}
          referencias={[
            { valor: 0, rotulo: 'joelho' },
            { valor: 100, rotulo: 'chão' },
          ]}
        />
        {doMesmo.length > 1 && (
          <ul className="historico">
            {doMesmo.map((x) => (
              <li key={x.id}>
                <button onClick={() => props.onAbrir(x.id)} className={x.id === r.id ? 'ativo' : ''}>
                  <span>{dataCurta(x.date)}</span>
                  <span className="nota">{x.nivel}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.foto && (
        <section className="cartao">
          <h2>Foto da posição final</h2>
          <FotoMedida foto={r.foto} />
        </section>
      )}

      <EnviarResultado tipo="flexibilidade" id={r.id} feitoEm={r.date} resultado={r} avaliado={r.avaliado} />

      <section className="cartao formulario">
        <CampoObservacoes valor={obs} onChange={setObs} />
        <button
          className="botao"
          disabled={obs === r.observacoes}
          onClick={() => {
            atualizar<RegistroFlex>(CHAVE_FLEX, r.id, { observacoes: obs.trim() })
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
          apagar(CHAVE_FLEX, r.id)
          props.onApagado()
        }}
      >
        Apagar teste
      </button>
      <AvisoTriagem />
    </>
  )
}
