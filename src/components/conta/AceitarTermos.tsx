import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { sair, useConta } from '../../nuvem/conta'
import { excluirMinhaConta } from '../../nuvem/gestao'
import { aceitarTermos } from '../../nuvem/privacidade'
import { Logo } from '../Logo'
import { AceiteLgpd } from './AceiteLgpd'
import { Privacidade } from './Privacidade'
import { Suporte } from './Suporte'
import { Termos } from './Termos'

/** Primeiro acesso (aluno cadastrado pelo personal) ou termos novos: pede o aceite antes de abrir o app. */
export function AceitarTermos() {
  const { perfil, recarregar } = useConta()
  const [termos, setTermos] = useState(false)
  const [saude, setSaude] = useState(false)
  const [ver, setVer] = useState<'termos' | 'privacidade' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (ver === 'termos') return <Termos onVoltar={() => setVer(null)} />
  if (ver === 'privacidade') return <Privacidade onVoltar={() => setVer(null)} />

  const primeiraVez = !perfil?.termos_versao

  async function aceitar() {
    setEnviando(true)
    const e = await aceitarTermos()
    setEnviando(false)
    if (e) setErro(e)
    else await recarregar()
  }

  async function apagar() {
    if (!confirm('Apagar a sua conta e todos os seus dados do FormaCerta? Não tem como desfazer.')) return
    const e = await excluirMinhaConta()
    if (e) setErro(e)
    else await sair()
  }

  return (
    <div className="tela">
      <header className="marca">
        <Logo size={30} />
      </header>
      <section className="cartao destaque formulario">
        <span className="etiqueta">
          <ShieldCheck size={14} /> Privacidade · LGPD
        </span>
        <h1>{primeiraVez ? 'Antes de começar' : 'Atualizamos os termos'}</h1>
        <p className="dica">
          {primeiraVez
            ? `Olá${perfil?.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}! O FormaCerta guarda resultados de avaliações físicas, que são dados de saúde. Pela LGPD, precisamos da sua autorização.`
            : 'Os Termos de uso e a Política de privacidade mudaram. Leia e aceite para continuar usando o app.'}
        </p>

        <AceiteLgpd termos={termos} saude={saude} onTermos={setTermos} onSaude={setSaude} onVerTermos={() => setVer('termos')} onVerPrivacidade={() => setVer('privacidade')} />

        {erro && <p className="mensagem erro">{erro}</p>}

        <button className="botao grande" disabled={!termos || !saude || enviando} onClick={aceitar}>
          {enviando ? 'Aguarde…' : 'Aceito e quero continuar'}
        </button>
        <p className="dica-sec">Não quer autorizar? Pode só sair, ou apagar a sua conta e tudo o que estiver guardado nela.</p>
        <button className="botao-sec" onClick={() => sair()}>
          Agora não, sair
        </button>
        <button className="botao-sec perigo" onClick={apagar}>
          Não aceito, apagar minha conta
        </button>
      </section>
      <Suporte assunto="Privacidade no FormaCerta" />
    </div>
  )
}
