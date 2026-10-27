import type { Perfil } from '../nuvem/conta'
import type { Assessment } from '../pose/types'
import { Activity, ArrowRight, Brain, Clapperboard, Crown, Dumbbell, FileText, Footprints, HeartPulse, PersonStanding, PlayCircle, Ruler, Sparkles, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { FundoHex } from './FundoHex'
import { Logo } from './Logo'
import { CartaoReavaliacao } from './plano/Reavaliacoes'
import { usePlanosLiberados } from './planos/usePlanosLiberados'
import { VitrineCarrossel } from './vitrine/VitrineCarrossel'

type Props = {
  history: Assessment[]
  onStart: () => void
  onOpen: (a: Assessment) => void
  onEstudio: () => void
  onExercicio: () => void
  onCarga: () => void
  onCorrida: () => void
  onFlexibilidade: () => void
  onAdams: () => void
  onIdoso: () => void
  perfil: Perfil | null
  onAdmin: () => void
  onAlunos: () => void
  onReavaliacoes: () => void
  onEvolucao: () => void
  onConta: () => void
  onVitrine: () => void
  onPlanos: () => void
  onRelatorio: () => void
}

type Atalho = { titulo: string; texto: string; Icone: LucideIcon; abrir: () => void; soPersonal?: boolean }

function Grupo({ titulo, atalhos, personal }: { titulo: string; atalhos: Atalho[]; personal: boolean }) {
  const visiveis = atalhos.filter((a) => personal || !a.soPersonal)
  if (!visiveis.length) return null
  return (
    <section className="grupo-atalhos">
      <h2 className="secao">{titulo}</h2>
      <div className="atalhos">
        {visiveis.map(({ titulo, texto, Icone, abrir }) => (
          <button key={titulo} className="atalho" onClick={abrir}>
            <span className="atalho-icone">
              <Icone size={20} />
            </span>
            <strong>{titulo}</strong>
            <span>{texto}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function Home({ history, onStart, onOpen, onEstudio, onExercicio, onCarga, onCorrida, onFlexibilidade, onAdams, onIdoso, perfil, onAdmin, onAlunos, onReavaliacoes, onEvolucao, onConta, onVitrine, onPlanos, onRelatorio }: Props) {
  const verPlanos = usePlanosLiberados(perfil)
  const [todoHistorico, setTodoHistorico] = useState(false)
  // O aluno só vê o que ele mesmo usa; as ferramentas de avaliar e atender alunos ficam para o personal.
  const personal = !perfil || perfil.papel !== 'aluno'
  const aluno = perfil?.papel === 'aluno'

  return (
    <div className="tela">
      <FundoHex brilho />

      {perfil && (
        <div className="barra-conta">
          <button className="link" onClick={onConta}>
            {perfil.nome ? perfil.nome.split(' ')[0] : perfil.email} · Minha conta
          </button>
          <span className="barra-botoes">
            {verPlanos && (
              <button className="botao-sec" onClick={onPlanos}>
                <Crown size={14} /> Planos
              </button>
            )}
            {perfil.papel === 'admin' && (
              <button className="botao-sec" onClick={onAdmin}>
                Administração
              </button>
            )}
            {(perfil.papel === 'profissional' || perfil.papel === 'admin') && (
              <button className="botao-sec" onClick={onAlunos}>
                Meus alunos
              </button>
            )}
            {perfil.papel === 'aluno' && (
              <button className="botao-sec" onClick={onEvolucao}>
                Minha evolução
              </button>
            )}
          </span>
        </div>
      )}

      <header className="marca">
        <Logo size={30} />
        <p className="slogan">
          Treine certo. <span className="verde">Evolua sempre.</span>
        </p>
      </header>

      {perfil && <VitrineCarrossel onAbrir={onVitrine} />}

      {perfil && <CartaoReavaliacao perfil={perfil} onAbrir={onReavaliacoes} />}

      <section className="cartao destaque">
        <span className="etiqueta">
          <Sparkles size={14} /> Correção de postura com IA
        </span>
        <h1>Avaliação de postura</h1>
        <p className="dica">4 fotos paradas: frente, costas e as duas laterais. As fotos não saem do seu celular.</p>
        <button className="botao grande" onClick={onStart}>
          Começar avaliação <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      </section>

      <Grupo
        titulo="Treino"
        personal={personal}
        atalhos={[
          { titulo: 'Exercício em vídeo', texto: 'Conta as repetições e corrige', Icone: PlayCircle, abrir: onExercicio },
          { titulo: 'Projeção de carga', texto: 'Quanto colocar no próximo treino', Icone: Dumbbell, abrir: onCarga },
        ]}
      />

      <Grupo
        titulo="Testes"
        personal={personal}
        atalhos={[
          { titulo: 'Corrida', texto: 'Pisada, cadência e joelhos', Icone: Footprints, abrir: onCorrida },
          { titulo: 'Flexibilidade', texto: 'Até onde as mãos chegam', Icone: Ruler, abrir: onFlexibilidade },
          { titulo: 'Coluna (Adams)', texto: 'Assimetria nas costas', Icone: PersonStanding, abrir: onAdams },
          { titulo: 'Idoso', texto: 'Berg, 6 minutos e mais', Icone: HeartPulse, abrir: onIdoso, soPersonal: true },
        ]}
      />

      <Grupo
        titulo={aluno ? 'Meu acompanhamento' : 'Meus alunos'}
        personal={personal}
        atalhos={[
          ...(perfil
            ? [{ titulo: 'Central de Inteligência', texto: aluno ? 'Minha análise e exercícios' : '🟢🟡🔴 de cada aluno', Icone: Brain, abrir: aluno ? onEvolucao : onAlunos }]
            : []),
          { titulo: 'Relatório', texto: 'PDF com sua logo e CREF', Icone: FileText, abrir: onRelatorio, soPersonal: true },
          { titulo: 'Modo estúdio', texto: 'Grave com 2 ou 3 celulares', Icone: Clapperboard, abrir: onEstudio, soPersonal: true },
        ]}
      />

      {history.length > 0 && (
        <section className="cartao destaque">
          <span className="etiqueta">
            <Activity size={14} /> Seus resultados
          </span>
          <h2>Histórico de postura</h2>
          <ul className="historico">
            {(todoHistorico ? history : history.slice(0, 3)).map((a) => (
              <li key={a.id}>
                <button onClick={() => onOpen(a)}>
                  <span>{new Date(a.date).toLocaleDateString('pt-BR')}</span>
                  <span className="nota">{a.score} pts</span>
                </button>
              </li>
            ))}
          </ul>
          {history.length > 3 && (
            <button className="link" onClick={() => setTodoHistorico(!todoHistorico)}>
              {todoHistorico ? 'Mostrar menos' : `Ver todas (${history.length})`}
            </button>
          )}
        </section>
      )}

      <p className="rodape">
        Seu corpo em movimento <span className="verde">certo.</span>
      </p>
    </div>
  )
}
