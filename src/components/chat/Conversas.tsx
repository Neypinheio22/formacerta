import { BadgeCheck, MessagesSquare, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Perfil } from '../../nuvem/conta'
import { listarConversas, outroLado, quando, type Conversa } from '../../nuvem/chat'

type Props = {
  perfil: Perfil
  onAbrir: (c: Conversa) => void
  onPersonais: () => void
}

/** Aba Chat: as conversas entre aluno e personal. O administrador também vê as de todo mundo. */
export function Conversas({ perfil, onAbrir, onPersonais }: Props) {
  const [todas, setTodas] = useState(false)
  const [lista, setLista] = useState<Conversa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const aluno = perfil.papel === 'aluno'

  useEffect(() => {
    let vivo = true
    const ler = () =>
      listarConversas(todas).then((r) => {
        if (!vivo) return
        setLista(r.lista)
        setErro(r.erro)
      })
    ler()
    const vez = setInterval(ler, 15000)
    return () => {
      vivo = false
      clearInterval(vez)
    }
  }, [todas])

  return (
    <div className="tela">
      <h1>Chat</h1>
      <p className="dica-sec">
        <ShieldCheck size={14} /> {aluno ? 'Tire dúvidas com o personal e contrate pelo app, com pagamento seguro e histórico guardado.' : 'Alunos que encontraram você no app falam com você aqui e contratam seus serviços pelo FormaCerta.'}
      </p>

      {perfil.papel === 'admin' && (
        <div className="escolha">
          <button className={!todas ? 'ativo' : ''} onClick={() => setTodas(false)}>
            Minhas
          </button>
          <button className={todas ? 'ativo' : ''} onClick={() => setTodas(true)}>
            Todas (administração)
          </button>
        </div>
      )}

      {erro && <p className="mensagem erro">{erro}</p>}
      {lista === null && !erro && <p className="carregando">Carregando conversas…</p>}

      {lista?.length === 0 && (
        <section className="cartao centro chat-vazio">
          <MessagesSquare size={40} className="verde" />
          {aluno ? (
            <>
              <p className="dica">Ainda não tem conversa. Escolha um profissional com CREF e toque em Conversar.</p>
              <button className="botao" onClick={onPersonais}>
                <BadgeCheck size={18} /> Encontrar personal
              </button>
            </>
          ) : (
            <p className="dica">Quando um aluno chamar você em "Encontrar personal", a conversa aparece aqui.</p>
          )}
        </section>
      )}

      <ul className="lista-conversas">
        {lista?.map((c) => {
          const outro = outroLado(c, perfil.id)
          const deTerceiros = c.aluno_id !== perfil.id && c.profissional_id !== perfil.id
          return (
            <li key={c.id}>
              <button className="conversa-item" onClick={() => onAbrir(c)}>
                {outro.foto ? <img className="personal-foto" src={outro.foto} alt="" /> : <span className="personal-inicial">{outro.nome.charAt(0).toUpperCase()}</span>}
                <span className="conversa-texto">
                  <strong>{deTerceiros ? `${c.aluno_nome} ↔ ${c.profissional_nome}` : outro.nome}</strong>
                  <span>{c.ultima_previa || 'Conversa aberta'}</span>
                </span>
                <span className="conversa-lado">
                  <small>{quando(c.ultima_em)}</small>
                  {c.nao_lidas > 0 && <b className="selo-novas">{c.nao_lidas}</b>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
