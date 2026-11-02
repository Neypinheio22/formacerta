import { Check, Crown } from 'lucide-react'

export type RecursoPro = 'corrida' | 'exercicio' | 'evolucao'

const TEXTO: Record<RecursoPro, { titulo: string; texto: string }> = {
  corrida: { titulo: 'Análise da corrida', texto: 'Filme você correndo e veja a pisada, a cadência e os joelhos, com dicas para corrigir.' },
  exercicio: { titulo: 'Exercício em vídeo', texto: 'A câmera conta as repetições e avisa na hora quando o movimento sai do certo.' },
  evolucao: { titulo: 'Central de Inteligência', texto: 'Sua análise completa, os exercícios para corrigir e os gráficos de evolução.' },
}

const INCLUI = ['Análise da corrida com IA', 'Exercício em vídeo com contagem e correção', 'Central de Inteligência e evolução em gráficos']

/** Tela no lugar de um recurso do Aluno Pro, para quem está no plano grátis. */
export function TravaPro({ recurso, onPlanos, onVoltar }: { recurso: RecursoPro; onPlanos: () => void; onVoltar: () => void }) {
  const { titulo, texto } = TEXTO[recurso]
  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      </header>
      <section className="cartao destaque centro trava-pro">
        <Crown size={44} className="verde" />
        <span className="etiqueta">Aluno Pro</span>
        <h1>{titulo}</h1>
        <p className="dica">{texto}</p>
        <ul className="recursos">
          {INCLUI.map((r) => (
            <li key={r}>
              <Check size={16} strokeWidth={3} /> {r}
            </li>
          ))}
        </ul>
        <button className="botao grande" onClick={onPlanos}>
          Ver o Aluno Pro
        </button>
        <p className="dica-sec">Se o seu personal assina um plano pago do FormaCerta, você ganha o Aluno Pro sem pagar nada.</p>
      </section>
    </div>
  )
}
