// Avaliação funcional do idoso: anamnese, antropometria, bateria de testes
// (Senior Fitness Test, de Rikli e Jones) e Escala de Equilíbrio de Berg.

import type { Registro } from '../testes/historico'

export type Sexo = 'feminino' | 'masculino'

export const DISPOSITIVOS = ['Nenhum', 'Bengala', 'Muleta', 'Andador', 'Cadeira de rodas', 'Outro'] as const
export type Dispositivo = (typeof DISPOSITIVOS)[number]

export type Anamnese = {
  idade: number | null
  sexo: Sexo | null
  objetivo: string
  atividade: string
  medicamentos: string
  doencas: string
  /** Quedas nos últimos 12 meses. */
  quedas: number | null
  quedasDetalhe: string
  dores: string
  /** Intensidade da dor, de 0 a 10. */
  dorNota: number | null
  cirurgias: string
  dispositivo: Dispositivo
  observacoes: string
}

// Perimetria na ordem da ficha do personal Romildo. As três "antigas" (um lado só)
// vêm das primeiras avaliações e só aparecem quando foram medidas.
export const CIRCUNFERENCIAS = [
  { id: 'pescoco', nome: 'Pescoço' },
  { id: 'torax', nome: 'Tórax' },
  { id: 'bracoD', nome: 'Braço direito' },
  { id: 'bracoE', nome: 'Braço esquerdo' },
  { id: 'antebracoD', nome: 'Antebraço direito' },
  { id: 'antebracoE', nome: 'Antebraço esquerdo' },
  { id: 'abdomen', nome: 'Abdômen' },
  { id: 'cintura', nome: 'Cintura' },
  { id: 'quadril', nome: 'Quadril' },
  { id: 'coxaE', nome: 'Coxa esquerda' },
  { id: 'coxaD', nome: 'Coxa direita' },
  { id: 'panturrilhaE', nome: 'Panturrilha esquerda' },
  { id: 'panturrilhaD', nome: 'Panturrilha direita' },
  { id: 'braco', nome: 'Braço', antiga: true },
  { id: 'coxa', nome: 'Coxa', antiga: true },
  { id: 'panturrilha', nome: 'Panturrilha', antiga: true },
] as const
export type Circunferencia = (typeof CIRCUNFERENCIAS)[number]['id']

export type Antropometria = {
  /** kg */
  peso: number | null
  /** cm */
  estatura: number | null
  /** cm */
  circ: Partial<Record<Circunferencia, number>>
}

export type IdTeste = 'levantar' | 'flexaoBraco' | 'marcha' | 'caminhada' | 'tug' | 'sentarAlcancar' | 'alcancarCostas'

/** foto: o paciente executando o teste (JPEG reduzido, fica só no aparelho). */
export type ResultadoTeste = { valor: number; observacao: string; foto?: FotoTeste }

export type FotoTeste = { image: string; width: number; height: number }

export type AvaliacaoIdoso = Registro & {
  anamnese: Anamnese
  antropometria: Antropometria
  testes: Partial<Record<IdTeste, ResultadoTeste>>
  /** Nota de 0 a 4 de cada um dos 14 itens; null = não feito. */
  berg: (number | null)[]
  bergObservacao: string
}

export const CHAVE_IDOSO = 'formacerta:idoso'
export const CHAVE_RASCUNHO_IDOSO = 'formacerta:idoso-rascunho'

export const anamneseVazia = (): Anamnese => ({
  idade: null,
  sexo: null,
  objetivo: '',
  atividade: '',
  medicamentos: '',
  doencas: '',
  quedas: null,
  quedasDetalhe: '',
  dores: '',
  dorNota: null,
  cirurgias: '',
  dispositivo: 'Nenhum',
  observacoes: '',
})

export const novaAvaliacao = (anterior?: AvaliacaoIdoso): AvaliacaoIdoso => ({
  id: crypto.randomUUID(),
  date: new Date().toISOString(),
  avaliado: anterior?.avaliado ?? '',
  observacoes: '',
  // Na reavaliação a anamnese vem preenchida da última vez, para só atualizar.
  anamnese: anterior ? { ...anterior.anamnese } : anamneseVazia(),
  antropometria: { peso: null, estatura: anterior?.antropometria.estatura ?? null, circ: {} },
  testes: {},
  berg: Array(14).fill(null),
  bergObservacao: '',
})
