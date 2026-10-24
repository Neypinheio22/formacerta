import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FundoHex } from './components/FundoHex'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FundoHex />
    <App />
  </StrictMode>,
)
