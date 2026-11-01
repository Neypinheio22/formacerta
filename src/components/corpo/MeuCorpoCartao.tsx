import { HeartPulse } from 'lucide-react'
import type { ItemCorpo } from '../../corpo/corpo'

const COR: Record<ItemCorpo['status'], string> = { ok: 'chip-ok', atencao: 'chip-atencao', alerta: 'chip-alerta' }
const BOLA: Record<ItemCorpo['status'], string> = { ok: '🟢', atencao: '🟡', alerta: '🔴' }

const numero = (v: number, id: ItemCorpo['id']) => v.toLocaleString('pt-BR', { minimumFractionDigits: id === 'rce' ? 2 : 1, maximumFractionDigits: id === 'rce' ? 2 : 1 })

/** "Meu corpo hoje": IMC, gordura e cintura/altura, cada um com cor e a explicação dentro. */
export function MeuCorpoCartao({ itens, titulo = 'Meu corpo hoje', vazio }: { itens: ItemCorpo[]; titulo?: string; vazio?: string }) {
  if (!itens.length && !vazio) return null
  return (
    <section className="cartao meu-corpo">
      <span className="etiqueta">
        <HeartPulse size={14} /> {titulo}
      </span>
      {itens.length ? (
        <ul className="lista-corpo">
          {itens.map((i) => (
            <li key={i.id}>
              <details>
                <summary>
                  <span className="corpo-rotulo">
                    {BOLA[i.status]} {i.rotulo}
                  </span>
                  <span className="corpo-valor">
                    <b>
                      {numero(i.valor, i.id)}
                      {i.unidade}
                    </b>
                    <span className={`chip ${COR[i.status]}`}>{i.faixa}</span>
                  </span>
                </summary>
                <p className="dica-sec">{i.explicacao}</p>
                <p className="dica-sec">
                  <i>{i.como}</i>
                </p>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dica-sec">{vazio}</p>
      )}
      {itens.length > 0 && <p className="dica-sec nota-corpo">Toque em cada item para entender. São estimativas para orientar o treino, não substituem a avaliação de um profissional de saúde.</p>}
    </section>
  )
}
