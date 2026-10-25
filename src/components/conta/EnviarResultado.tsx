import { useEffect, useState } from 'react'
import { useConta, type Perfil } from '../../nuvem/conta'
import { listarPerfis } from '../../nuvem/gestao'
import { enviarResultado, type TipoResultado } from '../../nuvem/resultados'

const ENVIADOS = 'formacerta:enviados'

function jaEnviado(id: string) {
  try {
    return (JSON.parse(localStorage.getItem(ENVIADOS) ?? '[]') as string[]).includes(id)
  } catch {
    return false
  }
}

function marcarEnviado(id: string) {
  try {
    const lista = JSON.parse(localStorage.getItem(ENVIADOS) ?? '[]') as string[]
    localStorage.setItem(ENVIADOS, JSON.stringify([id, ...lista].slice(0, 500)))
  } catch {
    /* ignora */
  }
}

type Props = {
  tipo: TipoResultado
  /** Id do resultado no celular, para não mandar duas vezes. */
  id: string
  feitoEm: string
  resultado: unknown
  /** Nome digitado no teste, sugerido como apelido. */
  avaliado?: string
  altura?: number
}

/** Cartão no fim de cada resultado: com o consentimento da pessoa, manda os números para o banco. */
export function EnviarResultado({ tipo, id, feitoEm, resultado, avaliado = '', altura }: Props) {
  const { perfil } = useConta()
  const [aberto, setAberto] = useState(false)
  const [enviado, setEnviado] = useState(() => jaEnviado(id))
  const [alunos, setAlunos] = useState<Perfil[]>([])
  const [alunoId, setAlunoId] = useState('')
  const [apelido, setApelido] = useState(avaliado)
  const [idade, setIdade] = useState('')
  const [sexo, setSexo] = useState<'' | 'feminino' | 'masculino' | 'outro'>('')
  const [alturaCm, setAlturaCm] = useState(altura ? String(altura) : '')
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const ehAluno = perfil?.papel === 'aluno'

  useEffect(() => {
    if (!aberto || ehAluno || !perfil) return
    listarPerfis().then((r) => {
      const meus = r.perfis.filter((p) => p.papel === 'aluno' && (perfil.papel === 'admin' || p.profissional_id === perfil.id))
      setAlunos(meus)
      const igual = meus.find((p) => p.nome.trim().toLocaleLowerCase('pt-BR') === avaliado.trim().toLocaleLowerCase('pt-BR'))
      if (igual) setAlunoId(igual.id)
    })
  }, [aberto, ehAluno, perfil, avaliado])

  if (!perfil || perfil.situacao !== 'liberado') return null

  if (enviado)
    return (
      <section className="cartao">
        <p className="mensagem ok">
          Resultado guardado no banco do FormaCerta{ehAluno ? '' : ', no histórico do aluno'}. Isso não manda mensagem para ninguém: para mandar para a pessoa, use o
          botão “Enviar pelo WhatsApp”.
        </p>
      </section>
    )

  const numero = (s: string) => (s.trim() === '' ? null : Math.round(Number(s.replace(',', '.'))))

  async function enviar() {
    setEnviando(true)
    setErro(null)
    const erro = await enviarResultado({
      tipo,
      feitoEm,
      resultado,
      enviadoPor: perfil!.id,
      alunoId: ehAluno ? perfil!.id : alunoId || null,
      apelido: ehAluno ? '' : alunoId ? '' : apelido,
      idade: numero(idade),
      sexo: sexo || null,
      alturaCm: numero(alturaCm),
    })
    setEnviando(false)
    if (erro) return setErro(erro)
    marcarEnviado(id)
    setEnviado(true)
  }

  if (!aberto)
    return (
      <section className="cartao">
        <h2>Guardar no banco do FormaCerta</h2>
        <p className="dica-sec">
          Envia só os números deste resultado, sem foto e sem vídeo, para {ehAluno ? 'o seu personal acompanhar' : 'acompanhar a evolução do aluno'} e
          melhorar as análises do app. Não manda mensagem para a pessoa: para isso, use o botão “Enviar pelo WhatsApp”.
        </p>
        <button className="botao-sec" onClick={() => setAberto(true)}>
          Guardar no app
        </button>
      </section>
    )

  return (
    <section className="cartao destaque formulario">
      <h2>Guardar no banco do FormaCerta</h2>

      {!ehAluno && (
        <label className="campo">
          De quem é este teste
          <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)}>
            <option value="">Pessoa sem conta no app</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome || a.email}
              </option>
            ))}
          </select>
        </label>
      )}
      {!ehAluno && !alunoId && (
        <label className="campo">
          Apelido ou código
          <input value={apelido} onChange={(e) => setApelido(e.target.value)} maxLength={60} placeholder="Ex.: Maria S. ou A-012" />
          <span className="dica-sec">Pode usar só o primeiro nome ou um código, para não identificar a pessoa.</span>
        </label>
      )}

      <div className="tres-campos">
        <label className="campo">
          Idade
          <input inputMode="numeric" value={idade} onChange={(e) => setIdade(e.target.value.replace(/\D/g, ''))} maxLength={3} />
        </label>
        <label className="campo">
          Altura (cm)
          <input inputMode="numeric" value={alturaCm} onChange={(e) => setAlturaCm(e.target.value.replace(/\D/g, ''))} maxLength={3} />
        </label>
        <label className="campo">
          Sexo
          <select value={sexo} onChange={(e) => setSexo(e.target.value as typeof sexo)}>
            <option value="">—</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="outro">Outro</option>
          </select>
        </label>
      </div>
      <p className="dica-sec">Idade, altura e sexo são opcionais, mas ajudam a comparar resultados parecidos.</p>

      <label className="aceite">
        <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
        <span>
          {ehAluno ? 'Eu autorizo' : 'A pessoa avaliada autorizou'} enviar estes números (sem foto e sem vídeo) para o FormaCerta, para acompanhar a evolução
          e melhorar as análises. Dá para apagar quando quiser.
        </span>
      </label>

      {erro && <p className="mensagem erro">{erro}</p>}

      <button className="botao" disabled={!aceito || enviando || (!ehAluno && !alunoId && apelido.trim() === '')} onClick={enviar}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
      <button className="botao-sec" onClick={() => setAberto(false)}>
        Agora não
      </button>
    </section>
  )
}
