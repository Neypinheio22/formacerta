import { BadgeCheck, ExternalLink, MapPin, MessageCircle, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { abrirConversa, type Conversa } from '../../nuvem/chat'
import { aPartirDe, listarServicos, precoServico, type Servico } from '../../nuvem/planos'
import { CONSULTA_CONFEF, filtrarProfissionais, listaEspecialidades, listarProfissionais, type ProfissionalHabilitado } from '../../nuvem/profissionais'

function Cartao({ p, servicos, abrindo, onConversar }: { p: ProfissionalHabilitado; servicos: Servico[]; abrindo: boolean; onConversar: () => void }) {
  const menor = aPartirDe(servicos)
  const primeiro = p.nome.split(' ')[0]
  const especialidades = listaEspecialidades(p.especialidade)
  return (
    <li className="cartao personal-cartao">
      <div className="personal-topo">
        {p.foto_url ? <img className="personal-foto" src={p.foto_url} alt={`Foto de ${p.nome}`} loading="lazy" /> : <span className="personal-inicial">{primeiro.charAt(0).toUpperCase()}</span>}
        <div>
          <h2>{p.nome}</h2>
          <p className="personal-cref">
            <BadgeCheck size={15} /> {/^crefito/i.test(p.registro) ? p.registro : `CREF ${p.registro.replace(/^cref\s*/i, '')}`}
          </p>
        </div>
      </div>
      {p.cidade && (
        <p className="dica-sec personal-info">
          <MapPin size={13} /> {p.cidade}
        </p>
      )}
      {especialidades.length > 0 && (
        <ul className="personal-chips" aria-label="Especialidades">
          {especialidades.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {p.bio && <p className="personal-bio">{p.bio}</p>}
      {servicos.length > 0 && (
        <div className="personal-servicos">
          <h3>
            Serviços <small>a partir de {precoServico({ preco: menor!, mensal: false })}</small>
          </h3>
          <ul>
            {servicos.map((s) => (
              <li key={s.id}>
                <span>{s.nome}</span>
                <b>{precoServico(s)}</b>
              </li>
            ))}
          </ul>
          <p className="dica-sec">Tire dúvidas e contrate pelo chat, com pagamento pelo app.</p>
        </div>
      )}
      <p className="personal-selo">✓ Cadastro conferido e liberado pelo FormaCerta</p>
      <div className="acoes-linha">
        <button className="botao" disabled={abrindo} onClick={onConversar}>
          <MessageCircle size={18} /> {abrindo ? 'Abrindo…' : 'Conversar'}
        </button>
        <a className="botao-sec" href={CONSULTA_CONFEF} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} /> Conferir CREF
        </a>
      </div>
    </li>
  )
}

/** Aluno encontra um profissional de Educação Física habilitado e conversa com ele pelo chat do app. */
export function EncontrarPersonal({ meuId, meuNome, onVoltar, onConversa }: { meuId: string; meuNome: string; onVoltar: () => void; onConversa: (c: Conversa) => void }) {
  const [lista, setLista] = useState<ProfissionalHabilitado[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [abrindo, setAbrindo] = useState<string | null>(null)
  const [servicos, setServicos] = useState<Servico[]>([])

  async function conversar(p: ProfissionalHabilitado) {
    setAbrindo(p.id)
    const { id, erro: e } = await abrirConversa(p.id)
    setAbrindo(null)
    if (e || !id) return setErro(e ?? 'Não deu para abrir a conversa.')
    onConversa({ id, aluno_id: meuId, profissional_id: p.id, aluno_nome: meuNome, profissional_nome: p.nome, profissional_foto: p.foto_url ?? '', ultima_em: new Date().toISOString(), ultima_previa: '', nao_lidas: 0 })
  }

  useEffect(() => {
    listarServicos().then((s) => setServicos(s.filter((x) => x.ativo).sort((a, b) => a.preco - b.preco)))
    listarProfissionais().then((r) => {
      setLista(r.lista)
      setErro(r.erro)
    })
  }, [])

  const visiveis = lista ? filtrarProfissionais(lista, busca) : []

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
      </header>
      <h1>Encontrar personal</h1>
      <p className="dica-sec">
        Profissionais de Educação Física cadastrados no FormaCerta, com registro no CREF. Antes de contratar, toque em <b>Conferir CREF</b> e confira o número no site oficial do Conselho (CONFEF).
      </p>

      <label className="campo busca-personal">
        <Search size={16} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, cidade ou especialidade" aria-label="Buscar personal" />
      </label>

      {erro && <p className="mensagem erro">{erro}</p>}
      {lista === null && <p className="carregando">Carregando profissionais…</p>}
      {lista?.length === 0 && !erro && <p className="dica-sec">Ainda não há profissionais na lista. Volte em breve.</p>}
      {lista && lista.length > 0 && visiveis.length === 0 && <p className="dica-sec">Ninguém com essa busca. Tente outra cidade ou só o nome.</p>}

      <ul className="lista-personais">
        {visiveis.map((p) => (
          <Cartao key={p.id} p={p} servicos={servicos.filter((s) => s.profissional_id === p.id)} abrindo={abrindo === p.id} onConversar={() => conversar(p)} />
        ))}
      </ul>

      <p className="dica-sec rodape-lista">Converse pelo chat e contrate pelo app: o pagamento fica protegido e o histórico guardado no FormaCerta.</p>
    </div>
  )
}
