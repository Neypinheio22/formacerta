// Vídeos do YouTube, em português, que o app mostra quando o personal ainda
// não colocou o vídeo dele. Escolhidos pela busca "como fazer ... execução
// correta" (28/10/2026), dando preferência a vídeos de profissionais que
// mostram a execução e os erros comuns. O vídeo do personal sempre vale mais.

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`

export const VIDEOS_APP: Record<string, string> = {
  // Pernas
  agachamento: yt('rM6SDUdl9fs'),
  'agachamento livre': yt('rM6SDUdl9fs'),
  afundo: yt('SSQkCXcEDx0'),
  avanco: yt('SSQkCXcEDx0'),
  'elevacao pelvica': yt('nwkXOSKGnQQ'),
  ponte: yt('pY9qYxyCO_c'),
  'leg press': yt('FeZ8D00iK5E'),
  'leg press 45': yt('FeZ8D00iK5E'),
  'cadeira extensora': yt('mruTNzILY3U'),
  'mesa flexora': yt('sWSm1pWb3lw'),
  'levantamento terra': yt('N3O3gtNM7GY'),
  'panturrilha em pe': yt('IC9sJ-k_rGo'),
  // Peito
  'flexao de braco': yt('Azw6BZ8-wSM'),
  'supino reto': yt('vIGvt-vgrvY'),
  'supino inclinado': yt('Ky_JXqloq0w'),
  // Costas e trapézio
  'remada curvada': yt('VJHBEy2duVc'),
  'remada baixa': yt('f8AVh4VBbos'),
  'puxada na frente': yt('7cCiQUdIXWw'),
  'puxada frente': yt('7cCiQUdIXWw'),
  'pulley frente': yt('7cCiQUdIXWw'),
  'encolhimento de ombros': yt('G4Db9-p9yJM'),
  encolhimento: yt('G4Db9-p9yJM'),
  // Ombro
  'desenvolvimento com halter': yt('eufDL9MmF8A'),
  'desenvolvimento com halteres': yt('eufDL9MmF8A'),
  'elevacao lateral': yt('jannLx4RxKo'),
  // Braços
  'rosca direta': yt('nUSmTWGzOqA'),
  'triceps frances em pe': yt('KXtq1r5eoOQ'),
  'triceps frances': yt('KXtq1r5eoOQ'),
  'mergulho no banco': yt('jH9RXQjbXqs'),
  'triceps banco': yt('jH9RXQjbXqs'),
  'triceps na polia': yt('YQ6MRBeyIAE'),
  'triceps polia': yt('YQ6MRBeyIAE'),
  'triceps pulley': yt('YQ6MRBeyIAE'),
  // Abdômen e corpo inteiro
  'abdominal supra': yt('tGobCIvFPHI'),
  'elevacao de pernas deitado': yt('lsfYFbfE45o'),
  'abdominal infra': yt('lsfYFbfE45o'),
  polichinelo: yt('S2uqQ9zHZMc'),
}
