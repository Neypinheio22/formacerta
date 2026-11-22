import { useEffect, useState } from 'react'
import { supabase } from '../../nuvem/cliente'

type Etapa = 'novo' | 'conversando' | 'follow_up' | 'aguardando' | 'fechado' | 'perdido'
type Lead = {
  id: string; nome: string; telefone: string; email: string | null
  perfil: 'aluno' | 'profissional'; objetivo: string | null; campanha: string | null
  criado_em: string; etapa: Etapa; consentimento_marketing: boolean
}
const etapas: { id: Etapa; nome: string }[] = [
  { id: 'novo', nome: 'Novo' }, { id: 'conversando', nome: 'Em conversa' },
  { id: 'follow_up', nome: 'Fazer follow-up' }, { id: 'aguardando', nome: 'Aguardando resposta' },
  { id: 'fechado', nome: 'Concluído' }, { id: 'perdido', nome: 'Perdido' },
]

/** Leads captados pelas páginas públicas: não envia mensagens automaticamente. */
export function AdminLeadsCaptacao() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [alterando, setAlterando] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'aluno' | 'profissional'>('todos')

  async function carregar() {
    setCarregando(true)
    setErro('')
    const { data, error } = await supabase.functions.invoke('captacao-lead', { body: { acao: 'listar' } })
    if (error || !Array.isArray(data?.leads)) setErro('Não foi possível carregar os contatos. Entre com sua conta de administrador e tente novamente.')
    else setLeads(data.leads as Lead[])
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  async function mudar(id: string, etapa: Etapa) {
    setAlterando(id)
    const { data, error } = await supabase.functions.invoke('captacao-lead', { body: { acao: 'atualizar', id, etapa } })
    if (error || !data?.ok) setErro('Não foi possível atualizar este contato.')
    else setLeads((todos) => todos.map((l) => l.id === id ? { ...l, etapa } : l))
    setAlterando(null)
  }

  const visiveis = filtro === 'todos' ? leads : leads.filter((l) => l.perfil === filtro)
  return (
    <div className="admin-whatsapp">
      <h2>Leads dos anúncios</h2>
      <p className="dica-sec">Contatos que preencheram as páginas de captação. A inscrição não significa que a pessoa concluiu o cadastro no app. Nenhuma mensagem é enviada automaticamente por este formulário.</p>
      <div className="escolha abas" aria-label="Filtrar leads da página">
        {([['todos', 'Todos'], ['aluno', 'Alunos'], ['profissional', 'Personais']] as const).map(([id, nome]) => (
          <button key={id} className={filtro === id ? 'ativo' : ''} onClick={() => setFiltro(id)}>
            {nome} ({id === 'todos' ? leads.length : leads.filter((l) => l.perfil === id).length})
          </button>
        ))}
        <button type="button" onClick={() => void carregar()} disabled={carregando}>Atualizar</button>
      </div>
      {carregando && <p className="carregando">Carregando contatos…</p>}
      {erro && <p className="mensagem erro" role="alert">{erro}</p>}
      {!carregando && visiveis.length === 0 && <p className="dica-sec">Nenhum lead encontrado neste filtro.</p>}
      {!carregando && visiveis.map((lead) => (
        <article className="cartao" key={lead.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>{lead.nome}</strong>
              <p className="dica-sec">{lead.perfil === 'aluno' ? 'Aluno' : 'Personal trainer'} · {new Date(lead.criado_em).toLocaleString('pt-BR')}</p>
            </div>
            <label className="campo" style={{ minWidth: 175 }}>
              Etapa
              <select aria-label={`Etapa de ${lead.nome}`} value={lead.etapa} disabled={alterando === lead.id} onChange={(e) => void mudar(lead.id, e.target.value as Etapa)}>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </label>
          </div>
          <p className="dica-sec">Objetivo: {lead.objetivo || 'Não informado'}</p>
          <p className="dica-sec">Origem: {lead.campanha || 'Página de captação'} · Ofertas: {lead.consentimento_marketing ? 'autorizadas' : 'não autorizadas'}</p>
          <p>
            <a href={`https://wa.me/${lead.telefone}`} target="_blank" rel="noreferrer">WhatsApp: +{lead.telefone}</a>
            {lead.email && <> · <a href={`mailto:${lead.email}`}>{lead.email}</a></>}
          </p>
        </article>
      ))}
    </div>
  )
}
