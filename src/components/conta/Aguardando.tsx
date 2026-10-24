import { sair, useConta } from '../../nuvem/conta'
import { Logo } from '../Logo'

/** Conta criada, mas o administrador ainda não liberou (ou bloqueou). */
export function Aguardando() {
  const { perfil, recarregar } = useConta()
  const bloqueado = perfil?.situacao === 'bloqueado'
  return (
    <div className="tela">
      <header className="marca">
        <Logo size={30} />
      </header>
      <section className="cartao destaque">
        <span className="etiqueta">{bloqueado ? 'Acesso bloqueado' : 'Quase lá'}</span>
        <h1>{bloqueado ? 'Seu acesso está bloqueado' : 'Aguardando liberação'}</h1>
        <p className="dica">
          {bloqueado
            ? 'O administrador do FormaCerta bloqueou esta conta. Fale com ele para saber mais.'
            : `Olá${perfil?.nome ? `, ${perfil.nome.split(' ')[0]}` : ''}! Seu cadastro chegou. O administrador confere os dados e libera o acesso; depois é só voltar aqui.`}
        </p>
        <p className="dica-sec">Conta: {perfil?.email}</p>
        {!bloqueado && (
          <button className="botao" onClick={() => recarregar()}>
            Já fui liberado
          </button>
        )}
        <button className="botao-sec" onClick={() => sair()}>
          Sair
        </button>
      </section>
    </div>
  )
}
