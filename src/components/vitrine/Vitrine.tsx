import { useEffect, useState } from 'react'
import { useConta, type Perfil } from '../../nuvem/conta'
import { listarPerfis } from '../../nuvem/gestao'
import {
  ROTULO_SITUACAO_FOTO,
  apagarFoto,
  enviarFoto,
  listarMinhasFotos,
  listarVitrine,
  prepararFoto,
  type FotoVitrine,
  type TipoFoto,
} from '../../nuvem/vitrine'
import { CartaoFoto } from './CartaoFoto'

type Aba = 'vitrine' | 'enviar' | 'minhas'

/** Vitrine dos alunos: ver as fotos aprovadas, enviar uma nova e acompanhar as suas. */
export function Vitrine({ onVoltar }: { onVoltar: () => void }) {
  const { perfil } = useConta()
  const [aba, setAba] = useState<Aba>('vitrine')
  const [fotos, setFotos] = useState<FotoVitrine[]>([])
  const [minhas, setMinhas] = useState<FotoVitrine[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    if (!perfil) return
    setCarregando(true)
    const [v, m] = await Promise.all([listarVitrine(60), listarMinhasFotos(perfil.id)])
    setFotos(v.fotos)
    setMinhas(m.fotos)
    setErro(v.erro ?? m.erro)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!perfil) return null

  async function apagar(f: FotoVitrine) {
    if (!confirm(`Tirar a foto de ${f.nome} da vitrine e apagar as imagens? Não tem como desfazer.`)) return
    const erro = await apagarFoto(f)
    if (erro) setErro(erro)
    else carregar()
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>

      <h1>Vitrine dos alunos</h1>
      <p className="dica-sec">Fotos de evolução e de treino com o FormaCerta, enviadas com a autorização de cada pessoa e aprovadas antes de aparecer.</p>

      <div className="escolha abas">
        <button className={aba === 'vitrine' ? 'ativo' : ''} onClick={() => setAba('vitrine')}>
          Vitrine
        </button>
        <button className={aba === 'enviar' ? 'ativo' : ''} onClick={() => setAba('enviar')}>
          Enviar foto
        </button>
        <button className={aba === 'minhas' ? 'ativo' : ''} onClick={() => setAba('minhas')}>
          Minhas fotos{minhas.length > 0 && ` (${minhas.length})`}
        </button>
      </div>

      {erro && <p className="mensagem erro">{erro}</p>}
      {carregando && aba !== 'enviar' && <p className="carregando">Carregando…</p>}

      {!carregando && aba === 'vitrine' && (
        <>
          {fotos.length === 0 && <p className="dica-sec">Nenhuma foto na vitrine ainda.</p>}
          <div className="grade-vitrine">
            {fotos.map((f) => (
              <CartaoFoto key={f.id} f={f} />
            ))}
          </div>
        </>
      )}

      {aba === 'enviar' && (
        <EnviarFoto
          perfil={perfil}
          onEnviado={() => {
            carregar()
            setAba('minhas')
          }}
        />
      )}

      {!carregando && aba === 'minhas' && (
        <>
          {minhas.length === 0 && <p className="dica-sec">Você ainda não enviou fotos, e ninguém enviou uma foto sua.</p>}
          <div className="grade-vitrine">
            {minhas.map((f) => (
              <CartaoFoto key={f.id} f={f}>
                <div className="acoes-linha">
                  <span className={`chip ${f.situacao === 'aprovada' ? 'chip-ok' : f.situacao === 'pendente' ? 'chip-atencao' : 'chip-alerta'}`}>
                    {ROTULO_SITUACAO_FOTO[f.situacao]}
                  </span>
                  <button className="botao-sec perigo" onClick={() => apagar(f)}>
                    Apagar
                  </button>
                </div>
              </CartaoFoto>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EnviarFoto({ perfil, onEnviado }: { perfil: Perfil; onEnviado: () => void }) {
  const ehAluno = perfil.papel === 'aluno'
  const [alunos, setAlunos] = useState<Perfil[]>([])
  const [alunoId, setAlunoId] = useState('')
  const [nome, setNome] = useState(ehAluno ? perfil.nome.split(' ')[0] : '')
  const [tipo, setTipo] = useState<TipoFoto>('evolucao')
  const [legenda, setLegenda] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [antes, setAntes] = useState<File | null>(null)
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (ehAluno) return
    listarPerfis().then((r) => setAlunos(r.perfis.filter((p) => p.papel === 'aluno' && (perfil.papel === 'admin' || p.profissional_id === perfil.id))))
  }, [ehAluno, perfil])

  function escolherAluno(id: string) {
    setAlunoId(id)
    const a = alunos.find((x) => x.id === id)
    if (a) setNome((a.nome || a.email).split(' ')[0])
  }

  async function enviar() {
    if (!foto) return
    setEnviando(true)
    setErro(null)
    try {
      const erro = await enviarFoto({
        meuId: perfil.id,
        alunoId: ehAluno ? perfil.id : alunoId || null,
        nome,
        legenda,
        tipo,
        foto: await prepararFoto(foto),
        antes: tipo === 'evolucao' && antes ? await prepararFoto(antes) : null,
      })
      if (erro) setErro(erro)
      else onEnviado()
    } catch {
      setErro('Não deu para abrir esta foto. Tente outra, em JPG ou PNG.')
    }
    setEnviando(false)
  }

  const pronto = aceito && !!foto && nome.trim() !== '' && !enviando

  return (
    <section className="cartao destaque formulario">
      <h2>Enviar foto para a vitrine</h2>

      <div className="escolha">
        <button className={tipo === 'evolucao' ? 'ativo' : ''} onClick={() => setTipo('evolucao')}>
          Evolução
        </button>
        <button className={tipo === 'uso' ? 'ativo' : ''} onClick={() => setTipo('uso')}>
          Usando o app
        </button>
      </div>
      <p className="dica-sec">
        {tipo === 'evolucao' ? 'Mande a foto de antes e a de agora, para mostrar a mudança.' : 'Uma foto treinando ou fazendo uma avaliação com o FormaCerta.'}
      </p>

      {!ehAluno && (
        <label className="campo">
          De quem é a foto
          <select value={alunoId} onChange={(e) => escolherAluno(e.target.value)}>
            <option value="">Pessoa sem conta no app</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome || a.email}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="campo">
        Nome que aparece na vitrine
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Ex.: Maria" />
        <span className="dica-sec">Pode ser só o primeiro nome.</span>
      </label>

      {tipo === 'evolucao' && (
        <label className="campo">
          Foto de antes (opcional)
          <input type="file" accept="image/*" onChange={(e) => setAntes(e.target.files?.[0] ?? null)} />
        </label>
      )}
      <label className="campo">
        {tipo === 'evolucao' ? 'Foto de agora' : 'Foto'}
        <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
      </label>

      <label className="campo">
        Legenda (opcional)
        <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={200} rows={2} placeholder="Ex.: 3 meses corrigindo a postura" />
      </label>

      <label className="aceite">
        <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
        <span>
          {ehAluno ? 'Eu autorizo' : 'A pessoa da foto autorizou'} o uso desta imagem na vitrine do FormaCerta, que outros usuários do app vão ver (LGPD,
          Lei 13.709/2018). Se for menor de 18 anos, o responsável autorizou. Dá para apagar a foto quando quiser em "Minhas fotos".
        </span>
      </label>

      <p className="dica-sec">A foto só aparece na vitrine depois que o administrador aprovar.</p>

      {erro && <p className="mensagem erro">{erro}</p>}

      <button className="botao" disabled={!pronto} onClick={enviar}>
        {enviando ? 'Enviando…' : 'Enviar para aprovação'}
      </button>
    </section>
  )
}
