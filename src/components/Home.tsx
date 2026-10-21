import type { Assessment } from '../pose/types'
import { Logo } from './Logo'

type Props = {
  history: Assessment[]
  onStart: () => void
  onOpen: (a: Assessment) => void
}

const EM_BREVE = [
  { titulo: 'Análise da corrida', texto: 'Grave 10 a 20 segundos correndo, de lado e de frente.' },
  { titulo: 'Teste de mobilidade', texto: 'Agachamento, tornozelo, elevação dos braços e equilíbrio.' },
  { titulo: 'Caminhada de 6 minutos', texto: 'Distância, tempo, frequência cardíaca e esforço.' },
]

export function Home({ history, onStart, onOpen }: Props) {
  return (
    <div className="tela">
      <header className="marca">
        <Logo size={30} />
        <p className="slogan">
          Treine certo. <span className="verde">Evolua sempre.</span>
        </p>
      </header>

      <section className="cartao destaque">
        <span className="etiqueta">Correção de postura com IA</span>
        <h1>Avaliação de postura</h1>
        <p className="dica">4 fotos rápidas: frente, costas e as duas laterais. A análise acontece no seu celular, e as fotos não saem dele.</p>
        <button className="botao grande" onClick={onStart}>
          Começar avaliação
        </button>
      </section>

      {history.length > 0 && (
        <section className="cartao">
          <h2>Seu histórico</h2>
          <ul className="historico">
            {history.map((a) => (
              <li key={a.id}>
                <button onClick={() => onOpen(a)}>
                  <span>{new Date(a.date).toLocaleDateString('pt-BR')}</span>
                  <span className="nota">{a.score} pts</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="secao">Em breve</h2>
      {EM_BREVE.map((m) => (
        <section className="cartao bloqueado" key={m.titulo}>
          <h3>{m.titulo}</h3>
          <p className="dica-sec">{m.texto}</p>
        </section>
      ))}

      <p className="rodape">
        Seu corpo em movimento <span className="verde">certo.</span>
      </p>
    </div>
  )
}
