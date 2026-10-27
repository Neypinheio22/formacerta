import { MessageSquareText } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Ficha } from '../../nuvem/fichas'
import { listarFeitos, type Treino, type TreinoFeito } from '../../nuvem/treinos'
import { dataCurta } from '../../testes/formato'
import { hora, intensidadeComum, minutos, tempoMedio, textoDuracao } from '../../treino/retorno'

/** Para o personal: como o aluno sentiu os últimos treinos (tempo, intensidade e comentário). */
export function RetornosAluno({ ficha, treinos }: { ficha: Ficha; treinos: Treino[] }) {
  const [feitos, setFeitos] = useState<TreinoFeito[] | null>(null)

  useEffect(() => {
    listarFeitos(ficha.id, 60).then(setFeitos)
  }, [ficha.id])

  const primeiro = ficha.nome.split(' ')[0]
  const media = feitos ? tempoMedio(feitos) : null
  const comum = feitos ? intensidadeComum(feitos) : null
  const nomeDe = (f: TreinoFeito) => treinos.find((t) => t.id === f.treino_id)?.nome

  return (
    <section className="cartao">
      <h2>
        <MessageSquareText size={18} /> Retorno dos treinos
      </h2>
      <p className="dica-sec">Ao concluir, {primeiro} conta quanto tempo levou, a intensidade e deixa um comentário. Use para ver se o treino está longo ou se a intensidade está boa.</p>
      {feitos === null && <p className="carregando">Carregando…</p>}
      {feitos?.length === 0 && <p className="dica-sec">Nenhum treino concluído nos últimos 60 dias.</p>}
      {feitos && feitos.length > 0 && (
        <>
          {(media !== null || comum) && (
            <div className="retorno-resumo">
              {media !== null && (
                <span>
                  Tempo médio <b className="verde">{textoDuracao(media)}</b>
                </span>
              )}
              {comum && (
                <span>
                  Intensidade mais comum <b className="verde">{comum}</b>
                </span>
              )}
            </div>
          )}
          <ul className="retornos">
            {feitos.slice(0, 15).map((f) => {
              const m = minutos(f.inicio, f.fim)
              return (
                <li key={f.id}>
                  <span className="linha-fim">
                    <b>
                      {f.letra && <span className="verde">{f.letra}</span>} {nomeDe(f) ?? (f.letra ? '' : 'Treino')}
                    </b>
                    <span className="dica-sec">{dataCurta(f.feito_em)}</span>
                  </span>
                  <span className="dica-sec">
                    {f.inicio && f.fim ? `${hora(f.inicio)} às ${hora(f.fim)}` : 'Sem horário'}
                    {m !== null && ` · ${textoDuracao(m)}`}
                    {f.intensidade && ` · ${f.intensidade}`}
                  </span>
                  {f.comentario && <span className="retorno-comentario">“{f.comentario}”</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
