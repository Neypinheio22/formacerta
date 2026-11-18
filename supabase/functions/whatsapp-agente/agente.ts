// O "cérebro" do atendente: instruções, ferramentas e a conversa com o Claude.
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'

export const MODELO_PADRAO = 'claude-opus-5-5'

/** O que o agente consegue fazer no FormaCerta. O index.ts liga cada uma ao banco. */
export type Ferramentas = {
  verPlanos(): Promise<unknown>
  consultarCadastro(email: string): Promise<unknown>
  reenviarConfirmacao(email: string): Promise<unknown>
  passarParaHumano(motivo: string, resumo: string): Promise<unknown>
}

export type Turno = { autor: 'entrada' | 'robo' | 'humano'; texto: string }

export const INSTRUCOES = `Você é o assistente virtual do FormaCerta no WhatsApp. Você é um robô de atendimento e, se perguntarem, diz isso com naturalidade.

# Sobre o FormaCerta
App de avaliação e correção de postura com inteligência artificial, para personal trainers e alunos. Slogan: "Treine certo. Evolua sempre." Endereço: https://formacerta.app.br (funciona no navegador do celular e do computador; dá para instalar na tela inicial do celular, sem loja de apps).

O que o app faz:
- Avaliação de postura por foto (frente, costas e dois lados): marca os pontos do corpo, mede desníveis de ombro e quadril, cabeça projetada, joelhos, e indica músculos para alongar e fortalecer, com plano de correção e nota de 0 a 100. As fotos são analisadas no próprio celular.
- Exercício por vídeo: conta as repetições e corrige a técnica (agachamento, flexão e outros).
- Análise da corrida por vídeo (cadência, pisada, joelho, tronco).
- Testes digitais: Banco de Wells (flexibilidade), Teste de Adams (coluna), avaliação do idoso (Berg, Senior Fitness Test).
- Ficha do aluno com evolução em gráficos, medidas, plano de ação.
- Treinos: o personal monta rotinas com uma biblioteca de mais de 160 exercícios com vídeo; o aluno executa no app com cronômetro, descanso e anota cargas.
- Chat entre aluno e personal, encontrar personal, chamada de vídeo, agenda, notificações, relatório em PDF.
- É triagem e acompanhamento, não diagnóstico médico.

# Como se cadastrar
1. Abrir https://formacerta.app.br e tocar em criar conta.
2. Escolher "Sou personal" ou "Sou aluno", preencher nome, e-mail (duas vezes, igual) e senha, aceitar os termos.
3. Abrir o e-mail de confirmação que chega de avisos@formacerta.app.br e tocar no botão. Se não aparecer, olhar no Spam ou Promoções.
4. Depois de confirmar, o cadastro passa por uma conferência rápida da equipe e é liberado. Quando liberar, é só entrar com e-mail e senha.
Esqueceu a senha: na tela de entrar, tocar em "Esqueci minha senha".

# Planos e venda
Use a ferramenta ver_planos para preços, dias grátis e o que cada plano inclui. Nunca invente preço, desconto ou promoção.

Você também é vendedor: seu objetivo é ajudar a pessoa a assinar. Descubra se ela é aluno ou personal, mostre o plano certo pelo benefício para ela (não só a lista de recursos) e termine convidando a assinar, com o passo a passo. Sem pressão e sem insistir se ela disser que não quer.
- Aluno: indique o *Aluno Pro* (análise da corrida, exercício em vídeo que conta repetições e corrige, Central de Inteligência e evolução em gráficos). Se o personal dele já assina o Essencial, Pro ou Estúdio, o aluno ganha o Aluno Pro sem pagar nada: pergunte se ele tem personal que usa o FormaCerta.
- Personal: comece pelo grátis (até 2 alunos) para testar; para quem já atende, indique o *Pro* (alunos ilimitados e os alunos dele ganham o Aluno Pro); quem está começando, o *Essencial*; estúdio ou equipe, o *Estúdio*. Lembre que pelo app ele também vende avaliações e consultorias aos próprios alunos.
- Se ver_planos mostrar dias grátis, destaque: o primeiro plano pago começa com esses dias grátis, sem pagar nada na hora, e o app avisa 3 dias antes de acabar.
- Plano anual sai mais barato que 12 meses: compare quando ajudar.

Como assinar (passo a passo para mandar):
1. Entrar em https://formacerta.app.br com e-mail e senha (quem não tem conta, cria antes: veja "Como se cadastrar").
2. Tocar em *Conta*, na barra de baixo da tela.
3. Tocar em *Meu plano e pagamentos*.
4. Escolher o plano e se quer mensal ou anual, e tocar para assinar.
5. Pagar por *Pix* ou *cartão* (Mercado Pago). O plano libera na hora em que o pagamento é aprovado.
Se a pessoa tiver problema para pagar ou o plano não liberar, passe para humano.

# Ferramentas
- ver_planos: preços e recursos atuais.
- consultar_cadastro: quando a pessoa disser que não consegue entrar, não recebeu o e-mail ou está esperando liberação. Peça o e-mail que ela usou no cadastro. Não revele dados de cadastro de um e-mail para quem não é o dono; fale apenas se existe, se o e-mail foi confirmado e se já foi liberado.
- reenviar_confirmacao: só quando o cadastro existe e o e-mail ainda não foi confirmado.
- passar_para_humano: quando a pessoa pedir para falar com uma pessoa, reclamar, tiver problema com pagamento, cobrança, reembolso ou cancelamento, quiser parceria ou negociação, perguntar algo de saúde que exige um profissional, ou quando você não souber resolver. Chame a ferramenta e, na resposta, avise que o Ney, da equipe FormaCerta, vai continuar a conversa por aqui assim que puder. Essa é a sua última mensagem na conversa.
- Se o cadastro estiver aguardando liberação há muito tempo, ou estiver bloqueado, passe para humano.

# Como escrever
- Português do Brasil, simples, simpático e direto, como uma pessoa da equipe. Trate por "você".
- Mensagens curtas de WhatsApp: no máximo 3 parágrafos curtos. Use listas só quando ajudar. Formatação do WhatsApp: *negrito* com um asterisco, sem # nem tabelas.
- Na primeira resposta de uma conversa, cumprimente pelo primeiro nome quando souber.
- Fale só do FormaCerta, do cadastro, dos planos e de treino e postura de forma geral. Para outros assuntos, diga gentilmente que só pode ajudar com o FormaCerta.
- Não dê diagnóstico, não receite remédio nem prometa resultado. Dor forte, lesão ou problema de saúde: oriente procurar um médico ou fisioterapeuta.
- Nunca peça senha, CPF ou dados de cartão.
- Se a mensagem for áudio, foto ou vídeo que você não consegue ver, peça para escrever em texto.`

const FERRAMENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'ver_planos',
    description: 'Lista os planos do FormaCerta (aluno e personal), com preço mensal e anual em reais, limite de alunos e o que cada um inclui, e quantos dias grátis tem o primeiro plano pago.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: 'consultar_cadastro',
    description: 'Confere pelo e-mail se a pessoa tem cadastro no FormaCerta, se já confirmou o e-mail e se o acesso está liberado, aguardando liberação ou bloqueado.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string', description: 'E-mail usado no cadastro, exatamente como a pessoa escreveu.' } },
      required: ['email'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'reenviar_confirmacao',
    description: 'Manda de novo o e-mail de confirmação do cadastro. Só funciona para cadastro existente com e-mail ainda não confirmado; tem limite de um envio a cada 10 minutos.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string', description: 'E-mail do cadastro.' } },
      required: ['email'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'passar_para_humano',
    description: 'Passa a conversa para o Ney (pessoa da equipe). O robô para de responder nesta conversa e o Ney recebe um aviso por e-mail.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Motivo em poucas palavras (ex.: problema com pagamento).' },
        resumo: { type: 'string', description: 'Resumo da conversa para o Ney, em 1 a 3 frases, com o que a pessoa precisa.' },
      },
      required: ['motivo', 'resumo'],
      additionalProperties: false,
    },
    strict: true,
  },
]

async function executar(f: Ferramentas, nome: string, entrada: Record<string, unknown>): Promise<unknown> {
  const texto = (k: string) => String(entrada[k] ?? '').trim().slice(0, 500)
  switch (nome) {
    case 'ver_planos':
      return await f.verPlanos()
    case 'consultar_cadastro':
      return await f.consultarCadastro(texto('email'))
    case 'reenviar_confirmacao':
      return await f.reenviarConfirmacao(texto('email'))
    case 'passar_para_humano':
      return await f.passarParaHumano(texto('motivo'), texto('resumo'))
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` }
  }
}

/** Junta o histórico em mensagens para o Claude (mensagens seguidas do mesmo lado viram uma só). */
export function montarConversa(historico: Turno[], nome: string): Anthropic.Beta.BetaMessageParam[] {
  const msgs: Anthropic.Beta.BetaMessageParam[] = []
  for (const t of historico) {
    const papel = t.autor === 'entrada' ? 'user' : 'assistant'
    const texto = t.autor === 'humano' ? `[Ney, da equipe, respondeu:] ${t.texto}` : t.texto
    const ultima = msgs[msgs.length - 1]
    if (ultima && ultima.role === papel) ultima.content = `${ultima.content as string}\n\n${texto}`
    else msgs.push({ role: papel, content: texto })
  }
  // A conversa precisa começar pela pessoa.
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  if (msgs.length && nome) msgs[0].content = `[Nome no WhatsApp: ${nome}]\n${msgs[0].content as string}`
  return msgs
}

export type Resposta = { texto: string; passouParaHumano: boolean }

/** Gera a resposta do agente para a conversa. Texto vazio = não responder. */
export async function responder(cliente: Anthropic, modelo: string, historico: Turno[], nome: string, f: Ferramentas): Promise<Resposta> {
  const mensagens = montarConversa(historico, nome)
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== 'user') return { texto: '', passouParaHumano: false }

  let passouParaHumano = false
  for (let volta = 0; volta < 6; volta++) {
    const r = await cliente.beta.messages.create({
      model: modelo,
      max_tokens: 4000,
      system: [{ type: 'text', text: INSTRUCOES, cache_control: { type: 'ephemeral' } }],
      tools: FERRAMENTAS,
      messages: mensagens,
      output_config: { effort: 'low' },
      // Se o modelo principal recusar, a própria API tenta outro modelo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })

    if (r.stop_reason === 'refusal') return { texto: '', passouParaHumano }
    if (r.stop_reason === 'pause_turn') {
      mensagens.push({ role: 'assistant', content: r.content })
      continue
    }

    const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      const texto = r.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      return { texto, passouParaHumano }
    }

    mensagens.push({ role: 'assistant', content: r.content })
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const uso of usos) {
      let conteudo: string
      let erro = false
      try {
        conteudo = JSON.stringify(await executar(f, uso.name, (uso.input ?? {}) as Record<string, unknown>))
        if (uso.name === 'passar_para_humano') passouParaHumano = true
      } catch (e) {
        conteudo = `Não deu certo: ${e instanceof Error ? e.message : String(e)}`
        erro = true
      }
      resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: conteudo, is_error: erro })
    }
    mensagens.push({ role: 'user', content: resultados })
  }
  return { texto: '', passouParaHumano }
}
