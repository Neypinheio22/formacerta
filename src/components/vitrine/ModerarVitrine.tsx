import { useEffect, useState } from 'react'
import { ROTULO_SITUACAO_FOTO, apagarFoto, listarParaModerar, moderarFoto, type FotoVitrine, type SituacaoFoto } from '../../nuvem/vitrine'
import { CartaoFoto } from './CartaoFoto'

/** Administrador: aprova, recusa ou apaga as fotos enviadas para a vitrine. */
export function ModerarVitrine({ nomePorId }: { nomePorId: Map<string, string> }) {
  const [situacao, setSituacao] = useState<SituacaoFoto>('pendente')
  const [fotos, setFotos] = useState<FotoVitrine[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregar(s = situacao) {
    setCarregando(true)
    const r = await listarParaModerar(s)
    setFotos(r.fotos)
    setErro(r.erro)
    setCarregando(false)
  }

  useEffect(() => {
    carregar(situacao)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao])

  async function mudar(f: FotoVitrine, nova: SituacaoFoto) {
    const erro = await moderarFoto(f.id, nova)
    if (erro) setErro(erro)
    else setFotos((fs) => fs.filter((x) => x.id !== f.id))
  }

  async function apagar(f: FotoVitrine) {
    if (!confirm(`Apagar a foto de ${f.nome}? Não tem como desfazer.`)) return
    const erro = await apagarFoto(f)
    if (erro) setErro(erro)
    else setFotos((fs) => fs.filter((x) => x.id !== f.id))
  }

  return (
    <>
      <div className="escolha abas">
        {(['pendente', 'aprovada', 'recusada'] as SituacaoFoto[]).map((s) => (
          <button key={s} className={situacao === s ? 'ativo' : ''} onClick={() => setSituacao(s)}>
            {ROTULO_SITUACAO_FOTO[s]}
          </button>
        ))}
      </div>

      {erro && <p className="mensagem erro">{erro}</p>}
      {carregando && <p className="carregando">Carregando…</p>}
      {!carregando && fotos.length === 0 && <p className="dica-sec">Nenhuma foto aqui.</p>}

      <div className="grade-vitrine">
        {!carregando &&
          fotos.map((f) => (
            <CartaoFoto key={f.id} f={f}>
              <p className="dica-sec">
                Enviada por {nomePorId.get(f.enviado_por) ?? 'você'} em {new Date(f.criado_em).toLocaleDateString('pt-BR')} · autorização de imagem em{' '}
                {new Date(f.autorizacao_em).toLocaleDateString('pt-BR')}
              </p>
              <div className="acoes-linha">
                {f.situacao !== 'aprovada' && (
                  <button className="botao" onClick={() => mudar(f, 'aprovada')}>
                    Aprovar
                  </button>
                )}
                {f.situacao !== 'recusada' && (
                  <button className="botao-sec" onClick={() => mudar(f, 'recusada')}>
                    {f.situacao === 'aprovada' ? 'Tirar da vitrine' : 'Recusar'}
                  </button>
                )}
                <button className="botao-sec perigo" onClick={() => apagar(f)}>
                  Apagar
                </button>
              </div>
            </CartaoFoto>
          ))}
      </div>
    </>
  )
}
