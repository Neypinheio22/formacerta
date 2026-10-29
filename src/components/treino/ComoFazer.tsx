import { ExternalLink, Image, Pencil, PlayCircle, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GRUPOS } from '../../movimento/exercicios'
import { apagarExercicio, enderecoMidia, salvarExercicio } from '../../nuvem/exercicios'
import { buscaYoutube, idYoutube, type ExercicioProprio } from '../../treino/comoFazer'

/** Foto, vídeo ou YouTube do exercício. Sem nenhum cadastrado, oferece a busca no YouTube. */
export function MidiaExercicio({ nome, ex }: { nome: string; ex?: ExercicioProprio }) {
  // Endereço da foto ou do vídeo, guardado junto com o exercício a que pertence.
  const chave = ex?.tipo ? `${ex.id}:${ex.arquivo ?? ex.link}` : ''
  const [res, setRes] = useState<{ chave: string; url: string | null } | null>(null)
  const [quebrou, setQuebrou] = useState('')

  useEffect(() => {
    if (!ex?.tipo) return
    let vivo = true
    const k = `${ex.id}:${ex.arquivo ?? ex.link}`
    enderecoMidia(ex).then((u) => vivo && setRes({ chave: k, url: u }))
    return () => {
      vivo = false
    }
  }, [ex])

  const url = res?.chave === chave ? res.url : undefined
  const falhou = !!chave && (url === null || quebrou === chave)
  const setFalhou = () => setQuebrou(chave)

  const yt = ex?.tipo === 'link' && ex.link ? idYoutube(ex.link) : null

  return (
    <div className="como-fazer">
      {ex?.tipo && !url && !falhou && <p className="carregando">Carregando…</p>}
      {url && ex?.tipo === 'imagem' && <img className="como-fazer-midia" src={url} alt={`Como fazer ${nome}`} loading="lazy" onError={setFalhou} />}
      {url && ex?.tipo === 'video' && <video className="como-fazer-midia" src={url} controls playsInline preload="metadata" onError={setFalhou} />}
      {yt && (
        <iframe
          className={`como-fazer-midia como-fazer-yt ${ex?.link?.includes('/shorts/') ? 'vertical' : ''}`}
          src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
          title={`Como fazer ${nome}`}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      )}
      {url && ex?.tipo === 'link' && !yt && (
        <a className="botao-sec" href={url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Abrir o vídeo de como fazer
        </a>
      )}
      {ex?.descricao && <p className="como-fazer-texto">{ex.descricao}</p>}
      {(!ex?.tipo || falhou) && (
        <>
          <p className="dica-sec">{falhou ? 'Não deu para abrir a foto ou o vídeo agora.' : 'Seu personal ainda não colocou foto ou vídeo deste exercício.'}</p>
          <a className="botao-sec" href={buscaYoutube(nome)} target="_blank" rel="noreferrer">
            <PlayCircle size={16} /> Ver vídeos de como fazer no YouTube
          </a>
        </>
      )}
    </div>
  )
}

type PropsForm = {
  meuId: string
  admin: boolean
  /** Editando um exercício que já existe. */
  antes?: ExercicioProprio
  nomeInicial?: string
  onPronto: () => void
  onCancelar: () => void
}

/**
 * Cadastro do exercício: nome, grupo, como fazer e foto ou vídeo. Não usa
 * <form> porque também abre dentro do formulário do treino.
 */
export function FormExercicio({ meuId, admin, antes, nomeInicial = '', onPronto, onCancelar }: PropsForm) {
  const [nome, setNome] = useState(antes?.nome ?? nomeInicial)
  const [grupo, setGrupo] = useState(antes?.grupo ?? '')
  const [descricao, setDescricao] = useState(antes?.descricao ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [semMidia, setSemMidia] = useState(false)
  const [doApp, setDoApp] = useState(antes?.do_app ?? false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const temMidia = !!antes?.tipo && !semMidia

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const e = await salvarExercicio({ meuId, antes, nome, grupo, descricao, arquivo, link, semMidia, doApp })
    setSalvando(false)
    if (e) setErro(e)
    else onPronto()
  }

  return (
    <div className="formulario form-exercicio">
      <h3>{antes ? 'Editar exercício' : 'Novo exercício'}</h3>
      <label className="campo">
        Nome do exercício
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Ex.: Remada cavalinho" />
      </label>
      <label className="campo">
        Grupo (opcional)
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Sem grupo</option>
          {[...GRUPOS, 'Peito', 'Glúteo', 'Panturrilha', 'Cardio', 'Alongamento', 'Mobilidade'].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        Como fazer (opcional)
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={500} placeholder="Ex.: tronco a 45°, puxe a barra até o umbigo e segure 1 s" />
      </label>
      {temMidia && !arquivo && !link && (
        <p className="dica-sec">
          Já tem {antes!.tipo === 'imagem' ? 'uma foto' : antes!.tipo === 'video' ? 'um vídeo' : 'um link'}.{' '}
          <button type="button" className="link" onClick={() => setSemMidia(true)}>
            Tirar
          </button>{' '}
          ou escolha outro abaixo para trocar.
        </p>
      )}
      <label className="campo">
        Foto ou vídeo seu fazendo o exercício (até 50 MB)
        <input type="file" accept="image/*,video/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      {!arquivo && (
        <label className="campo">
          ou link do YouTube
          <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtube.com/..." />
        </label>
      )}
      {admin && (
        <label className="aceite">
          <input type="checkbox" checked={doApp} onChange={(e) => setDoApp(e.target.checked)} />
          <span>Exercício do app: aparece para todos os personais e alunos</span>
        </label>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
      <button type="button" className="botao" disabled={salvando || !nome.trim()} onClick={salvar}>
        <Upload size={18} /> {salvando ? (arquivo ? 'Enviando…' : 'Guardando…') : 'Guardar exercício'}
      </button>
      <button type="button" className="botao-sec" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}

const ROTULO_MIDIA = { imagem: 'foto', video: 'vídeo', link: 'YouTube' } as const

/** Lista "Meus exercícios": o personal cadastra, edita e apaga os exercícios dele. */
export function MeusExercicios({ meuId, admin, lista, onMudou }: { meuId: string; admin: boolean; lista: ExercicioProprio[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<ExercicioProprio | 'novo' | null>(null)
  const [vendo, setVendo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const meus = lista.filter((e) => e.profissional_id === meuId || (admin && e.do_app))

  async function apagar(e: ExercicioProprio) {
    if (!confirm(`Apagar "${e.nome}"? A foto ou o vídeo some das fichas que usam este exercício.`)) return
    const r = await apagarExercicio(e)
    if (r) setErro(r)
    else onMudou()
  }

  return (
    <section className="cartao">
      <h2>Meus exercícios</h2>
      <p className="dica-sec">Não achou o exercício no app ou quer usar o seu vídeo? Cadastre aqui com foto ou vídeo. Ele aparece na hora de montar as fichas, e o aluno vê como fazer no treino.</p>
      {meus.length > 0 && (
        <ul className="materiais">
          {meus.map((e) => (
            <li key={e.id}>
              <div className="material">
                <button className="material-abrir" onClick={() => setVendo(vendo === e.id ? null : e.id)}>
                  <span className="atalho-icone">{e.tipo === 'imagem' ? <Image size={18} /> : <PlayCircle size={18} />}</span>
                  <span className="material-texto">
                    <strong>{e.nome}</strong>
                    <small>
                      {[e.grupo, e.tipo ? `com ${ROTULO_MIDIA[e.tipo]}` : 'sem foto ou vídeo', e.do_app ? 'do app' : ''].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                </button>
                <button className="icone-apagar" aria-label={`Editar ${e.nome}`} onClick={() => setEditando(e)}>
                  <Pencil size={16} />
                </button>
                <button className="icone-apagar" aria-label={`Apagar ${e.nome}`} onClick={() => apagar(e)}>
                  <Trash2 size={16} />
                </button>
              </div>
              {vendo === e.id && <MidiaExercicio nome={e.nome} ex={e} />}
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
      {editando ? (
        <FormExercicio
          meuId={meuId}
          admin={admin}
          antes={editando === 'novo' ? undefined : editando}
          onCancelar={() => setEditando(null)}
          onPronto={() => {
            setEditando(null)
            onMudou()
          }}
        />
      ) : (
        <button className="botao-sec" onClick={() => setEditando('novo')}>
          <Plus size={16} /> Criar exercício
        </button>
      )}
    </section>
  )
}
