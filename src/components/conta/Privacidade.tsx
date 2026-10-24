/** Rascunho da política de privacidade. Revisar com um advogado antes de abrir o app ao público. */
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
        <p className="dica-sec">FormaCerta · versão de 24/10/2026</p>

        <h2>O que o FormaCerta guarda</h2>
        <p>
          Para a conta: nome, e-mail, tipo de conta (profissional ou aluno) e, para profissionais, o número de registro. A senha fica guardada de forma
          protegida e ninguém consegue lê-la.
        </p>
        <p>
          Dos testes, só quando a pessoa avaliada autoriza: os números do resultado (ângulos, níveis, cadência, repetições), a data, observações do
          profissional e, se informados, idade, sexo e altura. <strong>Fotos e vídeos não são enviados</strong>: ficam só no celular onde o teste foi feito.
        </p>

        <h2>Para que usamos</h2>
        <p>
          Para o profissional acompanhar a evolução dos seus alunos e para melhorar as análises do app, comparando resultados de muitas pessoas sem
          identificar ninguém nos estudos.
        </p>

        <h2>Dado de saúde</h2>
        <p>
          Resultados de postura e de movimento são dados pessoais sensíveis pela LGPD (Lei 13.709/2018, art. 11). Por isso o envio só acontece com o
          consentimento claro da pessoa avaliada, pedido a cada teste.
        </p>

        <h2>Quem vê</h2>
        <p>
          O aluno vê os próprios resultados. O profissional vê os resultados dos seus alunos. O administrador do FormaCerta vê todos, para gerenciar o app.
          Não vendemos nem repassamos os dados.
        </p>

        <h2>Onde ficam</h2>
        <p>Num banco de dados do Supabase, com servidor em São Paulo, protegido por senha e por regras de acesso.</p>

        <h2>Seus direitos</h2>
        <p>
          Você pode ver, corrigir e apagar os seus dados a qualquer momento. Em "Minha conta" há o botão para apagar a conta e todos os resultados. Também
          pode pedir ao administrador pelo e-mail ney.comercial@gmail.com.
        </p>

        <h2>Triagem, não diagnóstico</h2>
        <p>Os testes do FormaCerta são de triagem e orientação. Não substituem a avaliação de um médico ou fisioterapeuta.</p>
      </section>
    </div>
  )
}
