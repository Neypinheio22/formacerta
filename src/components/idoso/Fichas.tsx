import { useState } from 'react'
import { calcularImc, classificarCintura, classificarImc, classificarRcq, panturrilhaBaixa } from '../../idoso/analise'
import { CIRCUNFERENCIAS, DISPOSITIVOS, type Anamnese, type Antropometria, type Dispositivo, type Sexo } from '../../idoso/tipos'
import { lerNumero, numero } from '../../testes/formato'

/** Campo de número que aceita vírgula e deixa apagar. */
export function CampoNumero(props: { rotulo: string; valor: number | null; onChange: (v: number | null) => void; placeholder?: string; inteiro?: boolean }) {
  const [texto, setTexto] = useState(props.valor === null ? '' : String(props.valor).replace('.', ','))
  return (
    <label className="campo">
      {props.rotulo}
      <input
        inputMode={props.inteiro ? 'numeric' : 'decimal'}
        value={texto}
        placeholder={props.placeholder}
        onChange={(e) => {
          setTexto(e.target.value)
          const v = lerNumero(e.target.value)
          props.onChange(v === null || v < 0 ? null : props.inteiro ? Math.round(v) : v)
        }}
      />
    </label>
  )
}

function CampoTexto({ rotulo, valor, onChange, placeholder }: { rotulo: string; valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="campo">
      {rotulo}
      <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} />
    </label>
  )
}

/** IMC calculado na hora, com a classificação. */
export function ImcAutomatico({ peso, estatura, idade }: { peso: number | null; estatura: number | null; idade: number | null }) {
  const imc = calcularImc(peso, estatura)
  if (imc === null) return <p className="dica-sec">O IMC aparece sozinho quando você preencher peso e altura.</p>
  const c = classificarImc(imc, idade)
  return (
    <div className="resultado-teste imc">
      <span className="valor-grande">
        {numero(imc)} <small>IMC</small>
      </span>
      <span className={`chip chip-${c.status}`}>{c.rotulo}</span>
    </div>
  )
}

type PropsAnamnese = {
  avaliado: string
  onAvaliado: (v: string) => void
  nomes: string[]
  anamnese: Anamnese
  onAnamnese: (a: Anamnese) => void
  antropometria: Antropometria
  onAntropometria: (a: Antropometria) => void
}

export function FichaAnamnese(p: PropsAnamnese) {
  const a = p.anamnese
  const mudar = <K extends keyof Anamnese>(k: K, v: Anamnese[K]) => p.onAnamnese({ ...a, [k]: v })
  const medida = <K extends keyof Antropometria>(k: K, v: Antropometria[K]) => p.onAntropometria({ ...p.antropometria, [k]: v })

  return (
    <>
      <section className="cartao formulario">
        <h2>Dados pessoais</h2>
        <label className="campo">
          Nome do avaliado
          <input value={p.avaliado} onChange={(e) => p.onAvaliado(e.target.value)} placeholder="Ex.: João Silva" list="avaliados-idoso" autoComplete="off" />
          <datalist id="avaliados-idoso">
            {p.nomes.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <div className="linha-campos">
          <CampoNumero rotulo="Idade (anos)" valor={a.idade} onChange={(v) => mudar('idade', v)} inteiro />
          <label className="campo">
            Sexo
            <select value={a.sexo ?? ''} onChange={(e) => mudar('sexo', (e.target.value || null) as Sexo | null)}>
              <option value="">—</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          </label>
        </div>
        <div className="linha-campos">
          <CampoNumero rotulo="Altura (cm)" valor={p.antropometria.estatura} onChange={(v) => medida('estatura', v)} placeholder="Ex.: 165" />
          <CampoNumero rotulo="Peso (kg)" valor={p.antropometria.peso} onChange={(v) => medida('peso', v)} placeholder="Ex.: 72,5" />
        </div>
        <ImcAutomatico peso={p.antropometria.peso} estatura={p.antropometria.estatura} idade={a.idade} />
      </section>

      <section className="cartao formulario">
        <h2>Saúde e rotina</h2>
        <CampoTexto rotulo="Objetivo" valor={a.objetivo} onChange={(v) => mudar('objetivo', v)} placeholder="Ex.: ganhar força para subir escadas, evitar quedas" />
        <CampoTexto rotulo="Histórico de atividade física" valor={a.atividade} onChange={(v) => mudar('atividade', v)} placeholder="Ex.: caminhada 3x por semana há 2 anos" />
        <CampoTexto rotulo="Medicamentos" valor={a.medicamentos} onChange={(v) => mudar('medicamentos', v)} placeholder="Ex.: losartana, metformina" />
        <CampoTexto rotulo="Doenças e condições relevantes" valor={a.doencas} onChange={(v) => mudar('doencas', v)} placeholder="Ex.: hipertensão, diabetes, artrose no joelho" />
      </section>

      <section className="cartao formulario">
        <h2>Quedas, dores e cirurgias</h2>
        <CampoNumero rotulo="Quedas nos últimos 12 meses" valor={a.quedas} onChange={(v) => mudar('quedas', v)} inteiro placeholder="0" />
        {!!a.quedas && <CampoTexto rotulo="Como foram as quedas" valor={a.quedasDetalhe} onChange={(v) => mudar('quedasDetalhe', v)} placeholder="Ex.: tropeçou no tapete; caiu ao levantar à noite" />}
        <CampoTexto rotulo="Dores" valor={a.dores} onChange={(v) => mudar('dores', v)} placeholder="Ex.: lombar ao ficar muito tempo em pé" />
        <div className="campo">
          Intensidade da dor (0 = sem dor, 10 = pior dor)
          <div className="escolha notas-dor">
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} className={a.dorNota === n ? 'ativo' : ''} onClick={() => mudar('dorNota', a.dorNota === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <CampoTexto rotulo="Cirurgias" valor={a.cirurgias} onChange={(v) => mudar('cirurgias', v)} placeholder="Ex.: prótese de quadril em 2020" />
        <label className="campo">
          Uso de dispositivo auxiliar
          <select value={a.dispositivo} onChange={(e) => mudar('dispositivo', e.target.value as Dispositivo)}>
            {DISPOSITIVOS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <CampoTexto rotulo="Observações" valor={a.observacoes} onChange={(v) => mudar('observacoes', v)} />
      </section>
    </>
  )
}

export function FichaAntropometria({ valor, onChange, idade, sexo }: { valor: Antropometria; onChange: (a: Antropometria) => void; idade: number | null; sexo: Sexo | null }) {
  const { cintura, quadril, panturrilha } = valor.circ
  const cint = cintura ? classificarCintura(cintura, sexo) : null
  const rcq = cintura && quadril ? Math.round((cintura / quadril) * 100) / 100 : null
  const rcqC = rcq ? classificarRcq(rcq, sexo) : null
  return (
    <>
      <section className="cartao formulario">
        <h2>Peso, estatura e IMC</h2>
        <div className="linha-campos">
          <CampoNumero rotulo="Peso (kg)" valor={valor.peso} onChange={(v) => onChange({ ...valor, peso: v })} />
          <CampoNumero rotulo="Estatura (cm)" valor={valor.estatura} onChange={(v) => onChange({ ...valor, estatura: v })} />
        </div>
        <ImcAutomatico peso={valor.peso} estatura={valor.estatura} idade={idade} />
      </section>

      <section className="cartao formulario">
        <h2>Circunferências (perimetria)</h2>
        <p className="dica-sec">Em centímetros, com fita métrica. Braço e coxa no lado dominante, no meio do segmento; panturrilha na parte mais larga.</p>
        <div className="linha-campos">
          {CIRCUNFERENCIAS.map((c) => (
            <CampoNumero
              key={c.id}
              rotulo={`${c.nome} (cm)`}
              valor={valor.circ[c.id] ?? null}
              onChange={(v) => {
                const circ = { ...valor.circ }
                if (v === null) delete circ[c.id]
                else circ[c.id] = v
                onChange({ ...valor, circ })
              }}
            />
          ))}
        </div>
        {cint && (
          <p className="dica-sec">
            Cintura: <span className={`chip chip-${cint.status}`}>{cint.rotulo}</span> para doenças do coração e diabetes.
          </p>
        )}
        {rcq && (
          <p className="dica-sec">
            Relação cintura/quadril: <b>{numero(rcq, 2)}</b> {rcqC && <span className={`chip chip-${rcqC.status}`}>{rcqC.rotulo}</span>}
          </p>
        )}
        {panturrilha && panturrilhaBaixa(panturrilha) && (
          <p className="dica-sec">
            <span className="chip chip-atencao">Panturrilha abaixo de 31 cm</span> pode indicar perda de massa muscular (sarcopenia).
          </p>
        )}
        {!sexo && (cintura || quadril) && <p className="dica-sec">Preencha o sexo na anamnese para classificar cintura e relação cintura/quadril.</p>}
      </section>
    </>
  )
}
