import { createClient } from '@supabase/supabase-js'

// Banco do FormaCerta no Supabase (região São Paulo). A chave publicável pode
// ficar no app: quem protege os dados são as regras de acesso do banco.
const URL = 'https://zyxftkspkerttjqvepbg.supabase.co'
const CHAVE_PUBLICA = 'sb_publishable_kDJRcwq50Qdmi4V45xXbzw_qGInBs1S'

export const supabase = createClient(URL, CHAVE_PUBLICA, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Endereço do app, para onde voltam os links de confirmação e de troca de senha. */
export const enderecoApp = () => window.location.origin + window.location.pathname
