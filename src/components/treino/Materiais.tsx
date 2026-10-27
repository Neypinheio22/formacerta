import { FileText, Image, Link2, PlayCircle, Trash2, Upload, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { apagarMaterial, enderecoMaterial, enviarMaterial, listarMateriais, type Material, type TipoMaterial } from '../../nuvem/materiais'
import { dataCurta } from '../../testes/formato'

const ICONE: Record<TipoMaterial, LucideIcon> = { pdf: FileText, video: PlayCircle, imagem: Image, link: Link2 }

function LinhaMaterial({ m, onApagar }: { m: Material; onApagar?: () => void }) {
  const [abrindo, setAbrindo] = useState(false)
  const Icone = ICONE[m.tipo]

  async function abrir() {
    // Abre a aba antes de buscar o endereço: o Safari bloqueia janela aberta depois de esperar.
    const janela = window.open('', '_blank')
    setAbrindo(true)
    const url = await enderecoMaterial(m)
    setAbrindo(false)
    if (url && janela) janela.location.href = url
    else if (url) window.location.href = url
    else janela?.close()
  }

  return (
    <li className="material">
      <button className="material-abrir" onClick={abrir} disabled={abrindo}>
        <span className="atalho-icone">
          <Icone size={18} />
        </span>
        <span className="material-texto">
          <strong>{m.titulo}</strong>
          {m.descricao && <span>{m.descricao}</span>}
          <small>
            {abrindo ? 'Abrindo…' : dataCurta(m.criado_em)}
            {onApagar && (m.ficha_id ? ' · só este aluno' : ' · todos os alunos')}
          </small>
        </span>
      </button>
      {onApagar && (
        <button className="icone-apagar" aria-label="Apagar material" onClick={onApagar}>
          <Trash2 size={16} />
        </button>
      )}
    </li>
  )
}

/** Materiais extras que o personal mandou (aluno só vê). */
export function ListaMateriais({ fichaId }: { fichaId?: string }) {
  const [lista, setLista] = useState<Material[] | null>(null)

  useEffect(() => {
    listarMateriais(fichaId).then((r) => setLista(r.materiais))
  }, [fichaId])

  if (!lista?.length) return null
  return (
    <section className="cartao">
      <h2>Materiais extras</h2>
      <p className="dica-sec">PDFs, vídeos e links que o seu personal separou para você.</p>
      <ul className="materiais">
        {lista.map((m) => (
          <LinhaMaterial key={m.id} m={m} />
        ))}
      </ul>
    </section>
  )
}

/** O personal envia e apaga materiais para um aluno ou para todos os alunos dele. */
export function MateriaisEditor({ meuId, fichaId, nome }: { meuId: string; fichaId: string; nome: string }) {
  const [lista, setLista] = useState<Material[]>([])
  const [novo, setNovo] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [todos, setTodos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await listarMateriais(fichaId)
    setLista(r.materiais)
    setErro(r.erro)
  }, [fichaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    const erro = await enviarMaterial({ meuId, fichaId: todos ? null : fichaId, titulo, descricao, arquivo, link })
    setEnviando(false)
    if (erro) return setErro(erro)
    setNovo(false)
    setTitulo('')
    setDescricao('')
    setArquivo(null)
    setLink('')
    carregar()
  }

  async function apagar(m: Material) {
    if (!confirm(`Apagar "${m.titulo}"? ${m.ficha_id ? '' : 'Some para todos os seus alunos.'}`)) return
    const e = await apagarMaterial(m)
    if (e) setErro(e)
    else carregar()
  }

  return (
    <section className="cartao">
      <h2>Materiais extras</h2>
      <p className="dica-sec">PDF, vídeo (até 50 MB) ou link do YouTube. {nome.split(' ')[0]} vê na aba Treino.</p>
      {lista.length > 0 && (
        <ul className="materiais">
          {lista.map((m) => (
            <LinhaMaterial key={m.id} m={m} onApagar={m.profissional_id === meuId ? () => apagar(m) : undefined} />
          ))}
        </ul>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
      {novo ? (
        <form className="formulario" onSubmit={enviar}>
          <label className="campo">
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Ex.: Alongamento antes do treino" required />
          </label>
          <label className="campo">
            Explicação (opcional)
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} maxLength={300} />
          </label>
          <label className="campo">
            Arquivo (PDF, vídeo ou imagem)
            <input type="file" accept="application/pdf,video/*,image/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
          {!arquivo && (
            <label className="campo">
              ou um link
              <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtube.com/..." />
            </label>
          )}
          <label className="aceite">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
            <span>Mandar para todos os meus alunos</span>
          </label>
          <button className="botao" type="submit" disabled={enviando || !titulo.trim() || (!arquivo && !link.trim())}>
            <Upload size={18} /> {enviando ? 'Enviando…' : 'Enviar material'}
          </button>
          <button className="botao-sec" type="button" onClick={() => setNovo(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button className="botao-sec" onClick={() => setNovo(true)}>
          <Upload size={16} /> Novo material
        </button>
      )}
    </section>
  )
}
