import { Activity, Camera, Check, ChevronDown, Dumbbell, Eye, Film, HeartPulse, Library, Move, Pencil, PersonStanding, Plus, Search, Shapes, Sparkles, Star, Stethoscope, Trash2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { apagarExercicio, enderecoMidia } from '../../nuvem/exercicios'
import { listarFavoritos, mudarFavorito } from '../../nuvem/favoritos'
import { CATEGORIAS, contar, ehMeu, filtrar, FILTRO_INICIAL, GRUPOS_MUSCULARES, miniaturaYoutube, montarBiblioteca, type Aba, type Filtro, type ItemBiblioteca } from '../../treino/catalogo'
import type { ExercicioProprio } from '../../treino/comoFazer'
import { FormExercicio, MidiaExercicio } from './ComoFazer'

const ICONE_CATEGORIA: Record<string, React.ComponentType<{ size?: number }>> = {
  Musculação: Dumbbell,
  'Peso do corpo': PersonStanding,
  Funcional: Zap,
  Cardio: HeartPulse,
  Mobilidade: Move,
  Alongamento: Activity,
  Reabilitação: Stethoscope,
}

/** Cor de fundo da miniatura sem foto, pelo grupo muscular. */
const corDoGrupo = (g: string) => {
  const i = (GRUPOS_MUSCULARES as readonly string[]).indexOf(g)
  return `hsl(${i < 0 ? 200 : (150 + i * 24) % 360} 45% 22%)`
}

function useFavoritos() {
  const [chaves, setChaves] = useState<Set<string>>(new Set())
  const [soNoAparelho, setSoNoAparelho] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    listarFavoritos().then((r) => {
      setChaves(new Set(r.chaves))
      setSoNoAparelho(r.soNoAparelho)
      setErro(r.erro)
    })
  }, [])
  const alternar = useCallback(
    async (chave: string) => {
      const fav = !chaves.has(chave)
      const novo = new Set(chaves)
      if (fav) novo.add(chave)
      else novo.delete(chave)
      setChaves(novo)
      const e = await mudarFavorito(chave, fav, soNoAparelho)
      if (e) {
        setErro(e)
        setChaves(chaves)
      }
    },
    [chaves, soNoAparelho],
  )
  return { chaves, soNoAparelho, erro, alternar }
}

/** Miniatura da lista: a foto, o GIF, o vídeo ou a capa do YouTube. Sem nada, um bloco com o ícone da categoria. */
function Miniatura({ item }: { item: ItemBiblioteca }) {
  const m = item.midia
  const yt = m?.tipo === 'link' ? miniaturaYoutube(m.link) : null
  const arquivo = m?.tipo === 'imagem' || m?.tipo === 'video' ? m : null
  const [url, setUrl] = useState<{ de: string; url: string | null } | null>(null)
  const [quebrou, setQuebrou] = useState(false)
  useEffect(() => {
    if (!arquivo) return
    let vivo = true
    enderecoMidia(arquivo).then((u) => vivo && setUrl({ de: arquivo.id, url: u }))
    return () => {
      vivo = false
    }
  }, [arquivo])
  const Icone = ICONE_CATEGORIA[item.categoria] ?? Dumbbell
  const src = arquivo && url?.de === arquivo.id ? url.url : null
  const temVideo = m?.tipo === 'video' || m?.tipo === 'link'
  return (
    <span className="bib-miniatura" style={{ background: corDoGrupo(item.grupo) }} aria-hidden>
      {!quebrou && yt && <img src={yt} alt="" loading="lazy" onError={() => setQuebrou(true)} />}
      {!quebrou && src && m?.tipo === 'imagem' && <img src={src} alt="" loading="lazy" onError={() => setQuebrou(true)} />}
      {!quebrou && src && m?.tipo === 'video' && <video src={`${src}#t=0.5`} muted playsInline preload="metadata" onError={() => setQuebrou(true)} />}
      {(quebrou || (!yt && !src)) && <Icone size={26} />}
      {temVideo && !quebrou && (yt || src) && <span className="bib-play">▶</span>}
    </span>
  )
}

type Escolha = {
  /** Nomes que já estão no treino aberto (aparecem marcados como "na ficha"). */
  naFicha: string[]
  onAdicionar: (nomes: string[]) => void
}

type Props = {
  meuId: string
  admin: boolean
  lista: ExercicioProprio[]
  onMudou: () => void
  onFechar: () => void
  /** Aberta na montagem da ficha: tocar escolhe o exercício. */
  escolha?: Escolha
}

/**
 * Biblioteca de exercícios, no modelo do MFIT: exercícios do app e do
 * personal, com grupos, categorias, busca, foto/GIF/vídeo e favoritos. Na
 * montagem da ficha vira um seletor: marca vários e adiciona de uma vez.
 */
export function BibliotecaExercicios(props: Props) {
  // Fora da árvore da página: não herda o <form> da ficha nem fica atrás da barra de baixo.
  return createPortal(<Tela {...props} />, document.body)
}

function Tela({ meuId, admin, lista, onMudou, onFechar, escolha }: Props) {
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_INICIAL)
  const [vista, setVista] = useState<'lista' | 'grupos' | 'categorias'>('lista')
  const [aberto, setAberto] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ item?: ItemBiblioteca; novo?: boolean } | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const fav = useFavoritos()

  const itens = useMemo(() => montarBiblioteca(lista, meuId), [lista, meuId])
  const visiveis = useMemo(() => {
    const r = filtrar(itens, filtro, fav.chaves, meuId)
    // Favoritos primeiro: são os mais usados.
    return [...r.filter((i) => fav.chaves.has(i.chave)), ...r.filter((i) => !fav.chaves.has(i.chave))]
  }, [itens, filtro, fav.chaves, meuId])
  const naFicha = useMemo(() => new Set((escolha?.naFicha ?? []).map((n) => n.trim().toLowerCase())), [escolha])
  const meus = itens.filter((i) => ehMeu(i, meuId)).length

  // A tela cobre o app inteiro: a página de trás não rola junto.
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [])

  const mudar = (f: Partial<Filtro>) => setFiltro({ ...filtro, ...f })

  function marcar(i: ItemBiblioteca) {
    setMarcados(marcados.includes(i.nome) ? marcados.filter((n) => n !== i.nome) : [...marcados, i.nome])
  }

  async function apagar(i: ItemBiblioteca) {
    if (!i.proprio) return
    if (!confirm(`Excluir "${i.nome}"? A foto ou o vídeo some das fichas que usam este exercício.${i.doApp ? ' O exercício do app continua na biblioteca.' : ''}`)) return
    const e = await apagarExercicio(i.proprio)
    if (e) return setErro(e)
    setErro(null)
    setAviso(`"${i.nome}" foi excluído.`)
    setAberto(null)
    onMudou()
  }

  const podeEditar = (i: ItemBiblioteca) => ehMeu(i, meuId) || (admin && !!i.proprio?.do_app)

  const topo = (
    <header className="bib-topo">
      <button className="voltar" onClick={editando ? () => setEditando(null) : vista !== 'lista' ? () => setVista('lista') : onFechar} aria-label="Voltar">
        ←
      </button>
      <div>
        <h1>Biblioteca de exercícios</h1>
        <small className="dica-sec">{escolha ? 'Toque nos exercícios e depois em Adicionar' : `${itens.length} exercícios · ${meus} seu${meus === 1 ? '' : 's'}`}</small>
      </div>
      <button className="icone-apagar" onClick={onFechar} aria-label="Fechar">
        <X size={20} />
      </button>
    </header>
  )

  if (editando) {
    const it = editando.item
    const meu = it && podeEditar(it) ? it.proprio : undefined
    return (
      <div className="bib-ex" role="dialog" aria-label="Biblioteca de exercícios">
        <div className="bib-conteudo">
          {topo}
          {it && !meu && <p className="dica-sec">Você está criando a sua versão de "{it.nome}". Nas suas fichas, o aluno vê a sua foto ou vídeo no lugar do vídeo do app.</p>}
          <FormExercicio
            meuId={meuId}
            admin={admin}
            antes={meu}
            nomeInicial={it?.nome ?? filtro.busca.trim()}
            grupoInicial={it?.grupo ?? filtro.grupo}
            categoriaInicial={it?.categoria ?? filtro.categoria}
            onCancelar={() => setEditando(null)}
            onPronto={() => {
              setEditando(null)
              setAviso(meu ? 'Exercício atualizado.' : 'Exercício guardado na sua biblioteca.')
              if (!it) mudar({ aba: 'meus', busca: '' })
              onMudou()
            }}
          />
        </div>
      </div>
    )
  }

  const grade = (campo: 'grupo' | 'categoria') => {
    const n = contar(itens, campo)
    const opcoes = campo === 'grupo' ? [...GRUPOS_MUSCULARES, ...[...n.keys()].filter((g) => !(GRUPOS_MUSCULARES as readonly string[]).includes(g))] : [...CATEGORIAS]
    return (
      <div className="bib-grade">
        {opcoes.map((o) => {
          const Icone = campo === 'categoria' ? (ICONE_CATEGORIA[o] ?? Dumbbell) : Dumbbell
          return (
            <button
              key={o}
              className={`bib-grade-item ${filtro[campo] === o ? 'ativo' : ''}`}
              style={campo === 'grupo' ? { background: corDoGrupo(o) } : undefined}
              onClick={() => {
                mudar({ [campo]: o })
                setVista('lista')
              }}
            >
              {campo === 'categoria' && <Icone size={22} />}
              <strong>{o}</strong>
              <small>{n.get(o) ?? 0} exercícios</small>
            </button>
          )
        })}
      </div>
    )
  }

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'favoritos', rotulo: `Favoritos${fav.chaves.size ? ` (${fav.chaves.size})` : ''}` },
    { id: 'app', rotulo: 'Do app' },
    { id: 'meus', rotulo: `Seus exercícios${meus ? ` (${meus})` : ''}` },
  ]
  const filtrando = filtro.grupo || filtro.categoria || filtro.busca || filtro.aba !== 'todos'

  return (
    <div className="bib-ex" role="dialog" aria-label="Biblioteca de exercícios">
      <div className={`bib-conteudo ${escolha ? 'com-barra' : ''}`}>
        {topo}
        <button className="bib-criar" onClick={() => setEditando({ novo: true })}>
          <Plus size={18} /> Criar exercício
        </button>
        <div className="bib-botoes">
          <button className={vista === 'grupos' ? 'ativo' : ''} onClick={() => setVista(vista === 'grupos' ? 'lista' : 'grupos')}>
            <Dumbbell size={16} /> Grupos
          </button>
          <button className={vista === 'categorias' ? 'ativo' : ''} onClick={() => setVista(vista === 'categorias' ? 'lista' : 'categorias')}>
            <Shapes size={16} /> Categorias
          </button>
        </div>
        <label className="bib-busca">
          <Search size={18} />
          <input
            type="search"
            value={filtro.busca}
            onChange={(e) => {
              mudar({ busca: e.target.value })
              setVista('lista')
            }}
            placeholder="Buscar exercícios..."
            aria-label="Buscar exercícios pelo nome"
          />
        </label>

        {vista === 'grupos' && grade('grupo')}
        {vista === 'categorias' && grade('categoria')}

        {vista === 'lista' && (
          <>
            <div className="bib-abas" role="tablist">
              {abas.map((a) => (
                <button key={a.id} role="tab" aria-selected={filtro.aba === a.id} className={filtro.aba === a.id ? 'ativo' : ''} onClick={() => mudar({ aba: a.id })}>
                  {a.rotulo}
                </button>
              ))}
            </div>
            <div className="bib-filtros">
              <label>
                <select value={filtro.grupo} onChange={(e) => mudar({ grupo: e.target.value })} aria-label="Grupo muscular">
                  <option value="">Grupos musculares</option>
                  {GRUPOS_MUSCULARES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label>
                <select value={filtro.categoria} onChange={(e) => mudar({ categoria: e.target.value })} aria-label="Categoria">
                  <option value="">Categorias</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              {filtrando && (
                <button className="link" onClick={() => setFiltro(FILTRO_INICIAL)}>
                  Limpar
                </button>
              )}
            </div>

            {fav.soNoAparelho && <p className="dica-sec">Os favoritos estão guardados só neste aparelho. Rode no Supabase o arquivo biblioteca-de-exercicios.sql para valerem em qualquer celular.</p>}
            {(erro || fav.erro) && <p className="mensagem erro">{erro || fav.erro}</p>}
            {aviso && <p className="mensagem ok">{aviso}</p>}

            <p className="dica-sec bib-total">
              {visiveis.length} exercício{visiveis.length === 1 ? '' : 's'}
              {filtro.grupo && ` · ${filtro.grupo}`}
              {filtro.categoria && ` · ${filtro.categoria}`}
            </p>

            {visiveis.length === 0 && (
              <div className="cartao centro">
                <p className="dica-sec">
                  {filtro.aba === 'favoritos'
                    ? 'Nenhum favorito ainda. Toque na estrela dos exercícios que você mais usa.'
                    : filtro.aba === 'meus'
                      ? 'Você ainda não criou exercícios. Crie com sua foto, GIF ou vídeo.'
                      : 'Nenhum exercício com esse nome.'}
                </p>
                {filtro.aba !== 'favoritos' && (
                  <button className="botao-sec" onClick={() => setEditando({ novo: true })}>
                    <Plus size={16} /> Criar {filtro.busca.trim() ? `"${filtro.busca.trim()}"` : 'exercício'}
                  </button>
                )}
              </div>
            )}

            <ul className="bib-lista">
              {visiveis.map((i) => {
                const marcado = marcados.includes(i.nome)
                const jaNaFicha = naFicha.has(i.nome.trim().toLowerCase())
                const favorito = fav.chaves.has(i.chave)
                return (
                  <li key={i.chave} className={`bib-item ${marcado ? 'marcado' : ''}`}>
                    <div className="bib-linha">
                      <button className="bib-corpo" onClick={() => (escolha ? marcar(i) : setAberto(aberto === i.chave ? null : i.chave))} aria-pressed={escolha ? marcado : undefined} aria-expanded={escolha ? undefined : aberto === i.chave}>
                        {escolha && <span className={`bib-check ${marcado ? 'ativo' : ''}`}>{marcado && <Check size={16} />}</span>}
                        <Miniatura item={i} />
                        <span className="bib-texto">
                          <strong>{i.nome}</strong>
                          <span className="rotina-chips">
                            {i.grupo && <span className="chip chip-neutro">{i.grupo}</span>}
                            {i.categoria && <span className="chip chip-neutro">{i.categoria}</span>}
                            {ehMeu(i, meuId) && <span className="chip chip-ok">Seu{i.proprio?.tipo ? ' vídeo' : ''}</span>}
                            {i.camera && (
                              <span className="chip chip-ok">
                                <Camera size={11} /> câmera
                              </span>
                            )}
                            {jaNaFicha && <span className="chip chip-atencao">na ficha</span>}
                          </span>
                        </span>
                      </button>
                      {escolha && (
                        <button className="icone-apagar" aria-label={`Ver ${i.nome}`} aria-expanded={aberto === i.chave} onClick={() => setAberto(aberto === i.chave ? null : i.chave)}>
                          <Eye size={18} />
                        </button>
                      )}
                      <button className={`bib-estrela ${favorito ? 'ativo' : ''}`} aria-label={favorito ? `Tirar ${i.nome} dos favoritos` : `Favoritar ${i.nome}`} aria-pressed={favorito} onClick={() => fav.alternar(i.chave)}>
                        <Star size={20} fill={favorito ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    {aberto === i.chave && (
                      <div className="bib-detalhe">
                        <MidiaExercicio nome={i.nome} ex={i.midia} />
                        <div className="acoes-linha">
                          {escolha && (
                            <button className="botao-sec" onClick={() => escolha.onAdicionar([i.nome])}>
                              <Plus size={16} /> Adicionar à ficha
                            </button>
                          )}
                          {podeEditar(i) ? (
                            <>
                              <button className="botao-sec" onClick={() => setEditando({ item: i })}>
                                <Pencil size={16} /> Editar
                              </button>
                              <button className="botao-sec perigo" onClick={() => apagar(i)}>
                                <Trash2 size={16} /> Excluir
                              </button>
                            </>
                          ) : (
                            <button className="botao-sec" onClick={() => setEditando({ item: i })}>
                              <Film size={16} /> Pôr meu vídeo ou foto
                            </button>
                          )}
                        </div>
                        {i.doApp && !podeEditar(i) && (
                          <p className="dica-sec">
                            <Sparkles size={12} /> Exercício do FormaCerta: não dá para excluir, mas você pode pôr o seu vídeo e o seu texto de como fazer.
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {escolha && (
        <div className="bib-barra">
          <button className="botao grande" disabled={!marcados.length} onClick={() => escolha.onAdicionar(marcados)}>
            <Plus size={20} /> {marcados.length ? `Adicionar ${marcados.length} à ficha` : 'Escolha os exercícios'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Cartão que abre a biblioteca (aba Treino do personal e aba Treino da ficha). */
export function CartaoBibliotecaExercicios({ meuId, admin, lista, onMudou }: { meuId: string; admin: boolean; lista: ExercicioProprio[]; onMudou: () => void }) {
  const [aberta, setAberta] = useState(false)
  const meus = lista.filter((e) => e.profissional_id === meuId).length
  return (
    <section className="cartao destaque">
      <span className="etiqueta">
        <Library size={14} /> Exercícios
      </span>
      <h2>Biblioteca de exercícios</h2>
      <p className="dica-sec">
        Mais de 150 exercícios por grupo muscular e categoria, com busca e favoritos. Crie os seus com foto, GIF ou vídeo{meus ? ` (você tem ${meus})` : ''}. Na montagem da ficha, toque em Buscar na biblioteca.
      </p>
      <button className="botao grande" onClick={() => setAberta(true)}>
        <Search size={18} /> Abrir biblioteca de exercícios
      </button>
      {aberta && <BibliotecaExercicios meuId={meuId} admin={admin} lista={lista} onMudou={onMudou} onFechar={() => setAberta(false)} />}
    </section>
  )
}
