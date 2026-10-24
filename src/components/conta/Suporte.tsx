import { SUPORTE } from '../../nuvem/conta'

/** Linha com o e-mail de suporte, para quem não consegue entrar ou encontra um erro. */
export function Suporte({ assunto = 'Suporte FormaCerta' }: { assunto?: string }) {
  return (
    <p className="dica-sec suporte">
      Problema para entrar ou algum erro? Fale com o suporte:{' '}
      <a className="link" href={`mailto:${SUPORTE}?subject=${encodeURIComponent(assunto)}`}>
        {SUPORTE}
      </a>
    </p>
  )
}
