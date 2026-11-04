import { BellRing, CalendarClock, Check, MessagesSquare, Repeat, Search, Send, Users, Zap, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Ficha } from '../../nuvem/fichas'
import {
  CATEGORIAS,
  comNome,
  conferir,
  DIAS_CURTOS,
  DIAS_LETRA,
  MODELOS,
  salvarNotificacao,
  TEXTO_MAXIMO,
  TITULO_MAXIMO,
  type DadosNotificacao,
  type Frequencia,
  type Modelo,
  type TipoNotificacao,
} from '../../nuvem/notificacoes'

export const TIPOS: { id: TipoNotificacao; rotulo: string; texto: string; Icone: LucideIcon }[] = [
  { id: 'agora', rotulo: 'Enviar na hora', texto: 'A mensagem chega agora no celular do aluno.', Icone: Zap },
  { id: 'agendada', rotulo: 'Agendar', texto: 'Escolha o dia e o horário em que ela vai sair.', Icone: CalendarClock },
  { id: 'recorrente', rotulo: 'Recorrente', texto: 'Repete sozinha: dias da semana, a cada 2 semanas ou todo mês.', Icone: Repeat },
]

const FREQUENCIAS: { id: Frequencia; rotulo: string }[] = [
  { id: 'diaria', rotulo: 'Todo dia' },
  { id: 'semanal', rotulo: 'Toda semana' },
  { id: 'quinzenal', rotulo: 'A cada 2 semanas' },
  { id: 'mensal', rotulo: 'Todo mês' },
]

/** Escolha de como enviar (os 3 botões grandes). */
export function EscolherTipo({ onEscolher }: { onEscolher: (t: TipoNotificacao) => void }) {
  return (
    <div className="notif-tipos">
      {TIPOS.map(({ id, rotulo, texto, Icone }) => (
        <button key={id} className="notif-tipo" onClick={() => onEscolher(id)}>
          <span className="atalho-icone">
            <Icone size={22} />
          </span>
          <span>
            <strong>{rotulo}</strong>
            <small>{texto}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Formulário de criar ou editar. `fichas`: só os alunos deste personal. */
export function CriarNotificacao({
  inicial,
  fichas,
  meuNome,
  onPronto,
  onCancelar,
  onTrocar,
}: {
  inicial: DadosNotificacao
  fichas: Ficha[]
  meuNome: string
  onPronto: (msg: string) => void
  onCancelar: () => void
  /** Volta para a escolha entre na hora, agendar e recorrente. */
  onTrocar?: () => void
}) {
  const [d, setD] = useState<DadosNotificacao>(inicial)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modelo, setModelo] = useState<string | null>(null)
  const editando = !!inicial.id
  const tipo = TIPOS.find((t) => t.id === d.tipo)!

  const comConta = useMemo(() => fichas.filter((f) => f.aluno_id), [fichas])
  const escolhidos = d.todos ? comConta : fichas.filter((f) => d.fichas.includes(f.id))
  const recebem = escolhidos.filter((f) => f.aluno_id)
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = fichas.filter((f) => !termo || f.nome.toLocaleLowerCase('pt-BR').includes(termo))
  const exemploNome = recebem[0]?.nome ?? 'Ana'

  const mudar = (p: Partial<DadosNotificacao>) => setD((v) => ({ ...v, ...p }))
  const alternarFicha = (id: string) => mudar({ fichas: d.fichas.includes(id) ? d.fichas.filter((x) => x !== id) : [...d.fichas, id] })
  const alternarDia = (dia: number) => mudar({ dias_semana: d.dias_semana.includes(dia) ? d.dias_semana.filter((x) => x !== dia) : [...d.dias_semana, dia].sort() })

  function usarModelo(m: Modelo) {
    setModelo(m.id)
    const s = m.sugestao ?? {}
    // A sugestão de repetição só vale para quem está criando uma recorrente.
    mudar({
      categoria: m.categoria,
      titulo: m.titulo,
      texto: m.texto,
      ...(d.tipo === 'recorrente' && s.tipo === 'recorrente' ? { frequencia: s.frequencia ?? d.frequencia, dia_mes: s.dia_mes ?? d.dia_mes, dias_semana: s.dias_semana ?? d.dias_semana, hora: s.hora ?? d.hora } : {}),
    })
  }

  async function confirmar() {
    const problema = conferir(d)
    if (problema) return setErro(problema)
    if (!recebem.length) return setErro(d.todos ? 'Nenhum aluno seu tem conta no app ainda. Convide pelo WhatsApp em Meus alunos.' : 'Os alunos escolhidos ainda não têm conta no app.')
    setSalvando(true)
    setErro(null)
    const r = await salvarNotificacao(d)
    setSalvando(false)
    if (r.erro) return setErro(r.erro)
    const n = recebem.length
    onPronto(
      d.tipo === 'agora'
        ? `Enviada para ${r.enviados || n} ${(r.enviados || n) === 1 ? 'aluno' : 'alunos'}.`
        : editando
          ? 'Alterações guardadas.'
          : d.tipo === 'agendada'
            ? 'Notificação agendada.'
            : 'Recorrência criada.',
    )
  }

  const textoBotao = salvando
    ? 'Enviando…'
    : d.tipo === 'agora'
      ? `Confirmar envio para ${recebem.length} ${recebem.length === 1 ? 'aluno' : 'alunos'}`
      : editando
        ? 'Salvar alterações'
        : d.tipo === 'agendada'
          ? 'Confirmar agendamento'
          : 'Criar recorrência'

  return (
    <div className="notif-form">
      <p className="notif-modo">
        <tipo.Icone size={16} /> {tipo.rotulo}
        {!editando && onTrocar && (
          <button className="link" onClick={onTrocar}>
            Trocar
          </button>
        )}
      </p>

      {/* Modelos prontos */}
      {!editando && (
        <section className="cartao notif-secao">
          <h2 className="titulo-secao">Usar um modelo</h2>
          {CATEGORIAS.map((c) => (
            <div key={c.id} className="notif-modelos">
              <span className="notif-modelos-titulo">
                {c.emoji} {c.rotulo}
              </span>
              <div className="atalhos-data">
                {MODELOS.filter((m) => m.categoria === c.id).map((m) => (
                  <button key={m.id} type="button" className={`chip-botao ${modelo === m.id ? 'ativo' : ''}`} onClick={() => usarModelo(m)}>
                    {m.rotulo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Para quem */}
      <section className="cartao notif-secao">
        <h2 className="titulo-secao">
          <Users size={18} /> Para quem
        </h2>
        <div className="seletor-comparar" role="radiogroup" aria-label="Para quem">
          <button role="radio" aria-checked={d.todos} className={d.todos ? 'ativo' : ''} onClick={() => mudar({ todos: true })}>
            Todos os ativos ({comConta.length})
          </button>
          <button role="radio" aria-checked={!d.todos} className={!d.todos ? 'ativo' : ''} onClick={() => mudar({ todos: false })}>
            Escolher alunos
          </button>
        </div>
        {d.todos ? (
          <p className="dica-sec">
            Vai para todos os seus alunos com conta no app, inclusive os que entrarem depois
            {fichas.length > comConta.length ? `. ${fichas.length - comConta.length === 1 ? '1 aluno sem conta no app fica' : `${fichas.length - comConta.length} alunos sem conta no app ficam`} de fora.` : '.'}
          </p>
        ) : (
          <>
            {fichas.length > 6 && (
              <label className="busca-alunos">
                <Search size={16} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno" aria-label="Buscar aluno" />
              </label>
            )}
            <div className="acoes-linha notif-marcar">
              <button className="link" type="button" onClick={() => mudar({ fichas: comConta.map((f) => f.id) })}>
                Marcar todos
              </button>
              <button className="link" type="button" onClick={() => mudar({ fichas: [] })}>
                Desmarcar
              </button>
            </div>
            <ul className="notif-alunos">
              {visiveis.map((f) => (
                <li key={f.id}>
                  <label className={`campo-check ${f.aluno_id ? '' : 'apagado'}`}>
                    <input type="checkbox" disabled={!f.aluno_id} checked={d.fichas.includes(f.id)} onChange={() => alternarFicha(f.id)} />
                    <span>{f.nome}</span>
                    {!f.aluno_id && <small>sem conta no app</small>}
                  </label>
                </li>
              ))}
              {!visiveis.length && <li className="dica-sec">Nenhum aluno encontrado.</li>}
            </ul>
            <p className="dica-sec">
              {recebem.length} {recebem.length === 1 ? 'aluno escolhido' : 'alunos escolhidos'}
            </p>
          </>
        )}
      </section>

      {/* Mensagem */}
      <section className="cartao notif-secao formulario">
        <h2 className="titulo-secao">
          <BellRing size={18} /> Mensagem
        </h2>
        <label className="campo">
          Título
          <input value={d.titulo} maxLength={TITULO_MAXIMO} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Ex.: Hoje tem treino!" />
        </label>
        <label className="campo">
          Mensagem
          <textarea value={d.texto} maxLength={TEXTO_MAXIMO} rows={4} onChange={(e) => mudar({ texto: e.target.value })} placeholder="Escreva aqui. Use {nome} para colocar o nome do aluno." />
        </label>
        <div className="notif-nome">
          <button type="button" className="chip-botao" onClick={() => mudar({ texto: `${d.texto}${d.texto && !d.texto.endsWith(' ') ? ' ' : ''}{nome}` })}>
            + nome do aluno
          </button>
          <small>
            {d.texto.length}/{TEXTO_MAXIMO}
          </small>
        </div>
        <label className="campo-check">
          <input type="checkbox" checked={d.no_chat} onChange={(e) => mudar({ no_chat: e.target.checked })} />
          <MessagesSquare size={16} /> Mandar também no chat com o aluno
        </label>
      </section>

      {/* Quando */}
      {d.tipo === 'agendada' && (
        <section className="cartao notif-secao formulario">
          <h2 className="titulo-secao">
            <CalendarClock size={18} /> Quando
          </h2>
          <div className="notif-linha">
            <label className="campo">
              Data
              <input type="date" value={d.data} onChange={(e) => mudar({ data: e.target.value })} />
            </label>
            <label className="campo">
              Horário
              <input type="time" value={d.hora} onChange={(e) => mudar({ hora: e.target.value })} />
            </label>
          </div>
          <p className="dica-sec">Horário de Brasília.</p>
        </section>
      )}

      {d.tipo === 'recorrente' && (
        <section className="cartao notif-secao formulario">
          <h2 className="titulo-secao">
            <Repeat size={18} /> Repetição
          </h2>
          <div className="campo">
            Frequência
            <div className="atalhos-data" role="radiogroup" aria-label="Frequência">
              {FREQUENCIAS.map((f) => (
                <button key={f.id} type="button" role="radio" aria-checked={d.frequencia === f.id} className={`chip-botao ${d.frequencia === f.id ? 'ativo' : ''}`} onClick={() => mudar({ frequencia: f.id })}>
                  {f.rotulo}
                </button>
              ))}
            </div>
          </div>
          {(d.frequencia === 'semanal' || d.frequencia === 'quinzenal') && (
            <div className="campo">
              Dias da semana
              <div className="notif-dias">
                {DIAS_LETRA.map((l, i) => (
                  <button key={i} type="button" aria-label={DIAS_CURTOS[i]} aria-pressed={d.dias_semana.includes(i)} className={d.dias_semana.includes(i) ? 'ativo' : ''} onClick={() => alternarDia(i)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="notif-linha">
            {d.frequencia === 'mensal' && (
              <label className="campo">
                Dia do mês
                <input type="number" min={1} max={31} inputMode="numeric" value={d.dia_mes || ''} onChange={(e) => mudar({ dia_mes: Number(e.target.value) })} />
              </label>
            )}
            <label className="campo">
              Horário
              <input type="time" value={d.hora} onChange={(e) => mudar({ hora: e.target.value })} />
            </label>
          </div>
          <div className="notif-linha">
            <label className="campo">
              Começa em
              <input type="date" value={d.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
            </label>
            <label className="campo">
              Termina em
              <input type="date" value={d.fim} min={d.inicio} onChange={(e) => mudar({ fim: e.target.value })} />
            </label>
          </div>
          <p className="dica-sec">
            {d.frequencia === 'mensal' && d.dia_mes > 28 ? 'Nos meses mais curtos, sai no último dia. ' : ''}
            {d.fim ? '' : 'Sem data para terminar: repete até você pausar ou excluir. '}Horário de Brasília.
          </p>
        </section>
      )}

      {/* Prévia */}
      {(d.titulo || d.texto) && (
        <section className="notif-previa" aria-label="Como o aluno vê">
          <span className="dica-sec">Como o aluno vê no celular</span>
          <div className="notif-previa-cartao">
            <img src="./icon-192.png" alt="" width={36} height={36} />
            <div>
              <strong>
                {meuNome.split(' ')[0] || 'Seu personal'}: {d.titulo || 'Título'}
              </strong>
              <p>{comNome(d.texto, exemploNome)}</p>
            </div>
          </div>
        </section>
      )}

      {erro && <p className="mensagem erro">{erro}</p>}
      <div className="acoes-linha notif-acoes">
        <button className="botao" disabled={salvando} onClick={confirmar}>
          {d.tipo === 'agora' ? <Send size={18} /> : <Check size={18} />} {textoBotao}
        </button>
        <button className="botao-sec" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

