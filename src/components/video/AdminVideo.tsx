import { Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { emReais, lerReais } from '../../nuvem/planos'
import { lerRegrasVideo, minhasChamadas, repassarVideo, resumoGanhos, salvarTaxaVideo, type Chamada } from '../../nuvem/video'

/** Administrador: taxa por chamada e o que repassar a cada personal pelas chamadas feitas. */
export function AdminVideo() {
  const [chamadas, setChamadas] = useState<Chamada[] | null>(null)
  const [taxa, setTaxa] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const carregar = () => minhasChamadas().then(setChamadas)

  useEffect(() => {
    carregar()
    lerRegrasVideo().then((r) => setTaxa(String(r.taxa_video).replace('.', ',')))
  }, [])

  if (chamadas === null) return null

  const porPersonal = new Map<string, Chamada[]>()
  for (const c of chamadas) porPersonal.set(c.profissional_id, [...(porPersonal.get(c.profissional_id) ?? []), c])
  const todas = resumoGanhos(chamadas)

  async function gravarTaxa() {
    const v = lerReais(taxa)
    if (v === null || v < 0 || v > 50) return setMsg({ ok: false, texto: 'Taxa entre R$ 0 e R$ 50.' })
    const e = await salvarTaxaVideo(v)
    setMsg(e ? { ok: false, texto: e } : { ok: true, texto: 'Taxa salva. Vale para as próximas chamadas atendidas.' })
  }

  async function repassar(id: string, nome: string, valor: number) {
    if (!confirm(`Confirmar que você já pagou ${emReais(valor)} para ${nome}?`)) return
    const e = await repassarVideo(id)
    if (e) setMsg({ ok: false, texto: e })
    else carregar()
  }

  return (
    <section className="cartao formulario">
      <span className="etiqueta">
        <Video size={14} /> Chamadas de vídeo
      </span>
      <div className="numeros">
        <div>
          <strong>{todas.feitas}</strong> feitas
        </div>
        <div>
          <strong>{emReais(todas.comissao + todas.taxas)}</strong> seus
        </div>
        <div>
          <strong>{emReais(todas.aReceber)}</strong> a repassar
        </div>
      </div>
      <p className="dica-sec">Sua parte = comissão + taxa de cada chamada atendida. O personal só recebe as chamadas feitas.</p>

      {[...porPersonal.entries()].map(([id, lista]) => {
        const g = resumoGanhos(lista)
        const nome = lista[0].profissional_nome
        const creditos = lista.filter((c) => c.situacao === 'credito').length
        return (
          <div key={id} className="servico-linha">
            <b>{nome}</b>
            <small className="dica-sec">
              {g.feitas} feita{g.feitas === 1 ? '' : 's'} · {creditos} para usar · vendido {emReais(g.bruto)} · comissão {emReais(g.comissao)} · taxas {emReais(g.taxas)}
            </small>
            {g.aReceber > 0 ? (
              <button className="botao-sec" onClick={() => repassar(id, nome, g.aReceber)}>
                Marcar repasse de {emReais(g.aReceber)} como feito
              </button>
            ) : (
              <small className="dica-sec">Nada a repassar.</small>
            )}
          </div>
        )
      })}

      <label className="campo">
        Taxa por chamada realizada (R$), paga pelo personal
        <input inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
      </label>
      <button className="botao" onClick={gravarTaxa}>
        Salvar taxa
      </button>
      {msg && <p className={`mensagem ${msg.ok ? 'ok' : 'erro'}`}>{msg.texto}</p>}
    </section>
  )
}
