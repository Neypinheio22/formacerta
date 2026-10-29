import { ChevronRight, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { corpoDaFicha, type ItemCorpo } from '../../corpo/corpo'
import { idadeDe, rotuloObjetivo, type Ficha } from '../../nuvem/fichas'
import { listarResultados } from '../../nuvem/resultados'
import { minhaFicha } from '../../nuvem/treinos'

const BOLA: Record<ItemCorpo['status'], string> = { ok: '🟢', atencao: '🟡', alerta: '🔴' }

/** Tela inicial do aluno: um só cartão "Meus dados", com o resumo do corpo ou o convite para preencher. */
export function CartaoMeusDados({ meuId, onAbrir }: { meuId: string; onAbrir: () => void }) {
  const [estado, setEstado] = useState<{ ficha: Ficha | null; itens: ItemCorpo[] } | null>(null)

  useEffect(() => {
    let vivo = true
    minhaFicha(meuId).then(async (f) => {
      const m = f ? (await listarResultados({ fichaId: f.id, tipo: 'medidas' })).lista : []
      if (vivo) setEstado({ ficha: f, itens: f ? corpoDaFicha(f, m, idadeDe(f.nascimento)) : [] })
    })
    return () => {
      vivo = false
    }
  }, [meuId])

  if (!estado) return null
  const f = estado.ficha
  const falta = !f || !f.altura_cm || !f.nascimento || !f.sexo || !f.objetivo

  return (
    <button className={`cartao cartao-meus-dados${falta ? ' destaque' : ''}`} onClick={onAbrir}>
      <span className="etiqueta">
        <ClipboardList size={14} /> Meus dados
      </span>
      {falta ? (
        <>
          <h2>Complete os seus dados</h2>
          <p className="dica-sec">Peso, altura, objetivo e medidas: a avaliação fica completa e os exercícios se ajustam a você.</p>
        </>
      ) : (
        <>
          <h2>{rotuloObjetivo(f.objetivo)}</h2>
          {estado.itens.length > 0 ? (
            <p className="resumo-corpo">
              {estado.itens.map((i) => (
                <span key={i.id}>
                  {BOLA[i.status]} {i.rotulo} {i.faixa.toLowerCase()}
                </span>
              ))}
            </p>
          ) : (
            <p className="dica-sec">Anote o seu peso para ver o seu corpo hoje.</p>
          )}
        </>
      )}
      <span className="cartao-seta">
        {falta ? 'Preencher agora' : 'Ver e atualizar'} <ChevronRight size={16} />
      </span>
    </button>
  )
}
