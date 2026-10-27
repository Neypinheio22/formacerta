import { useState } from 'react'
import { EXERCICIOS, GRUPOS, exercicioPorId, type Grupo } from '../../movimento/exercicios'
import type { ExercicioId } from '../../movimento/tipos'

export type ConfigExercicio = { exercicio: ExercicioId; alvo: number }

type Props = {
  onVoltar: () => void
  onAoVivo: (c: ConfigExercicio) => void
  onArquivo: (c: ConfigExercicio, arquivo: File) => void
}

const ALVOS = [5, 8, 10, 12]

export function ExercicioInicio({ onVoltar, onAoVivo, onArquivo }: Props) {
  const [exercicio, setExercicio] = useState<ExercicioId>('agachamento-lateral')
  const [grupo, setGrupo] = useState<Grupo>(exercicioPorId(exercicio).grupo)
  const [alvo, setAlvo] = useState(8)

  function escolherGrupo(g: Grupo) {
    setGrupo(g)
    setExercicio(EXERCICIOS.find((ex) => ex.grupo === g)!.id)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onArquivo({ exercicio, alvo }, file)
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Início
        </button>
      </header>

      <h1>Exercício por vídeo</h1>
      <p className="dica">
        O app acompanha o movimento quadro a quadro, conta as repetições e mostra o que corrigir em cada uma: descida, fundo e subida.
      </p>

      <h2 className="secao">Qual exercício?</h2>
      <div className="timer esquerda">
        {GRUPOS.map((g) => (
          <button key={g} className={g === grupo ? 'ativo' : ''} onClick={() => escolherGrupo(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="opcoes">
        {EXERCICIOS.filter((ex) => ex.grupo === grupo).map((ex) => (
          <button key={ex.id} className={`opcao ${ex.id === exercicio ? 'ativo' : ''}`} onClick={() => setExercicio(ex.id)}>
            <strong>
              {ex.nome} <span className="verde">· {ex.vista}</span>
            </strong>
            <span>{ex.dica}</span>
          </button>
        ))}
      </div>

      <div className="timer esquerda">
        Repetições:
        {ALVOS.map((n) => (
          <button key={n} className={n === alvo ? 'ativo' : ''} onClick={() => setAlvo(n)}>
            {n}
          </button>
        ))}
      </div>

      <button className="botao grande" onClick={() => onAoVivo({ exercicio, alvo })}>
        Gravar agora
      </button>
      <label className="botao-sec">
        Enviar vídeo da galeria
        <input type="file" accept="video/*" onChange={onFile} hidden />
      </label>
      <p className="dica-sec">O vídeo é analisado no seu celular e não é enviado para nenhum servidor.</p>
    </div>
  )
}
