import { useEffect, useMemo, useRef, useState } from 'react'
import { secao, nomeArquivo, nomeTeste, resumo, type ItemRelatorio, type Secao } from '../../relatorio/conteudo'
import { baixarPdf, compartilharPdf, gerarPdf, svgParaImagem, type Imagem } from '../../relatorio/pdf'
import { carregarProfissional, contato, perfilPreenchido } from '../../relatorio/profissional'
import { loadAssessments } from '../../storage'
import { CHAVE_ADAMS, type RegistroAdams } from '../../testes/adams'
import { CHAVE_FLEX, type RegistroFlex } from '../../testes/flexibilidade'
import { dataCurta } from '../../testes/formato'
import { avaliados, carregar } from '../../testes/historico'
import { PosePhoto } from '../PosePhoto'
import { FotoAdams } from '../testes/AdamsTeste'
import { FotoMedida } from '../testes/FlexTeste'
import { CampoAvaliado } from '../testes/comum'

type Props = {
  avaliadoInicial?: string
  marcados?: string[]
  textoVoltar?: string
  onVoltar: () => void
  onPerfil: () => void
}

const ORDEM: ItemRelatorio['tipo'][] = ['postura', 'flexibilidade', 'adams']

const nomeDo = (i: ItemRelatorio) => (i.tipo === 'postura' ? '' : i.registro.avaliado)
const mesmoNome = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

function carregarTodos(): ItemRelatorio[] {
  const itens: ItemRelatorio[] = [
    ...loadAssessments().map((registro) => ({ tipo: 'postura' as const, registro })),
    ...carregar<RegistroFlex>(CHAVE_FLEX).map((registro) => ({ tipo: 'flexibilidade' as const, registro })),
    ...carregar<RegistroAdams>(CHAVE_ADAMS).map((registro) => ({ tipo: 'adams' as const, registro })),
  ]
  return itens.sort((a, b) => b.registro.date.localeCompare(a.registro.date))
}

/** Escolhe os testes, mostra a folha do relatório e gera o PDF para imprimir ou enviar. */
export function Relatorio({ avaliadoInicial = '', marcados: marcadosIniciais = [], textoVoltar = 'Início', onVoltar, onPerfil }: Props) {
  const [todos] = useState(carregarTodos)
  const [profissional] = useState(carregarProfissional)
  const [avaliado, setAvaliado] = useState(avaliadoInicial)
  const [marcados, setMarcados] = useState(() => new Set(marcadosIniciais))
  const [conclusao, setConclusao] = useState('')
  const [data] = useState(() => new Date().toISOString())

  // Avaliações de postura não têm nome: aparecem sempre. Os testes com nome, só os do avaliado.
  const visiveis = useMemo(() => todos.filter((i) => i.tipo === 'postura' || !avaliado.trim() || mesmoNome(nomeDo(i), avaliado)), [todos, avaliado])
  const escolhidos = useMemo(
    () => visiveis.filter((i) => marcados.has(i.registro.id)).sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo)),
    [visiveis, marcados],
  )
  const secoes = useMemo(() => escolhidos.map((i) => ({ item: i, secao: secao(i, todos.filter((x) => nomeDo(i) && mesmoNome(nomeDo(x), nomeDo(i)))) })), [escolhidos, todos])

  // O nome do relatório vem do campo; se ficou vazio, usa o nome dos testes escolhidos.
  const nomeAvaliado = avaliado.trim() || escolhidos.map(nomeDo).find(Boolean) || ''

  function alternar(id: string) {
    const novo = new Set(marcados)
    if (novo.has(id)) novo.delete(id)
    else novo.add(id)
    setMarcados(novo)
  }

  // O PDF fica pronto antes do toque no botão: o iPhone só abre o compartilhar logo depois do toque.
  const folha = useRef<HTMLDivElement>(null)
  const fotosProntas = useRef(new Map<string, Imagem[]>())
  const [pdf, setPdf] = useState<{ blob: Blob; nome: string } | null>(null)
  const [gerando, setGerando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    setPdf(null)
    setAviso('')
    if (!secoes.length) return
    let cancelado = false
    const t = setTimeout(async () => {
      setGerando(true)
      try {
        const comFotos: (Secao & { fotos: Imagem[] })[] = []
        for (const { secao: s } of secoes) {
          let fotos = fotosProntas.current.get(s.id)
          if (!fotos) {
            const svgs = [...(folha.current?.querySelectorAll<SVGSVGElement>(`[data-secao="${s.id}"] .folha-fotos svg`) ?? [])]
            fotos = (await Promise.all(svgs.map((svg) => svgParaImagem(svg).catch(() => null)))).filter((f): f is Imagem => f !== null)
            fotosProntas.current.set(s.id, fotos)
          }
          comFotos.push({ ...s, fotos })
        }
        const blob = await gerarPdf({ profissional, avaliado: nomeAvaliado, data, conclusao, secoes: comFotos })
        if (!cancelado) setPdf({ blob, nome: nomeArquivo(nomeAvaliado) })
      } catch {
        if (!cancelado) setAviso('Não conseguimos montar o PDF. Use o botão Imprimir e escolha "Salvar como PDF".')
      }
      if (!cancelado) setGerando(false)
    }, 600)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [secoes, profissional, nomeAvaliado, data, conclusao])

  async function enviar() {
    if (!pdf) return
    const texto = `Relatório de avaliação${nomeAvaliado ? ` de ${nomeAvaliado}` : ''}${profissional.nome ? `, por ${profissional.nome}` : ''}.`
    const r = await compartilharPdf(pdf.blob, pdf.nome, texto)
    if (r === 'baixado') setAviso('Este aparelho não abre o compartilhar. O PDF foi baixado: anexe o arquivo no WhatsApp (ou WhatsApp Web).')
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← {textoVoltar}
        </button>
        <button className="voltar" onClick={onPerfil}>
          Meu perfil
        </button>
      </header>

      <section className="cartao destaque">
        <span className="etiqueta">Imprimir ou enviar</span>
        <h1>Relatório dos testes</h1>
        <p className="dica-sec">Escolha os testes do avaliado. O relatório sai com a sua logo, seu nome e o número de registro, pronto para imprimir, salvar em PDF ou mandar no WhatsApp.</p>
      </section>

      {!perfilPreenchido(profissional) && (
        <section className="cartao aviso-perfil">
          <p>Seu nome e o número de registro (CREF) ainda não estão no perfil. Eles saem no topo e na assinatura do relatório.</p>
          <button className="botao-sec" onClick={onPerfil}>
            Preencher perfil e logo
          </button>
        </section>
      )}

      <section className="cartao formulario">
        <CampoAvaliado valor={avaliado} onChange={setAvaliado} nomes={avaliados(todos.flatMap((i) => (i.tipo === 'postura' ? [] : [i.registro])))} />
        <div className="campo">
          Testes no relatório
          {visiveis.length === 0 && <p className="dica-sec">Nenhum teste salvo ainda. Faça e salve um teste para gerar o relatório.</p>}
          <ul className="lista-testes">
            {visiveis.map((i) => (
              <li key={i.registro.id}>
                <label>
                  <input type="checkbox" checked={marcados.has(i.registro.id)} onChange={() => alternar(i.registro.id)} />
                  <span>
                    <strong>{nomeTeste(i)}</strong>
                    <span className="dica-sec">
                      {dataCurta(i.registro.date)} · {resumo(i)}
                      {nomeDo(i) && !avaliado.trim() ? ` · ${nomeDo(i)}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <label className="campo">
          Conclusão e conduta (opcional)
          <textarea value={conclusao} onChange={(e) => setConclusao(e.target.value)} rows={4} placeholder="Ex.: priorizar mobilidade de quadril e fortalecimento de glúteos; reavaliar em 30 dias." />
        </label>
      </section>

      {secoes.length > 0 && (
        <>
          <div className="acoes-relatorio">
            <button className="botao grande" disabled={!pdf} onClick={enviar}>
              {pdf ? 'Enviar (WhatsApp, e-mail…)' : gerando ? 'Preparando o PDF…' : 'Enviar (WhatsApp, e-mail…)'}
            </button>
            <div className="acoes">
              <button className="botao-sec" disabled={!pdf} onClick={() => pdf && baixarPdf(pdf.blob, pdf.nome)}>
                Baixar PDF
              </button>
              <button className="botao-sec" onClick={() => window.print()}>
                Imprimir
              </button>
            </div>
            {aviso && <p className="dica-sec centro">{aviso}</p>}
          </div>

          <h2 className="secao">Prévia do relatório</h2>
          <div className="folha" ref={folha}>
            <header className="folha-topo">
              {profissional.logo && <img src={profissional.logo.image} alt="" />}
              <div>
                <strong className="folha-nome">{profissional.nome || 'Seu nome'}</strong>
                {profissional.profissao && <span>{profissional.profissao}</span>}
                <span className="folha-registro">{profissional.registro || 'Número de registro (CREF)'}</span>
                {contato(profissional) && <span>{contato(profissional)}</span>}
              </div>
            </header>
            <h1>Relatório de avaliação</h1>
            <p className="folha-avaliado">
              <span>Avaliado: {nomeAvaliado || '—'}</span>
              <span>Data: {dataCurta(data)}</span>
            </p>

            {secoes.map(({ item, secao: s }) => (
              <section key={s.id} data-secao={s.id} className="folha-secao">
                <h2>
                  {s.titulo}
                  <span>{dataCurta(s.data)}</span>
                </h2>
                <table>
                  <tbody>
                    {s.linhas.map((l, n) => (
                      <tr key={n}>
                        <td>{l.rotulo}</td>
                        <td className={l.status ? `st-${l.status}` : ''}>{l.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {s.textos.map((t) => (
                  <p key={t}>{t}</p>
                ))}
                {s.listas.map((l) => (
                  <div key={l.titulo}>
                    <h3>{l.titulo}</h3>
                    <ul>
                      {l.itens.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className={`folha-fotos fotos-${item.tipo}`}>
                  <FotosDoTeste item={item} />
                </div>
                {s.observacoes && (
                  <>
                    <h3>Observações do profissional</h3>
                    <p>{s.observacoes}</p>
                  </>
                )}
                <p className="folha-aviso">{s.aviso}</p>
              </section>
            ))}

            {conclusao.trim() && (
              <section className="folha-secao">
                <h2>Conclusão e conduta</h2>
                <p>{conclusao}</p>
              </section>
            )}

            <div className="folha-assinatura">
              <span />
              <strong>{profissional.nome || 'Seu nome'}</strong>
              {profissional.registro && <small>{profissional.registro}</small>}
            </div>
            <p className="folha-rodape">Relatório feito com o FormaCerta · triagem, não diagnóstico médico</p>
          </div>
        </>
      )}
    </div>
  )
}

function FotosDoTeste({ item }: { item: ItemRelatorio }) {
  if (item.tipo === 'postura') return item.registro.views.map((v) => <PosePhoto key={v.view} image={v.image} width={v.width} height={v.height} landmarks={v.landmarks} />)
  if (item.tipo === 'flexibilidade') return item.registro.foto ? <FotoMedida foto={item.registro.foto} /> : null
  return item.registro.foto ? <FotoAdams image={item.registro.foto.image} resultado={item.registro.foto.resultado} /> : null
}
