import { useState } from 'react'
import { PERIMETRIA, type DadosMedidas } from '../../evolucao/evolucao'
import type { Circunferencia } from '../../idoso/tipos'
import { idadeDe, type Ficha } from '../../nuvem/fichas'
import { enviarResultado } from '../../nuvem/resultados'
import { lerNumero } from '../../testes/formato'
import { ComoMedir } from './ComoMedir'

type Props = {
  ficha: Ficha
  meuId: string
  onSalvo: () => void
  onCancelar: () => void
  /** O próprio aluno anotando as medidas dele, em casa. */
  doAluno?: boolean
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Campo({ rotulo, valor, onChange }: { rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <label className="campo">
      {rotulo}
      <input inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value.replace(/[^\d,.]/g, ''))} maxLength={6} />
    </label>
  )
}

/** O profissional (ou o próprio aluno) anota peso, gordura, batimentos e perimetria. */
export function MedidasForm({ ficha, meuId, onSalvo, onCancelar, doAluno = false }: Props) {
  const [data, setData] = useState(hoje)
  const [peso, setPeso] = useState('')
  const [gordura, setGordura] = useState('')
  const [fc, setFc] = useState('')
  const [circ, setCirc] = useState<Partial<Record<Circunferencia, string>>>({})
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const dados: DadosMedidas = {
    peso: lerNumero(peso),
    gordura: lerNumero(gordura),
    fcRepouso: lerNumero(fc),
    circ: Object.fromEntries(Object.entries(circ).map(([k, v]) => [k, lerNumero(v ?? '')]).filter(([, v]) => v !== null)),
    observacoes: obs.trim(),
  }
  const algum = dados.peso !== null || dados.gordura !== null || dados.fcRepouso !== null || Object.keys(dados.circ!).length > 0

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    // Meio-dia, para a data não mudar de dia por causa do fuso.
    const feitoEm = data === hoje() ? new Date().toISOString() : new Date(`${data}T12:00:00`).toISOString()
    const erro = await enviarResultado({
      tipo: 'medidas',
      feitoEm,
      resultado: dados,
      enviadoPor: meuId,
      alunoId: ficha.aluno_id,
      fichaId: ficha.id,
      apelido: '',
      idade: idadeDe(ficha.nascimento, new Date(feitoEm)),
      sexo: ficha.sexo,
      alturaCm: ficha.altura_cm,
    })
    setSalvando(false)
    if (erro) setErro(erro)
    else onSalvo()
  }

  return (
    <form className="cartao destaque formulario" onSubmit={salvar}>
      <h2>{doAluno ? 'Minhas medidas de hoje' : 'Medidas do corpo'}</h2>
      <p className="dica-sec">
        {doAluno
          ? 'Preencha só o que mediu hoje. Cada medida entra no seu gráfico de evolução, e o seu personal vê que foi você quem anotou.'
          : `Preencha só o que mediu hoje. Cada medida entra no gráfico de evolução de ${ficha.nome.split(' ')[0]}.`}
      </p>
      <label className="campo">
        Data
        <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value || hoje())} />
      </label>
      <div className="tres-campos">
        <Campo rotulo="Peso (kg)" valor={peso} onChange={setPeso} />
        <Campo rotulo="Gordura (%)" valor={gordura} onChange={setGordura} />
        <Campo rotulo={doAluno ? 'Batimentos em repouso' : 'FC repouso'} valor={fc} onChange={setFc} />
      </div>
      {doAluno && <p className="dica-sec">Gordura e batimentos só se a sua balança ou relógio mostrarem.</p>}
      {!ficha.altura_cm && <p className="dica-sec">{doAluno ? 'Coloque a sua altura em "Meus dados"' : 'Coloque a altura na ficha'} para o app calcular o IMC.</p>}
      <details className="perimetria" open={doAluno}>
        <summary>{doAluno ? 'Medidas com fita métrica (cm)' : 'Perimetria (circunferências em cm)'}</summary>
        {doAluno && <ComoMedir />}
        <div className="tres-campos">
          {PERIMETRIA.map((c) => (
            <Campo key={c.id} rotulo={c.nome} valor={circ[c.id] ?? ''} onChange={(v) => setCirc((x) => ({ ...x, [c.id]: v }))} />
          ))}
        </div>
      </details>
      <label className="campo">
        Observações
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={300} />
      </label>
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao" type="submit" disabled={!algum || salvando}>
        {salvando ? 'Guardando…' : 'Guardar medidas'}
      </button>
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}
