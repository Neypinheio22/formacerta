import { Archive, ArchiveRestore, ArrowLeft, ArrowRight, BookCopy, CalendarDays, Copy, EllipsisVertical, HeartPulse, Library, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ficha } from '../../nuvem/fichas'
import { fotoDoAluno, listarRotinas, listarTreinosDasRotinas, mudarSituacao, ordenarTreinos, salvarRotina, type DadosRotina, type Rotina, type TreinoRascunho } from '../../nuvem/rotinas'
import { comLinhas, exercicioVazio, listarFeitosDosTreinos, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { focoEmLista, focoSugerido, LETRAS_TREINO, listaEmFoco, mover, OPCOES_FOCO, reletrar } from '../../treino/execucao'
import { dataCurta } from '../../testes/formato'
import { andamento, dataDia, DIVISOES, ICONES_ROTINA, NIVEIS, nomeSugerido, OBJETIVOS_ROTINA, ordenarRotinas, rotinaAtual, rotuloNivel, rotuloTipo, somarSemanas, tipoDaRotina, type Nivel, type Situacao } from '../../treino/rotinas'
import { diaLocal } from '../../treino/semana'
import { SERIE_SUGERIDA } from '../../treino/sugerida'
import { salvarModelo } from '../../nuvem/biblioteca'
import { SEMANAS_MODELO, type Modelo, type Pasta } from '../../treino/biblioteca'
import { EscolherModelo } from './BibliotecaTreinos'
import { AbaAerobico } from './Aerobico'
import { EditorExercicios, type Biblioteca } from './EditorTreinos'
import { DesenhoIcone, IconeDaRotina } from './IconeRotina'
import { useExercicios } from './useExercicios'
import { DetalheRotina, type AcaoRotina } from './DetalheRotina'
import { EvolucaoRotina } from './EvolucaoRotina'
import { useAtualizacao } from './useAtualizacao'

type Lista = 'ativas' | 'arquivada' | 'excluida'

/**
 * O que abre no formulário: rotina nova, cópia de outra ou edição. O mesmo
 * formulário monta os modelos da biblioteca de treinos (com pasta e duração
 * sugerida no lugar das datas).
 */
export type Edicao = { id?: string; dados: DadosRotina; treinos: TreinoRascunho[]; copiaDe?: string; doModelo?: string; pastaId?: string | null; semanas?: number | null; abrirLetra?: string }

const treinoVazio = (letra: string): TreinoRascunho => ({ letra, nome: '', exercicios: [exercicioVazio()] })

function novaRotina(): Edicao {
  const hoje = diaLocal(new Date())
  return {
    dados: { nome: nomeSugerido(), inicio: hoje, fim: somarSemanas(hoje, 8), objetivo: '', nivel: '', icone: '' },
    treinos: ['A', 'B', 'C'].map(treinoVazio),
  }
}

/** Rotina do aluno a partir de um modelo da biblioteca: começa hoje e vale pelas semanas do modelo. */
function rotinaDoModelo(m: Modelo): Edicao {
  const hoje = diaLocal(new Date())
  return {
    doModelo: m.nome,
    dados: { nome: m.nome, inicio: hoje, fim: m.semanas ? somarSemanas(hoje, m.semanas) : null, objetivo: m.objetivo, nivel: m.nivel, icone: m.icone },
    treinos: m.treinos.map((t) => ({ letra: t.letra, nome: t.nome, exercicios: comLinhas(t.exercicios) })),
  }
}

/** Semanas entre o início e a validade da rotina (para guardar como modelo). */
function semanasDe(r: Pick<Rotina, 'inicio' | 'fim'>): number | null {
  if (!r.inicio || !r.fim) return null
  return Math.min(52, Math.max(1, Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / (7 * 86400000))))
}

/** Cópia para a próxima fase: mesmos treinos, datas novas com a mesma duração. */
function copiaDe(r: Rotina, treinos: Treino[]): Edicao {
  const hoje = diaLocal(new Date())
  const semanas = r.inicio && r.fim ? Math.max(1, Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / (7 * 86400000))) : 8
  return {
    copiaDe: r.nome,
    dados: { nome: `${r.nome} (cópia)`.slice(0, 60), inicio: hoje, fim: somarSemanas(hoje, semanas), objetivo: r.objetivo, nivel: r.nivel, icone: r.icone },
    treinos: treinos.map((t) => ({ letra: t.letra, nome: t.nome, foco: t.foco, exercicios: comLinhas(t.exercicios) })),
  }
}

/** Menu dos três pontinhos do cartão. */
function MenuRotina({ r, onAcao }: { r: Rotina; onAcao: (acao: AcaoRotina) => void }) {
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

  const item = (acao: Parameters<typeof onAcao>[0], icone: React.ReactNode, texto: string, perigo = false) => (
    <button
      role="menuitem"
      className={perigo ? 'perigo' : ''}
      onClick={() => {
        setAberto(false)
        onAcao(acao)
      }}
    >
      {icone} {texto}
    </button>
  )

  return (
    <div className="menu-pontos" ref={ref}>
      <button className="icone-apagar" aria-label={`Opções da rotina ${r.nome}`} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <EllipsisVertical size={20} />
      </button>
      {aberto && (
        <div className="menu-pontos-lista" role="menu">
          {r.situacao === 'excluida' ? (
            item('ativa', <RotateCcw size={16} />, 'Recuperar')
          ) : (
            <>
              {item('editar', <Pencil size={16} />, 'Editar')}
              {item('duplicar', <Copy size={16} />, 'Duplicar')}
              {item('biblioteca', <BookCopy size={16} />, 'Salvar na biblioteca')}
              {r.situacao === 'arquivada' ? item('ativa', <ArchiveRestore size={16} />, 'Reativar') : item('arquivada', <Archive size={16} />, 'Arquivar')}
              {item('excluida', <Trash2 size={16} />, 'Excluir', true)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CartaoRotina({ r, treinos, feitos, atual, onAbrir, onAcao }: { r: Rotina; treinos: Treino[]; feitos: TreinoFeito[]; atual: boolean; onAbrir: () => void; onAcao: (acao: AcaoRotina) => void }) {
  const a = andamento(r)
  const exercicios = treinos.reduce((n, t) => n + t.exercicios.length, 0)
  const meus = feitos.filter((f) => treinos.some((t) => t.id === f.treino_id))
  return (
    <li className={`cartao rotina-cartao ${atual ? 'atual' : ''}`}>
      <button className="rotina-corpo" onClick={onAbrir}>
        <IconeDaRotina id={r.icone} objetivo={r.objetivo} />
        <span className="rotina-info">
          <strong>{r.nome}</strong>
          <small>
            <CalendarDays size={13} /> {r.inicio ? dataDia(r.inicio) : 'Sem início'} até {r.fim ? dataDia(r.fim) : 'sem data'}
          </small>
          <span className="rotina-chips">
            <span className="chip chip-neutro">{rotuloTipo(r.icone, r.objetivo)}</span>
            {r.objetivo && <span className="chip chip-neutro">{r.objetivo}</span>}
            {r.nivel && <span className="chip chip-neutro">{rotuloNivel(r.nivel)}</span>}
            <span className={`chip chip-${a.tom}`}>{atual ? `Valendo · ${a.rotulo.toLowerCase()}` : a.rotulo}</span>
          </span>
          <small>
            {treinos.length ? `Treinos ${treinos.map((t) => t.letra).join(' ')} · ${exercicios} exercício${exercicios === 1 ? '' : 's'}` : 'Sem treinos'}
            {r.situacao === 'excluida' && r.excluida_em && ` · excluída em ${dataCurta(r.excluida_em)}`}
          </small>
          {meus.length > 0 && (
            <small className="verde">
              Feita {meus.length}x · última em {dataCurta(meus[0].feito_em)}
            </small>
          )}
        </span>
      </button>
      <MenuRotina r={r} onAcao={onAcao} />
    </li>
  )
}

/**
 * Formulário da rotina. Com `pastas`, monta um modelo da biblioteca de treinos:
 * no lugar das datas vêm a pasta e a duração sugerida.
 */
export function FormRotina({ inicial, bib, nomeAluno, pastas, onSalvar, onCancelar }: { inicial: Edicao; bib: Biblioteca; nomeAluno: string; pastas?: Pasta[]; onSalvar: (e: Edicao) => Promise<string | null>; onCancelar: () => void }) {
  const modelo = !!pastas
  const [dados, setDados] = useState(inicial.dados)
  const [pastaId, setPastaId] = useState(inicial.pastaId ?? null)
  const [semanas, setSemanas] = useState(inicial.semanas ?? null)
  const [treinos, setTreinos] = useState<TreinoRascunho[]>(() => inicial.treinos.map((t) => ({ ...t, exercicios: comLinhas(t.exercicios) })))
  const [letra, setLetra] = useState(inicial.abrirLetra ?? inicial.treinos[0]?.letra ?? 'A')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const divisao = treinos.map((t) => t.letra).join('')
  const treino = treinos.find((t) => t.letra === letra) ?? treinos[0]
  const vazio = !treinos.some((t) => t.exercicios.some((e) => e.nome.trim()))
  const mudarTreino = (m: Partial<TreinoRascunho>) => setTreinos(treinos.map((t) => (t.letra === treino.letra ? { ...t, ...m } : t)))

  function mudarDivisao(nova: string) {
    const sai = treinos.filter((t) => !nova.includes(t.letra) && t.exercicios.some((e) => e.nome.trim()))
    if (sai.length && !confirm(`Tirar ${sai.map((t) => `o treino ${t.letra}`).join(' e ')} desta rotina? Os exercícios dele saem junto.`)) return
    setTreinos(nova.split('').map((l) => treinos.find((t) => t.letra === l) ?? treinoVazio(l)))
    if (!nova.includes(letra)) setLetra('A')
  }

  /** Mais um treino no fim (até o J). */
  function adicionarTreino() {
    const nova = LETRAS_TREINO[treinos.length]
    if (!nova) return
    setTreinos([...treinos, treinoVazio(nova)])
    setLetra(nova)
  }

  /** Muda o treino aberto de lugar: as letras se ajustam (A, B, C...). */
  function moverTreino(passo: -1 | 1) {
    const i = treinos.findIndex((t) => t.letra === letra)
    const nova = reletrar(mover(treinos, i, passo))
    if (nova === treinos) return
    setTreinos(nova)
    setLetra(LETRAS_TREINO[i + passo])
  }

  function tirarTreino() {
    const t = treinos.find((x) => x.letra === letra)
    if (!t || treinos.length < 2) return
    if (t.exercicios.some((e) => e.nome.trim()) && !confirm(`Tirar o treino ${t.letra}${t.nome ? ` (${t.nome})` : ''} desta rotina? Os exercícios dele saem junto.`)) return
    setTreinos(reletrar(treinos.filter((x) => x.letra !== letra)))
    setLetra('A')
  }

  function usarSugerida() {
    setTreinos(SERIE_SUGERIDA.map((t) => ({ letra: t.letra, nome: t.nome, exercicios: comLinhas(t.exercicios) })))
    setLetra('A')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!dados.nome.trim()) return setErro(modelo ? 'Dê um nome para o modelo.' : 'Dê um nome para a rotina.')
    if (!modelo && dados.inicio && dados.fim && dados.fim < dados.inicio) return setErro('A validade precisa ser depois do início.')
    setSalvando(true)
    const e2 = await onSalvar({ ...inicial, dados, treinos, pastaId, semanas })
    setSalvando(false)
    setErro(e2)
  }

  return (
    <form className="formulario rotina-form" onSubmit={salvar}>
      <section className="cartao destaque">
        <h2>
          {modelo
            ? inicial.id
              ? 'Editar modelo'
              : inicial.copiaDe
                ? `Modelo a partir de ${inicial.copiaDe}`
                : 'Novo modelo de treino'
            : inicial.id
              ? 'Editar rotina'
              : inicial.copiaDe
                ? `Cópia de ${inicial.copiaDe}`
                : inicial.doModelo
                  ? `Rotina a partir do modelo ${inicial.doModelo}`
                  : 'Nova rotina'}
        </h2>
        {inicial.doModelo && !modelo && <p className="dica-sec">Ajuste o que precisar para {nomeAluno}. O modelo na biblioteca não muda.</p>}
        <label className="campo">
          {modelo ? 'Nome do modelo' : 'Nome da rotina'}
          <input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} maxLength={60} placeholder={modelo ? 'Ex.: Hipertrofia ABC, Circuito de abdominais' : 'Ex.: TREINO NOVO 2026/11'} />
        </label>
        {modelo && (
          <>
            <label className="campo">
              Pasta
              <select value={pastaId ?? ''} onChange={(e) => setPastaId(e.target.value || null)}>
                <option value="">Sem pasta</option>
                {pastas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="campo">
              <legend>Duração sugerida</legend>
              <div className="atalhos-data">
                {SEMANAS_MODELO.map((s) => (
                  <button key={s} type="button" className={`chip-botao ${semanas === s ? 'ativo' : ''}`} aria-pressed={semanas === s} onClick={() => setSemanas(semanas === s ? null : s)}>
                    {s} semanas
                  </button>
                ))}
              </div>
              <small className="dica-sec">Vira a validade da rotina quando você usar o modelo num aluno.</small>
            </fieldset>
          </>
        )}
        {!modelo && (
          <>
        <div className="linha-campos">
          <label className="campo">
            Início
            <input type="date" value={dados.inicio ?? ''} onChange={(e) => setDados({ ...dados, inicio: e.target.value || null })} />
          </label>
          <label className="campo">
            Validade
            <input type="date" value={dados.fim ?? ''} min={dados.inicio ?? undefined} onChange={(e) => setDados({ ...dados, fim: e.target.value || null })} />
          </label>
        </div>
        <div className="atalhos-data">
          {[4, 6, 8, 12].map((s) => (
            <button key={s} type="button" className={`chip-botao ${dados.inicio && dados.fim === somarSemanas(dados.inicio, s) ? 'ativo' : ''}`} onClick={() => setDados({ ...dados, inicio: dados.inicio ?? diaLocal(new Date()), fim: somarSemanas(dados.inicio ?? diaLocal(new Date()), s) })}>
              {s} semanas
            </button>
          ))}
        </div>
          </>
        )}
        <label className="campo">
          Objetivo
          <select value={dados.objetivo} onChange={(e) => setDados({ ...dados, objetivo: e.target.value })}>
            <option value="">Escolha</option>
            {OBJETIVOS_ROTINA.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="campo">
          <legend>{modelo ? 'Nível' : 'Nível do aluno'}</legend>
          <div className="atalhos-data">
            {NIVEIS.map((n) => (
              <button key={n.id} type="button" className={`chip-botao ${dados.nivel === n.id ? 'ativo' : ''}`} onClick={() => setDados({ ...dados, nivel: dados.nivel === n.id ? '' : (n.id as Nivel) })}>
                {n.rotulo}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="campo">
          <legend>Tipo de exercício</legend>
          <div className="icones-rotina">
            {ICONES_ROTINA.map((i) => {
              const escolhido = tipoDaRotina(dados.icone, dados.objetivo) === i.id
              return (
                <button key={i.id} type="button" className={escolhido ? 'ativo' : ''} aria-pressed={escolhido} title={i.rotulo} onClick={() => setDados({ ...dados, icone: i.id })}>
                  <DesenhoIcone id={i.id} />
                  <small>{i.rotulo}</small>
                </button>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section className="cartao">
        <h2>Divisão dos treinos</h2>
        <div className="divisoes" role="radiogroup" aria-label="Divisão dos treinos">
          {DIVISOES.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={divisao === d} className={divisao === d ? 'ativo' : ''} onClick={() => mudarDivisao(d)}>
              {d}
            </button>
          ))}
        </div>
        {!inicial.id && vazio && (
          <button type="button" className="link" onClick={usarSugerida}>
            <Copy size={14} /> Começar pela série sugerida do app (A e B) e ajustar
          </button>
        )}
        <div className="seletor-comparar abas-ficha abas-letra" role="tablist">
          {treinos.map((t) => {
            const n = t.exercicios.filter((e) => e.nome.trim()).length
            return (
              <button key={t.letra} type="button" role="tab" aria-selected={t.letra === treino?.letra} className={t.letra === treino?.letra ? 'ativo' : ''} onClick={() => setLetra(t.letra)}>
                {t.letra}
                {n > 0 && <small> · {n}</small>}
              </button>
            )
          })}
          {treinos.length < 10 && (
            <button type="button" className="aba-mais" onClick={adicionarTreino} aria-label="Adicionar treino">
              <Plus size={14} /> Treino
            </button>
          )}
        </div>
        {treino && (
          <div key={treino.letra}>
            <div className="treino-ordem">
              <button type="button" className="botao-sec" onClick={() => moverTreino(-1)} disabled={treino.letra === treinos[0]?.letra} aria-label="Mover para antes">
                <ArrowLeft size={15} /> Antes
              </button>
              <button type="button" className="botao-sec" onClick={() => moverTreino(1)} disabled={treino.letra === treinos[treinos.length - 1]?.letra} aria-label="Mover para depois">
                Depois <ArrowRight size={15} />
              </button>
              {treinos.length > 1 && (
                <button type="button" className="botao-sec perigo" onClick={tirarTreino}>
                  <Trash2 size={15} /> Tirar
                </button>
              )}
            </div>
            <label className="campo">
              Nome do treino {treino.letra}
              <input value={treino.nome} onChange={(e) => mudarTreino({ nome: e.target.value })} maxLength={60} placeholder="Ex.: Pernas, Superiores, Glúteo" />
            </label>
            <EditorFoco foco={treino.foco ?? ''} exercicios={treino.exercicios} onMudar={(foco) => mudarTreino({ foco })} />
            <EditorExercicios exercicios={treino.exercicios} bib={bib} onMudar={(exercicios) => mudarTreino({ exercicios })} />
          </div>
        )}
      </section>

      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao grande" type="submit" disabled={salvando || vazio}>
        {salvando ? 'Guardando…' : modelo ? 'Salvar na biblioteca' : `Salvar e liberar para ${nomeAluno}`}
      </button>
      {vazio && <p className="dica-sec centro">Coloque pelo menos um exercício para salvar.</p>}
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}

/** Foco do treino: grupos musculares ou objetivo, com sugestão tirada dos exercícios. */
function EditorFoco({ foco, exercicios, onMudar }: { foco: string; exercicios: { nome: string }[]; onMudar: (f: string) => void }) {
  const [abrir, setAbrir] = useState(false)
  const lista = focoEmLista(foco)
  const sugestao = focoSugerido(exercicios)
  const alternar = (g: string) => onMudar(listaEmFoco(lista.includes(g) ? lista.filter((x) => x !== g) : [...lista, g]))
  return (
    <fieldset className="campo foco-treino">
      <legend>Grupo muscular ou objetivo</legend>
      <div className="atalhos-data">
        {lista.map((g) => (
          <button key={g} type="button" className="chip-botao ativo" onClick={() => alternar(g)} aria-label={`Tirar ${g}`}>
            {g} ×
          </button>
        ))}
        <button type="button" className="chip-botao" onClick={() => setAbrir(!abrir)} aria-expanded={abrir}>
          <Plus size={13} /> {lista.length ? 'Mudar' : 'Escolher'}
        </button>
        {!lista.length && sugestao.length > 0 && (
          <button type="button" className="chip-botao sugestao" onClick={() => onMudar(listaEmFoco(sugestao))}>
            <Sparkles size={13} /> Usar: {sugestao.join(', ')}
          </button>
        )}
      </div>
      {abrir && (
        <div className="atalhos-data foco-opcoes">
          {OPCOES_FOCO.map((g) => (
            <button key={g} type="button" className={`chip-botao ${lista.includes(g) ? 'ativo' : ''}`} aria-pressed={lista.includes(g)} onClick={() => alternar(g)}>
              {g}
            </button>
          ))}
        </div>
      )}
    </fieldset>
  )
}

export type Vista = { tipo: 'lista' } | { tipo: 'rotina'; id: string } | { tipo: 'evolucao'; id: string }

/** Tela de rotinas do aluno (personal): rotinas de treino e aeróbico, com histórico de execução e evolução. */
export function TelaRotinas({ ficha, meuId, abrir, onVoltar }: { ficha: Ficha; meuId: string; abrir?: Vista; onVoltar: () => void }) {
  const [aba, setAba] = useState<'rotinas' | 'aerobico'>('rotinas')
  const [lista, setLista] = useState<Lista>('ativas')
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null)
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [feitos, setFeitos] = useState<TreinoFeito[]>([])
  const [foto, setFoto] = useState('')
  const [vista, setVista] = useState<Vista>(abrir ?? { tipo: 'lista' })
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState<Edicao | null>(null)
  const [escolhendoModelo, setEscolhendoModelo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const exercicios = useExercicios()
  const bib: Biblioteca = { meuId, lista: exercicios.lista, onMudou: exercicios.recarregar }
  const primeiro = ficha.nome.split(' ')[0]

  const carregar = useCallback(async () => {
    const r = await listarRotinas(ficha.id)
    const t = await listarTreinosDasRotinas(r.rotinas.map((x) => x.id))
    setFeitos(await listarFeitosDosTreinos(t.map((x) => x.id)))
    setTreinos(t)
    setRotinas(r.rotinas)
    setErro(r.semTabela ? 'Falta rodar no Supabase o arquivo rotinas-de-treino.sql para as rotinas funcionarem.' : r.erro)
  }, [ficha.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Atualização automática (o aluno concluiu um treino): só fora do formulário, para não atrapalhar quem está editando.
  useAtualizacao(() => {
    if (!editando && !escolhendoModelo) carregar()
  })

  useEffect(() => {
    fotoDoAluno(ficha.aluno_id).then(setFoto)
  }, [ficha.aluno_id])

  const treinosDe = (r: Rotina) => treinos.filter((t) => t.rotina_id === r.id).sort((a, b) => a.letra.localeCompare(b.letra))
  const feitosDe = (r: Rotina) => {
    const ids = new Set(treinosDe(r).map((t) => t.id))
    return feitos.filter((f) => f.treino_id && ids.has(f.treino_id))
  }
  const ir = (v: Vista) => {
    setVista(v)
    window.scrollTo(0, 0)
  }

  async function acao(r: Rotina, a: AcaoRotina) {
    setAviso(null)
    if (a === 'editar') return setEditando({ id: r.id, dados: r, treinos: treinosDe(r) })
    if (a === 'duplicar') return setEditando(copiaDe(r, treinosDe(r)))
    if (a === 'biblioteca') {
      const m = await salvarModelo(undefined, { pasta_id: null, nome: r.nome, objetivo: r.objetivo, nivel: r.nivel, icone: r.icone, semanas: semanasDe(r), treinos: treinosDe(r) })
      if (m.erro) return setErro(/does not exist|schema cache|relation/i.test(m.erro) ? 'Falta rodar no Supabase o arquivo biblioteca-de-treinos.sql.' : m.erro)
      setErro(null)
      return setAviso(`${r.nome} foi guardada na sua biblioteca de treinos (Sem pasta). Abra a biblioteca na aba Treino para pôr numa pasta ou usar em outros alunos.`)
    }
    if (a === 'excluida' && !confirm(`Excluir a rotina ${r.nome}? Ela vai para Excluídas e dá para recuperar depois.`)) return
    const e = await mudarSituacao(r.id, a)
    if (e) return setErro(e)
    setAviso(a === 'arquivada' ? `${r.nome} foi para Arquivadas.` : a === 'excluida' ? `${r.nome} foi para Excluídas.` : `${r.nome} voltou para as rotinas.`)
    ir({ tipo: 'lista' })
    carregar()
  }

  async function ordenar(r: Rotina, ordem: Treino[]) {
    setAviso(null)
    // Mostra a ordem nova na hora; se o banco recusar, volta como estava.
    setTreinos(treinos.map((t) => {
      const i = ordem.findIndex((o) => o.id === t.id)
      return i >= 0 ? { ...t, letra: LETRAS_TREINO[i] } : t
    }))
    const e = await ordenarTreinos(r.id, ordem)
    if (e) setErro(e)
    else setAviso(`Ordem salva: ${ordem.map((t, i) => `${LETRAS_TREINO[i]} ${t.nome || ''}`.trim()).join(' · ')}.`)
    carregar()
  }

  const rotinaDaVista = vista.tipo !== 'lista' ? rotinas?.find((r) => r.id === vista.id) : undefined

  const cabecalho = (
    <header className="rotinas-topo">
      <button
        className="voltar"
        onClick={
          editando
            ? () => setEditando(null)
            : escolhendoModelo
              ? () => setEscolhendoModelo(false)
              : vista.tipo === 'evolucao' && abrir?.tipo !== 'evolucao'
                ? () => ir({ tipo: 'rotina', id: vista.id })
                : vista.tipo === 'rotina' && abrir?.tipo !== 'rotina'
                  ? () => ir({ tipo: 'lista' })
                  : onVoltar
        }
        aria-label="Voltar"
      >
        ←
      </button>
      {foto ? <img className="rotinas-foto" src={foto} alt="" /> : <span className="personal-inicial">{ficha.nome.charAt(0).toUpperCase()}</span>}
      <div>
        <h1>{ficha.nome}</h1>
        <small className="dica-sec">{editando ? 'Rotina de treino' : vista.tipo === 'evolucao' ? 'Evolução da rotina' : vista.tipo === 'rotina' ? 'Rotina de treino' : 'Rotinas e aeróbico'}</small>
      </div>
    </header>
  )

  if (escolhendoModelo)
    return (
      <div className="tela">
        {cabecalho}
        <EscolherModelo
          meuId={meuId}
          nomeAluno={primeiro}
          onCancelar={() => setEscolhendoModelo(false)}
          onEscolher={(m) => {
            setEscolhendoModelo(false)
            setEditando(rotinaDoModelo(m))
            window.scrollTo(0, 0)
          }}
        />
      </div>
    )

  if (editando)
    return (
      <div className="tela">
        {cabecalho}
        <FormRotina
          inicial={editando}
          bib={bib}
          nomeAluno={primeiro}
          onCancelar={() => setEditando(null)}
          onSalvar={async (e) => {
            const r = await salvarRotina(ficha.id, e.id, e.dados, e.treinos)
            if (r.erro) return r.erro
            setEditando(null)
            setLista('ativas')
            setAviso(e.id ? 'Rotina atualizada. O aluno já vê as mudanças.' : `Rotina salva e liberada para ${primeiro}. As anteriores continuam guardadas.`)
            await carregar()
            if (r.id) ir({ tipo: 'rotina', id: r.id })
            else window.scrollTo(0, 0)
            return null
          }}
        />
      </div>
    )

  const atual = rotinas ? rotinaAtual(rotinas) : null

  if (rotinaDaVista && vista.tipo === 'evolucao')
    return (
      <div className="tela">
        {cabecalho}
        <EvolucaoRotina nomeRotina={rotinaDaVista.nome} nomeAluno={primeiro} treinos={treinosDe(rotinaDaVista)} feitos={feitosDe(rotinaDaVista)} />
        <button className="botao-sec" onClick={() => ir({ tipo: 'rotina', id: rotinaDaVista.id })}>
          Voltar à rotina
        </button>
      </div>
    )

  if (rotinaDaVista && vista.tipo === 'rotina')
    return (
      <div className="tela">
        {cabecalho}
        {aviso && <p className="mensagem ok">{aviso}</p>}
        {erro && <p className="mensagem erro">{erro}</p>}
        <DetalheRotina
          r={rotinaDaVista}
          treinos={treinosDe(rotinaDaVista)}
          feitos={feitosDe(rotinaDaVista)}
          atual={rotinaDaVista.id === atual?.id}
          onEditar={(letra) => {
            setAviso(null)
            setEditando({ id: rotinaDaVista.id, dados: rotinaDaVista, treinos: treinosDe(rotinaDaVista), abrirLetra: letra })
          }}
          onAdicionar={() => {
            const ts = treinosDe(rotinaDaVista)
            const nova = LETRAS_TREINO[ts.length]
            setAviso(null)
            setEditando({ id: rotinaDaVista.id, dados: rotinaDaVista, treinos: [...ts, treinoVazio(nova)], abrirLetra: nova })
          }}
          onOrdenar={(ordem) => ordenar(rotinaDaVista, ordem)}
          onAcao={(a) => acao(rotinaDaVista, a)}
          onEvolucao={() => ir({ tipo: 'evolucao', id: rotinaDaVista.id })}
        />
      </div>
    )

  const daLista = rotinas ? rotinas.filter((r) => (lista === 'ativas' ? r.situacao === 'ativa' : r.situacao === lista)) : []
  // Organizar por objetivo ou tipo de exercício (só aparece com mais de uma opção).
  const grupos = [...new Set(daLista.flatMap((r) => [rotuloTipo(r.icone, r.objetivo), r.objetivo].filter(Boolean)))]
  const visiveis = ordenarRotinas(daLista.filter((r) => !filtro || rotuloTipo(r.icone, r.objetivo) === filtro || r.objetivo === filtro))
  const quantas = (s: Situacao) => rotinas?.filter((r) => r.situacao === s).length ?? 0

  return (
    <div className="tela">
      {cabecalho}
      <div className="seletor-comparar" role="tablist">
        <button role="tab" aria-selected={aba === 'rotinas'} className={aba === 'rotinas' ? 'ativo' : ''} onClick={() => setAba('rotinas')}>
          Rotinas de treino
        </button>
        <button role="tab" aria-selected={aba === 'aerobico'} className={aba === 'aerobico' ? 'ativo' : ''} onClick={() => setAba('aerobico')}>
          <HeartPulse size={14} /> Aeróbico
        </button>
      </div>

      {aba === 'aerobico' ? (
        <AbaAerobico ficha={ficha} />
      ) : (
        <>
          <button className="botao grande" onClick={() => setEditando(novaRotina())} disabled={!rotinas || !!erro?.includes('rotinas-de-treino.sql')}>
            <Plus size={20} /> Criar rotina
          </button>
          <button className="botao-sec" onClick={() => setEscolhendoModelo(true)} disabled={!rotinas || !!erro?.includes('rotinas-de-treino.sql')}>
            <Library size={18} /> Usar treino pronto da biblioteca
          </button>
          <div className="acoes-linha rotinas-filtros">
            <button className={`botao-sec ${lista === 'arquivada' ? 'ativo' : ''}`} onClick={() => setLista(lista === 'arquivada' ? 'ativas' : 'arquivada')} aria-pressed={lista === 'arquivada'}>
              <Archive size={16} /> Arquivadas{quantas('arquivada') ? ` (${quantas('arquivada')})` : ''}
            </button>
            <button className={`botao-sec ${lista === 'excluida' ? 'ativo' : ''}`} onClick={() => setLista(lista === 'excluida' ? 'ativas' : 'excluida')} aria-pressed={lista === 'excluida'}>
              <Trash2 size={16} /> Excluídas{quantas('excluida') ? ` (${quantas('excluida')})` : ''}
            </button>
          </div>

          {grupos.length > 1 && (
            <div className="atalhos-data filtro-rotinas" role="radiogroup" aria-label="Organizar por objetivo ou tipo">
              <button type="button" role="radio" aria-checked={!filtro} className={`chip-botao ${!filtro ? 'ativo' : ''}`} onClick={() => setFiltro('')}>
                Todas
              </button>
              {grupos.map((g) => (
                <button key={g} type="button" role="radio" aria-checked={filtro === g} className={`chip-botao ${filtro === g ? 'ativo' : ''}`} onClick={() => setFiltro(filtro === g ? '' : g)}>
                  {g}
                </button>
              ))}
            </div>
          )}

          {aviso && <p className="mensagem ok">{aviso}</p>}
          {erro && <p className="mensagem erro">{erro}</p>}
          {rotinas === null && <p className="carregando">Carregando rotinas…</p>}

          {lista !== 'ativas' && (
            <p className="dica-sec">
              {lista === 'arquivada' ? 'Rotinas antigas ou finalizadas. Toque nos três pontinhos para reativar ou duplicar como base de uma nova.' : 'Rotinas removidas. Toque nos três pontinhos para recuperar.'}{' '}
              <button className="link" onClick={() => setLista('ativas')}>
                Voltar às rotinas ativas
              </button>
            </p>
          )}

          {rotinas && visiveis.length === 0 && (
            <p className="dica-sec centro">
              {lista === 'ativas' ? (filtro ? 'Nenhuma rotina com esse filtro.' : `${primeiro} ainda não tem rotina ativa. Toque em Criar rotina.`) : lista === 'arquivada' ? 'Nenhuma rotina arquivada.' : 'Nenhuma rotina excluída.'}
            </p>
          )}

          {visiveis.length > 0 && <p className="dica-sec">Toque numa rotina para ver os treinos, quantas vezes cada um foi feito e a evolução.</p>}

          <ul className="rotinas-lista">
            {visiveis.map((r) => (
              <CartaoRotina key={r.id} r={r} treinos={treinosDe(r)} feitos={feitosDe(r)} atual={r.id === atual?.id} onAbrir={() => ir({ tipo: 'rotina', id: r.id })} onAcao={(a) => acao(r, a)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
