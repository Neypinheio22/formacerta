import { supabase } from './cliente'
import { erroAmigavel } from './conta'
import { salvarRotina, semTabela } from './rotinas'
import { limparExercicio } from './treinos'
import type { Ficha } from './fichas'
import type { DadosModelo, Modelo, Pasta } from '../treino/biblioteca'
import { somarSemanas } from '../treino/rotinas'

/** Pastas e modelos do profissional logado. semTabela: falta rodar o SQL da biblioteca. */
export async function carregarBiblioteca(): Promise<{ pastas: Pasta[]; modelos: Modelo[]; erro: string | null; semTabela: boolean }> {
  const [p, m] = await Promise.all([
    supabase.from('pastas_treino').select('id, nome, criado_em').order('nome'),
    supabase.from('modelos_treino').select('*').order('atualizado_em', { ascending: false }),
  ])
  const error = p.error ?? m.error
  return {
    pastas: (p.data ?? []) as Pasta[],
    modelos: (m.data ?? []) as Modelo[],
    erro: error ? erroAmigavel(error) : null,
    semTabela: !!error && semTabela(error.message),
  }
}

export async function salvarPasta(id: string | undefined, nome: string): Promise<{ id: string | null; erro: string | null }> {
  const linha = { nome: nome.trim().slice(0, 40) }
  const r = id ? await supabase.from('pastas_treino').update(linha).eq('id', id).select('id').single() : await supabase.from('pastas_treino').insert(linha).select('id').single()
  return r.error ? { id: null, erro: erroAmigavel(r.error) } : { id: (r.data as { id: string }).id, erro: null }
}

/** Apaga a pasta; os modelos dela vão para "Sem pasta" (o banco faz isso sozinho). */
export async function apagarPasta(id: string) {
  const { error } = await supabase.from('pastas_treino').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

function limparModelo(d: DadosModelo) {
  return {
    pasta_id: d.pasta_id,
    nome: d.nome.trim().slice(0, 60),
    objetivo: d.objetivo.slice(0, 40),
    nivel: d.nivel,
    icone: d.icone.slice(0, 20),
    semanas: d.semanas,
    treinos: d.treinos
      .map((t) => ({ letra: t.letra, nome: t.nome.trim().slice(0, 60), exercicios: t.exercicios.filter((e) => e.nome.trim()).map(limparExercicio) }))
      .filter((t) => t.exercicios.length),
    atualizado_em: new Date().toISOString(),
  }
}

export async function salvarModelo(id: string | undefined, d: DadosModelo): Promise<{ id: string | null; erro: string | null }> {
  const linha = limparModelo(d)
  const r = id ? await supabase.from('modelos_treino').update(linha).eq('id', id).select('id').single() : await supabase.from('modelos_treino').insert(linha).select('id').single()
  return r.error ? { id: null, erro: erroAmigavel(r.error) } : { id: (r.data as { id: string }).id, erro: null }
}

export async function moverModelo(id: string, pastaId: string | null) {
  const { error } = await supabase.from('modelos_treino').update({ pasta_id: pastaId, atualizado_em: new Date().toISOString() }).eq('id', id)
  return error ? erroAmigavel(error) : null
}

export async function apagarModelo(id: string) {
  const { error } = await supabase.from('modelos_treino').delete().eq('id', id)
  return error ? erroAmigavel(error) : null
}

/**
 * Cria uma rotina nova para cada aluno escolhido, a partir do modelo. As
 * rotinas que o aluno já tem continuam guardadas. Devolve quem deu certo e
 * quem deu erro, para a tela avisar.
 */
export async function enviarParaAlunos(m: Modelo, fichas: Ficha[], inicio: string): Promise<{ ok: string[]; falhas: { nome: string; erro: string }[] }> {
  const ok: string[] = []
  const falhas: { nome: string; erro: string }[] = []
  const dados = { nome: m.nome, inicio, fim: m.semanas ? somarSemanas(inicio, m.semanas) : null, objetivo: m.objetivo, nivel: m.nivel, icone: m.icone }
  for (const f of fichas) {
    const r = await salvarRotina(f.id, undefined, dados, m.treinos)
    if (r.erro) falhas.push({ nome: f.nome, erro: r.erro })
    else ok.push(f.nome)
  }
  return { ok, falhas }
}
