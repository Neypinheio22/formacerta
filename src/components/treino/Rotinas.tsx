import { Archive, ArchiveRestore, CalendarDays, Copy, EllipsisVertical, HeartPulse, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ficha } from '../../nuvem/fichas'
import { fotoDoAluno, listarRotinas, listarTreinosDasRotinas, mudarSituacao, salvarRotina, type DadosRotina, type Rotina, type TreinoRascunho } from '../../nuvem/rotinas'
import { comLinhas, exercicioVazio, type Treino } from '../../nuvem/treinos'
import { dataCurta } from '../../testes/formato'
import { andamento, dataDia, DIVISOES, iconePadrao, ICONES_ROTINA, NIVEIS, nomeSugerido, OBJETIVOS_ROTINA, ordenarRotinas, rotinaAtual, rotuloNivel, somarSemanas, type Nivel, type Situacao } from '../../treino/rotinas'
import { diaLocal } from '../../treino/semana'
import { SERIE_SUGERIDA } from '../../treino/sugerida'
import { AbaAerobico } from './Aerobico'
import { EditorExercicios, type Biblioteca } from './EditorTreinos'
import { DesenhoIcone, IconeDaRotina } from './IconeRotina'
import { useExercicios } from './useExercicios'

type Lista = 'ativas' | 'arquivada' | 'excluida'

/** O que abre no formulário: rotina nova, cópia de outra ou edição. */
type Edicao = { id?: string; dados: DadosRotina; treinos: TreinoRascunho[]; copiaDe?: string }

const treinoVazio = (letra: string): TreinoRascunho => ({ letra, nome: '', exercicios: [exercicioVazio()] })

function novaRotina(): Edicao {
  const hoje = diaLocal(new Date())
  return {
    dados: { nome: nomeSugerido(), inicio: hoje, fim: somarSemanas(hoje, 8), objetivo: '', nivel: '', icone: '' },
    treinos: ['A', 'B', 'C'].map(treinoVazio),
  }
}

/** Cópia para a próxima fase: mesmos treinos, datas novas com a mesma duração. */
function copiaDe(r: Rotina, treinos: Treino[]): Edicao {
  const hoje = diaLocal(new Date())
  const semanas = r.inicio && r.fim ? Math.max(1, Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / (7 * 86400000))) : 8
  return {
    copiaDe: r.nome,
    dados: { nome: `${r.nome} (cópia)`.slice(0, 60), inicio: hoje, fim: somarSemanas(hoje, semanas), objetivo: r.objetivo, nivel: r.nivel, icone: r.icone },
    treinos: treinos.map((t) => ({ letra: t.letra, nome: t.nome, exercicios: comLinhas(t.exercicios) })),
  }
}

/** Menu dos três pontinhos do cartão. */
function MenuRotina({ r, onAcao }: { r: Rotina; onAcao: (acao: 'editar' | 'duplicar' | Situacao) => void }) {
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
              {r.situacao === 'arquivada' ? item('ativa', <ArchiveRestore size={16} />, 'Reativar') : item('arquivada', <Archive size={16} />, 'Arquivar')}
              {item('excluida', <Trash2 size={16} />, 'Excluir', true)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CartaoRotina({ r, treinos, atual, onAbrir, onAcao }: { r: Rotina; treinos: Treino[]; atual: boolean; onAbrir: () => void; onAcao: (acao: 'editar' | 'duplicar' | Situacao) => void }) {
  const a = andamento(r)
  const exercicios = treinos.reduce((n, t) => n + t.exercicios.length, 0)
  return (
    <li className={`cartao rotina-cartao ${atual ? 'atual' : ''}`}>
      <button className="rotina-corpo" onClick={onAbrir} disabled={r.situacao === 'excluida'}>
        <IconeDaRotina id={r.icone || iconePadrao(r.objetivo)} />
        <span className="rotina-info">
          <strong>{r.nome}</strong>
          <small>
            <CalendarDays size={13} /> {r.inicio ? dataDia(r.inicio) : 'Sem início'} até {r.fim ? dataDia(r.fim) : 'sem data'}
          </small>
          <span className="rotina-chips">
            {r.objetivo && <span className="chip chip-neutro">{r.objetivo}</span>}
            {r.nivel && <span className="chip chip-neutro">{rotuloNivel(r.nivel)}</span>}
            <span className={`chip chip-${a.tom}`}>{atual ? `Valendo · ${a.rotulo.toLowerCase()}` : a.rotulo}</span>
          </span>
          <small>
            {treinos.length ? `Treinos ${treinos.map((t) => t.letra).join(' ')} · ${exercicios} exercício${exercicios === 1 ? '' : 's'}` : 'Sem treinos'}
            {r.situacao === 'excluida' && r.excluida_em && ` · excluída em ${dataCurta(r.excluida_em)}`}
          </small>
        </span>
      </button>
      <MenuRotina r={r} onAcao={onAcao} />
    </li>
  )
}

function FormRotina({ inicial, bib, nomeAluno, onSalvar, onCancelar }: { inicial: Edicao; bib: Biblioteca; nomeAluno: string; onSalvar: (e: Edicao) => Promise<string | null>; onCancelar: () => void }) {
  const [dados, setDados] = useState(inicial.dados)
  const [treinos, setTreinos] = useState<TreinoRascunho[]>(() => inicial.treinos.map((t) => ({ ...t, exercicios: comLinhas(t.exercicios) })))
  const [letra, setLetra] = useState(inicial.treinos[0]?.letra ?? 'A')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const divisao = treinos.map((t) => t.letra).join('')
  const treino = treinos.find((t) => t.letra === letra) ?? treinos[0]
  const vazio = !treinos.some((t) => t.exercicios.some((e) => e.nome.trim()))

  function mudarDivisao(nova: string) {
    const sai = treinos.filter((t) => !nova.includes(t.letra) && t.exercicios.some((e) => e.nome.trim()))
    if (sai.length && !confirm(`Tirar ${sai.map((t) => `o treino ${t.letra}`).join(' e ')} desta rotina? Os exercícios dele saem junto.`)) return
    setTreinos(nova.split('').map((l) => treinos.find((t) => t.letra === l) ?? treinoVazio(l)))
    if (!nova.includes(letra)) setLetra('A')
  }

  function usarSugerida() {
    setTreinos(SERIE_SUGERIDA.map((t) => ({ letra: t.letra, nome: t.nome, exercicios: comLinhas(t.exercicios) })))
    setLetra('A')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!dados.nome.trim()) return setErro('Dê um nome para a rotina.')
    if (dados.inicio && dados.fim && dados.fim < dados.inicio) return setErro('A validade precisa ser depois do início.')
    setSalvando(true)
    const e2 = await onSalvar({ ...inicial, dados, treinos })
    setSalvando(false)
    setErro(e2)
  }

  return (
    <form className="formulario rotina-form" onSubmit={salvar}>
      <section className="cartao destaque">
        <h2>{inicial.id ? 'Editar rotina' : inicial.copiaDe ? `Cópia de ${inicial.copiaDe}` : 'Nova rotina'}</h2>
        <label className="campo">
          Nome da rotina
          <input value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} maxLength={60} placeholder="Ex.: TREINO NOVO 2026/11" />
        </label>
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
          <legend>Nível do aluno</legend>
          <div className="atalhos-data">
            {NIVEIS.map((n) => (
              <button key={n.id} type="button" className={`chip-botao ${dados.nivel === n.id ? 'ativo' : ''}`} onClick={() => setDados({ ...dados, nivel: dados.nivel === n.id ? '' : (n.id as Nivel) })}>
                {n.rotulo}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="campo">
          <legend>Ícone do cartão</legend>
          <div className="icones-rotina">
            {ICONES_ROTINA.map((i) => {
              const escolhido = (dados.icone || iconePadrao(dados.objetivo)) === i.id
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
        </div>
        {treino && (
          <div key={treino.letra}>
            <label className="campo">
              Nome do treino {treino.letra}
              <input value={treino.nome} onChange={(e) => setTreinos(treinos.map((t) => (t.letra === treino.letra ? { ...t, nome: e.target.value } : t)))} maxLength={60} placeholder="Ex.: Pernas, Superiores, Glúteo" />
            </label>
            <EditorExercicios exercicios={treino.exercicios} bib={bib} onMudar={(exercicios) => setTreinos(treinos.map((t) => (t.letra === treino.letra ? { ...t, exercicios } : t)))} />
          </div>
        )}
      </section>

      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao grande" type="submit" disabled={salvando || vazio}>
        {salvando ? 'Guardando…' : `Salvar e liberar para ${nomeAluno}`}
      </button>
      {vazio && <p className="dica-sec centro">Coloque pelo menos um exercício para salvar.</p>}
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}

/** Tela de rotinas do aluno (personal): rotinas de treino e aeróbico, com histórico. */
export function TelaRotinas({ ficha, meuId, onVoltar }: { ficha: Ficha; meuId: string; onVoltar: () => void }) {
  const [aba, setAba] = useState<'rotinas' | 'aerobico'>('rotinas')
  const [lista, setLista] = useState<Lista>('ativas')
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null)
  const [treinos, setTreinos] = useState<Treino[]>([])
  const [foto, setFoto] = useState('')
  const [editando, setEditando] = useState<Edicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const exercicios = useExercicios()
  const bib: Biblioteca = { meuId, lista: exercicios.lista, onMudou: exercicios.recarregar }
  const primeiro = ficha.nome.split(' ')[0]

  const carregar = useCallback(async () => {
    const r = await listarRotinas(ficha.id)
    setTreinos(await listarTreinosDasRotinas(r.rotinas.map((x) => x.id)))
    setRotinas(r.rotinas)
    setErro(r.semTabela ? 'Falta rodar no Supabase o arquivo rotinas-de-treino.sql para as rotinas funcionarem.' : r.erro)
  }, [ficha.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    fotoDoAluno(ficha.aluno_id).then(setFoto)
  }, [ficha.aluno_id])

  const treinosDe = (r: Rotina) => treinos.filter((t) => t.rotina_id === r.id)

  async function acao(r: Rotina, a: 'editar' | 'duplicar' | Situacao) {
    setAviso(null)
    if (a === 'editar') return setEditando({ id: r.id, dados: r, treinos: treinosDe(r) })
    if (a === 'duplicar') return setEditando(copiaDe(r, treinosDe(r)))
    if (a === 'excluida' && !confirm(`Excluir a rotina ${r.nome}? Ela vai para Excluídas e dá para recuperar depois.`)) return
    const e = await mudarSituacao(r.id, a)
    if (e) return setErro(e)
    setAviso(a === 'arquivada' ? `${r.nome} foi para Arquivadas.` : a === 'excluida' ? `${r.nome} foi para Excluídas.` : `${r.nome} voltou para as rotinas.`)
    carregar()
  }

  const cabecalho = (
    <header className="rotinas-topo">
      <button className="voltar" onClick={editando ? () => setEditando(null) : onVoltar} aria-label="Voltar">
        ←
      </button>
      {foto ? <img className="rotinas-foto" src={foto} alt="" /> : <span className="personal-inicial">{ficha.nome.charAt(0).toUpperCase()}</span>}
      <div>
        <h1>{ficha.nome}</h1>
        <small className="dica-sec">{editando ? 'Rotina de treino' : 'Rotinas e aeróbico'}</small>
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
          nomeAluno={primeiro}
          onCancelar={() => setEditando(null)}
          onSalvar={async (e) => {
            const r = await salvarRotina(ficha.id, e.id, e.dados, e.treinos)
            if (r.erro) return r.erro
            setEditando(null)
            setLista('ativas')
            setAviso(e.id ? 'Rotina atualizada. O aluno já vê as mudanças.' : `Rotina salva e liberada para ${primeiro}. As anteriores continuam guardadas.`)
            await carregar()
            window.scrollTo(0, 0)
            return null
          }}
        />
      </div>
    )

  const atual = rotinas ? rotinaAtual(rotinas) : null
  const visiveis = rotinas ? ordenarRotinas(rotinas.filter((r) => (lista === 'ativas' ? r.situacao === 'ativa' : r.situacao === lista))) : []
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
          <div className="acoes-linha rotinas-filtros">
            <button className={`botao-sec ${lista === 'arquivada' ? 'ativo' : ''}`} onClick={() => setLista(lista === 'arquivada' ? 'ativas' : 'arquivada')} aria-pressed={lista === 'arquivada'}>
              <Archive size={16} /> Arquivadas{quantas('arquivada') ? ` (${quantas('arquivada')})` : ''}
            </button>
            <button className={`botao-sec ${lista === 'excluida' ? 'ativo' : ''}`} onClick={() => setLista(lista === 'excluida' ? 'ativas' : 'excluida')} aria-pressed={lista === 'excluida'}>
              <Trash2 size={16} /> Excluídas{quantas('excluida') ? ` (${quantas('excluida')})` : ''}
            </button>
          </div>

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
              {lista === 'ativas' ? `${primeiro} ainda não tem rotina ativa. Toque em Criar rotina.` : lista === 'arquivada' ? 'Nenhuma rotina arquivada.' : 'Nenhuma rotina excluída.'}
            </p>
          )}

          <ul className="rotinas-lista">
            {visiveis.map((r) => (
              <CartaoRotina key={r.id} r={r} treinos={treinosDe(r)} atual={r.id === atual?.id} onAbrir={() => acao(r, 'editar')} onAcao={(a) => acao(r, a)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
