type Props = {
  termos: boolean
  saude: boolean
  onTermos: (v: boolean) => void
  onSaude: (v: boolean) => void
  onVerTermos: () => void
  onVerPrivacidade: () => void
}

/** Os dois aceites da LGPD: termos e política, e o consentimento destacado para os dados de saúde (art. 11). */
export function AceiteLgpd({ termos, saude, onTermos, onSaude, onVerTermos, onVerPrivacidade }: Props) {
  return (
    <>
      <label className="aceite">
        <input type="checkbox" checked={termos} onChange={(e) => onTermos(e.target.checked)} />
        <span>
          Li e aceito os{' '}
          <button type="button" className="link" onClick={onVerTermos}>
            Termos de uso
          </button>{' '}
          e a{' '}
          <button type="button" className="link" onClick={onVerPrivacidade}>
            Política de privacidade
          </button>
          .
        </span>
      </label>
      <label className="aceite aceite-saude">
        <input type="checkbox" checked={saude} onChange={(e) => onSaude(e.target.checked)} />
        <span>
          <strong>Autorizo o uso dos meus dados de saúde</strong> (resultados dos testes, medidas, informações de saúde da ficha e fotos que eu escolher
          enviar) para avaliação e acompanhamento do meu treino. Posso retirar essa autorização e apagar tudo quando quiser em "Minha conta". Se tenho menos
          de 18 anos, meu responsável também autorizou.
        </span>
      </label>
    </>
  )
}
