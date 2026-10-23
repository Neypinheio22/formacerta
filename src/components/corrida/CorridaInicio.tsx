import { useState } from 'react'
import type { ConfigCorrida, LocalCorrida, VistaCorrida } from '../../corrida/tipos'

type Props = {
  vistaInicial?: VistaCorrida
  onVoltar: () => void
  onArquivo: (c: ConfigCorrida, arquivo: File) => void
}

const VISTAS: { id: VistaCorrida; nome: string; mede: string }[] = [
  { id: 'lado', nome: 'De lado', mede: 'Cadência, pisada, pé à frente do corpo, joelho no contato, tronco e sobe e desce.' },
  { id: 'tras', nome: 'De trás', mede: 'Joelho para dentro, queda da pelve e pés cruzando a linha do meio.' },
]

const LOCAIS: { id: LocalCorrida; nome: string }[] = [
  { id: 'esteira', nome: 'Esteira' },
  { id: 'rua', nome: 'Rua / pista' },
]

const FATORES = [
  { fator: 1, nome: 'Normal' },
  { fator: 4, nome: 'Lenta 4x (120 qps)' },
  { fator: 8, nome: 'Lenta 8x (240 qps)' },
]

const DICAS: Record<LocalCorrida, Record<VistaCorrida, string[]>> = {
  esteira: {
    lado: ['Celular parado (apoiado ou tripé) ao lado da esteira, na altura do quadril, a uns 2 a 3 metros.', 'Corpo inteiro no quadro, dos pés à cabeça, com a esteira já no ritmo do treino.'],
    tras: ['Celular parado atrás da esteira, na altura do quadril, a uns 2 metros.', 'Os dois pés e o quadril bem visíveis. Roupa justa ajuda a ver joelhos e quadril.'],
  },
  rua: {
    lado: [
      'Melhor: alguém acompanha correndo ou de bicicleta ao lado, mantendo o celular na altura do quadril e sempre à mesma distância.',
      'Ou celular parado num tripé e a pessoa passa várias vezes de um lado para o outro, a uns 3 metros.',
    ],
    tras: ['Alguém acompanha logo atrás, a uns 2 metros, com o celular na altura do quadril.', 'Em linha reta e piso plano. Se não der, a esteira dá um resultado mais confiável.'],
  },
}

const lerAltura = () => {
  try {
    return Number(localStorage.getItem('formacerta.altura')) || 170
  } catch {
    return 170
  }
}

export function CorridaInicio({ vistaInicial = 'lado', onVoltar, onArquivo }: Props) {
  const [vista, setVista] = useState<VistaCorrida>(vistaInicial)
  const [local, setLocal] = useState<LocalCorrida>('esteira')
  const [fator, setFator] = useState(1)
  const [altura, setAltura] = useState(lerAltura)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      localStorage.setItem('formacerta.altura', String(altura))
    } catch {
      // Sem armazenamento: só não lembra a altura da próxima vez.
    }
    onArquivo({ vista, local, fator, altura: Math.min(220, Math.max(120, altura || 170)) }, file)
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>

      <h1>Avaliação da corrida</h1>
      <p className="dica">Grave de 10 a 20 segundos correndo no seu ritmo de treino. O app lê o vídeo quadro a quadro, encontra cada passo e mede a técnica.</p>

      <h2 className="secao">Onde você corre?</h2>
      <div className="timer esquerda">
        {LOCAIS.map((l) => (
          <button key={l.id} className={l.id === local ? 'ativo' : ''} onClick={() => setLocal(l.id)}>
            {l.nome}
          </button>
        ))}
      </div>

      <h2 className="secao">De onde vai filmar?</h2>
      <div className="opcoes">
        {VISTAS.map((v) => (
          <button key={v.id} className={`opcao ${v.id === vista ? 'ativo' : ''}`} onClick={() => setVista(v.id)}>
            <strong>{v.nome}</strong>
            <span>{v.mede}</span>
          </button>
        ))}
      </div>

      <section className="cartao">
        <h3>Como gravar</h3>
        <ul className="exercicios">
          {DICAS[local][vista].map((d) => (
            <li key={d}>{d}</li>
          ))}
          <li>Para a avaliação completa, grave um vídeo de lado e outro de trás.</li>
        </ul>
      </section>

      <h2 className="secao">O vídeo é em câmera lenta?</h2>
      <div className="timer esquerda">
        {FATORES.map((f) => (
          <button key={f.fator} className={f.fator === fator ? 'ativo' : ''} onClick={() => setFator(f.fator)}>
            {f.nome}
          </button>
        ))}
      </div>
      <p className="dica-sec">Câmera lenta deixa a pisada mais precisa. Escolha a velocidade com que gravou, para o app calcular a cadência certa.</p>

      <label className="campo">
        Sua altura (cm)
        <input type="number" inputMode="numeric" min={120} max={220} value={altura || ''} onChange={(e) => setAltura(Number(e.target.value))} />
      </label>
      <p className="dica-sec">Usada para converter a imagem em centímetros.</p>

      <label className="botao grande">
        Gravar agora
        <input type="file" accept="video/*" capture="environment" onChange={onFile} hidden />
      </label>
      <label className="botao-sec">
        Enviar vídeo da galeria
        <input type="file" accept="video/*" onChange={onFile} hidden />
      </label>
      <p className="dica-sec">O vídeo é analisado no seu celular e não é enviado para nenhum servidor.</p>
    </div>
  )
}
