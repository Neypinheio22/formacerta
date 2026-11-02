import { ArrowLeft, BookCopy, Check, ChevronDown, ChevronRight, Copy, EllipsisVertical, Folder, FolderInput, FolderPlus, Pencil, Plus, Search, Send, Sparkles, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apagarModelo, apagarPasta, carregarBiblioteca, enviarParaAlunos, moverModelo, salvarModelo, salvarPasta } from '../../nuvem/biblioteca'
import { listarFichas, type Ficha } from '../../nuvem/fichas'
import { comLinhas } from '../../nuvem/treinos'
import { buscarModelos, MODELOS_DO_APP, nomeDeCopia, ordenarPastas, PASTA_APP, resumoModelo, semAcento, validarPasta, type Modelo, type Pasta } from '../../treino/biblioteca'
import { rotuloNivel, rotuloTipo } from '../../treino/rotinas'
import { diaLocal } from '../../treino/semana'
import type { Biblioteca } from './EditorTreinos'
import { IconeDaRotina } from './IconeRotina'
import { FormRotina, type Edicao } from './Rotinas'
import { useExercicios } from './useExercicios'

const SEM_PASTA = 'sem-pasta'
const AVISO_SQL = 'Falta rodar no Supabase o arquivo biblioteca-de-treinos.sql para guardar os seus modelos. Os treinos prontos do FormaCerta já dá para usar.'

/** Pastas e modelos do personal, mais os prontos do FormaCerta. */
function useBiblioteca() {
  const [pastas, setPastas] = useState<Pasta[]>([])
  const [meus, setMeus] = useState<Modelo[]>([])
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [semTabela, setSemTabela] = useState(false)

  const recarregar = useCallback(async () => {
    const r = await carregarBiblioteca()
    setPastas(ordenarPastas(r.pastas))
    setMeus(r.modelos)
    setSemTabela(r.semTabela)
    setErro(r.semTabela ? AVISO_SQL : r.erro)
    setCarregado(true)
  }, [])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return { pastas, meus, todos: [...meus, ...MODELOS_DO_APP], carregado, erro, semTabela, recarregar }
}

/** Menu dos três pontinhos, igual ao das rotinas. */
function MenuPontos({ rotulo, itens }: { rotulo: string; itens: { texto: string; icone: React.ReactNode; perigo?: boolean; acao: () => void }[] }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fechar = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('pointerdown', fechar)
    return () => document.removeEventListener('pointerdown', fechar)
  }, [aberto])
  return (
    <div className="menu-pontos" ref={ref}>
      <button className="icone-apagar" aria-label={rotulo} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <EllipsisVertical size={20} />
      </button>
      {aberto && (
        <div className="menu-pontos-lista" role="menu">
          {itens.map((i) => (
            <button
              key={i.texto}
              role="menuitem"
              className={i.perigo ? 'perigo' : ''}
              onClick={() => {
                setAberto(false)
                i.acao()
              }}
            >
              {i.icone} {i.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Treinos do modelo, para o personal conferir antes de usar. */
function PreviaTreinos({ m }: { m: Modelo }) {
  return (
    <div className="modelo-previa">
      {m.treinos.map((t) => (
        <div key={t.letra}>
          <strong>
            {t.letra} · {t.nome || `Treino ${t.letra}`}
          </strong>
          <ol>
            {t.exercicios.map((e, i) => (
              <li key={i}>
                {e.nome}
                {(e.series || e.reps) && <small> · {e.series ? `${e.series}x${e.reps}` : e.reps}</small>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

function CartaoModelo({ m, pastaNome, acoes, menu, extra }: { m: Modelo; pastaNome?: string; acoes: React.ReactNode; menu?: React.ReactNode; extra?: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (
    <li className="cartao rotina-cartao modelo-cartao">
      <div className="modelo-linha">
        <button className="rotina-corpo" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          <IconeDaRotina id={m.icone} objetivo={m.objetivo} />
          <span className="rotina-info">
            <strong>{m.nome}</strong>
            <span className="rotina-chips">
              {m.doApp && (
                <span className="chip chip-ok">
                  <Sparkles size={11} /> FormaCerta
                </span>
              )}
              <span className="chip chip-neutro">{rotuloTipo(m.icone, m.objetivo)}</span>
              {m.objetivo && <span className="chip chip-neutro">{m.objetivo}</span>}
              {m.nivel && <span className="chip chip-neutro">{rotuloNivel(m.nivel)}</span>}
            </span>
            <small>
              {resumoModelo(m)}
              {pastaNome && ` · ${pastaNome}`}
            </small>
            <small className="link-previa">
              {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {aberto ? 'Esconder treinos' : 'Ver treinos'}
            </small>
          </span>
        </button>
        {menu}
      </div>
      {aberto && <PreviaTreinos m={m} />}
      {extra}
      <div className="modelo-acoes">{acoes}</div>
    </li>
  )
}

/** Escolher alunos e criar a rotina de todos de uma vez a partir do modelo. */
function EnviarParaAlunos({ m, meuId, onVoltar, onEnviado }: { m: Modelo; meuId: string; onVoltar: () => void; onEnviado: (texto: string) => void }) {
  const [fichas, setFichas] = useState<Ficha[] | null>(null)
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [inicio, setInicio] = useState(diaLocal(new Date()))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarFichas().then((r) => {
      setFichas(r.fichas.filter((f) => f.profissional_id === meuId))
      setErro(r.erro)
    })
  }, [meuId])

  const visiveis = useMemo(() => {
    const t = semAcento(busca)
    return (fichas ?? []).filter((f) => !t || semAcento(`${f.nome} ${f.telefone}`).includes(t))
  }, [fichas, busca])

  const alternar = (id: string) => setMarcados(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id])
  const todosVisiveis = visiveis.length > 0 && visiveis.every((f) => marcados.includes(f.id))

  async function enviar() {
    const escolhidas = (fichas ?? []).filter((f) => marcados.includes(f.id))
    if (!escolhidas.length) return
    setEnviando(true)
    setErro(null)
    const r = await enviarParaAlunos(m, escolhidas, inicio)
    setEnviando(false)
    if (r.falhas.length) {
      // Fica na tela só com quem deu erro marcado, para tentar de novo.
      setErro(`${r.ok.length ? `Criada para ${r.ok.join(', ')}. ` : ''}Não deu para criar para ${r.falhas.map((f) => f.nome).join(', ')}: ${r.falhas[0].erro}`)
      setMarcados(escolhidas.filter((f) => r.falhas.some((x) => x.nome === f.nome)).map((f) => f.id))
      return
    }
    onEnviado(`Rotina ${m.nome} criada para ${r.ok.join(', ')}. As rotinas anteriores continuam guardadas no histórico de cada um.`)
  }

  return (
    <div className="formulario">
      <section className="cartao destaque">
        <h2>
          <Users size={18} /> Usar {m.nome} em alunos
        </h2>
        <p className="dica-sec">Cada aluno escolhido ganha uma rotina nova com este treino. Depois dá para ajustar a rotina de cada um na ficha dele.</p>
        <label className="campo">
          Começa em
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value || diaLocal(new Date()))} />
        </label>
        {m.semanas && <small className="dica-sec">Validade: {m.semanas} semanas a partir do início.</small>}
      </section>

      <section className="cartao">
        <div className="busca-linha">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar aluno por nome ou telefone" aria-label="Procurar aluno" />
        </div>
        {fichas === null && <p className="carregando">Carregando alunos…</p>}
        {fichas && fichas.length === 0 && <p className="dica-sec centro">Você ainda não tem alunos. Cadastre em Alunos.</p>}
        {visiveis.length > 1 && (
          <button className="link" type="button" onClick={() => setMarcados(todosVisiveis ? marcados.filter((id) => !visiveis.some((f) => f.id === id)) : [...new Set([...marcados, ...visiveis.map((f) => f.id)])])}>
            {todosVisiveis ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        )}
        <ul className="lista-alunos-escolher">
          {visiveis.map((f) => (
            <li key={f.id}>
              <label>
                <input type="checkbox" checked={marcados.includes(f.id)} onChange={() => alternar(f.id)} />
                <span className="personal-inicial">{f.nome.charAt(0).toUpperCase()}</span>
                <span>{f.nome}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao grande" onClick={enviar} disabled={enviando || !marcados.length}>
        <Send size={18} /> {enviando ? 'Criando rotinas…' : marcados.length ? `Criar rotina para ${marcados.length} aluno${marcados.length === 1 ? '' : 's'}` : 'Escolha os alunos'}
      </button>
      <button className="botao-sec" onClick={onVoltar}>
        Cancelar
      </button>
    </div>
  )
}

const edicaoDoModelo = (m: Modelo, copia = false): Edicao => ({
  id: copia || m.doApp ? undefined : m.id,
  copiaDe: copia ? m.nome : undefined,
  pastaId: m.doApp ? null : m.pasta_id,
  semanas: m.semanas,
  dados: { nome: m.nome, inicio: null, fim: null, objetivo: m.objetivo, nivel: m.nivel, icone: m.icone },
  treinos: m.treinos.map((t) => ({ letra: t.letra, nome: t.nome, exercicios: comLinhas(t.exercicios) })),
})

const novoModelo = (pastaId: string | null): Edicao => ({
  pastaId,
  semanas: 8,
  dados: { nome: '', inicio: null, fim: null, objetivo: '', nivel: '', icone: '' },
  treinos: ['A', 'B', 'C'].map((letra) => ({ letra, nome: '', exercicios: comLinhas([{ nome: '', series: '', reps: '', obs: '' }]) })),
})

/**
 * Biblioteca de treinos do personal: modelos em pastas, treinos prontos do
 * FormaCerta e o atalho para criar a rotina de vários alunos de uma vez.
 */
export function TelaBiblioteca({ meuId, onVoltar }: { meuId: string; onVoltar: () => void }) {
  const b = useBiblioteca()
  const exercicios = useExercicios()
  const bib: Biblioteca = { meuId, lista: exercicios.lista, onMudou: exercicios.recarregar }
  const [pasta, setPasta] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Edicao | null>(null)
  const [enviando, setEnviando] = useState<Modelo | null>(null)
  const [movendo, setMovendo] = useState<string | null>(null)
  const [nomePasta, setNomePasta] = useState<{ id?: string; nome: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const nomeDaPasta = (id: string | null) => (id === PASTA_APP ? 'Prontos do FormaCerta' : (b.pastas.find((p) => p.id === id)?.nome ?? 'Sem pasta'))
  const naPasta = (id: string) => b.todos.filter((m) => (id === SEM_PASTA ? !m.pasta_id || (!m.doApp && !b.pastas.some((p) => p.id === m.pasta_id)) : m.pasta_id === id))
  const pastaAtual = pasta ? b.pastas.find((p) => p.id === pasta) : undefined
  const topo = () => window.scrollTo(0, 0)

  function avisar(t: string) {
    setErro(null)
    setAviso(t)
    topo()
  }

  async function guardarPasta(e: React.FormEvent) {
    e.preventDefault()
    if (!nomePasta) return
    const v = validarPasta(nomePasta.nome, b.pastas, nomePasta.id)
    if (v) return setErro(v)
    const r = await salvarPasta(nomePasta.id, nomePasta.nome)
    if (r.erro) return setErro(b.semTabela ? AVISO_SQL : r.erro)
    setNomePasta(null)
    await b.recarregar()
    avisar(nomePasta.id ? 'Pasta renomeada.' : `Pasta ${nomePasta.nome.trim()} criada.`)
  }

  async function excluirPasta(p: Pasta) {
    const n = naPasta(p.id).length
    if (!confirm(`Apagar a pasta ${p.nome}?${n ? ` Os ${n} treino${n === 1 ? '' : 's'} dela vão para Sem pasta.` : ''}`)) return
    const e = await apagarPasta(p.id)
    if (e) return setErro(e)
    setPasta(null)
    await b.recarregar()
    avisar(`Pasta ${p.nome} apagada.`)
  }

  async function excluirModelo(m: Modelo) {
    if (!confirm(`Apagar o modelo ${m.nome} da biblioteca? As rotinas que você já criou com ele não mudam.`)) return
    const e = await apagarModelo(m.id)
    if (e) return setErro(e)
    await b.recarregar()
    avisar(`${m.nome} saiu da biblioteca.`)
  }

  async function mover(m: Modelo, destino: string | null) {
    setMovendo(null)
    const e = await moverModelo(m.id, destino)
    if (e) return setErro(e)
    await b.recarregar()
    avisar(`${m.nome} foi para ${nomeDaPasta(destino)}.`)
  }

  const cabecalho = (
    <header className="rotinas-topo">
      <button className="voltar" onClick={editando ? () => setEditando(null) : enviando ? () => setEnviando(null) : pasta ? () => setPasta(null) : onVoltar} aria-label="Voltar">
        ←
      </button>
      <span className="rotina-icone" aria-hidden>
        <BookCopy size={22} />
      </span>
      <div>
        <h1>Biblioteca de treinos</h1>
        <small className="dica-sec">{editando ? 'Modelo de treino' : enviando ? 'Usar em alunos' : 'Treinos prontos para usar nos alunos'}</small>
      </div>
    </header>
  )

  if (editando)
    return (
      <div className="tela">
        {cabecalho}
        <FormRotina
          inicial={editando}
          bib={bib}
          nomeAluno=""
          pastas={b.pastas}
          onCancelar={() => setEditando(null)}
          onSalvar={async (e) => {
            const r = await salvarModelo(e.id, { pasta_id: e.pastaId ?? null, nome: e.dados.nome, objetivo: e.dados.objetivo, nivel: e.dados.nivel, icone: e.dados.icone, semanas: e.semanas ?? null, treinos: e.treinos })
            if (r.erro) return b.semTabela ? AVISO_SQL : r.erro
            setEditando(null)
            setPasta(e.pastaId ?? SEM_PASTA)
            await b.recarregar()
            avisar(e.id ? 'Modelo atualizado. As rotinas já criadas com ele não mudam.' : `${e.dados.nome.trim()} guardado em ${nomeDaPasta(e.pastaId ?? null)}.`)
            return null
          }}
        />
      </div>
    )

  if (enviando)
    return (
      <div className="tela">
        {cabecalho}
        <EnviarParaAlunos
          m={enviando}
          meuId={meuId}
          onVoltar={() => setEnviando(null)}
          onEnviado={(t) => {
            setEnviando(null)
            avisar(t)
          }}
        />
      </div>
    )

  const cartao = (m: Modelo, comPasta = false) => (
    <CartaoModelo
      key={m.id}
      m={m}
      pastaNome={comPasta ? nomeDaPasta(m.pasta_id) : undefined}
      acoes={
        <button className="botao pequeno" onClick={() => setEnviando(m)}>
          <Users size={16} /> Usar em alunos
        </button>
      }
      menu={
        <MenuPontos
          rotulo={`Opções do treino ${m.nome}`}
          itens={
            m.doApp
              ? [
                  {
                    texto: 'Copiar para editar',
                    icone: <Copy size={16} />,
                    acao: () => {
                      setEditando({ ...edicaoDoModelo(m), pastaId: pastaAtual?.id ?? null })
                      topo()
                    },
                  },
                ]
              : [
                  {
                    texto: 'Editar',
                    icone: <Pencil size={16} />,
                    acao: () => {
                      setEditando(edicaoDoModelo(m))
                      topo()
                    },
                  },
                  {
                    texto: 'Duplicar',
                    icone: <Copy size={16} />,
                    acao: () => {
                      const ed = edicaoDoModelo(m, true)
                      setEditando({ ...ed, dados: { ...ed.dados, nome: nomeDeCopia(m.nome, b.meus.map((x) => x.nome)) } })
                      topo()
                    },
                  },
                  { texto: 'Mover de pasta', icone: <FolderInput size={16} />, acao: () => setMovendo(m.id) },
                  { texto: 'Apagar', icone: <Trash2 size={16} />, perigo: true, acao: () => excluirModelo(m) },
                ]
          }
        />
      }
      extra={
        movendo === m.id && (
          <label className="campo mover-pasta">
            Mover para
            <select autoFocus defaultValue={m.pasta_id ?? ''} onChange={(e) => mover(m, e.target.value || null)} onBlur={() => setMovendo(null)}>
              <option value="">Sem pasta</option>
              {b.pastas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        )
      }
    />
  )

  const resultados = busca.trim() ? buscarModelos(b.todos, busca) : null
  const semPasta = naPasta(SEM_PASTA)

  return (
    <div className="tela">
      {cabecalho}
      <button
        className="botao grande"
        onClick={() => {
          setEditando(novoModelo(pastaAtual?.id ?? null))
          topo()
        }}
        disabled={b.semTabela}
      >
        <Plus size={20} /> Adicionar treino
      </button>
      <div className="busca-linha cartao">
        <Search size={16} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome, objetivo ou exercício" aria-label="Procurar treino" />
      </div>

      {aviso && <p className="mensagem ok">{aviso}</p>}
      {erro && <p className="mensagem erro">{erro}</p>}
      {!erro && b.erro && <p className="mensagem erro">{b.erro}</p>}
      {!b.carregado && <p className="carregando">Carregando biblioteca…</p>}

      {resultados ? (
        <>
          <h2 className="secao">
            {resultados.length} resultado{resultados.length === 1 ? '' : 's'}
          </h2>
          <ul className="rotinas-lista">{resultados.map((m) => cartao(m, true))}</ul>
          {!resultados.length && <p className="dica-sec centro">Nenhum treino com "{busca.trim()}". Tente o nome de um exercício, como agachamento.</p>}
        </>
      ) : pasta ? (
        <>
          <div className="pasta-topo">
            <button className="link" onClick={() => setPasta(null)}>
              <ArrowLeft size={14} /> Todas as pastas
            </button>
            <h2>
              <Folder size={18} /> {nomeDaPasta(pasta === SEM_PASTA ? null : pasta)}
            </h2>
            {pastaAtual && (
              <MenuPontos
                rotulo={`Opções da pasta ${pastaAtual.nome}`}
                itens={[
                  { texto: 'Renomear', icone: <Pencil size={16} />, acao: () => setNomePasta({ id: pastaAtual.id, nome: pastaAtual.nome }) },
                  { texto: 'Apagar pasta', icone: <Trash2 size={16} />, perigo: true, acao: () => excluirPasta(pastaAtual) },
                ]}
              />
            )}
          </div>
          {pasta === PASTA_APP && <p className="dica-sec">Treinos montados pelo FormaCerta, com vídeo de como fazer. Use direto ou toque nos três pontinhos para copiar e ajustar do seu jeito.</p>}
          {nomePasta?.id && <FormPasta valor={nomePasta.nome} onMudar={(nome) => setNomePasta({ ...nomePasta, nome })} onSalvar={guardarPasta} onCancelar={() => setNomePasta(null)} />}
          <ul className="rotinas-lista">{naPasta(pasta).map((m) => cartao(m))}</ul>
          {!naPasta(pasta).length && <p className="dica-sec centro">Pasta vazia. Toque em Adicionar treino para criar um aqui, ou mova um treino de outra pasta.</p>}
        </>
      ) : (
        <>
          <section className="cartao">
            <h2 className="secao">Pastas</h2>
            <ul className="lista-pastas">
              <li>
                <button onClick={() => setPasta(PASTA_APP)}>
                  <span className="pasta-icone app">
                    <Sparkles size={18} />
                  </span>
                  <span>Prontos do FormaCerta</span>
                  <small>{MODELOS_DO_APP.length}</small>
                </button>
              </li>
              {b.pastas.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setPasta(p.id)}>
                    <span className="pasta-icone">
                      <Folder size={18} />
                    </span>
                    <span>{p.nome}</span>
                    <small>{naPasta(p.id).length}</small>
                  </button>
                </li>
              ))}
            </ul>
            {nomePasta && !nomePasta.id ? (
              <FormPasta valor={nomePasta.nome} onMudar={(nome) => setNomePasta({ nome })} onSalvar={guardarPasta} onCancelar={() => setNomePasta(null)} />
            ) : (
              <button className="link" onClick={() => setNomePasta({ nome: '' })} disabled={b.semTabela}>
                <FolderPlus size={16} /> Nova pasta
              </button>
            )}
          </section>

          <h2 className="secao">Treinos sem pasta</h2>
          <ul className="rotinas-lista">{semPasta.map((m) => cartao(m))}</ul>
          {b.carregado && !semPasta.length && (
            <p className="dica-sec centro">
              {b.meus.length ? 'Todos os seus treinos estão em pastas.' : 'Você ainda não guardou treinos. Toque em Adicionar treino, ou na ficha de um aluno use os três pontinhos da rotina e Salvar na biblioteca.'}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function FormPasta({ valor, onMudar, onSalvar, onCancelar }: { valor: string; onMudar: (v: string) => void; onSalvar: (e: React.FormEvent) => void; onCancelar: () => void }) {
  return (
    <form className="form-pasta" onSubmit={onSalvar}>
      <input autoFocus value={valor} onChange={(e) => onMudar(e.target.value)} maxLength={40} placeholder="Ex.: Alongamentos, Esqueleto de treino" aria-label="Nome da pasta" />
      <button className="botao pequeno" type="submit" aria-label="Salvar pasta">
        <Check size={16} />
      </button>
      <button className="botao-sec pequeno" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}

/** Escolher um treino pronto da biblioteca para criar a rotina de um aluno. */
export function EscolherModelo({ nomeAluno, onEscolher, onCancelar }: { meuId: string; nomeAluno: string; onEscolher: (m: Modelo) => void; onCancelar: () => void }) {
  const b = useBiblioteca()
  const [busca, setBusca] = useState('')
  const grupos = useMemo(() => {
    const lista = buscarModelos(b.todos, busca)
    const nomes = new Map(b.pastas.map((p) => [p.id, p.nome]))
    const g = [
      ...b.pastas.map((p) => ({ id: p.id, nome: p.nome, modelos: lista.filter((m) => m.pasta_id === p.id) })),
      { id: SEM_PASTA, nome: 'Sem pasta', modelos: lista.filter((m) => !m.doApp && (!m.pasta_id || !nomes.has(m.pasta_id))) },
      { id: PASTA_APP, nome: 'Prontos do FormaCerta', modelos: lista.filter((m) => m.doApp) },
    ]
    return g.filter((x) => x.modelos.length)
  }, [b.todos, b.pastas, busca])

  return (
    <div className="formulario">
      <section className="cartao destaque">
        <h2>Treino pronto para {nomeAluno}</h2>
        <p className="dica-sec">Escolha um treino da sua biblioteca. Ele abre como rotina nova para você ajustar antes de liberar.</p>
        <div className="busca-linha">
          <Search size={16} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome, objetivo ou exercício" aria-label="Procurar treino" />
        </div>
      </section>
      {b.erro && !b.semTabela && <p className="mensagem erro">{b.erro}</p>}
      {!b.carregado && <p className="carregando">Carregando biblioteca…</p>}
      {grupos.map((g) => (
        <section key={g.id}>
          <h2 className="secao">
            {g.id === PASTA_APP ? <Sparkles size={16} /> : <Folder size={16} />} {g.nome}
          </h2>
          <ul className="rotinas-lista">
            {g.modelos.map((m) => (
              <CartaoModelo
                key={m.id}
                m={m}
                acoes={
                  <button className="botao pequeno" onClick={() => onEscolher(m)}>
                    <Check size={16} /> Usar este
                  </button>
                }
              />
            ))}
          </ul>
        </section>
      ))}
      {b.carregado && !grupos.length && <p className="dica-sec centro">Nenhum treino encontrado.</p>}
      <button className="botao-sec" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}
