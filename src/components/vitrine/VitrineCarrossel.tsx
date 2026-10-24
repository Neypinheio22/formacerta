import { useEffect, useRef, useState } from 'react'
import { listarVitrine, type FotoVitrine } from '../../nuvem/vitrine'
import { CartaoFoto } from './CartaoFoto'

/** Carrossel da tela inicial: fotos aprovadas passando sozinhas. */
export function VitrineCarrossel({ onAbrir }: { onAbrir: () => void }) {
  const [fotos, setFotos] = useState<FotoVitrine[] | null>(null)
  const [atual, setAtual] = useState(0)
  const trilho = useRef<HTMLDivElement>(null)
  const parado = useRef(false)

  useEffect(() => {
    listarVitrine(12).then((r) => setFotos(r.fotos))
  }, [])

  // Passa para a próxima a cada 4 segundos, menos quando a pessoa está mexendo.
  useEffect(() => {
    if (!fotos || fotos.length < 2) return
    const t = setInterval(() => {
      const el = trilho.current
      if (!el || parado.current) return
      const prox = (atual + 1) % fotos.length
      el.scrollTo({ left: prox * el.clientWidth, behavior: 'smooth' })
    }, 4000)
    return () => clearInterval(t)
  }, [fotos, atual])

  function aoRolar() {
    const el = trilho.current
    if (el) setAtual(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (fotos === null) return null

  return (
    <section className="cartao destaque">
      <span className="etiqueta">Vitrine dos alunos</span>
      <h2>Quem está evoluindo com o FormaCerta</h2>
      {fotos.length === 0 ? (
        <p className="dica-sec">A vitrine ainda está vazia. Mande a primeira foto de evolução ou de treino com o app.</p>
      ) : (
        <>
          <div
            className="carrossel"
            ref={trilho}
            onScroll={aoRolar}
            onPointerDown={() => (parado.current = true)}
            onPointerUp={() => setTimeout(() => (parado.current = false), 6000)}
          >
            {fotos.map((f) => (
              <div className="carrossel-item" key={f.id}>
                <CartaoFoto f={f} />
              </div>
            ))}
          </div>
          {fotos.length > 1 && (
            <div className="pontinhos">
              {fotos.map((f, i) => (
                <span key={f.id} className={i === atual ? 'ativo' : ''} />
              ))}
            </div>
          )}
        </>
      )}
      <button className="botao-sec" onClick={onAbrir}>
        Ver vitrine e enviar foto
      </button>
    </section>
  )
}
