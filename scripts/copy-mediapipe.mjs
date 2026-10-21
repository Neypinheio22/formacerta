// Copia os arquivos WebAssembly do MediaPipe para public/, para o app não
// depender de CDN externa para rodar a detecção de pose.
import { cpSync, mkdirSync } from 'node:fs'

const origem = 'node_modules/@mediapipe/tasks-vision/wasm'
const destino = 'public/mediapipe/wasm'
mkdirSync(destino, { recursive: true })
cpSync(origem, destino, { recursive: true })
console.log(`MediaPipe wasm copiado para ${destino}`)
