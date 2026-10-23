import { describe, expect, it } from 'vitest'
import { LM, type Finding, type Point } from '../pose/types'
import { planoCorretivo, recomendacao } from '../pose/recomendacoes'
import { analyzeFrontBack } from '../pose/analysis'
import { analisarAdams, anguloAdams, classificarAdams } from './adams'
import { ajustarMarca, classificarWells, medirFotoWells } from './wells'

describe('recomendações por alteração', () => {
  const pontos = (over: Record<number, [number, number]> = {}): Point[] => {
    const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.99 }))
    const base: Record<number, [number, number]> = {
      [LM.nariz]: [0.5, 0.12],
      [LM.orelhaEsq]: [0.54, 0.11],
      [LM.orelhaDir]: [0.46, 0.11],
      [LM.ombroEsq]: [0.6, 0.25],
      [LM.ombroDir]: [0.4, 0.25],
      [LM.quadrilEsq]: [0.56, 0.52],
      [LM.quadrilDir]: [0.44, 0.52],
      [LM.joelhoEsq]: [0.56, 0.72],
      [LM.joelhoDir]: [0.44, 0.72],
      [LM.tornozeloEsq]: [0.56, 0.92],
      [LM.tornozeloDir]: [0.44, 0.92],
      ...over,
    }
    for (const [i, [x, y]] of Object.entries(base)) lm[Number(i)] = { x, y, visibility: 0.99 }
    return lm
  }

  it('ombro esquerdo alto: alongar trapézio superior esquerdo', () => {
    const fs = analyzeFrontBack('frente', pontos({ [LM.ombroEsq]: [0.6, 0.22] }), 1000, 1000)
    const rec = recomendacao(fs.find((f) => f.id === 'ombros-frente')!)!
    expect(rec.alteracao).toBe('Ombro elevado')
    expect(rec.alongar).toContain('Trapézio superior (lado esquerdo)')
    expect(rec.fortalecer).toContain('Trapézio inferior (lado esquerdo)')
    expect(rec.exercicios.some((e) => e.foco === 'alongar')).toBe(true)
  })

  it('quadril direito alto: abdutores do lado oposto', () => {
    const fs = analyzeFrontBack('frente', pontos({ [LM.quadrilDir]: [0.44, 0.49] }), 1000, 1000)
    const rec = recomendacao(fs.find((f) => f.id === 'quadril-frente')!)!
    expect(rec.alongar).toEqual(['Quadrado lombar (lado direito)', 'Tensor da fáscia lata e abdutores (lado esquerdo)'])
  })

  it('joelho valgo indica glúteo médio do mesmo lado', () => {
    const fs = analyzeFrontBack('frente', pontos({ [LM.joelhoDir]: [0.48, 0.72] }), 1000, 1000)
    const rec = recomendacao(fs.find((f) => f.id === 'joelho-direito-frente')!)!
    expect(rec.fortalecer).toContain('Glúteo médio (lado direito)')
  })

  it('postura boa não gera recomendação', () => {
    const fs = analyzeFrontBack('frente', pontos(), 1000, 1000)
    expect(fs.map(recomendacao).every((r) => r === null)).toBe(true)
    expect(planoCorretivo(fs).exercicios).toEqual([])
  })

  it('plano junta sem repetir e põe alongamentos primeiro', () => {
    const f = (correcao: Finding['correcao']): Finding => ({ id: String(correcao), title: '', value: '', status: 'alerta', detail: '', exercises: [], correcao })
    const plano = planoCorretivo([f('cabecaAnteriorizada'), f('troncoAFrente')])
    const nomes = plano.exercicios.map((e) => e.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
    const primeiroFortalecer = plano.exercicios.findIndex((e) => e.foco === 'fortalecer')
    expect(plano.exercicios.slice(primeiroFortalecer).every((e) => e.foco === 'fortalecer')).toBe(true)
  })
})

describe('Banco de Wells', () => {
  it('classifica pela tabela de sexo e idade', () => {
    expect(classificarWells(41, 'M', 25).classe).toBe('Excelente')
    expect(classificarWells(34, 'M', 25).classe).toBe('Acima da média')
    expect(classificarWells(30, 'M', 25).classe).toBe('Média')
    expect(classificarWells(25, 'M', 25).classe).toBe('Abaixo da média')
    expect(classificarWells(24, 'M', 25).classe).toBe('Fraco')
    expect(classificarWells(30, 'F', 45).classe).toBe('Média')
    expect(classificarWells(22, 'F', 65).classe).toBe('Fraco')
  })

  it('diz quanto falta para a próxima classe', () => {
    const r = classificarWells(31, 'F', 35)
    expect(r.classe).toBe('Abaixo da média')
    expect(r.proximaClasse).toBe('Média')
    expect(r.faltam).toBe(1)
    expect(classificarWells(50, 'F', 35).proximaClasse).toBeNull()
  })

  it('ajusta banco com outra marca dos pés', () => {
    expect(ajustarMarca(30, 23)).toBe(33)
    expect(ajustarMarca(30, 26)).toBe(30)
  })

  it('avisa quando o joelho dobra na foto', () => {
    const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }))
    // Sentado de lado: tronco inclinado sobre as pernas esticadas.
    lm[LM.ombroEsq] = { x: 0.55, y: 0.45, visibility: 1 }
    lm[LM.quadrilEsq] = { x: 0.3, y: 0.7, visibility: 1 }
    lm[LM.joelhoEsq] = { x: 0.55, y: 0.7, visibility: 1 }
    lm[LM.tornozeloEsq] = { x: 0.8, y: 0.7, visibility: 1 }
    const reto = medirFotoWells(lm, 1000, 1000)
    expect(reto.quadril).toBeCloseTo(45)
    expect(reto.joelhosOk).toBe(true)
    lm[LM.joelhoEsq] = { x: 0.55, y: 0.6, visibility: 1 }
    expect(medirFotoWells(lm, 1000, 1000).joelhosOk).toBe(false)
  })
})

describe('Teste de Adams', () => {
  // Costas vistas por trás, pessoa inclinada: a borda de cima do contorno é um arco.
  // "elevacao" levanta o lado esquerdo da foto (gibosidade).
  function costas(elevacao: number) {
    const W = 400, H = 300
    const dados = new Float32Array(W * H)
    for (let x = 100; x <= 300; x++) {
      const u = (x - 200) / 100
      let topo = 120 + 40 * u * u
      if (u < 0) topo -= elevacao * Math.sin(Math.PI * -u)
      for (let y = Math.round(topo); y < H; y++) dados[y * W + x] = 1
    }
    const lm: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }))
    lm[LM.ombroEsq] = { x: 0.27, y: 0.5 }
    lm[LM.ombroDir] = { x: 0.73, y: 0.5 }
    lm[LM.quadrilEsq] = { x: 0.4, y: 0.45 }
    lm[LM.quadrilDir] = { x: 0.6, y: 0.45 }
    return { mascara: { dados, largura: W, altura: H }, lm }
  }

  it('costas simétricas dão ângulo perto de zero', () => {
    const { mascara, lm } = costas(0)
    const r = analisarAdams(mascara, lm, 'costas')!
    expect(r.atr).toBeLessThan(2)
    expect(classificarAdams(r.atr).status).toBe('ok')
    expect(r.flexaoOk).toBe(true)
  })

  it('gibosidade à esquerda vista por trás', () => {
    const { mascara, lm } = costas(14)
    const r = analisarAdams(mascara, lm, 'costas')!
    expect(r.atr).toBeGreaterThan(7)
    expect(r.lado).toBe('esquerdo')
    expect(classificarAdams(r.atr).status).toBe('alerta')
  })

  it('vista pela frente inverte o lado', () => {
    const { mascara, lm } = costas(14)
    expect(analisarAdams(mascara, lm, 'frente')!.lado).toBe('direito')
  })

  it('sem os pontos do corpo mede só pelo contorno', () => {
    const { mascara } = costas(14)
    const r = analisarAdams(mascara, null, 'costas')!
    expect(r.atr).toBeGreaterThan(7)
    expect(r.lado).toBe('esquerdo')
    expect(r.flexaoOk).toBeNull()
    expect(analisarAdams(costas(0).mascara, null, 'costas')!.atr).toBeLessThan(2)
  })

  it('classifica pelos cortes do escoliômetro', () => {
    expect(classificarAdams(4.9).status).toBe('ok')
    expect(classificarAdams(5).status).toBe('atencao')
    expect(classificarAdams(7).status).toBe('alerta')
  })

  it('escoliômetro tem prioridade sobre a foto', () => {
    expect(anguloAdams({ atr: 3, escoliometro: 8 })).toBe(8)
    expect(anguloAdams({ atr: 3, escoliometro: null })).toBe(3)
  })
})
