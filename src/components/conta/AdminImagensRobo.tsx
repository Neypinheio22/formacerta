import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apagarArquivo, apagarImagem, chaveDoTitulo, criarImagem, listarImagens, salvarImagem, subirImagem, type ImagemRobo } from '../../nuvem/whatsappAgente'

const TIPOS = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

/** Administrador: imagens de passo a passo que o robô manda no WhatsApp. */
export function AdminImagensRobo() {
  const [lista, setLista] = useState<ImagemRobo[] | null | undefined>(undefined)
  const [nova, setNova] = useState(false)

  const recarregar = () => listarImagens().then(setLista)
  useEffect(() => {
    recarregar()
  }, [])

  if (lista === undefined) return <p className="carregando">Carregando…</p>
  if (lista === null) return <p className="dica-sec">Esta parte aparece depois de rodar o SQL das imagens do robô.</p>

  return (
    <div className="admin-imagens-robo">
      <p className="dica-sec">
        O robô escolhe a imagem certa pelo campo <b>Quando usar</b> e manda logo depois da resposta, com a legenda. Use imagens em pé (como um story), com letra grande. Só as que estão <b>ligadas</b> são usadas.
      </p>
      {lista.map((img) => (
        <CartaoImagem key={img.id} img={img} onMudou={recarregar} />
      ))}
      {nova ? (
        <CartaoImagem
          nova
          ordem={(lista.at(-1)?.ordem ?? 0) + 1}
          onMudou={() => {
            setNova(false)
            recarregar()
          }}
          onCancelar={() => setNova(false)}
        />
      ) : (
        <button className="botao" onClick={() => setNova(true)}>
          <ImagePlus size={16} /> Nova imagem
        </button>
      )}
    </div>
  )
}

type Props = { img?: ImagemRobo; nova?: boolean; ordem?: number; onMudou: () => void; onCancelar?: () => void }

function CartaoImagem({ img, nova, ordem = 0, onMudou, onCancelar }: Props) {
  const [titulo, setTitulo] = useState(img?.titulo ?? '')
  const [quando, setQuando] = useState(img?.quando_usar ?? '')
  const [legenda, setLegenda] = useState(img?.legenda ?? '')
  const [url, setUrl] = useState(img?.url ?? '')
  const [ativo, setAtivo] = useState(img?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const mudou = !img || titulo !== img.titulo || quando !== img.quando_usar || legenda !== img.legenda || url !== img.url || ativo !== img.ativo
  const pronto = titulo.trim() !== '' && quando.trim() !== '' && url !== '' && (nova ? chaveDoTitulo(titulo).length >= 2 : true)

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setOcupado(true)
    setErro(null)
    const r = await subirImagem(arquivo)
    setOcupado(false)
    if (r.erro) return setErro(r.erro)
    // Imagem trocada e ainda não salva: apaga o arquivo que acabou de subir antes deste.
    if (url && url !== img?.url) apagarArquivo(url)
    setUrl(r.url!)
    setOk(false)
  }

  async function salvar() {
    setOcupado(true)
    setErro(null)
    const dados = { titulo: titulo.trim(), quando_usar: quando.trim(), legenda: legenda.trim(), url, ativo }
    const e = img ? await salvarImagem(img.id, dados) : await criarImagem({ ...dados, chave: chaveDoTitulo(titulo), ordem })
    setOcupado(false)
    if (e) return setErro(e)
    if (img && img.url !== url) apagarArquivo(img.url)
    setOk(true)
    onMudou()
  }

  async function apagar() {
    if (!img) {
      if (url) apagarArquivo(url)
      return onCancelar?.()
    }
    if (!confirm(`Apagar a imagem "${img.titulo}"? O robô para de mandar ela.`)) return
    setOcupado(true)
    const e = await apagarImagem(img)
    setOcupado(false)
    if (e) return setErro(e)
    onMudou()
  }

  return (
    <section className="cartao imagem-robo">
      <div className="imagem-robo-corpo">
        <div className="imagem-robo-foto">
          {url ? <img src={url} alt={titulo} /> : <span className="dica-sec">Sem imagem</span>}
          <label className="botao-sec">
            {url ? 'Trocar imagem' : 'Escolher imagem'}
            <input type="file" accept={TIPOS} onChange={escolher} hidden disabled={ocupado} />
          </label>
        </div>
        <div className="imagem-robo-campos">
          <label className="campo">
            Título
            <input value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Como pagar com Pix" />
          </label>
          <label className="campo">
            Quando usar (o robô lê isso para escolher)
            <textarea rows={2} value={quando} maxLength={300} onChange={(e) => setQuando(e.target.value)} placeholder="Ex.: Logo depois de mandar o código do Pix." />
          </label>
          <label className="campo">
            Legenda (vai junto com a imagem)
            <textarea rows={2} value={legenda} maxLength={900} onChange={(e) => setLegenda(e.target.value)} />
          </label>
          <label className="aceite">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span>Ligada (o robô pode mandar)</span>
          </label>
          {img && <p className="dica-sec">Nome interno: {img.chave}</p>}
        </div>
      </div>
      {erro && <p className="mensagem erro">{erro}</p>}
      {ok && !mudou && <p className="mensagem ok">Salvo.</p>}
      <div className="acoes-linha">
        <button className="botao" disabled={!pronto || !mudou || ocupado} onClick={salvar}>
          {ocupado ? 'Aguarde…' : nova ? 'Adicionar' : 'Salvar'}
        </button>
        <button className="botao-sec" disabled={ocupado} onClick={apagar}>
          <Trash2 size={16} /> {nova ? 'Cancelar' : 'Apagar'}
        </button>
      </div>
    </section>
  )
}
