import { describe, expect, it } from 'vitest'
import { etapasDoAluno, mensagemParaAluno, situacaoDoAluno, ultimaAtividade, type AlunoNovo } from './alunosNovos'

const agora = new Date('2026-11-16T12:00:00Z')
const base: AlunoNovo = {
  id: '1',
  nome: 'Maria Souza',
  email: 'maria@exemplo.com',
  whatsapp: '',
  situacao: 'liberado',
  criado_em: '2026-11-14T12:00:00Z',
  ultimo_acesso: '2026-11-15T12:00:00Z',
  email_confirmado: true,
  personal: null,
  termos: true,
  dados: false,
  avaliacoes: 0,
  ultima_avaliacao: null,
  treinos: 0,
  treinos_feitos: 0,
  ultimo_treino: null,
  mensagens: 0,
  comprou: false,
  notificacoes: false,
}

describe('alunos novos', () => {
  it('quem não confirmou o e-mail vem primeiro como alerta', () => {
    const a = { ...base, email_confirmado: false, ultimo_acesso: null }
    expect(situacaoDoAluno(a, agora)).toEqual({ rotulo: 'Sem confirmar e-mail', tom: 'alerta' })
    expect(mensagemParaAluno(a)).toContain('confirmar o seu e-mail')
  })

  it('confirmou mas nunca entrou', () => {
    expect(situacaoDoAluno({ ...base, ultimo_acesso: null }, agora).rotulo).toBe('Nunca entrou')
  })

  it('parado há 7 dias ou mais', () => {
    expect(situacaoDoAluno({ ...base, ultimo_acesso: '2026-11-07T12:00:00Z' }, agora).rotulo).toBe('Parado há 9 dias')
  })

  it('treino feito conta como atividade recente', () => {
    const a = { ...base, ultimo_acesso: '2026-11-01T12:00:00Z', avaliacoes: 1, ultimo_treino: '2026-11-15T10:00:00Z' }
    expect(ultimaAtividade(a)).toBe('2026-11-15T10:00:00Z')
    expect(situacaoDoAluno(a, agora).rotulo).toBe('Ativo')
  })

  it('falta a primeira avaliação', () => {
    expect(situacaoDoAluno(base, agora).rotulo).toBe('Falta a 1ª avaliação')
    expect(mensagemParaAluno(base)).toContain('primeira avaliação')
  })

  it('etapas na ordem do primeiro uso', () => {
    const e = etapasDoAluno({ ...base, avaliacoes: 2 })
    expect(e.map((x) => x.feita)).toEqual([true, true, false, true, false, false])
  })
})
