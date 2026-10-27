import { SUPORTE } from '../../nuvem/conta'
import { VERSAO_TERMOS } from '../../nuvem/privacidade'

const versao = VERSAO_TERMOS.split('-').reverse().join('/')

/** Termos de uso. Revisar com um advogado antes de abrir o app ao público. */
export function Termos({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      </header>
      <section className="cartao texto-longo">
        <h1>Termos de uso</h1>
        <p className="dica-sec">FormaCerta · versão de {versao}</p>

        <p>Ao criar a conta ou usar o FormaCerta, você concorda com estas regras. Leia junto com a Política de privacidade.</p>

        <h2>1. O que é o FormaCerta</h2>
        <p>
          Um app de avaliação física com inteligência artificial: postura, corrida, exercício em vídeo, flexibilidade, coluna (Adams), avaliação do idoso,
          medidas, plano de ação e acompanhamento da evolução.
        </p>

        <h2>2. Triagem, não diagnóstico</h2>
        <p>
          Os resultados são de <strong>triagem e orientação</strong>. Não são diagnóstico médico e não substituem médico, fisioterapeuta ou outro profissional
          de saúde. O app sugere; a decisão final sobre o treino é do profissional que acompanha você. Em caso de dor, lesão ou doença, procure um médico
          antes de fazer os testes e exercícios.
        </p>

        <h2>3. Sua conta</h2>
        <ul>
          <li>Use dados verdadeiros e guarde a sua senha. Você responde pelo que for feito com a sua conta.</li>
          <li>Contas de profissional são conferidas e liberadas pelo administrador.</li>
          <li>Menores de 18 anos só podem usar com a autorização de um dos pais ou do responsável.</li>
        </ul>

        <h2>4. Regras para o profissional</h2>
        <ul>
          <li>Só cadastre e avalie alunos que autorizaram, e use os dados só para acompanhar esses alunos.</li>
          <li>Peça a autorização do aluno antes de guardar resultados, fotos ou informações de saúde.</li>
          <li>Não repasse dados de alunos para outras pessoas ou empresas.</li>
          <li>Quando o aluno pedir, apague a ficha e os resultados dele.</li>
        </ul>

        <h2>5. Uso correto</h2>
        <p>
          Não é permitido usar o app para enganar, copiar o sistema, tentar acessar dados de outras pessoas ou enviar fotos sem autorização. Contas que
          fizerem isso podem ser bloqueadas ou excluídas.
        </p>

        <h2>6. Planos e pagamentos</h2>
        <p>
          Quando houver planos pagos, o preço, o que cada plano inclui e o período de teste aparecem antes da compra. Você pode cancelar quando quiser; o
          plano vale até o fim do período já pago.
        </p>

        <h2>7. Disponibilidade</h2>
        <p>
          Trabalhamos para o app funcionar sempre, mas ele pode ficar fora do ar para manutenção ou por falhas da internet. Os testes que ficam no celular
          funcionam mesmo sem internet.
        </p>

        <h2>8. Sair e apagar</h2>
        <p>
          Você pode apagar a sua conta e todos os seus dados a qualquer momento em "Minha conta". O administrador pode excluir contas que quebrarem estas
          regras.
        </p>

        <h2>9. Mudanças</h2>
        <p>Quando estes termos mudarem, o app mostra a nova versão e pede o seu aceite de novo.</p>

        <h2>10. Contato e foro</h2>
        <p>
          Dúvidas, pedidos e reclamações: <a href={`mailto:${SUPORTE}?subject=Termos%20FormaCerta`}>{SUPORTE}</a>. Vale a lei brasileira, inclusive o Código
          de Defesa do Consumidor.
        </p>
      </section>
    </div>
  )
}
