import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import { enderecoApp, supabase } from './cliente'

export type Papel = 'admin' | 'profissional' | 'aluno'
export type Situacao = 'pendente' | 'liberado' | 'bloqueado'

export type Perfil = {
  id: string
  email: string
  nome: string
  papel: Papel
  situacao: Situacao
  registro: string
  profissional_id: string | null
  criado_em: string
}

export type Conta = {
  sessao: Session | null
  perfil: Perfil | null
  /** Ainda lendo a sessão guardada no aparelho. */
  carregando: boolean
  recarregar: () => Promise<void>
}

export const ContextoConta = createContext<Conta>({ sessao: null, perfil: null, carregando: true, recarregar: async () => {} })

export const useConta = () => useContext(ContextoConta)

const CACHE = 'formacerta:perfil'

/** Perfil guardado no aparelho, para o app abrir mesmo sem internet. */
export function perfilGuardado(id: string): Perfil | null {
  try {
    const p = JSON.parse(localStorage.getItem(CACHE) ?? 'null') as Perfil | null
    return p?.id === id ? p : null
  } catch {
    return null
  }
}

export async function buscarPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfis').select('*').eq('id', id).maybeSingle()
  if (error) return perfilGuardado(id)
  try {
    localStorage.setItem(CACHE, JSON.stringify(data))
  } catch {
    /* ignora */
  }
  return data as Perfil | null
}

/** Mensagens do Supabase traduzidas para o usuário. */
export function erroAmigavel(e: { message?: string } | null | undefined): string {
  const m = e?.message ?? ''
  if (/invalid login credentials/i.test(m)) return 'E-mail ou senha errados.'
  if (/email not confirmed/i.test(m)) return 'Confirme o seu e-mail primeiro: abra o link que chegou na sua caixa de entrada.'
  if (/already registered|already been registered|already exists/i.test(m)) return 'Este e-mail já tem cadastro. Use "Entrar" ou "Esqueci a senha".'
  if (/password should be at least|weak password/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  if (/failed to fetch|network/i.test(m)) return 'Sem internet. Confira a conexão e tente de novo.'
  return m || 'Não deu certo. Tente de novo.'
}

export async function entrar(email: string, senha: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
  return error ? erroAmigavel(error) : null
}

export async function cadastrar(dados: { email: string; senha: string; nome: string; papel: 'profissional' | 'aluno'; registro: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: dados.email.trim(),
    password: dados.senha,
    options: {
      emailRedirectTo: enderecoApp(),
      data: { nome: dados.nome.trim(), papel: dados.papel, registro: dados.registro.trim() },
    },
  })
  if (error) return { erro: erroAmigavel(error), confirmar: false }
  // Sem sessão: o Supabase mandou o e-mail de confirmação.
  return { erro: null, confirmar: !data.session }
}

export async function esqueciSenha(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: enderecoApp() })
  return error ? erroAmigavel(error) : null
}

export async function novaSenha(senha: string) {
  const { error } = await supabase.auth.updateUser({ password: senha })
  return error ? erroAmigavel(error) : null
}

export async function sair() {
  try {
    localStorage.removeItem(CACHE)
  } catch {
    /* ignora */
  }
  await supabase.auth.signOut()
}

export const senhaFraca = (s: string) => s.length < 8 || !/[a-zA-Z]/.test(s) || !/\d/.test(s)

export const ROTULO_PAPEL: Record<Papel, string> = { admin: 'Administrador', profissional: 'Profissional', aluno: 'Aluno' }
export const ROTULO_SITUACAO: Record<Situacao, string> = { pendente: 'Aguardando liberação', liberado: 'Liberado', bloqueado: 'Bloqueado' }
