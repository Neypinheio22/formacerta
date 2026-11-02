import { useEffect, useRef } from 'react'

/**
 * Atualização automática: chama `atualizar` quando a pessoa volta para o app
 * (troca de aba ou desbloqueia o celular) e de tempos em tempos enquanto a
 * tela está aberta. Assim o personal vê o treino que o aluno acabou de
 * concluir sem precisar recarregar.
 */
export function useAtualizacao(atualizar: () => void, segundos = 60) {
  const ref = useRef(atualizar)
  ref.current = atualizar

  useEffect(() => {
    const visivel = () => {
      if (document.visibilityState === 'visible') ref.current()
    }
    document.addEventListener('visibilitychange', visivel)
    window.addEventListener('focus', visivel)
    const timer = window.setInterval(visivel, segundos * 1000)
    return () => {
      document.removeEventListener('visibilitychange', visivel)
      window.removeEventListener('focus', visivel)
      window.clearInterval(timer)
    }
  }, [segundos])
}
