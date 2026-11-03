import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FundoHex } from './components/FundoHex'
import { prepararInstalacao, registrarServiceWorker } from './nuvem/push'

// Notificações com o app fechado e o botão "Instalar o FormaCerta".
prepararInstalacao()
registrarServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FundoHex />
    <App />
  </StrictMode>,
)
