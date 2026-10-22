type Props = { onControle: () => void; onCamera: () => void; onReferencias: () => void; onVoltar: () => void }

/** Escolha do papel deste celular no estúdio. */
export function EstudioInicio({ onControle, onCamera, onReferencias, onVoltar }: Props) {
  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
        <span className="passo">Modo estúdio</span>
      </header>

      <h1>Gravar exercício de referência</h1>
      <p className="dica">
        O personal executa o exercício e 2 ou 3 celulares filmam ao mesmo tempo, de ângulos diferentes. Um deles é o controle: começa e termina a
        gravação em todos.
      </p>

      <div className="opcoes">
        <button className="opcao" onClick={onControle}>
          <strong>Este celular é o controle</strong>
          <span>Abre o estúdio, mostra o código para os outros celulares e grava em todos com um toque. Também pode filmar.</span>
        </button>
        <button className="opcao" onClick={onCamera}>
          <strong>Este celular é uma câmera</strong>
          <span>Fica no tripé filmando de frente, de lado ou de costas.</span>
        </button>
      </div>

      <section className="cartao">
        <h2>Como montar</h2>
        <ul className="exercicios">
          <li>Celulares em tripés, na altura do quadril, a uns 2,5 a 3 metros.</li>
          <li>Frente e lateral formando um "L" (90°). Costas só se o exercício pedir (remada, elevação de braços).</li>
          <li>Boa luz, fundo liso e roupa de cor diferente da parede.</li>
          <li>Todos os celulares na mesma rede Wi-Fi e com o app aberto.</li>
        </ul>
      </section>

      <button className="botao-sec" onClick={onReferencias}>
        Ver exercícios de referência
      </button>
    </div>
  )
}
