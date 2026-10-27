import { useState } from 'react'
import { CONSELHOS, carregarProfissional, lerLogo, salvarProfissional, type Profissional } from '../../relatorio/profissional'

/** Nome, registro (CREF, CREFITO ou outro), contato e logo do profissional, usados no relatório. */
export function PerfilProfissional({ onVoltar, textoVoltar = 'Início' }: { onVoltar: () => void; textoVoltar?: string }) {
  const [salvo, setSalvo] = useState(carregarProfissional)
  const [p, setP] = useState(salvo)
  const [erroLogo, setErroLogo] = useState(false)
  const [aviso, setAviso] = useState('')
  const mudou = JSON.stringify(p) !== JSON.stringify(salvo)

  const campo = (chave: keyof Omit<Profissional, 'logo' | 'conselho'>, rotulo: string, placeholder: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="campo">
      {rotulo}
      <input value={p[chave]} onChange={(e) => setP({ ...p, [chave]: e.target.value })} placeholder={placeholder} {...extra} />
    </label>
  )

  async function escolherLogo(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      setP({ ...p, logo: await lerLogo(arquivo) })
      setErroLogo(false)
    } catch {
      setErroLogo(true)
    }
  }

  function salvar() {
    const t = (s: string) => s.trim()
    const limpo: Profissional = { ...p, nome: t(p.nome), profissao: t(p.profissao), registro: t(p.registro), telefone: t(p.telefone), email: t(p.email), local: t(p.local) }
    if (salvarProfissional(limpo)) {
      setSalvo(limpo)
      setP(limpo)
      setAviso('Perfil salvo. Ele vai aparecer no cabeçalho e na assinatura dos relatórios.')
    } else {
      setAviso('Não deu para salvar: o armazenamento do aparelho está cheio. Tente uma logo menor.')
    }
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="voltar" onClick={onVoltar}>
          ← {textoVoltar}
        </button>
      </header>

      <section className="cartao destaque">
        <span className="etiqueta">Para o relatório</span>
        <h1>Perfil do profissional</h1>
        <p className="dica-sec">Esses dados saem no topo e na assinatura dos relatórios que você imprime ou manda para o aluno. Ficam guardados só neste aparelho.</p>
      </section>

      <section className="cartao">
        <h2>Sua logo</h2>
        <div className="logo-perfil">
          {p.logo ? <img src={p.logo.image} alt="Logo do profissional" /> : <span className="logo-vazia">Sem logo</span>}
          <div className="acoes-col">
            <label className="botao-sec arquivo">
              {p.logo ? 'Trocar logo' : 'Escolher imagem'}
              <input type="file" accept="image/*" onChange={(e) => escolherLogo(e.target.files?.[0])} />
            </label>
            {p.logo && (
              <button className="botao-sec perigo" onClick={() => setP({ ...p, logo: undefined })}>
                Tirar logo
              </button>
            )}
          </div>
        </div>
        {erroLogo && <p className="pill pill-aviso estatico">Não conseguimos abrir essa imagem. Use PNG ou JPG.</p>}
        <p className="dica-sec">PNG com fundo transparente fica melhor. A imagem é reduzida para não ocupar espaço.</p>
      </section>

      <section className="cartao formulario">
        {campo('nome', 'Nome completo', 'Ex.: Romildo Silva', { autoComplete: 'name' })}
        {campo('profissao', 'Profissão', 'Ex.: Personal trainer ou Fisioterapeuta')}
        <label className="campo">
          Conselho do registro
          <select value={p.conselho} onChange={(e) => setP({ ...p, conselho: e.target.value })}>
            {CONSELHOS.map((c) => (
              <option key={c.sigla} value={c.sigla}>
                {c.nome}
              </option>
            ))}
            <option value="">Outro (escrevo no número)</option>
          </select>
        </label>
        {campo('registro', 'Número de registro', p.conselho === 'CREFITO' ? 'Ex.: 123456-F' : p.conselho ? 'Ex.: 012345-G/SP' : 'Ex.: CRN 12345')}
        {campo('telefone', 'Telefone / WhatsApp', 'Ex.: (11) 98765-4321', { inputMode: 'tel', autoComplete: 'tel' })}
        {campo('email', 'E-mail', 'Ex.: contato@studio.com.br', { inputMode: 'email', autoComplete: 'email' })}
        {campo('local', 'Estúdio, academia ou cidade', 'Ex.: Studio Forma, São Paulo')}
      </section>

      <button className="botao grande" disabled={!mudou} onClick={salvar}>
        Salvar perfil
      </button>
      {aviso && !mudou && <p className="dica-sec centro">{aviso}</p>}
    </div>
  )
}
