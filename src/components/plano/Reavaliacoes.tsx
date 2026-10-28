import { BellRing, CalendarClock, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { linkWhatsApp } from '../../compartilhar/whatsapp'
import type { Perfil } from '../../nuvem/conta'
import { listarFichas, type Ficha } from '../../nuvem/fichas'
import { listarResultados } from '../../nuvem/resultados'
import { TESTE_MEDIDAS, lembretes, mensagemLembrete, pendentes, textoSituacao, type Lembrete } from '../../plano/lembretes'
import { dataCurta } from '../../testes/formato'
import { FichaAluno } from '../alunos/FichaAluno'

const dia = (d: string) => dataCurta(`${d}T12:00:00`)

const CHIP: Record<Lembrete['situacao'], string> = { atrasada: 'chip-alerta', hoje: 'chip-atencao', breve: 'chip-atencao', futura: 'chip-neutro' }

/** Lembretes de quem o perfil acompanha: o aluno vê os dele; o profissional, os dos alunos. */
async function carregar(perfil: Perfil): Promise<{ lista: Lembrete[]; fichas: Ficha[]; erro: string | null }> {
  const aluno = perfil.papel === 'aluno'
  const [f, r] = await Promise.all([listarFichas(), listarResultados(aluno ? { alunoId: perfil.id } : {})])
  let resultados = r.lista
  // O administrador vê o banco inteiro: aqui só entram os alunos dele.
  if (perfil.papel === 'admin') {
    const minhas = new Set(f.fichas.filter((x) => x.profissional_id === perfil.id).map((x) => x.id))
    resultados = resultados.filter((x) => (x.ficha_id && minhas.has(x.ficha_id)) || x.enviado_por === perfil.id)
  }
  return { lista: lembretes(resultados, f.fichas), fichas: f.fichas, erro: f.erro ?? r.erro }
}

/** Junta os lembretes da mesma pessoa. */
function porPessoa(ls: Lembrete[]) {
  const m = new Map<string, Lembrete[]>()
  for (const l of ls) m.set(l.pessoa, [...(m.get(l.pessoa) ?? []), l])
  return [...m.values()]
}

/** Cartão na tela inicial: quem está na hora de refazer os testes. O aluno abre a evolução dele. */
export function CartaoReavaliacao({ perfil, onAbrir }: { perfil: Perfil; onAbrir: () => void }) {
  const [lista, setLista] = useState<Lembrete[] | null>(null)

  useEffect(() => {
    carregar(perfil).then((r) => setLista(r.erro ? null : r.lista))
  }, [perfil])

  if (!lista?.length) return null
  const agora = pendentes(lista)
  const aluno = perfil.papel === 'aluno'
  const pessoas = porPessoa(agora)
  const proxima = lista[0]

  return (
    <section className={`cartao lembrete-reavaliacao${agora.length ? ' destaque' : ''}`}>
      <span className="etiqueta">
        <BellRing size={14} /> Lembrete de reavaliação
      </span>
      {aluno ? (
        <>
          <h2>{agora.length ? 'Chegou a hora de refazer os testes' : 'Sua próxima reavaliação'}</h2>
          <ul className="lista-lembretes">
            {(agora.length ? agora : [proxima]).map((l) => (
              <li key={l.teste}>
                <span>{l.teste}</span>
                <span className={`chip ${CHIP[l.situacao]}`}>
                  {dia(l.data)} · {textoSituacao(l)}
                </span>
              </li>
            ))}
          </ul>
          <p className="dica-sec">Refazer os testes mostra o quanto você evoluiu. Combine com o seu personal ou faça de novo aqui no app.</p>
          {agora.some((l) => l.teste === TESTE_MEDIDAS) && (
            <button className="botao" onClick={onAbrir}>
              Anotar peso e medidas
            </button>
          )}
        </>
      ) : (
        <>
          <h2>{pessoas.length ? `${pessoas.length} ${pessoas.length === 1 ? 'aluno para reavaliar' : 'alunos para reavaliar'}` : 'Nenhuma reavaliação esta semana'}</h2>
          {pessoas.length ? (
            <ul className="lista-lembretes">
              {pessoas.slice(0, 3).map((ls) => (
                <li key={ls[0].pessoa}>
                  <span>{ls[0].nome}</span>
                  <span className={`chip ${CHIP[ls[0].situacao]}`}>{textoSituacao(ls[0])}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dica-sec">
              Próxima: {proxima.nome}, {proxima.teste.toLowerCase()}, em {dia(proxima.data)}.
            </p>
          )}
          <button className="botao" onClick={onAbrir}>
            Ver reavaliações
          </button>
        </>
      )}
    </section>
  )
}

/** Tela do profissional: todos os alunos com reavaliação vencida, de hoje e da semana. */
export function Reavaliacoes({ perfil, onVoltar }: { perfil: Perfil; onVoltar: () => void }) {
  const [lista, setLista] = useState<Lembrete[] | null>(null)
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<Ficha | null>(null)
  const [todas, setTodas] = useState(false)

  useEffect(() => {
    carregar(perfil).then((r) => {
      setLista(r.lista)
      setFichas(r.fichas)
      setErro(r.erro)
    })
  }, [perfil])

  if (aberta)
    return (
      <FichaAluno
        ficha={aberta}
        meuId={perfil.id}
        podeEditar
        nome={aberta.nome}
        textoVoltar="Reavaliações"
        onVoltar={() => {
          setAberta(null)
          window.scrollTo(0, 0)
        }}
      />
    )

  const grupos = porPessoa(lista ?? [])
  const agora = grupos.filter((ls) => ls[0].situacao !== 'futura')
  const depois = grupos.filter((ls) => ls[0].situacao === 'futura')
  const assinatura = perfil.nome ? `${perfil.nome.split(' ')[0]} · FormaCerta` : 'FormaCerta'

  const cartao = (ls: Lembrete[]) => {
    const l = ls[0]
    const ficha = l.fichaId ? fichas.find((f) => f.id === l.fichaId) : undefined
    const vencidos = ls.filter((x) => x.situacao !== 'futura')
    const texto = mensagemLembrete(l.nome, vencidos.map((x) => x.teste), assinatura)
    return (
      <section className="cartao pessoa" key={l.pessoa}>
        <h3>{l.nome}</h3>
        <ul className="lista-lembretes">
          {ls.map((x) => (
            <li key={x.teste}>
              <span>{x.teste}</span>
              <span className={`chip ${CHIP[x.situacao]}`}>
                {dia(x.data)} · {textoSituacao(x)}
              </span>
            </li>
          ))}
        </ul>
        <div className="acoes-lembrete">
          {vencidos.length > 0 && (
            <a className="botao botao-whatsapp" href={linkWhatsApp(texto, l.telefone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} /> Avisar no WhatsApp
            </a>
          )}
          {ficha && (
            <button className="botao-sec" onClick={() => setAberta(ficha)}>
              Abrir ficha
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>
      <h1>Reavaliações</h1>
      <p className="dica-sec">
        A data de cada reavaliação vem do plano de ação do teste (🔴 e 🟡 voltam antes, 🟢 depois). Quando chega a data, o FormaCerta manda um e-mail para
        você e para o aluno que tem conta. Refazer o teste tira o aluno desta lista.
      </p>

      {erro && <p className="mensagem erro">{erro}</p>}
      {lista === null && !erro && <p className="carregando">Carregando…</p>}

      <h2 className="titulo-secao">
        <CalendarClock size={18} /> Agora e nos próximos 7 dias
      </h2>
      {lista && !agora.length && <p className="dica-sec">Nenhum aluno para reavaliar esta semana.</p>}
      {agora.map(cartao)}

      {depois.length > 0 && (
        <>
          <h2 className="titulo-secao">Mais adiante</h2>
          {(todas ? depois : depois.slice(0, 5)).map(cartao)}
          {!todas && depois.length > 5 && (
            <button className="botao-sec" onClick={() => setTodas(true)}>
              Ver todos ({depois.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
