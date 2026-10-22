import { useEffect, useState } from 'react'
import { entrarSala, ErroConexao, type Canal } from '../../estudio/conexao'
import { ANGULOS, type Angulo } from '../../estudio/tipos'
import { PainelCamera } from './PainelCamera'

type Props = { codigoInicial?: string; onSair: () => void }

/** Tela do celular que fica no tripé: entra no estúdio com o código e escolhe o ângulo. */
export function EstudioCamera({ codigoInicial = '', onSair }: Props) {
  const [codigo, setCodigo] = useState(codigoInicial)
  const [angulo, setAngulo] = useState<Angulo>('frente')
  const [canal, setCanal] = useState<Canal | null>(null)
  const [conectando, setConectando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!canal) return
    canal.aoFechar(() => {
      setCanal(null)
      setErro('A ligação com o celular de controle caiu. Conecte de novo.')
    })
    return () => canal.fechar()
  }, [canal])

  async function conectar() {
    setErro(null)
    setConectando(true)
    try {
      setCanal(await entrarSala(codigo.trim()))
    } catch (e) {
      setErro(e instanceof ErroConexao ? e.message : 'Não foi possível conectar.')
    } finally {
      setConectando(false)
    }
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onSair}>
          ← Sair
        </button>
        <span className="passo">{canal ? `Estúdio ${codigo}` : 'Câmera do estúdio'}</span>
      </header>

      {canal ? (
        <PainelCamera canal={canal} angulo={angulo} />
      ) : (
        <>
          <h1>Este celular é uma câmera</h1>
          <p className="dica">Digite o código que aparece no celular de controle e escolha de onde este celular vai filmar.</p>

          <label className="campo">
            Código do estúdio
            <input
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="codigo-input"
            />
          </label>

          <div className="opcoes">
            {ANGULOS.map((a) => (
              <button key={a.id} className={`opcao ${angulo === a.id ? 'ativo' : ''}`} onClick={() => setAngulo(a.id)}>
                <strong>{a.label}</strong>
                <span>{a.dica}</span>
              </button>
            ))}
          </div>

          {erro && <p className="pill pill-aviso estatico">{erro}</p>}
          <button className="botao grande" onClick={conectar} disabled={codigo.length !== 6 || conectando}>
            {conectando ? 'Conectando…' : 'Conectar'}
          </button>
          <p className="dica-sec">Prenda o celular no tripé na altura do quadril, a uns 2,5 a 3 metros, deitado (na horizontal) se o exercício for largo.</p>
        </>
      )}
    </div>
  )
}
