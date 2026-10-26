import { useEffect, useState } from 'react'
import { useConta } from '../../nuvem/conta'
import { criarFicha, fichaPeloNome, fichaVazia, idadeDe, listarFichas, type Ficha } from '../../nuvem/fichas'
import { enviarResultado, type TipoResultado } from '../../nuvem/resultados'

const ENVIADOS = 'formacerta:enviados'
const NOVA = 'nova'

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
  const [fichas, setFichas] = useState<Ficha[]>([])
  // Id da ficha escolhida, ou NOVA para criar uma ficha com o nome digitado.
  const [fichaId, setFichaId] = useState('')
  const [nomeNovo, setNomeNovo] = useState(avaliado)
  const [idade, setIdade] = useState('')
  const [sexo, setSexo] = useState<'' | 'feminino' | 'masculino' | 'outro'>('')
  const [alturaCm, setAlturaCm] = useState(altura ? String(altura) : '')
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const ehAluno = perfil?.papel === 'aluno'

  useEffect(() => {
    if (!aberto || ehAluno || !perfil) return
    listarFichas().then((r) => {
      const minhas = r.fichas.filter((f) => f.profissional_id === perfil.id || perfil.papel === 'admin')
      setFichas(minhas)
      // Já escolhe a ficha com o nome digitado no teste; sem ficha, oferece criar.
      setFichaId(fichaPeloNome(minhas, avaliado)?.id ?? NOVA)
    })
  }, [aberto, ehAluno, perfil, avaliado])

  const ficha = fichas.find((f) => f.id === fichaId)
  // A ficha guarda a autorização do aluno e os dados pessoais: não precisa pedir de novo.
  const autorizadoNaFicha = !!ficha?.consentimento_em

  if (!perfil || perfil.situacao !== 'liberado') return null

  if (enviado)
    return (
      <section className="cartao">
        <p className="mensagem ok">
          Resultado guardado {ehAluno ? 'no banco do FormaCerta' : 'na ficha do aluno'}, e já entra nos gráficos de evolução. Isso não manda mensagem para ninguém: para mandar para a pessoa, use o
          botão “Enviar pelo WhatsApp”.
        </p>
      </section>
    )

  const numero = (s: string) => (s.trim() === '' ? null : Math.round(Number(s.replace(',', '.'))))

  async function enviar() {
    setEnviando(true)
    setErro(null)
    let alvo = ficha
    if (!ehAluno && fichaId === NOVA) {
      const sx = sexo || null
      const r = await criarFicha(perfil!.id, { ...fichaVazia(nomeNovo), sexo: sx, altura_cm: numero(alturaCm), consentimento_em: new Date().toISOString() })
      if (!r.ficha) {
        setEnviando(false)
        return setErro(r.erro)
      }
      alvo = r.ficha
    }
    const erro = await enviarResultado({
      tipo,
      feitoEm,
      resultado,
      enviadoPor: perfil!.id,
      alunoId: ehAluno ? perfil!.id : (alvo?.aluno_id ?? null),
      fichaId: alvo?.id ?? null,
      apelido: '',
      idade: alvo ? idadeDe(alvo.nascimento, new Date(feitoEm)) ?? numero(idade) : numero(idade),
      sexo: alvo?.sexo ?? (sexo || null),
      alturaCm: alvo?.altura_cm ?? numero(alturaCm),
    })
    setEnviando(false)
    if (erro) return setErro(erro)
    marcarEnviado(id)
    setEnviado(true)
  }

  if (!aberto)
    return (
      <section className="cartao">
        <h2>{ehAluno ? 'Guardar no banco do FormaCerta' : 'Guardar na ficha do aluno'}</h2>
        <p className="dica-sec">
          Envia só os números deste resultado, sem foto e sem vídeo, para {ehAluno ? 'o seu personal acompanhar' : 'acompanhar a evolução do aluno'} e
          melhorar as análises do app. Não manda mensagem para a pessoa: para isso, use o botão “Enviar pelo WhatsApp”.
        </p>
        <button className="botao-sec" onClick={() => setAberto(true)}>
          {ehAluno ? 'Guardar no app' : 'Guardar na ficha'}
        </button>
      </section>
    )

  return (
    <section className="cartao destaque formulario">
      <h2>{ehAluno ? 'Guardar no banco do FormaCerta' : 'Guardar na ficha do aluno'}</h2>

      {!ehAluno && (
        <label className="campo">
          De quem é este teste
          <select value={fichaId} onChange={(e) => setFichaId(e.target.value)}>
            <option value={NOVA}>+ Nova ficha</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {!ehAluno && fichaId === NOVA && (
        <label className="campo">
          Nome do aluno
          <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} maxLength={120} placeholder="Ex.: Maria Souza" />
          <span className="dica-sec">Cria a ficha agora. Depois dá para completar nascimento, objetivo e saúde em “Meus alunos”.</span>
        </label>
      )}

      {(ehAluno || fichaId === NOVA) && (
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
      )}
      {(ehAluno || fichaId === NOVA) && <p className="dica-sec">Idade, altura e sexo são opcionais, mas ajudam a comparar resultados parecidos.</p>}

      {autorizadoNaFicha ? (
        <p className="dica-sec">✓ {ficha!.nome.split(' ')[0]} já autorizou na ficha guardar os números das avaliações.</p>
      ) : (
        <label className="aceite">
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
          <span>
            {ehAluno ? 'Eu autorizo' : 'A pessoa avaliada autorizou'} enviar estes números (sem foto e sem vídeo) para o FormaCerta, para acompanhar a evolução
            e melhorar as análises. Dá para apagar quando quiser.
          </span>
        </label>
      )}

      {erro && <p className="mensagem erro">{erro}</p>}

      <button className="botao" disabled={!(aceito || autorizadoNaFicha) || enviando || (!ehAluno && (!fichaId || (fichaId === NOVA && nomeNovo.trim() === '')))} onClick={enviar}>
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
      <button className="botao-sec" onClick={() => setAberto(false)}>
        Agora não
      </button>
    </section>
  )
}
