export function speak(texto: string) {
  try {
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'pt-BR'
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  } catch {
    /* navegador sem voz */
  }
}
