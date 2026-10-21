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
