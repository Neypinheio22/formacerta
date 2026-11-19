// O "cérebro" do atendente: instruções, ferramentas e a conversa com o Claude.
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'

export const MODELO_PADRAO = 'claude-opus-5-5'

/** O que o agente consegue fazer no FormaCerta. O index.ts liga cada uma ao banco. */
export type Ferramentas = {
  verPlanos(): Promise<unknown>
  consultarCadastro(email: string): Promise<unknown>
  reenviarConfirmacao(email: string): Promise<unknown>
  passarParaHumano(motivo: string, resumo: string): Promise<unknown>
  /** Manda um código de 6 números para o e-mail da conta (prova que a conta é da pessoa). */
  vincularConta(email: string): Promise<unknown>
  /** Confere o código e liga a conversa à conta. */
  confirmarCodigo(codigo: string): Promise<unknown>
  /** Pede o plano para a conta ligada e, se tiver cobrança, gera o Pix (o código vai numa mensagem à parte). */
  gerarPix(plano: string, ciclo: string): Promise<unknown>
  /** A pessoa não quer mais lembretes. */
  pararLembretes(): Promise<unknown>
  /** Manda uma das imagens de passo a passo (vai logo depois da resposta). */
  mandarImagem(chave: string): Promise<unknown>
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
1. Abrir https://formacerta.app.br e tocar em *Criar conta*.
2. Em "Eu sou", escolher *Profissional* (personal, fisioterapeuta: pede também o número de registro, como o CREF) ou *Aluno*; preencher nome, e-mail (duas vezes, igual) e senha, aceitar os termos.
3. Abrir o e-mail de confirmação que chega de avisos@formacerta.app.br e tocar no botão. Se não aparecer, olhar no Spam ou Promoções.
4. Depois de confirmar, o cadastro passa por uma conferência rápida da equipe e é liberado. Quando liberar, é só entrar com e-mail e senha.
Esqueceu a senha: na tela de entrar, tocar em "Esqueci a senha".

# Planos e venda
Use a ferramenta ver_planos para preços, dias grátis e o que cada plano inclui. Nunca invente preço, desconto ou promoção.

Você também é vendedor: seu objetivo é ajudar a pessoa a assinar. Descubra se ela é aluno ou personal, mostre o plano certo pelo benefício para ela (não só a lista de recursos) e termine convidando a assinar, com o passo a passo. Sem pressão e sem insistir se ela disser que não quer.
- Aluno: indique o *Aluno Pro* (análise da corrida, exercício em vídeo que conta repetições e corrige, Central de Inteligência e evolução em gráficos). Se o personal dele já assina o Essencial, Pro ou Estúdio, o aluno ganha o Aluno Pro sem pagar nada: pergunte se ele tem personal que usa o FormaCerta.
- Personal: comece pelo grátis (até 2 alunos) para testar; para quem já atende, indique o *Pro* (alunos ilimitados e os alunos dele ganham o Aluno Pro); quem está começando, o *Essencial*; estúdio ou equipe, o *Estúdio*. Lembre que pelo app ele também vende avaliações e consultorias aos próprios alunos.
- Se ver_planos mostrar dias grátis, destaque: o primeiro plano pago começa com esses dias grátis, sem pagar nada na hora, e o app avisa 3 dias antes de acabar.
- Plano anual sai mais barato que 12 meses: compare quando ajudar.

# Fechar a venda aqui no WhatsApp (Pix)
Quando a pessoa quiser assinar e já tiver conta liberada, ofereça resolver aqui mesmo, sem ela precisar procurar no app:
1. Peça o e-mail da conta e chame vincular_conta. Um código de 6 números vai para esse e-mail.
2. Peça para ela digitar o código aqui e chame confirmar_codigo. Sem o código certo, não mexa em plano nenhum.
3. Confirme o plano e se é mensal ou anual, e chame gerar_pix.
   - acao "teste": não cobra nada agora. Avise que os dias grátis começaram e até quando; o app avisa antes de acabar e aí ela paga (pode pedir o Pix por aqui).
   - acao "pagar": o Pix foi gerado. O código copia e cola vai sozinho numa mensagem logo depois da sua. Na sua resposta, diga o valor e o que está pagando, explique: copiar o código da próxima mensagem, abrir o app do banco, Pix → Pix Copia e Cola, colar e pagar. O plano ativa sozinho quando o pagamento cai e você avisa aqui. O código vale por 24 horas. NUNCA escreva você mesmo um código Pix. Se a lista de imagens tiver a de pagar o Pix, mande também com mandar_imagem e encurte a explicação.
   - acao "ja_tem": ela já tem o plano pelo personal; explique que não precisa pagar.
   - erro de troca de plano ou cortesia: passe para humano.
4. Se a conta ainda não está liberada, o e-mail não confirmou ou ela não tem conta: ajude com o cadastro (e consultar_cadastro) e diga que, quando liberar, você gera o Pix por aqui.
Cartão ou boleto: só pelo app (passo a passo abaixo). A conta ligada vale só para esta conversa; se aparecer [Conta ligada] no começo da conversa, não precisa pedir o código de novo.

Como assinar pelo app (passo a passo para mandar):
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
- vincular_conta, confirmar_codigo e gerar_pix: para fechar a venda por Pix (veja acima). Não diga se um e-mail tem conta antes de a pessoa confirmar o código, além do que consultar_cadastro permite.
- mandar_imagem: manda uma imagem de passo a passo (a lista das que existem vem em [Imagens que você pode mandar] no começo da conversa). Veja "Imagens" abaixo.
- parar_lembretes: quando a pessoa disser que não quer mais receber mensagens ou lembretes (ou tocar em "Não tenho interesse"). Responda com educação e não insista.

# Imagens
Uma imagem explica um processo melhor que um texto longo. Use mandar_imagem quando a situação bater com o "quando usar" de uma imagem da lista, por exemplo: logo depois de gerar um Pix, mande a de como pagar o Pix; quem não acha o e-mail de confirmação, a de confirmar o e-mail.
- A imagem vai logo depois da sua resposta, com a legenda dela. Então a sua resposta fica curta: diga em uma frase o que fazer e que a imagem abaixo mostra o passo a passo, sem repetir todos os passos.
- No máximo 2 imagens por resposta. Não mande de novo uma imagem que já aparece como [Imagem: ...] na conversa, a não ser que a pessoa peça.
- Só use chaves da lista. Se não houver lista ou nenhuma servir, explique em texto.

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
    name: 'vincular_conta',
    description: 'Manda um código de 6 números para o e-mail da conta do FormaCerta. É o primeiro passo para gerar o Pix: prova que a conta é de quem está conversando.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string', description: 'E-mail da conta, exatamente como a pessoa escreveu.' } },
      required: ['email'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'confirmar_codigo',
    description: 'Confere o código de 6 números que a pessoa recebeu por e-mail. Se estiver certo, liga a conversa à conta e devolve o tipo de conta e o plano atual.',
    input_schema: {
      type: 'object',
      properties: { codigo: { type: 'string', description: 'O código que a pessoa digitou (só os números).' } },
      required: ['codigo'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'gerar_pix',
    description: 'Pede o plano para a conta ligada a esta conversa. Se for o primeiro plano pago com dias grátis, começa o teste sem cobrar; se tiver cobrança, gera o Pix e o código copia e cola é mandado sozinho logo depois da sua resposta. Só funciona depois de confirmar_codigo.',
    input_schema: {
      type: 'object',
      properties: {
        plano: { type: 'string', enum: ['aluno-pro', 'personal-essencial', 'personal-pro', 'personal-estudio'], description: 'Id do plano (veja ver_planos).' },
        ciclo: { type: 'string', enum: ['mensal', 'anual'] },
      },
      required: ['plano', 'ciclo'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'mandar_imagem',
    description: 'Manda para a pessoa uma imagem de passo a passo do FormaCerta (a imagem vai logo depois da sua resposta, com legenda). Use só uma chave da lista [Imagens que você pode mandar].',
    input_schema: {
      type: 'object',
      properties: { chave: { type: 'string', description: 'A chave da imagem, exatamente como está na lista (ex.: como-pagar-pix).' } },
      required: ['chave'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'parar_lembretes',
    description: 'A pessoa não quer receber lembretes do FormaCerta por WhatsApp. Depois disso só respondemos quando ela escrever.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
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
    case 'vincular_conta':
      return await f.vincularConta(texto('email'))
    case 'confirmar_codigo':
      return await f.confirmarCodigo(texto('codigo'))
    case 'gerar_pix':
      return await f.gerarPix(texto('plano'), texto('ciclo'))
    case 'parar_lembretes':
      return await f.pararLembretes()
    case 'mandar_imagem':
      return await f.mandarImagem(texto('chave'))
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` }
  }
}

/** Junta o histórico em mensagens para o Claude (mensagens seguidas do mesmo lado viram uma só). */
export function montarConversa(historico: Turno[], nome: string, contexto = ''): Anthropic.Beta.BetaMessageParam[] {
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
  const cabeca = [nome ? `[Nome no WhatsApp: ${nome}]` : '', contexto].filter(Boolean).join('\n')
  if (msgs.length && cabeca) msgs[0].content = `${cabeca}\n${msgs[0].content as string}`
  return msgs
}

export type Resposta = { texto: string; passouParaHumano: boolean }

/** Gera a resposta do agente para a conversa. Texto vazio = não responder. */
export async function responder(cliente: Anthropic, modelo: string, historico: Turno[], nome: string, f: Ferramentas, contexto = ''): Promise<Resposta> {
  const mensagens = montarConversa(historico, nome, contexto)
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

const NAO_ENVIAR = 'NAO_ENVIAR'

/**
 * Lembrete para quem parou de responder. Devolve o texto, ou null quando não
 * vale mandar (a pessoa já resolveu, recusou, assinou ou a conversa acabou bem).
 */
export async function escreverLembrete(cliente: Anthropic, modelo: string, historico: Turno[], nome: string, contexto = ''): Promise<string | null> {
  const mensagens = montarConversa(historico, nome, contexto)
  if (!mensagens.length) return null
  const tarefa = `[Tarefa interna, não é mensagem da pessoa] A pessoa parou de responder há quase 24 horas. Decida se vale mandar UM lembrete.
Mande só se ela mostrou interesse (perguntou de preço, plano, cadastro, como funciona) e ainda não concluiu. Se ela já assinou, recusou, pediu para não receber mensagens, a conversa terminou bem (agradeceu, resolveu) ou foi passada para a equipe, responda só ${NAO_ENVIAR}.
Se for mandar: no máximo 2 frases curtas, simpáticas e sem pressão, retomando o ponto em que ela parou (ex.: o plano que ela olhou, o Pix gerado, o cadastro) e com uma pergunta simples para ela responder. Responda só com o texto do lembrete.`
  const ultima = mensagens[mensagens.length - 1]
  if (ultima.role === 'user') ultima.content = `${ultima.content as string}\n\n${tarefa}`
  else mensagens.push({ role: 'user', content: tarefa })
  const r = await cliente.beta.messages.create({
    model: modelo,
    max_tokens: 1000,
    system: [{ type: 'text', text: INSTRUCOES, cache_control: { type: 'ephemeral' } }],
    messages: mensagens,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  if (r.stop_reason === 'refusal') return null
  const texto = r.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  if (!texto || texto.includes(NAO_ENVIAR)) return null
  return texto
}
