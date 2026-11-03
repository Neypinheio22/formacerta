import { CalendarClock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { emReais, mensalidadesParaRenovar, servicoDaMensalidade, type Mensalidade, type Servico } from '../../nuvem/planos'

/** Aluno: serviços mensais (acompanhamento, pacote) que vencem em breve, com o botão de renovar. */
export function CartaoMensalidades({ meuId, onPagar }: { meuId: string; onPagar: (servico: Servico) => void }) {
  const [lista, setLista] = useState<Mensalidade[]>([])
  const [agora, setAgora] = useState(0)

  useEffect(() => {
    mensalidadesParaRenovar().then((l) => {
      setAgora(Date.now())
      setLista(l)
    })
  }, [meuId])

  if (!lista.length) return null

  return (
    <>
      {lista.map((m) => {
        const vence = new Date(m.vence_em)
        const venceu = vence.getTime() < agora
        return (
          <section className={`cartao aviso-plano ${venceu ? 'venceu' : 'vence'}`} key={m.servico_id}>
            <span className="etiqueta">
              <CalendarClock size={14} /> Mensalidade
            </span>
            <h2>
              {m.nome} com {m.profissional_nome.split(' ')[0]}
            </h2>
            <p className="dica-sec">
              {venceu ? `Venceu em ${vence.toLocaleDateString('pt-BR')}.` : `Vence em ${vence.toLocaleDateString('pt-BR')}.`} Renove para continuar o acompanhamento.
            </p>
            {m.ativo ? (
              <button className="botao" onClick={() => onPagar(servicoDaMensalidade(m))}>
                Renovar: {emReais(m.preco)}
              </button>
            ) : (
              <p className="dica-sec">Este serviço não está mais à venda. Fale com o seu personal no chat.</p>
            )}
          </section>
        )
      })}
    </>
  )
}
