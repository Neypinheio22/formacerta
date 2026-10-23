import type { Assessment } from '../pose/types'
import { Logo } from './Logo'

type Props = {
  history: Assessment[]
  onStart: () => void
  onOpen: (a: Assessment) => void
  onEstudio: () => void
  onExercicio: () => void
  onCorrida: () => void
  onWells: () => void
  onAdams: () => void
}

const EM_BREVE = [
  { titulo: 'Teste de mobilidade', texto: 'Agachamento, tornozelo, elevação dos braços e equilíbrio.' },
  { titulo: 'Caminhada de 6 minutos', texto: 'Distância, tempo, frequência cardíaca e esforço.' },
]

export function Home({ history, onStart, onOpen, onEstudio, onExercicio, onCorrida, onWells, onAdams }: Props) {
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
        <p className="dica">4 fotos rápidas, paradas: frente, costas e as duas laterais. É a avaliação da postura em pé. A análise acontece no seu celular, e as fotos não saem dele.</p>
        <button className="botao grande" onClick={onStart}>
          Começar avaliação
        </button>
      </section>

      <section className="cartao destaque">
        <span className="etiqueta">Novo · análise em vídeo</span>
        <h2>Exercício em movimento</h2>
        <p className="dica-sec">
          Grave ou envie um vídeo do agachamento ou da flexão. O app lê o movimento quadro a quadro, conta as repetições e mostra o que corrigir em cada uma.
        </p>
        <button className="botao" onClick={onExercicio}>
          Analisar exercício
        </button>
      </section>

      <section className="cartao destaque">
        <span className="etiqueta">Novo · esteira ou rua</span>
        <h2>Avaliação da corrida</h2>
        <p className="dica-sec">Grave 10 a 20 segundos correndo, de lado e de trás. O app mede cadência, pisada, passada, joelhos, pelve e tronco, e indica músculos e exercícios.</p>
        <button className="botao" onClick={onCorrida}>
          Avaliar corrida
        </button>
      </section>

      <section className="cartao destaque">
        <span className="etiqueta">Para o personal</span>
        <h2>Modo estúdio</h2>
        <p className="dica-sec">Grave o exercício certo com 2 ou 3 celulares ao mesmo tempo (frente, lateral e costas) e use como referência para os clientes.</p>
        <button className="botao-sec" onClick={onEstudio}>
          Abrir modo estúdio
        </button>
      </section>

      <section className="cartao destaque">
        <span className="etiqueta">Testes do personal</span>
        <h2>Flexibilidade e coluna</h2>
        <div className="opcoes">
          <button className="opcao" onClick={onWells}>
            Banco de Wells Digital
            <span>Flexibilidade da cadeia posterior, com classificação automática e evolução.</span>
          </button>
          <button className="opcao" onClick={onAdams}>
            Teste de Adams Digital
            <span>Flexão do tronco para achar gibosidade, rotação vertebral e assimetria nas costas.</span>
          </button>
        </div>
        <p className="dica-sec">São testes de triagem: não substituem o diagnóstico médico.</p>
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
