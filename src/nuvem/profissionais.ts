import { supabase } from './cliente'
import { erroAmigavel } from './conta'

/** Dados públicos do profissional na lista "Encontrar personal". */
export type ProfissionalHabilitado = {
  id: string
  nome: string
  registro: string
  cidade: string
  /** Especialidades separadas por vírgula. */
  especialidade: string
  /** Biografia curta: formação, experiência e como trabalha. */
  bio: string
  whatsapp: string
  liberado_desde: string
}

/** Consulta oficial de registrados no Conselho Federal de Educação Física. */
export const CONSULTA_CONFEF = 'https://www.confef.org.br/confef/registrados/'

export async function listarProfissionais(): Promise<{ lista: ProfissionalHabilitado[]; erro: string | null }> {
  const { data, error } = await supabase.rpc('profissionais_habilitados')
  return { lista: (data ?? []) as ProfissionalHabilitado[], erro: error ? erroAmigavel(error) : null }
}

export type DadosContato = { whatsapp: string; cidade: string; especialidade: string; bio: string; aparecer_na_lista: boolean }

export const BIO_MAXIMO = 600

/** "Idosos, hipertrofia; corrida" vira ["Idosos", "hipertrofia", "corrida"]. */
export const listaEspecialidades = (texto: string) =>
  texto
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8)

export async function salvarContato(id: string, d: DadosContato) {
  const { error } = await supabase
    .from('perfis')
    .update({ whatsapp: d.whatsapp.trim().slice(0, 20), cidade: d.cidade.trim().slice(0, 60), especialidade: d.especialidade.trim().slice(0, 200), bio: d.bio.trim().slice(0, BIO_MAXIMO), aparecer_na_lista: d.aparecer_na_lista })
    .eq('id', id)
  return error ? erroAmigavel(error) : null
}

/** Busca por nome, cidade ou especialidade, sem ligar para acento nem maiúscula. */
export function filtrarProfissionais(lista: ProfissionalHabilitado[], busca: string): ProfissionalHabilitado[] {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  const termos = norm(busca).split(/\s+/).filter(Boolean)
  if (!termos.length) return lista
  return lista.filter((p) => {
    const texto = norm(`${p.nome} ${p.cidade} ${p.especialidade} ${p.bio} ${p.registro}`)
    return termos.every((t) => texto.includes(t))
  })
}
