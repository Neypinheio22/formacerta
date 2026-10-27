import { SUPORTE } from '../../nuvem/conta'
import { VERSAO_TERMOS } from '../../nuvem/privacidade'

const versao = VERSAO_TERMOS.split('-').reverse().join('/')

/** Política de privacidade (LGPD). Revisar com um advogado antes de abrir o app ao público. */
export function Privacidade({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      </header>
      <section className="cartao texto-longo">
        <h1>Política de privacidade</h1>
        <p className="dica-sec">FormaCerta · versão de {versao}</p>

        <p>
          Esta política explica, em linguagem simples, quais dados o FormaCerta guarda, para quê, com quem divide e como você pode ver, levar ou apagar os
          seus dados, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
        </p>

        <h2>1. Quem cuida dos seus dados</h2>
        <p>
          O controlador dos dados é o FormaCerta, de responsabilidade de Ney Pinheiro. O contato para qualquer assunto de privacidade, inclusive o
          encarregado de dados, é o e-mail <a href={`mailto:${SUPORTE}?subject=Privacidade%20FormaCerta`}>{SUPORTE}</a>.
        </p>
        <p>
          Quando um profissional (personal, fisioterapeuta etc.) cadastra e avalia os próprios alunos, ele também responde pelos dados desses alunos e
          precisa ter a autorização deles.
        </p>

        <h2>2. Quais dados guardamos</h2>
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail, tipo de conta e, para profissionais, o número de registro (CREF ou outro). A senha fica protegida e ninguém
            consegue lê-la.
          </li>
          <li>
            <strong>Ficha do aluno:</strong> data de nascimento, sexo, altura, telefone, objetivo, informações de saúde (dores, doenças, remédios,
            restrições) e observações do profissional.
          </li>
          <li>
            <strong>Resultados dos testes e medidas:</strong> os números de cada avaliação (ângulos, níveis, pontuações, repetições, peso, gordura,
            perimetria), a data e a data de reavaliação.
          </li>
          <li>
            <strong>Fotos:</strong> as fotos e os vídeos dos testes <strong>ficam só no celular</strong> onde o teste foi feito e não são enviados ao banco.
            A única exceção é a vitrine (item 6).
          </li>
          <li>
            <strong>Aceites:</strong> a data em que você aceitou estes termos e autorizou o uso dos dados de saúde.
          </li>
        </ul>

        <h2>3. Dados de saúde: consentimento explícito</h2>
        <p>
          Resultados de postura, movimento, medidas e informações de saúde são <strong>dados pessoais sensíveis</strong> (LGPD, art. 5º, II e art. 11). Por
          isso só tratamos esses dados com o seu consentimento claro e destacado, pedido no cadastro, no primeiro acesso e a cada envio de resultado. Você
          pode retirar esse consentimento quando quiser (item 8).
        </p>

        <h2>4. Para que usamos</h2>
        <ul>
          <li>Mostrar os resultados, a evolução e o plano de ação para você e para o seu profissional.</li>
          <li>Avisar quando chegar a data de refazer os testes (lembrete de reavaliação), por e-mail e dentro do app.</li>
          <li>Avisar o administrador de novos cadastros e manter a segurança da conta.</li>
          <li>Melhorar as análises do app comparando resultados de muitas pessoas, sempre sem identificar ninguém nos estudos.</li>
        </ul>
        <p>Não vendemos seus dados e não usamos para propaganda de terceiros.</p>

        <h2>5. Quem vê</h2>
        <p>
          O aluno vê os próprios resultados. O profissional vê os resultados dos seus alunos. O administrador do FormaCerta vê todos, apenas para gerenciar
          o app e dar suporte.
        </p>

        <h2>6. Vitrine dos alunos (fotos)</h2>
        <p>
          A foto só vai para a vitrine quando a própria pessoa (ou o responsável, se for menor de 18 anos) autoriza o uso da imagem. Ela passa pela
          aprovação do administrador, fica visível só para quem tem conta liberada no app e pode ser apagada a qualquer momento em "Vitrine dos alunos" →
          "Minhas fotos".
        </p>

        <h2>7. Com quem dividimos</h2>
        <p>Só com empresas que fazem o app funcionar, seguindo as nossas instruções:</p>
        <ul>
          <li>Supabase: banco de dados e fotos da vitrine, com servidor em São Paulo.</li>
          <li>Resend: envio dos e-mails de aviso e de lembrete (servidores fora do Brasil, com garantias de proteção previstas no art. 33 da LGPD).</li>
          <li>Mercado Pago: pagamentos, quando você compra um plano ou uma avaliação. O FormaCerta não guarda número de cartão.</li>
        </ul>
        <p>Também podemos informar dados quando a lei ou uma ordem judicial exigir.</p>

        <h2>8. Seus direitos</h2>
        <p>A qualquer momento, você pode (LGPD, art. 18):</p>
        <ul>
          <li>
            <strong>Ver e levar seus dados:</strong> em "Minha conta" → "Baixar meus dados", o app gera um arquivo com tudo o que está guardado.
          </li>
          <li>
            <strong>Corrigir:</strong> nome e registro em "Minha conta"; a ficha, com o seu profissional.
          </li>
          <li>
            <strong>Apagar e retirar o consentimento:</strong> em "Minha conta" → "Apagar minha conta e meus dados". Apaga a conta, a ficha, os resultados
            e as fotos da vitrine, sem volta. Também dá para apagar um resultado de cada vez.
          </li>
          <li>
            <strong>Parar os e-mails de lembrete:</strong> em "Minha conta".
          </li>
          <li>
            <strong>Pedir por e-mail</strong> qualquer um desses direitos, ou tirar dúvidas: {SUPORTE}. Respondemos em até 15 dias.
          </li>
        </ul>

        <h2>9. Por quanto tempo guardamos</h2>
        <p>
          Enquanto a sua conta existir ou enquanto o profissional acompanhar você. Ao apagar a conta, os dados saem do banco na hora; cópias de segurança
          automáticas somem em poucos dias. Registros de pagamento podem ser guardados pelo prazo que a lei fiscal exige.
        </p>

        <h2>10. Segurança</h2>
        <p>
          Acesso com e-mail e senha, conexão protegida (HTTPS) e regras no banco que deixam cada pessoa ver só o que pode. Se acontecer algum incidente de
          segurança que possa causar risco, avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>

        <h2>11. Menores de 18 anos</h2>
        <p>Menores de idade só usam o FormaCerta com a autorização de um dos pais ou do responsável legal (LGPD, art. 14).</p>

        <h2>12. Mudanças nesta política</h2>
        <p>Quando esta política mudar, o app mostra a nova versão e pede o seu aceite de novo antes de continuar.</p>

        <h2>Triagem, não diagnóstico</h2>
        <p>Os testes do FormaCerta são de triagem e orientação. Não substituem a avaliação de um médico ou fisioterapeuta.</p>
      </section>
    </div>
  )
}
