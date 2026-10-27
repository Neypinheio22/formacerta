import { useState } from 'react'
import { OBJETIVOS, type DadosFicha, type Objetivo } from '../../nuvem/fichas'

type Props = {
  inicial: DadosFicha
  titulo: string
  textoSalvar: string
  onSalvar: (dados: DadosFicha) => Promise<string | null>
  onCancelar: () => void
}

/** Dados pessoais do aluno: criar ou editar a ficha. */
export function FichaForm({ inicial, titulo, textoSalvar, onSalvar, onCancelar }: Props) {
  const [d, setD] = useState<DadosFicha>(inicial)
  const [aceito, setAceito] = useState(!!inicial.consentimento_em)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const muda = <K extends keyof DadosFicha>(k: K, v: DadosFicha[K]) => setD((x) => ({ ...x, [k]: v }))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    const consentimento_em = aceito ? (d.consentimento_em ?? new Date().toISOString()) : null
    const erro = await onSalvar({ ...d, consentimento_em })
    setSalvando(false)
    if (erro) setErro(erro)
  }

  return (
    <form className="cartao destaque formulario" onSubmit={salvar}>
      <h2>{titulo}</h2>
      <label className="campo">
        Nome do aluno
        <input value={d.nome} onChange={(e) => muda('nome', e.target.value)} maxLength={120} placeholder="Ex.: Maria Souza" />
      </label>
      <div className="tres-campos">
        <label className="campo">
          Nascimento
          <input type="date" value={d.nascimento ?? ''} onChange={(e) => muda('nascimento', e.target.value || null)} />
        </label>
        <label className="campo">
          Altura (cm)
          <input
            inputMode="numeric"
            value={d.altura_cm ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '')
              muda('altura_cm', v ? Number(v) : null)
            }}
            maxLength={3}
          />
        </label>
        <label className="campo">
          Sexo
          <select value={d.sexo ?? ''} onChange={(e) => muda('sexo', (e.target.value || null) as DadosFicha['sexo'])}>
            <option value="">—</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="outro">Outro</option>
          </select>
        </label>
      </div>
      <label className="campo">
        Objetivo
        <select value={d.objetivo} onChange={(e) => muda('objetivo', e.target.value as Objetivo)}>
          <option value="">Não informado</option>
          {OBJETIVOS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <span className="dica-sec">O objetivo define se perder ou ganhar peso e medidas conta como melhora nos gráficos.</span>
      </label>
      <label className="campo">
        WhatsApp
        <input value={d.telefone} onChange={(e) => muda('telefone', e.target.value)} inputMode="tel" maxLength={30} placeholder="(11) 91234-5678" />
      </label>
      <label className="campo">
        Saúde: doenças, dores, remédios e restrições
        <textarea value={d.saude} onChange={(e) => muda('saude', e.target.value)} rows={3} maxLength={2000} />
      </label>
      <label className="campo">
        Observações do profissional
        <textarea value={d.observacoes} onChange={(e) => muda('observacoes', e.target.value)} rows={3} maxLength={2000} />
      </label>
      <label className="aceite">
        <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
        <span>O aluno autorizou guardar estes dados e os números das avaliações (sem foto e sem vídeo) no FormaCerta, para acompanhar a evolução. Dá para apagar quando quiser.</span>
      </label>
      {erro && <p className="mensagem erro">{erro}</p>}
      <button className="botao" type="submit" disabled={d.nome.trim() === '' || !aceito || salvando}>
        {salvando ? 'Salvando…' : textoSalvar}
      </button>
      <button className="botao-sec" type="button" onClick={onCancelar}>
        Cancelar
      </button>
    </form>
  )
}
