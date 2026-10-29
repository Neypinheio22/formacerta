// Vídeos do YouTube, em português, que o app mostra quando o personal ainda
// não colocou o vídeo dele. A pedido do Ney (28/10/2026), são vídeos curtos e
// diretos: Shorts (até 1 minuto) ou demonstrações rápidas da execução. O vídeo
// do personal sempre vale mais.

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`
const short = (id: string) => `https://www.youtube.com/shorts/${id}`

export const VIDEOS_APP: Record<string, string> = {
  // Pernas
  agachamento: short('13rt06PvZKY'),
  'agachamento livre': short('13rt06PvZKY'),
  afundo: short('_PBdkgPqcu4'),
  avanco: short('_PBdkgPqcu4'),
  'elevacao pelvica': short('jlN46dzuNG4'),
  ponte: short('jlN46dzuNG4'),
  'leg press': short('rAUy2-fNrsw'),
  'leg press 45': short('rAUy2-fNrsw'),
  'cadeira extensora': short('s_5HG9UWIj4'),
  'mesa flexora': short('Qz-y0Yijdl0'),
  'levantamento terra': yt('_llExszRKVc'),
  'panturrilha em pe': yt('IC9sJ-k_rGo'),
  // Peito
  'flexao de braco': short('h5ClL5IYzog'),
  'supino reto': short('ZINbHcRi3U8'),
  'supino inclinado': short('oN48at2Zw7s'),
  // Costas e trapézio
  'remada curvada': short('KnHMbtOvd7U'),
  'remada baixa': yt('f8AVh4VBbos'),
  'puxada na frente': short('gUfVYr5AaYE'),
  'puxada frente': short('gUfVYr5AaYE'),
  'pulley frente': short('gUfVYr5AaYE'),
  'encolhimento de ombros': short('UaxOpCkSDZ4'),
  encolhimento: short('UaxOpCkSDZ4'),
  // Ombro
  'desenvolvimento com halter': yt('eufDL9MmF8A'),
  'desenvolvimento com halteres': yt('eufDL9MmF8A'),
  'elevacao lateral': short('XMMRx3qM_aA'),
  // Braços
  'rosca direta': short('BZJZTi6WvlU'),
  'triceps frances em pe': short('5uolmk0hgP0'),
  'triceps frances': short('5uolmk0hgP0'),
  'mergulho no banco': short('TtAFBzCbd1k'),
  'triceps banco': short('TtAFBzCbd1k'),
  'triceps na polia': short('-QGC1cL6ETE'),
  'triceps polia': short('-QGC1cL6ETE'),
  'triceps pulley': short('-QGC1cL6ETE'),
  // Abdômen e corpo inteiro
  'abdominal supra': short('w08qG9nQZ_Q'),
  'elevacao de pernas deitado': yt('Q_u3M8gVWKk'),
  'abdominal infra': yt('Q_u3M8gVWKk'),
  polichinelo: yt('YJbkVbNNops'),
  // Mobilidade (lista do Romildo, 28/10/2026)
  'mobilidade de quadril': short('88og-o4OE9I'),
  'rotacao interna e externa do quadril': short('SWOHoqsbQE8'),
  'rotacao interna/externa do quadril': short('SWOHoqsbQE8'),
  '90/90 de quadril': yt('FhX1nIbRvDc'),
  '90/90': yt('FhX1nIbRvDc'),
  'mobilidade dos flexores do quadril': short('QC-RD9zvUEE'),
  'mobilidade de adutores': short('BuAQVn1D6m0'),
  'mobilidade de tornozelo': short('5tREZJe8aqQ'),
  'joelho na parede': short('ALzS-jz5DZs'),
  'mobilidade de ombro': short('tOZ5aorPepg'),
  'mobilidade de ombro com bastao': short('tOZ5aorPepg'),
  'rotacao externa do ombro': short('kOZr0dZGsHc'),
  'mobilidade escapular': short('F8KAzmYSCgU'),
  'mobilidade toracica': short('J_U4pGy7wZM'),
  'gato e camelo': short('QoxSN4siCXA'),
  'cat-cow': short('QoxSN4siCXA'),
  'cat cow': short('QoxSN4siCXA'),
  'rotacao toracica': short('3OBtiNBbaLo'),
}

/** Exercícios de mobilidade que aparecem na lista ao montar a ficha. */
export const EXERCICIOS_MOBILIDADE = [
  'Mobilidade de quadril',
  'Rotação interna e externa do quadril',
  '90/90 de quadril',
  'Mobilidade dos flexores do quadril',
  'Mobilidade de adutores',
  'Mobilidade de tornozelo',
  'Joelho na parede',
  'Mobilidade de ombro',
  'Rotação externa do ombro',
  'Mobilidade escapular',
  'Mobilidade torácica',
  'Gato e camelo (cat-cow)',
  'Rotação torácica',
]
