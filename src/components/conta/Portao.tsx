import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../nuvem/cliente'
import { ContextoConta, buscarPerfil, sair, type Perfil } from '../../nuvem/conta'
import { precisaAceitar } from '../../nuvem/privacidade'
import { AceitarTermos } from './AceitarTermos'
import { Aguardando } from './Aguardando'
import { Entrar } from './Entrar'
import { NovaSenha } from './NovaSenha'
import { Suporte } from './Suporte'

/** Só deixa usar o app quem entrou e foi liberado pelo administrador. */
export function Portao({ children }: { children: React.ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  const leitura = useRef(0)

  const lerPerfil = useCallback(async (s: Session | null) => {
    const tentativa = ++leitura.current
    let encontrado: Perfil | null = null
    try {
      if (s) encontrado = await buscarPerfil(s.user.id)
    } catch {
      // A sessão continua válida. A tela abaixo permite tentar carregar o perfil de novo.
    }
    if (tentativa !== leitura.current) return
    setPerfil(encontrado)
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
      if (evento === 'SIGNED_OUT') {
        ++leitura.current
        setPerfil(null)
        setCarregando(false)
      } else if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') {
        setTimeout(() => lerPerfil(s), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [lerPerfil])

  const recarregar = useCallback(() => lerPerfil(sessao), [lerPerfil, sessao])

  let tela: React.ReactNode
  if (carregando) tela = <p className="carregando">Carregando…</p>
  else if (trocandoSenha && sessao) tela = <NovaSenha onPronto={() => setTrocandoSenha(false)} />
  else if (!sessao) tela = <Entrar />
  else if (!perfil || perfil.id !== sessao.user.id) tela = (
    <div className="tela">
      <section className="cartao destaque formulario">
        <h1>Não deu para carregar seu perfil</h1>
        <p className="dica">Você entrou no FormaCerta. Confira a conexão e tente carregar seu perfil de novo.</p>
        <button className="botao" onClick={() => { setCarregando(true); void recarregar() }}>Tentar novamente</button>
        <button className="botao-sec" onClick={() => void sair()}>Sair</button>
        <Suporte assunto="Perfil não carregou no FormaCerta" />
      </section>
    </div>
  )
  else if (perfil.situacao !== 'liberado') tela = <Aguardando />
  else if (precisaAceitar(perfil)) tela = <AceitarTermos />
  else tela = children

  return <ContextoConta.Provider value={{ sessao, perfil, carregando, recarregar }}>{tela}</ContextoConta.Provider>
}
