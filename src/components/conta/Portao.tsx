import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../nuvem/cliente'
import { ContextoConta, buscarPerfil, type Perfil } from '../../nuvem/conta'
import { Aguardando } from './Aguardando'
import { Entrar } from './Entrar'
import { NovaSenha } from './NovaSenha'

/** Só deixa usar o app quem entrou e foi liberado pelo administrador. */
export function Portao({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const lerPerfil = useCallback(async (s: Session | null) => {
    setPerfil(s ? await buscarPerfil(s.user.id) : null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      lerPerfil(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setTrocandoSenha(true)
      setSessao(s)
      // Fora do callback: chamar o Supabase aqui dentro trava a sessão.
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') setTimeout(() => lerPerfil(s), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [lerPerfil])

  const recarregar = useCallback(() => lerPerfil(sessao), [lerPerfil, sessao])

  let tela: React.ReactNode
  if (carregando) tela = <p className="carregando">Carregando…</p>
  else if (trocandoSenha && sessao) tela = <NovaSenha onPronto={() => setTrocandoSenha(false)} />
  else if (!sessao || !perfil) tela = <Entrar />
  else if (perfil.situacao !== 'liberado') tela = <Aguardando />
  else tela = children

  return <ContextoConta.Provider value={{ sessao, perfil, carregando, recarregar }}>{tela}</ContextoConta.Provider>
}
