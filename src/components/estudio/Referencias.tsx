import { useEffect, useState } from 'react'
import { apagarReferencia, listarReferencias } from '../../estudio/biblioteca'
import { nomeAngulo, type Referencia } from '../../estudio/tipos'
import { PlayerSincronizado } from './PlayerSincronizado'

type Props = { abrir?: string; onVoltar: () => void; onGravar: () => void }

/** Biblioteca de exercícios gravados pelo personal neste aparelho. */
export function Referencias({ abrir, onVoltar, onGravar }: Props) {
  const [lista, setLista] = useState<Referencia[] | null>(null)
  const [aberta, setAberta] = useState<string | undefined>(abrir)

  useEffect(() => {
    listarReferencias().then(setLista, () => setLista([]))
  }, [])

  const ref = lista?.find((r) => r.id === aberta)

  if (ref) {
    return (
      <div className="tela">
        <header className="topo">
          <button className="voltar" onClick={() => setAberta(undefined)}>
            ← Exercícios
          </button>
          <span className="passo">{new Date(ref.data).toLocaleDateString('pt-BR')}</span>
        </header>
        <h1>{ref.nome}</h1>
        {ref.personal && <p className="dica-sec">Executado por {ref.personal}</p>}
        <PlayerSincronizado videos={ref.videos} />
        <div className="acoes">
          {ref.videos.map((v) => (
            <button key={v.angulo} className="botao-sec" onClick={() => baixar(ref, v.angulo, v.video)}>
              Baixar {nomeAngulo(v.angulo).toLowerCase()}
            </button>
          ))}
        </div>
        <button
          className="voltar perigo"
          onClick={async () => {
            if (!confirm(`Apagar "${ref.nome}"?`)) return
            await apagarReferencia(ref.id)
            setLista(lista!.filter((r) => r.id !== ref.id))
            setAberta(undefined)
          }}
        >
          Apagar este exercício
        </button>
      </div>
    )
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← Voltar
        </button>
        <span className="passo">Referências</span>
      </header>
      <h1>Exercícios de referência</h1>
      <p className="dica-sec">Ficam guardados neste celular por enquanto.</p>

      {lista === null && <p className="carregando">Carregando…</p>}
      {lista?.length === 0 && <p className="dica">Nenhum exercício gravado ainda.</p>}
      {lista && lista.length > 0 && (
        <ul className="historico">
          {lista.map((r) => (
            <li key={r.id}>
              <button onClick={() => setAberta(r.id)}>
                <span>{r.nome}</span>
                <span className="nota">{r.videos.map((v) => nomeAngulo(v.angulo)).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="botao grande" onClick={onGravar}>
        Gravar novo exercício
      </button>
    </div>
  )
}

function baixar(r: Referencia, angulo: string, video: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(video)
  const base = r.nome.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()
  a.download = `${base}-${angulo}.${video.type.includes('mp4') ? 'mp4' : 'webm'}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
