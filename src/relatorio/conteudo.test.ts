import type { Assessment, Finding } from '../pose/types'
import { textoPdf } from './pdf'
import { novaAvaliacao, type AvaliacaoIdoso } from '../idoso/tipos'
import { describe, expect, it } from 'vitest'
import type { RegistroAdams } from '../testes/adams'
import type { RegistroFlex } from '../testes/flexibilidade'
import { nomeArquivo, secao } from './conteudo'

const flex = (id: string, date: string, nivel: RegistroFlex['nivel']): RegistroFlex => ({
  id,
  date,
  avaliado: 'Maria Souza',
  observacoes: '',
  nivel,
  nivelApp: nivel,
  alcance: 30,
  joelho: 5,
  joelhosOk: true,
})

describe('conteúdo do relatório', () => {
  it('flexibilidade traz o nível, os joelhos e os testes anteriores do mesmo avaliado', () => {
    const antigo = flex('a', '2026-09-01T10:00:00Z', 'Limitada')
    const novo = { ...flex('b', '2026-10-20T10:00:00Z', 'Moderada'), nivelApp: 'Limitada' as const, observacoes: 'Melhorou.' }
    const s = secao({ tipo: 'flexibilidade', registro: novo }, [
      { tipo: 'flexibilidade', registro: antigo },
      { tipo: 'flexibilidade', registro: novo },
    ])
    expect(s.linhas[0]).toMatchObject({ rotulo: 'Nível', valor: 'Moderada', status: 'atencao' })
    expect(s.linhas.find((l) => l.rotulo === 'Ajuste')?.valor).toContain('Limitada')
    expect(s.linhas.find((l) => l.rotulo === 'Testes anteriores')?.valor).toBe('01/09/2026: Limitada')
    expect(s.observacoes).toBe('Melhorou.')
  })

  it('Adams usa o escoliômetro quando existe e mostra a medida da foto', () => {
    const r: RegistroAdams = { id: 'x', date: '2026-10-20T10:00:00Z', avaliado: 'João', observacoes: '', vista: 'costas', atr: 4.2, lado: 'direito', escoliometro: 7 }
    const s = secao({ tipo: 'adams', registro: r })
    expect(s.linhas[0]).toMatchObject({ valor: '7,0° · Assimetria importante', status: 'alerta' })
    expect(s.linhas.map((l) => l.rotulo)).toContain('Medida da foto')
    expect(s.linhas.find((l) => l.rotulo.startsWith('Lado'))?.valor).toBe('direito')
  })

  it('postura traz as correções ponto por ponto, com a foto e os músculos', () => {
    const ombro: Finding = { id: 'ombros', title: 'Ombros', value: '4,0°', status: 'alerta', detail: 'Ombros: lado direito mais alto.', exercises: [], correcao: 'ombroElevado', lado: 'direito' }
    const a: Assessment = { id: 'p', date: '2026-10-20T10:00:00Z', score: 70, views: [{ view: 'frente', image: '', width: 1, height: 1, landmarks: [], findings: [ombro] }] }
    const s = secao({ tipo: 'postura', registro: a })
    expect(s.linhas.find((l) => l.rotulo === 'Pontos para melhorar')).toMatchObject({ valor: '1', status: 'alerta' })
    const porPonto = s.listas.find((l) => l.titulo.startsWith('Correções'))!
    expect(porPonto.itens[0]).toContain('Ombro elevado (Frente, 4,0°, Corrigir)')
    expect(porPonto.itens[0]).toContain('Alongar: Trapézio superior')
  })

  it('avaliação do idoso entra com as medidas e a evolução', () => {
    const base = novaAvaliacao()
    const primeira: AvaliacaoIdoso = { ...base, id: 'a', date: '2026-09-01T10:00:00Z', avaliado: 'Raquel', anamnese: { ...base.anamnese, idade: 68, sexo: 'feminino' }, antropometria: { ...base.antropometria, peso: 66, estatura: 160 } }
    const segunda: AvaliacaoIdoso = {
      ...primeira,
      id: 'b',
      date: '2026-10-20T10:00:00Z',
      antropometria: { ...primeira.antropometria, peso: 64 },
      testes: { alcancarCostas: { valor: -5, observacao: 'Ombro direito travado', foto: { image: 'data:image/jpeg;base64,', width: 3, height: 4 } } },
    }
    const s = secao({ tipo: 'idoso', registro: segunda }, [{ tipo: 'idoso', registro: primeira }, { tipo: 'idoso', registro: segunda }])
    expect(s.titulo).toBe('Avaliação funcional do idoso')
    expect(s.linhas[0]).toMatchObject({ rotulo: 'Avaliado', valor: '68 anos · feminino · 160 cm · 64,0 kg' })
    expect(s.linhas.find((l) => l.rotulo === 'IMC')?.valor).toBe('25,0 · Peso adequado')
    const lista = (titulo: string) => s.listas.find((l) => l.titulo === titulo)?.itens ?? []
    expect(lista('Evolução desde 01/09/2026')).toContain('Peso: 66,0 → 64,0 (-2,0)')
    // Todos os testes aparecem, os feitos com observação e foto, os outros como não realizados.
    const testes = lista('Testes funcionais')
    expect(testes).toHaveLength(7)
    expect(testes.find((t) => t.startsWith('Alcançar atrás das costas'))).toBe(
      'Alcançar atrás das costas: -5 cm · Dentro do esperado (esperado: -9 a 4 cm). Observação: Ombro direito travado. Foto abaixo.',
    )
    expect(testes).toContain('Caminhada de 6 minutos: não realizado.')
  })

  it('nome do arquivo sem acentos nem espaços', () => {
    expect(nomeArquivo('José da Conceição', new Date(2026, 9, 24))).toBe('Relatorio-Jose-da-Conceicao-2026-10-24.pdf')
    expect(nomeArquivo('', new Date(2026, 0, 5))).toBe('Relatorio-2026-01-05.pdf')
  })
})

describe('texto do PDF', () => {
  it('troca a seta e tira emoji', () => {
    expect(textoPdf('Peso: 64,0 → 62,0 📈 ação “ok” — 7°')).toBe('Peso: 64,0 -> 62,0  ação “ok” — 7°')
  })
})
