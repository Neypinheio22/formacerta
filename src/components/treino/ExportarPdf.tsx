import { Download, Eye, FileText, Mail, MessageCircle, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { linkWhatsApp } from '../../compartilhar/whatsapp'
import { useConta } from '../../nuvem/conta'
import type { Ficha } from '../../nuvem/fichas'
import { listarOrientacoes, rotuloOrientacao } from '../../nuvem/orientacoes'
import { emailDoAluno, listarAerobicos, personalDaFicha, type Rotina } from '../../nuvem/rotinas'
import type { Treino } from '../../nuvem/treinos'
import { baixarPdf, type Imagem } from '../../relatorio/pdf'
import { carregarProfissional, contato, registroCompleto } from '../../relatorio/profissional'
import { comoFazerDe, type ExercicioProprio } from '../../treino/comoFazer'
import { exercicioPdf, gerarFichaPdf, nomeArquivoFicha, registroComConselho, tituloFicha, type DadosFichaPdf } from '../../treino/fichaPdf'
import { imagemDeEndereco, imagemDoExercicio, videoDoExercicio } from '../../treino/imagensPdf'
import { resumoAerobico, rotuloNivel, rotuloTipo } from '../../treino/rotinas'
import { diaLocal } from '../../treino/semana'

const CHAVE_IMAGENS = 'formacerta:pdf-imagens'

function lerImagens(): boolean {
  try {
    return localStorage.getItem(CHAVE_IMAGENS) !== 'nao'
  } catch {
    return true
  }
}

type Personal = DadosFichaPdf['personal']

type Pronto = { pdf: Blob; nome: string; titulo: string; paginas: number; url: string }

type Props = {
  rotina: Rotina
  treinos: Treino[]
  ficha: Pick<Ficha, 'id' | 'nome' | 'telefone' | 'aluno_id' | 'profissional_id'>
  /** Quem está exportando: o personal (com os dados do perfil dele) ou o próprio aluno. */
  quem: 'personal' | 'aluno'
  /** Treino que já vem escolhido em "Treino atual". */
  letraInicial?: string
  exercicios: ExercicioProprio[]
  onFechar: () => void
}

/**
 * Janela de exportar a ficha em PDF, como no MFIT: incluir ou não as imagens,
 * "Treino atual" (um treino só) ou "Rotina completa" (todos, na ordem do
 * personal). Depois de pronto: ver, baixar, mandar pelo WhatsApp ou por e-mail.
 */
export function ExportarPdf({ rotina, treinos, ficha, quem, letraInicial, exercicios, onFechar }: Props) {
  const { perfil } = useConta()
  const ordem = useMemo(() => [...treinos].sort((a, b) => a.letra.localeCompare(b.letra)), [treinos])
  const [imagens, setImagens] = useState(lerImagens)
  const [letra, setLetra] = useState(letraInicial && ordem.some((t) => t.letra === letraInicial) ? letraInicial : (ordem[0]?.letra ?? 'A'))
  const [ajustes, setAjustes] = useState(false)
  const [elaborada, setElaborada] = useState(() => diaLocal(rotina.criado_em))
  const [validade, setValidade] = useState(rotina.fim ?? '')
  const [comOrientacoes, setComOrientacoes] = useState(true)
  const [comAerobico, setComAerobico] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [orientacoes, setOrientacoes] = useState<{ rotulo: string; texto: string }[]>([])
  const [aerobicos, setAerobicos] = useState<DadosFichaPdf['aerobicos']>([])
  const [personal, setPersonal] = useState<Personal | null>(null)
  const [email, setEmail] = useState('')
  const [gerando, setGerando] = useState<'treino' | 'rotina' | null>(null)
  const [pronto, setPronto] = useState<Pronto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const logo = useRef<Promise<Imagem | null> | null>(null)
  const profissionalId = ficha.profissional_id ?? (quem === 'personal' ? perfil?.id : null) ?? null

  // Orientações (só as que o aluno vê), aeróbico ativo, dados do personal e e-mail.
  useEffect(() => {
    let vivo = true
    listarOrientacoes(ficha.id).then((r) => vivo && setOrientacoes(r.lista.filter((o) => !o.so_personal).map((o) => ({ rotulo: rotuloOrientacao(o.tipo), texto: o.texto }))))
    listarAerobicos(ficha.id).then(
      (r) =>
        vivo &&
        setAerobicos(
          r.lista
            .filter((a) => a.situacao === 'ativa')
            .map((a) => ({ titulo: a.tipo, texto: resumoAerobico({ ...a, tipo: '' }), obs: a.observacoes })),
        ),
    )
    ;(async () => {
      if (quem === 'personal') {
        const p = carregarProfissional()
        const nome = p.nome.trim() || perfil?.nome || ''
        const registro = registroCompleto(p) || registroComConselho(perfil?.registro ?? '')
        const cont = contato(p) || [perfil?.whatsapp, perfil?.cidade].filter(Boolean).join(' · ')
        logo.current = p.logo ? Promise.resolve(p.logo) : perfil?.foto_url ? imagemDeEndereco(perfil.foto_url, 400, true) : Promise.resolve(null)
        if (vivo) setPersonal({ nome, registro, contato: cont })
        const e = await emailDoAluno(ficha.aluno_id)
        if (vivo) setEmail(e)
      } else {
        const p = await personalDaFicha(profissionalId)
        logo.current = p?.foto_url ? imagemDeEndereco(p.foto_url, 400, true) : Promise.resolve(null)
        if (vivo) setPersonal({ nome: p?.nome ?? '', registro: registroComConselho(p?.registro ?? ''), contato: [p?.whatsapp, p?.email, p?.cidade].filter(Boolean).join(' · ') })
        if (vivo) setEmail(perfil?.email ?? '')
      }
    })()
    return () => {
      vivo = false
    }
  }, [ficha.id, ficha.aluno_id, quem, perfil, profissionalId])

  // Fecha com Esc e não deixa a página de trás rolar.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', esc)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = antes
    }
  }, [onFechar])

  useEffect(() => () => {
    if (pronto) URL.revokeObjectURL(pronto.url)
  }, [pronto])

  function mudarImagens(v: boolean) {
    setImagens(v)
    try {
      localStorage.setItem(CHAVE_IMAGENS, v ? 'sim' : 'nao')
    } catch {
      /* ignora */
    }
  }

  async function gerar(tipo: 'treino' | 'rotina') {
    setErro(null)
    setAviso(null)
    setGerando(tipo)
    try {
      const lista = tipo === 'treino' ? ordem.filter((t) => t.letra === letra) : ordem
      const treinosPdf = await Promise.all(
        lista.map(async (t) => ({
          letra: t.letra,
          nome: t.nome,
          foco: t.foco ?? '',
          exercicios: await Promise.all(
            t.exercicios.map(async (e) => {
              const m = comoFazerDe(exercicios, e.nome, profissionalId)
              return exercicioPdf(e, { imagem: imagens ? await imagemDoExercicio(m) : null, video: videoDoExercicio(m) })
            }),
          ),
        })),
      )
      const dados: DadosFichaPdf = {
        tipo,
        aluno: ficha.nome,
        personal: { ...(personal ?? { nome: '', registro: '', contato: '' }), logo: logo.current ? await logo.current : null },
        rotina: { nome: rotina.nome, objetivo: rotina.objetivo, nivel: rotuloNivel(rotina.nivel), tipo: rotuloTipo(rotina.icone, rotina.objetivo) },
        elaborada,
        validade,
        orientacoes: comOrientacoes ? orientacoes : [],
        observacoes,
        treinos: treinosPdf,
        aerobicos: tipo === 'rotina' && comAerobico ? aerobicos : [],
        geradoEm: new Date(),
      }
      const { pdf, paginas } = await gerarFichaPdf(dados)
      if (pronto) URL.revokeObjectURL(pronto.url)
      setPronto({ pdf, paginas, nome: nomeArquivoFicha(dados), titulo: tituloFicha(dados), url: URL.createObjectURL(pdf) })
    } catch (e) {
      setErro(`Não deu para montar o PDF agora. ${(e as Error).message ?? ''}`.trim())
    } finally {
      setGerando(null)
    }
  }

  const primeiro = ficha.nome.split(' ')[0]
  const textoEnvio = pronto
    ? quem === 'personal'
      ? `Olá, ${primeiro}! Segue a sua ficha de treino em PDF: ${pronto.titulo} (${rotina.nome}). Bons treinos!${personal?.nome ? `\n${personal.nome}` : ''}`
      : `Minha ficha de treino em PDF: ${pronto.titulo} (${rotina.nome}).`
    : ''

  /** Folha de compartilhar do celular com o arquivo. Devolve false quando o aparelho não tem. */
  async function compartilhar(titulo: string): Promise<boolean | 'cancelou'> {
    if (!pronto) return false
    const arquivo = new File([pronto.pdf], pronto.nome, { type: 'application/pdf' })
    if (!navigator.canShare?.({ files: [arquivo] })) return false
    try {
      await navigator.share({ files: [arquivo], title: titulo, text: textoEnvio })
      return true
    } catch (e) {
      return (e as Error).name === 'AbortError' ? 'cancelou' : false
    }
  }

  async function whatsapp() {
    if (!pronto) return
    setAviso(null)
    const r = await compartilhar(pronto.titulo)
    if (r === true) return setAviso('Pronto! Escolha a conversa no WhatsApp.')
    if (r === 'cancelou') return
    // Computador: baixa o PDF e abre o WhatsApp com a mensagem; o arquivo vai pelo clipe.
    baixarPdf(pronto.pdf, pronto.nome)
    window.open(linkWhatsApp(textoEnvio, quem === 'personal' ? ficha.telefone : ''), '_blank', 'noopener')
    setAviso(`O PDF foi baixado (${pronto.nome}). No WhatsApp que abriu, toque no clipe 📎 e anexe o arquivo.`)
  }

  async function porEmail() {
    if (!pronto) return
    setAviso(null)
    const assunto = `Ficha de treino - ${pronto.titulo} - ${ficha.nome}`
    const r = await compartilhar(assunto)
    if (r === true) return setAviso('Pronto! Escolha o app de e-mail na lista.')
    if (r === 'cancelou') return
    baixarPdf(pronto.pdf, pronto.nome)
    window.location.href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(`${textoEnvio}\n\n(Arquivo em anexo: ${pronto.nome})`)}`
    setAviso(`O PDF foi baixado (${pronto.nome}). No e-mail que abriu, anexe o arquivo antes de enviar.`)
  }

  const tamanho = pronto ? `${Math.max(1, Math.round(pronto.pdf.size / 1024))} KB` : ''
  const treinoEscolhido = ordem.find((t) => t.letra === letra)

  return (
    <div className="pdf-fundo" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="pdf-janela" role="dialog" aria-modal="true" aria-labelledby="pdf-titulo">
        <header className="pdf-topo">
          <h2 id="pdf-titulo">
            <FileText size={20} /> Exportar treino em PDF
          </h2>
          <button className="icone-apagar" aria-label="Fechar" onClick={onFechar}>
            <X size={20} />
          </button>
        </header>

        {pronto ? (
          <>
            <section className="pdf-pronto">
              <span className="pdf-icone">
                <FileText size={26} />
              </span>
              <div>
                <strong>{pronto.titulo}</strong>
                <small>
                  {pronto.nome} · {pronto.paginas} página{pronto.paginas === 1 ? '' : 's'} · {tamanho}
                </small>
              </div>
            </section>
            <a className="botao-sec" href={pronto.url} target="_blank" rel="noreferrer">
              <Eye size={18} /> Ver o PDF
            </a>
            <button className="botao" onClick={() => baixarPdf(pronto.pdf, pronto.nome)}>
              <Download size={18} /> Baixar PDF
            </button>
            <button className="botao botao-whatsapp" onClick={whatsapp}>
              <MessageCircle size={18} /> Enviar pelo WhatsApp
            </button>
            <label className="campo">
              E-mail {quem === 'personal' ? `de ${primeiro}` : ''}
              <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" maxLength={120} />
            </label>
            <button className="botao-sec" onClick={porEmail}>
              <Mail size={18} /> Enviar por e-mail
            </button>
            {aviso && <p className="mensagem ok">{aviso}</p>}
            <button className="link" onClick={() => setPronto(null)}>
              Gerar outro PDF
            </button>
          </>
        ) : (
          <>
            <label className="pdf-opcao destaque-azul">
              <span>
                <strong>Incluir imagens dos exercícios</strong>
                <small>As imagens ajudam a reconhecer o exercício, mas deixam o PDF mais pesado.</small>
              </span>
              <input type="checkbox" role="switch" className="interruptor" checked={imagens} onChange={(e) => mudarImagens(e.target.checked)} />
            </label>

            <section className="pdf-opcao-bloco">
              <strong>Treino atual</strong>
              <small>Exporta só o treino escolhido, com todos os exercícios.</small>
              {ordem.length > 1 && (
                <div className="atalhos-data" role="radiogroup" aria-label="Qual treino">
                  {ordem.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={letra === t.letra} className={`chip-botao ${letra === t.letra ? 'ativo' : ''}`} onClick={() => setLetra(t.letra)}>
                      {t.letra}
                      {t.nome ? ` · ${t.nome}` : ''}
                    </button>
                  ))}
                </div>
              )}
              <button className="botao" onClick={() => gerar('treino')} disabled={!!gerando || !treinoEscolhido}>
                <Download size={18} /> {gerando === 'treino' ? 'Montando o PDF…' : `Gerar PDF do treino ${letra}`}
              </button>
            </section>

            <section className="pdf-opcao-bloco">
              <strong>Rotina completa</strong>
              <small>
                Todos os treinos ({ordem.map((t) => t.letra).join(', ') || '—'}) num PDF só, na ordem da rotina. Cada treino começa numa página.
              </small>
              <button className="botao" onClick={() => gerar('rotina')} disabled={!!gerando || !ordem.length}>
                <Download size={18} /> {gerando === 'rotina' ? 'Montando o PDF…' : 'Gerar PDF da rotina'}
              </button>
            </section>

            <button className="link link-discreto" onClick={() => setAjustes(!ajustes)} aria-expanded={ajustes}>
              <SlidersHorizontal size={14} /> {ajustes ? 'Esconder ajustes' : 'Datas, orientações e observações'}
            </button>
            {ajustes && (
              <section className="pdf-ajustes">
                <div className="pdf-datas">
                  <label className="campo">
                    Data de elaboração
                    <input type="date" value={elaborada} onChange={(e) => setElaborada(e.target.value)} />
                  </label>
                  <label className="campo">
                    Validade da ficha
                    <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
                  </label>
                </div>
                <label className="pdf-marcar">
                  <input type="checkbox" checked={comOrientacoes} onChange={(e) => setComOrientacoes(e.target.checked)} />
                  Orientações gerais {orientacoes.length ? `(${orientacoes.length})` : '(nenhuma cadastrada)'}
                </label>
                {aerobicos.length > 0 && (
                  <label className="pdf-marcar">
                    <input type="checkbox" checked={comAerobico} onChange={(e) => setComAerobico(e.target.checked)} />
                    Aeróbico na rotina completa ({aerobicos.length})
                  </label>
                )}
                <label className="campo">
                  Observações {quem === 'personal' ? 'para o aluno' : ''}
                  <textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={800} placeholder="Ex.: hidrate-se bem e respeite os intervalos. Qualquer dor, pare e me avise." />
                </label>
                <p className="dica-sec">
                  {quem === 'personal'
                    ? 'A logo, o nome e o registro vêm do “Meu perfil” do relatório de avaliação. Sem logo, vai a sua foto do perfil.'
                    : 'O nome, o registro e a foto do seu personal saem no topo do PDF.'}
                </p>
              </section>
            )}

            {erro && <p className="mensagem erro">{erro}</p>}
            <button className="botao-sec" onClick={onFechar}>
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
