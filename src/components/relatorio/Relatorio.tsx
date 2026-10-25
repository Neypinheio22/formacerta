import { FileText, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { linkWhatsApp, telefoneGuardado } from '../../compartilhar/whatsapp'
import { secao, nomeArquivo, nomeTeste, resumo, type ItemRelatorio, type Secao } from '../../relatorio/conteudo'
import { useConta } from '../../nuvem/conta'
import { baixarPdf, compartilharPdf, gerarPdf, svgParaImagem, type Imagem, type ModoRelatorio } from '../../relatorio/pdf'
import { carregarProfissional, contato, perfilPreenchido } from '../../relatorio/profissional'
import { loadAssessments } from '../../storage'
import { CHAVE_IDOSO, type AvaliacaoIdoso } from '../../idoso/tipos'
import { CHAVE_ADAMS, type RegistroAdams } from '../../testes/adams'
import { CHAVE_FLEX, type RegistroFlex } from '../../testes/flexibilidade'
import { dataCurta } from '../../testes/formato'
import { avaliados, carregar } from '../../testes/historico'
import { Logo } from '../Logo'
import { VIEWS } from '../../pose/types'
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

const ORDEM: ItemRelatorio['tipo'][] = ['idoso', 'postura', 'flexibilidade', 'adams']

const nomeDo = (i: ItemRelatorio) => (i.tipo === 'postura' ? '' : i.registro.avaliado)
const mesmoNome = (a: string, b: string) => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

function carregarTodos(): ItemRelatorio[] {
  const itens: ItemRelatorio[] = [
    ...loadAssessments().map((registro) => ({ tipo: 'postura' as const, registro })),
    ...carregar<RegistroFlex>(CHAVE_FLEX).map((registro) => ({ tipo: 'flexibilidade' as const, registro })),
    ...carregar<RegistroAdams>(CHAVE_ADAMS).map((registro) => ({ tipo: 'adams' as const, registro })),
    ...carregar<AvaliacaoIdoso>(CHAVE_IDOSO).map((registro) => ({ tipo: 'idoso' as const, registro })),
  ]
  return itens.sort((a, b) => b.registro.date.localeCompare(a.registro.date))
}

/** Escolhe os testes, mostra a folha do relatório e gera o PDF para imprimir ou enviar. */
export function Relatorio({ avaliadoInicial = '', marcados: marcadosIniciais = [], textoVoltar = 'Início', onVoltar, onPerfil }: Props) {
  const [todos] = useState(carregarTodos)
  const [profissional] = useState(carregarProfissional)
  const { perfil } = useConta()
  // O aluno só manda o relatório dele, sem dados de profissional.
  const ehAluno = perfil?.papel === 'aluno'
  const [modoEscolhido, setModo] = useState<ModoRelatorio>(ehAluno ? 'aluno' : 'personal')
  const modo: ModoRelatorio = ehAluno ? 'aluno' : modoEscolhido
  const doPersonal = modo === 'personal'
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
  const [baixado, setBaixado] = useState(false)

  useEffect(() => {
    setPdf(null)
    setAviso('')
    setBaixado(false)
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
            const legenda = (svg: SVGSVGElement) => svg.closest<HTMLElement>('[data-legenda]')?.dataset.legenda
            fotos = (await Promise.all(svgs.map((svg) => svgParaImagem(svg).then((f): Imagem => ({ ...f, legenda: legenda(svg) }), () => null)))).filter(
              (f): f is Imagem => f !== null,
            )
            fotosProntas.current.set(s.id, fotos)
          }
          comFotos.push({ ...s, fotos })
        }
        const blob = await gerarPdf({ modo, profissional, avaliado: nomeAvaliado, data, conclusao, secoes: comFotos })
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
  }, [secoes, modo, profissional, nomeAvaliado, data, conclusao])

  const textoEnvio = doPersonal
    ? `Olá${nomeAvaliado ? `, ${nomeAvaliado.split(' ')[0]}` : ''}! Segue o seu relatório de avaliação FormaCerta${profissional.nome ? `, por ${profissional.nome}` : ''}.`
    : `Olá! Segue o meu relatório de avaliação do FormaCerta${nomeAvaliado ? ` (${nomeAvaliado})` : ''}, com as fotos e os resultados, para você analisar.`

  async function enviar() {
    if (!pdf) return
    const r = await compartilharPdf(pdf.blob, pdf.nome, textoEnvio)
    if (r === 'baixado') {
      setBaixado(true)
      setAviso('Este aparelho não abre o compartilhar com arquivo. O PDF foi baixado: abra o WhatsApp abaixo e anexe o arquivo na conversa (clipe 📎 > Documento).')
    }
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← {textoVoltar}
        </button>
        {doPersonal && (
          <button className="voltar" onClick={onPerfil}>
            Meu perfil
          </button>
        )}
      </header>

      <section className="cartao destaque">
        <span className="etiqueta">Imprimir ou enviar</span>
        <h1>Relatório dos testes</h1>
        <p className="dica-sec">
          {doPersonal
            ? 'Escolha os testes do avaliado. O relatório sai com a sua logo, seu nome e o número de registro, pronto para imprimir, salvar em PDF ou mandar no WhatsApp.'
            : 'Escolha os testes. O relatório sai só com os dados do aluno, as fotos e os resultados, para mandar a um profissional qualificado analisar.'}
        </p>
        {!ehAluno && (
          <div className="escolha-modo" role="radiogroup" aria-label="Quem está enviando">
            <button role="radio" aria-checked={doPersonal} className={doPersonal ? 'ativo' : ''} onClick={() => setModo('personal')}>
              <strong>Enviar como personal</strong>
              <span>Com a sua logo, nome e CREF</span>
            </button>
            <button role="radio" aria-checked={!doPersonal} className={!doPersonal ? 'ativo' : ''} onClick={() => setModo('aluno')}>
              <strong>Enviar como aluno</strong>
              <span>Só os dados do aluno</span>
            </button>
          </div>
        )}
      </section>

      {doPersonal && !perfilPreenchido(profissional) && (
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
          {doPersonal ? 'Conclusão e conduta (opcional)' : 'Observações do aluno (opcional)'}
          <textarea
            value={conclusao}
            onChange={(e) => setConclusao(e.target.value)}
            rows={4}
            placeholder={doPersonal ? 'Ex.: priorizar mobilidade de quadril e fortalecimento de glúteos; reavaliar em 30 dias.' : 'Ex.: sinto dor no ombro direito ao levantar o braço.'}
          />
        </label>
      </section>

      {secoes.length > 0 && (
        <>
          <div className="acoes-relatorio">
            <button className="botao grande botao-whatsapp" disabled={!pdf} onClick={enviar}>
              <FileText size={20} /> {!pdf && gerando ? 'Preparando o PDF…' : 'Enviar PDF pelo WhatsApp'}
            </button>
            {!baixado && <p className="dica-sec centro">Ao tocar, escolha WhatsApp e depois a conversa. Também dá para mandar por e-mail.</p>}
            {baixado && (
              <a className="botao botao-whatsapp" href={linkWhatsApp(textoEnvio, telefoneGuardado(nomeAvaliado))} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={20} /> Abrir o WhatsApp
              </a>
            )}
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
            <div className="folha-marca">
              <Logo size={20} />
              <span>Treine certo. Evolua sempre.</span>
            </div>
            {doPersonal && (
              <header className="folha-topo">
                {profissional.logo && <img src={profissional.logo.image} alt="" />}
                <div>
                  <strong className="folha-nome">{profissional.nome || 'Seu nome'}</strong>
                  {profissional.profissao && <span>{profissional.profissao}</span>}
                  <span className="folha-registro">{profissional.registro || 'Número de registro (CREF)'}</span>
                  {contato(profissional) && <span>{contato(profissional)}</span>}
                </div>
              </header>
            )}
            <h1>{doPersonal ? 'Relatório de avaliação' : 'Relatório do aluno'}</h1>
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
                    <h3>{doPersonal ? 'Observações do profissional' : 'Observações'}</h3>
                    <p>{s.observacoes}</p>
                  </>
                )}
                <p className="folha-aviso">{s.aviso}</p>
              </section>
            ))}

            {conclusao.trim() && (
              <section className="folha-secao">
                <h2>{doPersonal ? 'Conclusão e conduta' : 'Observações do aluno'}</h2>
                <p>{conclusao}</p>
              </section>
            )}

            {!doPersonal && (
              <p className="folha-aviso">Relatório gerado pelo próprio aluno no FormaCerta, para ser analisado por um profissional qualificado (educação física, fisioterapia ou medicina).</p>
            )}
            <div className="folha-assinatura">
              <span />
              <strong>{doPersonal ? profissional.nome || 'Seu nome' : 'Profissional responsável e registro'}</strong>
              {doPersonal && profissional.registro && <small>{profissional.registro}</small>}
            </div>
            <p className="folha-rodape">Relatório feito com o FormaCerta · triagem, não diagnóstico médico</p>
          </div>
        </>
      )}
    </div>
  )
}

function FotosDoTeste({ item }: { item: ItemRelatorio }) {
  if (item.tipo === 'postura')
    return item.registro.views.map((v) => {
      const legenda = VIEWS.find((x) => x.id === v.view)?.label ?? v.view
      return (
        <figure key={v.view} data-legenda={legenda}>
          <PosePhoto image={v.image} width={v.width} height={v.height} landmarks={v.landmarks} />
          <figcaption>{legenda}</figcaption>
        </figure>
      )
    })
  if (item.tipo === 'flexibilidade') return item.registro.foto ? <FotoMedida foto={item.registro.foto} /> : null
  if (item.tipo === 'idoso') return null
  return item.registro.foto ? <FotoAdams image={item.registro.foto.image} resultado={item.registro.foto.resultado} /> : null
}
