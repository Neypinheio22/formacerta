import { ROTULO_FOTO, type FotoVitrine } from '../../nuvem/vitrine'

/** Uma foto da vitrine. Na de evolução mostra antes e depois lado a lado. */
export function CartaoFoto({ f, children }: { f: FotoVitrine; children?: React.ReactNode }) {
  return (
    <figure className="foto-vitrine">
      <div className={f.url_antes ? 'foto-par' : 'foto-unica'}>
        {f.url_antes && (
          <div>
            <img src={f.url_antes} alt={`${f.nome}, antes`} loading="lazy" />
            <span className="selo-foto">Antes</span>
          </div>
        )}
        <div>
          {f.url ? <img src={f.url} alt={f.nome} loading="lazy" /> : <div className="foto-vazia">Foto indisponível</div>}
          {f.url_antes && <span className="selo-foto verde-fundo">Depois</span>}
        </div>
      </div>
      <figcaption>
        <strong>{f.nome}</strong> <span className="dica-sec">· {ROTULO_FOTO[f.tipo]}</span>
        {f.legenda && <p className="dica-sec">{f.legenda}</p>}
        {children}
      </figcaption>
    </figure>
  )
}
