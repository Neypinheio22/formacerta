import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { conferirHorarios, DIAS_SEMANA, meusAgendamentos, meusHorarios, salvarHorarios, type Agendamento, type HorarioSemana } from '../../nuvem/video'
import { ListaAgendamentos } from './AgendarVideo'

const HORAS = Array.from({ length: 35 }, (_, i) => `${String(5 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** Personal: horários da semana em que aceita treino agendado e os próximos agendamentos. */
export function AgendaPersonal({ meuId }: { meuId: string }) {
  const [horarios, setHorarios] = useState<HorarioSemana[] | null>(null)
  const [agenda, setAgenda] = useState<Agendamento[]>([])
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ erro: boolean; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    const [h, a] = await Promise.all([meusHorarios(meuId), meusAgendamentos()])
    setHorarios(h)
    setAgenda(a.filter((x) => x.profissional_id === meuId))
  }, [meuId])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Sem o SQL da agenda, nada aparece.
  if (horarios === null) return null

  const mudar = (i: number, campo: keyof HorarioSemana, valor: string | number) =>
    setHorarios(horarios.map((h, j) => (j === i ? { ...h, [campo]: valor } : h)))

  async function salvar() {
    const lista = horarios ?? []
    const problema = conferirHorarios(lista)
    if (problema) return setMsg({ erro: true, texto: problema })
    setSalvando(true)
    const e = await salvarHorarios(lista)
    setSalvando(false)
    if (e) return setMsg({ erro: true, texto: e })
    setMsg({ erro: false, texto: 'Agenda salva. Os alunos com chamada comprada já podem agendar.' })
    setEditando(false)
    carregar()
  }

  const resumo = DIAS_SEMANA.map((nome, d) => {
    const doDia = horarios.filter((h) => h.dia_semana === d)
    return doDia.length ? `${nome.slice(0, 3)} ${doDia.map((h) => `${h.inicio}–${h.fim}`).join(', ')}` : null
  }).filter(Boolean)

  return (
    <div className="agenda-personal">
      <h3>
        <CalendarDays size={16} /> Agenda de vídeo
      </h3>
      {!editando ? (
        <>
          <p className="dica-sec">{resumo.length ? resumo.join(' · ') : 'Abra horários na semana e o aluno que comprou chamada agenda sozinho, sem você precisar ficar disponível o dia todo.'}</p>
          <button className="botao-sec" onClick={() => setEditando(true)}>
            <CalendarDays size={16} /> {resumo.length ? 'Mudar horários' : 'Abrir horários na agenda'}
          </button>
        </>
      ) : (
        <>
          {horarios.map((h, i) => (
            <div className="linha-horario" key={i}>
              <select aria-label="Dia" value={h.dia_semana} onChange={(e) => mudar(i, 'dia_semana', Number(e.target.value))}>
                {DIAS_SEMANA.map((nome, d) => (
                  <option key={d} value={d}>
                    {nome.slice(0, 3)}
                  </option>
                ))}
              </select>
              <select aria-label="Início" value={h.inicio} onChange={(e) => mudar(i, 'inicio', e.target.value)}>
                {HORAS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <span>às</span>
              <select aria-label="Fim" value={h.fim} onChange={(e) => mudar(i, 'fim', e.target.value)}>
                {HORAS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button className="redondo-pequeno" aria-label="Tirar este horário" onClick={() => setHorarios(horarios.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="link"
            onClick={() => {
              const ultimo = horarios[horarios.length - 1]
              setHorarios([...horarios, { dia_semana: ultimo ? (ultimo.dia_semana + 1) % 7 : 1, inicio: ultimo?.inicio ?? '18:00', fim: ultimo?.fim ?? '21:00' }])
            }}
          >
            <Plus size={14} /> Adicionar horário
          </button>
          <div className="acoes-linha">
            <button className="botao" disabled={salvando} onClick={salvar}>
              Salvar agenda
            </button>
            <button
              className="botao-sec"
              onClick={() => {
                setEditando(false)
                setMsg(null)
                carregar()
              }}
            >
              Cancelar
            </button>
          </div>
          <p className="dica-sec">Horário de Brasília. O aluno agenda com pelo menos 1 hora de antecedência, de 30 em 30 minutos.</p>
        </>
      )}
      {msg && <p className={`mensagem ${msg.erro ? 'erro' : 'ok'}`}>{msg.texto}</p>}
      {agenda.length > 0 && (
        <>
          <h3>Próximos treinos agendados</h3>
          <ListaAgendamentos meuId={meuId} lista={agenda} onMudou={carregar} />
        </>
      )}
    </div>
  )
}
