import { ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listarFichas } from '../../nuvem/fichas'

/** Tela inicial do aluno: convida a preencher altura, nascimento e objetivo enquanto faltar algum. */
export function CartaoMeusDados({ meuId, onAbrir }: { meuId: string; onAbrir: () => void }) {
  const [falta, setFalta] = useState(false)

  useEffect(() => {
    listarFichas().then((r) => {
      if (r.erro) return
      const f = r.fichas.find((x) => x.aluno_id === meuId)
      setFalta(!f || !f.altura_cm || !f.nascimento || !f.objetivo)
    })
  }, [meuId])

  if (!falta) return null
  return (
    <section className="cartao destaque">
      <span className="etiqueta">
        <ClipboardList size={14} /> Meus dados
      </span>
      <h2>Complete os seus dados</h2>
      <p className="dica-sec">Altura, peso, objetivo e medidas do corpo deixam a sua avaliação completa e mostram a sua evolução mês a mês.</p>
      <button className="botao" onClick={onAbrir}>
        Preencher agora
      </button>
    </section>
  )
}
