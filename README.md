# FormaCerta

**Treine certo. Evolua sempre.** App de correção de postura com IA.

Primeira versão web (feita para o celular). Depois o mesmo código vira app para iOS e Android.

## O que já funciona

**Avaliação de postura:** o cliente apoia o celular, tira 4 fotos (frente, costas, lateral direita e lateral esquerda) com temporizador e aviso de voz, e o app:

- marca os pontos do corpo (MediaPipe Pose, rodando no próprio celular, sem enviar fotos para servidor);
- confere se o corpo apareceu inteiro antes de aceitar a foto;
- mede ombros e quadril desnivelados, inclinação da cabeça, tronco deslocado e joelhos para dentro/fora (frente e costas);
- mede cabeça projetada para frente, inclinação do tronco e joelhos hiperestendidos ou flexionados (laterais);
- dá uma nota de 0 a 100 e monta um plano de exercícios de correção;
- guarda o histórico no aparelho.

**Modo estúdio (para o personal):** grava o exercício de referência com 2 ou 3 celulares ao mesmo tempo (frente, lateral e costas).

- um celular é o **controle**: abre o estúdio e mostra um código de 6 dígitos (ou manda o link pelo WhatsApp); ele também pode filmar;
- os outros entram como **câmera** com o código e escolhem o ângulo; mostram o esqueleto para ajudar a enquadrar;
- o controle acerta o relógio de todos e manda começar no mesmo instante, depois de uma contagem de 3 segundos com voz;
- ao parar, cada câmera envia o vídeo direto para o controle (WebRTC, de celular para celular; o servidor gratuito do PeerJS só apresenta um ao outro);
- o controle mostra os ângulos lado a lado, sincronizados, com câmera lenta e esqueleto, e salva como **exercício de referência** no aparelho (IndexedDB), com opção de baixar os vídeos.

Para testar sem internet, use `?local=1` no endereço: cada aba do navegador vira um celular.

**Em breve:** análise da corrida, teste de mobilidade, caminhada de 6 minutos, painel do personal com relatórios e chamada com personal de plantão.

## Rodar no computador

```bash
npm install
npm run dev
```

A câmera só funciona em `localhost` ou em endereço `https`.

## Testes

```bash
npm test
```

As regras de análise ficam em `src/pose/analysis.ts` e os limites (em graus) de "Atenção" e "Corrigir" podem ser ajustados com o personal.

## Publicação

Cada alteração na branch `main` é publicada no GitHub Pages pelo workflow `.github/workflows/deploy.yml`. Na primeira vez, ative em **Settings → Pages → Source: GitHub Actions**.
