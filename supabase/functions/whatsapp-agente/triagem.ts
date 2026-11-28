/** Regras simples e testáveis de triagem para o WhatsApp do FormaCerta.
 * Não acessam dados pessoais, cobranças ou APIs externas.
 */
export type TurnoTriagem = { autor: 'entrada' | 'robo' | 'humano'; texto: string }

function normalizar(texto: string): string {
  return texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

const ABERTURA_AVALIACAO = 'Sua primeira avaliação de postura é grátis 😊 Você já tem conta no FormaCerta ou quer ajuda para começar?'

export function recebeuEmailParaAcesso(historico: TurnoTriagem[]): boolean {
  const ultimo = historico.at(-1)
  if (ultimo?.autor !== 'entrada' || !/[^\s@]+@[^\s@]+\.[^\s@.]+/.test(ultimo.texto)) return false

  const anterior = historico.at(-2)
  const pediuEmail = anterior?.autor === 'robo' &&
    /\b(manda|mande|envie|informe|qual|passe|passa|diga|diz)\b.*e[- ]?mail/s.test(normalizar(anterior.texto))
  const motivo = historico.slice(0, -1).reverse().find(turno => turno.autor === 'entrada')
  return Boolean(pediuEmail && motivo && /\b(nao (consigo|consegui|consegue) (entrar|acessar|fazer login)|erro (ao|para) (entrar|acessar)|problema (no login|de acesso)|nao (chegou|recebi).{0,35}e[- ]?mail|aguardando (a )?liberacao)\b/.test(normalizar(motivo.texto)))
}

/** Responde aos pedidos mais comuns sem reiniciar o atendimento. */
export function respostaDireta(historico: TurnoTriagem[]): string | null {
  const ultimo = historico.at(-1)
  if (ultimo?.autor !== 'entrada') return null

  const texto = normalizar(ultimo.texto)
  const anterior = historico.at(-2)
  if (anterior?.autor === 'robo' && anterior.texto.endsWith(ABERTURA_AVALIACAO)) {
    if (/^(sim|ja tenho( conta)?|tenho( conta)?|ja fiz (o )?cadastro)[!.\s]*$/.test(texto)) {
      return 'Entre em https://formacerta.app.br e toque em *Começar avaliação*. O app vai te guiar nas quatro fotos.'
    }
    if (/^(nao|nao tenho( conta)?|quero ajuda( para comecar)?|como comeco)[!.?\s]*$/.test(texto)) {
      return 'Abra https://formacerta.app.br, toque em *Criar conta* e escolha *Aluno* se a avaliação for para você. Confirme o e-mail para continuar.'
    }
  }

  if (/^(?:posso|da para|tem como) pagar (?:com pix )?(?:por aqui|aqui|pelo whatsapp)[?.!]*$/.test(texto)) {
    return 'Dá para pagar por Pix nesta conversa depois de confirmar sua conta e o plano. Para pagar com cartão, abra *Conta → Meu plano e pagamentos* no app.'
  }

  if (historico.length === 1 && /^(oi+|ola|bom dia|boa tarde|boa noite)[!.\s]*$/.test(texto)) {
    return 'Oi! Aqui é o assistente do FormaCerta. Como posso te ajudar hoje?'
  }

  if (/^(?:(?:quero|gostaria de) )?fazer (?:a |minha )?avaliacao(?: postural| de postura)?(?: gratis| gratuita)?[!.?]*$/.test(texto)) {
    return 'A primeira avaliação postural é grátis. Entre no FormaCerta e toque em *Começar avaliação*. Você já consegue entrar na sua conta?'
  }

  if (/^(?:aprendendo (?:a )?fazer|quero aprender (?:a )?fazer|como (?:fazer|faco)) (?:o )?agachamento[!.?]*$/.test(texto)) {
    return 'Para assistir à demonstração, abra o agachamento no seu treino e toque em *Ver vídeo*. Quer ajuda para encontrar o exercício no app?'
  }

  if (/^(?:voce )?pode (?:me )?(?:mandar|enviar) (?:um )?video\b/.test(texto) &&
    !/\b(gravacao|avaliacao|postura|meu video)\b/.test(texto)) {
    return /\bagachamento\b/.test(texto)
      ? 'Para assistir à demonstração, abra o agachamento no seu treino e toque em *Ver vídeo*. Quer ajuda para encontrar o exercício no app?'
      : 'Qual exercício você quer ver em vídeo? Posso te mostrar onde encontrar a demonstração no FormaCerta.'
  }

  return null
}

/** Resposta curta apenas para o primeiro pedido genérico de informações. */
export function respostaInicialLead(historico: TurnoTriagem[], nome: string): string | null {
  if (historico.length !== 1 || historico[0]?.autor !== 'entrada') return null

  const texto = normalizar(historico[0].texto)
  // Quando já existe cadastro, não mandar o tutorial de criação de conta novamente.
  if (/\b(ja (tenho|criei|fiz) ((o|a|um|uma) )?(conta|cadastro)|ja (me )?cadastrei|sou cadastrad[oa]|tenho cadastro)\b/.test(texto)) {
    return 'Que bom! 😊 Você já conseguiu entrar no FormaCerta ou está aguardando a confirmação/liberação do cadastro? Se precisar, ajudo nessa etapa.'
  }

  // Pedidos recorrentes dos anúncios: entregar a instrução antes de enviar imagens.
  if (/\b(como faco (minha |a )?avaliacao( gratis| gratuita)?|como fazer (minha |a )?avaliacao( gratis| gratuita)?|quero fazer (minha |a )?avaliacao( gratis| gratuita)?|como funciona a avaliacao de postura|como funciona a avaliacao postural)\b/.test(texto)) {
    const primeiroNome = nome.trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, '').slice(0, 30)
    const saudacao = primeiroNome ? 'Olá, ' + primeiroNome + '! 😊' : 'Olá! 😊'
    if (/como funciona/.test(texto)) {
      return [
        saudacao + ' A avaliação postural do FormaCerta é feita por fotos de frente, costas e dos dois lados. Ela ajuda a observar sua postura e acompanhar a evolução, sem substituir uma avaliação clínica.',
        '',
        'Sua primeira avaliação é grátis. Para começar, entre em https://formacerta.app.br e escolha *Criar conta*. Quer que eu te ajude nessa etapa?',
      ].join('\n')
    }
    return saudacao + ' ' + ABERTURA_AVALIACAO
  }

  const perguntaGenerica = /\b(posso (ter|saber) (mais )?informac(?:ao|oes)|quero (mais )?informac(?:ao|oes)|gostaria de (mais )?informac(?:ao|oes)|como funciona|quero saber mais|tenho interesse)\b/.test(texto)
  const assuntoEspecifico = /\b(preco|valor|plano|pagamento|pix|cadastro|senha|conta|email|erro|problema|cancelamento|reembolso|dor|lesao|consulta)\b/.test(texto)
  if (!perguntaGenerica || assuntoEspecifico) return null

  const primeiroNome = nome.trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, '').slice(0, 30)
  const saudacao = primeiroNome ? 'Olá, ' + primeiroNome + '! 😊' : 'Olá! 😊'
  return [
    saudacao + ' O FormaCerta ajuda você a avaliar sua postura e acompanhar sua evolução pelo celular.',
    '',
    '🎁 Sua primeira avaliação é grátis. Comece em https://formacerta.app.br (o acesso depende da liberação do cadastro). Você quer conhecer como aluno ou personal?',
  ].join('\n')
}

/** Áudio sem transcrição não pode ser interpretado pela IA; encaminhar a uma pessoa. */
export function deveEncaminharAudio(tipo: string, texto: string): boolean {
  return tipo === 'audio' && !texto.trim()
}

/** Evita insistência na mesma pergunta quando a pessoa não informa o perfil. */
export function orientacaoContraRepeticao(historico: TurnoTriagem[]): string {
  const perguntasSobrePerfil = historico.filter(
    (t) => t.autor === 'robo' && /\?/.test(t.texto) && /alun[oa]|personal/i.test(t.texto),
  ).length
  if (perguntasSobrePerfil < 2) return ''
  return '[Orientação de atendimento: você já perguntou sobre aluno/personal pelo menos duas vezes. Não repita essa classificação. Responda ao conteúdo mais recente, ofereça o link https://formacerta.app.br e uma ajuda concreta. Se houver dúvida ou somente emojis, acolha sem pressionar e faça no máximo uma pergunta diferente.]'
}
