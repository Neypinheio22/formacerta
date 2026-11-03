import { BellRing, Download, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import { appInstalado, ativarPush, ehIphone, estadoPush, instalarApp, podeInstalarDireto, type EstadoPush } from '../nuvem/push'

const lerDispensado = (k: string) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
const dispensar = (k: string) => {
  try {
    localStorage.setItem(k, '1')
  } catch {
    // Sem acesso ao aparelho: volta a aparecer na próxima visita.
  }
}

/** Botão "Instalar o FormaCerta": Android instala com um toque; iPhone mostra o caminho. */
export function CartaoInstalar() {
  const [direto, setDireto] = useState(podeInstalarDireto)
  const [instalado, setInstalado] = useState(appInstalado)
  const [fora, setFora] = useState(() => lerDispensado('formacerta:sem-instalar'))
  const [passos, setPassos] = useState(false)
  const iphone = ehIphone()

  useEffect(() => {
    const ver = () => {
      setDireto(podeInstalarDireto())
      setInstalado(appInstalado())
    }
    window.addEventListener('formacerta:instalavel', ver)
    return () => window.removeEventListener('formacerta:instalavel', ver)
  }, [])

  if (instalado || fora || (!direto && !iphone)) return null

  return (
    <section className="cartao cartao-instalar">
      <span className="etiqueta">
        <Download size={14} /> App no celular
      </span>
      <h2>Instale o FormaCerta</h2>
      <p className="dica-sec">Fica com o ícone na tela do celular, abre em tela cheia como app de loja{iphone ? ' e, no iPhone, é assim que as notificações funcionam' : ''}.</p>
      {direto ? (
        <button className="botao" onClick={() => instalarApp().then((ok) => ok && setInstalado(true))}>
          <Download size={18} /> Instalar o FormaCerta
        </button>
      ) : passos ? (
        <ol className="passos-instalar">
          <li>
            Toque em <Share size={14} aria-label="Compartilhar" /> <b>Compartilhar</b>, na barra do Safari.
          </li>
          <li>
            Escolha <b>Adicionar à Tela de Início</b>.
          </li>
          <li>
            Toque em <b>Adicionar</b>. Depois abra o FormaCerta pelo ícone novo.
          </li>
        </ol>
      ) : (
        <button className="botao" onClick={() => setPassos(true)}>
          <Download size={18} /> Como instalar no iPhone
        </button>
      )}
      <button
        className="link"
        onClick={() => {
          dispensar('formacerta:sem-instalar')
          setFora(true)
        }}
      >
        Agora não
      </button>
    </section>
  )
}

/** Convite para ligar as notificações (mensagem no chat, chamada de vídeo, lembrete do treino). */
export function CartaoNotificacoes({ personal }: { personal: boolean }) {
  const [estado, setEstado] = useState<EstadoPush>(estadoPush)
  const [fora, setFora] = useState(() => lerDispensado('formacerta:sem-notificacao'))
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (fora || estado === 'ligado' || estado === 'sem-suporte' || estado === 'precisa-instalar') return null

  async function ativar() {
    setAtivando(true)
    setErro(null)
    const e = await ativarPush()
    setAtivando(false)
    setEstado(estadoPush())
    if (e) setErro(e)
  }

  return (
    <section className="cartao cartao-notificacoes">
      <span className="etiqueta">
        <BellRing size={14} /> Notificações
      </span>
      <h2>Receba os avisos no celular</h2>
      <p className="dica-sec">
        {personal
          ? 'Mensagem nova dos alunos, aluno chamando por vídeo e lembrete dos treinos agendados, mesmo com o app fechado.'
          : 'Mensagem nova do seu personal e lembrete do treino por vídeo, mesmo com o app fechado.'}
      </p>
      {estado === 'bloqueado' ? (
        <p className="dica-sec">As notificações estão bloqueadas para este site. Libere nas configurações do navegador (cadeado ao lado do endereço).</p>
      ) : (
        <button className="botao" disabled={ativando} onClick={ativar}>
          <BellRing size={18} /> {ativando ? 'Ativando…' : 'Ativar notificações'}
        </button>
      )}
      {erro && <p className="mensagem erro">{erro}</p>}
      <button
        className="link"
        onClick={() => {
          dispensar('formacerta:sem-notificacao')
          setFora(true)
        }}
      >
        Agora não
      </button>
    </section>
  )
}
