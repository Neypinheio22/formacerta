import { useEffect, useState } from 'react'
import { supabase } from '../../nuvem/cliente'

type Etapa = 'novo' | 'conversando' | 'follow_up' | 'aguardando' | 'fechado' | 'perdido'
type Lead = {
  id: string; nome: string; telefone: string; email: string | null
  perfil: 'aluno' | 'profissional'; objetivo: string | null; campanha: string | null
  criado_em: string; etapa: Etapa; consentimento_marketing: boolean
  prazo_inicio: 'agora' | '7_dias' | 'pesquisando' | 'nao_informado'
  qualificacao: 'quente' | 'morno' | 'frio' | 'nao_classificado'
}
type Resumo = {
  total: { visitas:number; formularios:number; leads_unicos:number; qualificados:number; whatsapp_cliques:number; aplicativo_cliques:number }
  por_perfil: Array<{perfil:'aluno'|'profissional';visitas:number;formularios:number;leads_unicos:number;qualificados:number;whatsapp_cliques:number;aplicativo_cliques:number}>
}
const etapas: { id: Etapa; nome: string }[] = [
  { id: 'novo', nome: 'Novo' }, { id: 'conversando', nome: 'Em conversa' },
  { id: 'follow_up', nome: 'Fazer follow-up' }, { id: 'aguardando', nome: 'Aguardando resposta' },
  { id: 'fechado', nome: 'Concluído' }, { id: 'perdido', nome: 'Perdido' },
]

/** Leads captados pelas páginas públicas: não envia mensagens automaticamente. */
export function AdminLeadsCaptacao() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [alterando, setAlterando] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'aluno' | 'profissional'>('todos')
  const [prioridade, setPrioridade] = useState<'todas' | 'quente' | 'morno' | 'frio'>('todas')

  async function carregar() {
    setCarregando(true)
    setErro('')
    const [consulta, metricas] = await Promise.all([
      supabase.functions.invoke('captacao-lead', { body: { acao: 'listar' } }),
      supabase.functions.invoke('captacao-metricas', { body: { acao: 'resumo' } }),
    ])
    if (consulta.error || !Array.isArray(consulta.data?.leads)) setErro('Não foi possível carregar os contatos. Entre com sua conta de administrador e tente novamente.')
    else setLeads(consulta.data.leads as Lead[])
    if (!metricas.error && metricas.data?.resumo) setResumo(metricas.data.resumo as Resumo)
    else setResumo(null)
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

  const filtrados = filtro === 'todos' ? leads : leads.filter((l) => l.perfil === filtro)
  const nivel = { quente: 3, morno: 2, frio: 1, nao_classificado: 0 }
  const visiveis = (prioridade === 'todas' ? filtrados : filtrados.filter((l) => l.qualificacao === prioridade))
    .slice().sort((a, b) => (nivel[b.qualificacao] ?? 0) - (nivel[a.qualificacao] ?? 0))
  return (
    <div className="admin-whatsapp">
      <h2>Leads dos anúncios</h2>
      <p className="dica-sec">Contatos que preencheram as páginas de captação. A inscrição não significa que a pessoa concluiu o cadastro no app. Nenhuma mensagem é enviada automaticamente por este formulário.</p>
      {resumo && (
        <>
          <h3>Resultados das páginas · últimos 30 dias</h3>
          <div className="numeros" aria-label="Métricas de conversão das páginas">
            <div><strong>{resumo.total.visitas}</strong> visitas registradas</div>
            <div><strong>{resumo.total.formularios}</strong> formulários enviados</div>
            <div><strong>{resumo.total.qualificados}</strong> leads prioritários</div>
            <div><strong>{resumo.total.whatsapp_cliques}</strong> cliques para WhatsApp</div>
            <div><strong>{resumo.total.aplicativo_cliques}</strong> cliques para o app</div>
          </div>
          <p className="dica-sec">Taxa de preenchimento: {resumo.total.visitas ? ((resumo.total.formularios/resumo.total.visitas)*100).toFixed(1) : '0,0'}%.
            Os números representam visitas e ações registradas, não comprovam mensagens enviadas ou avaliações concluídas.
            A contagem começa com esta implementação e não recupera visitas anteriores.</p>
          {resumo.por_perfil.map(item => (
            <p key={item.perfil} className="dica-sec">
              <strong>{item.perfil === 'aluno' ? 'Alunos' : 'Profissionais'}:</strong> {item.visitas} visitas · {item.formularios} formulários · {item.qualificados} prioritários · {item.whatsapp_cliques} cliques WhatsApp
            </p>
          ))}
        </>
      )}
      <div className="escolha abas" aria-label="Filtrar leads da página">
        {([['todos', 'Todos'], ['aluno', 'Alunos'], ['profissional', 'Personais']] as const).map(([id, nome]) => (
          <button key={id} className={filtro === id ? 'ativo' : ''} onClick={() => setFiltro(id)}>
            {nome} ({id === 'todos' ? leads.length : leads.filter((l) => l.perfil === id).length})
          </button>
        ))}
        <label className="campo" style={{ minWidth: 180 }}>Prioridade
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as typeof prioridade)}>
            <option value="todas">Todas as prioridades</option>
            <option value="quente">Quentes</option>
            <option value="morno">Mornos</option>
            <option value="frio">Pesquisando</option>
          </select>
        </label>
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
              <span className="chip" style={{ background: lead.qualificacao === 'quente' ? '#DCFCE7' : lead.qualificacao === 'morno' ? '#FEF3C7' : '#E2E8F0', color: '#102334', marginLeft: 8 }}>
                {lead.qualificacao === 'quente' ? 'Prioridade alta' : lead.qualificacao === 'morno' ? 'Prioridade média' : lead.qualificacao === 'frio' ? 'Pesquisando' : 'Sem classificação'}
              </span>
              <p className="dica-sec">{lead.perfil === 'aluno' ? 'Aluno' : 'Personal trainer'} · {new Date(lead.criado_em).toLocaleString('pt-BR')}</p>
            </div>
            <label className="campo" style={{ minWidth: 175 }}>
              Etapa
              <select aria-label={`Etapa de ${lead.nome}`} value={lead.etapa} disabled={alterando === lead.id} onChange={(e) => void mudar(lead.id, e.target.value as Etapa)}>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </label>
          </div>
          <p className="dica-sec">Objetivo: {lead.objetivo || 'Não informado'} · Quando: {lead.prazo_inicio === 'agora' ? 'Agora' : lead.prazo_inicio === '7_dias' ? 'Próximos 7 dias' : lead.prazo_inicio === 'pesquisando' ? 'Pesquisando' : 'Não informado'}</p>
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
