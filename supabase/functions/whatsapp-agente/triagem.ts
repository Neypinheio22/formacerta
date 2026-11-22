/** Regras simples e testáveis de triagem para o WhatsApp do FormaCerta.
 * Não acessam dados pessoais, cobranças ou APIs externas.
 */
export type TurnoTriagem = { autor: 'entrada' | 'robo' | 'humano'; texto: string }

function normalizar(texto: string): string {
  return texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/** Resposta curta apenas para o primeiro pedido genérico de informações. */
export function respostaInicialLead(historico: TurnoTriagem[], nome: string): string | null {
  if (historico.length !== 1 || historico[0]?.autor !== 'entrada') return null

  const texto = normalizar(historico[0].texto)
  const perguntaGenerica = /\b(posso ter (mais )?informac|quero (mais )?informac|gostaria de (mais )?informac|como funciona|quero saber mais|tenho interesse)\b/.test(texto)
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
