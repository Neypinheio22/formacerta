# FormaCerta

**Treine certo. Evolua sempre.** App de correção de postura com IA.

Primeira versão web (feita para o celular). Depois o mesmo código vira app para iOS e Android.

## O que já funciona

**Avaliação de postura:** o cliente apoia o celular, tira 4 fotos (frente, costas, lateral direita e lateral esquerda) com temporizador e aviso de voz, e o app:

- marca os pontos do corpo (MediaPipe Pose, rodando no próprio celular, sem enviar fotos para servidor);
- confere se o corpo apareceu inteiro antes de aceitar a foto;
- mede ombros e quadril desnivelados, inclinação da cabeça, tronco deslocado e joelhos para dentro/fora (frente e costas);
- mede cabeça projetada para frente, inclinação do tronco e joelhos hiperestendidos ou flexionados (laterais);
- para cada alteração, indica os músculos a alongar e a fortalecer (com o lado do corpo) e os exercícios, e junta tudo num plano de correção (`src/pose/recomendacoes.ts`);
- dá uma nota de 0 a 100;
- guarda o histórico no aparelho.

**Exercício por vídeo (em movimento):** a avaliação de postura acima usa fotos paradas porque mede a postura em pé. Exercício é diferente: o erro aparece no meio do movimento. Aqui o app lê o vídeo **quadro a quadro**:

- câmera ao vivo (conta as repetições em voz alta e fala a correção logo depois de cada uma) ou vídeo enviado da galeria (lido a 15 quadros por segundo, pulando de quadro em quadro, sem perder nenhum mesmo em celular lento);
- em cada quadro mede o ângulo principal (joelho no agachamento, cotovelo na flexão) e as medidas de técnica;
- separa as repetições e as fases (descida, fundo, subida) pelo ângulo principal: a rep começa quando sai da posição inicial e só conta se passar do mínimo, assim balanço não conta;
- avalia cada repetição: profundidade, tronco caindo, joelhos para dentro, peso para um lado, quadril caindo na flexão e ritmo da descida;
- mostra o vídeo com o esqueleto, um gráfico do ângulo ao longo do tempo com cada repetição marcada, o resumo da série e exercícios para melhorar a técnica.

Exercícios: agachamento de lado, agachamento de frente (usa os pontos em 3D do MediaPipe, porque de frente a dobra do joelho quase não aparece na imagem plana) e flexão de braço de lado. Para incluir outro, basta descrever o exercício em `src/movimento/exercicios.ts`.

**Avaliação da corrida (esteira ou rua):** o cliente grava (ou envia da galeria) 10 a 20 segundos correndo, um vídeo de lado e outro de trás. Câmera lenta (120 ou 240 qps) deixa a pisada mais precisa; o app desconta a câmera lenta no cálculo do tempo. O vídeo é lido quadro a quadro (30 por segundo de vídeo) e os passos são encontrados pelo sobe e desce da pelve, que desce uma vez em cada apoio.

- **De lado:** cadência (passos por minuto), pisada (calcanhar, meio do pé ou antepé), pé à frente do corpo (overstriding, pela inclinação da canela no contato), joelho no contato, inclinação do tronco e sobe e desce do corpo (em cm, usando a altura da pessoa).
- **De trás:** joelho para dentro (ângulo do joelho no plano frontal, no meio do apoio), queda da pelve e pés cruzando a linha do meio, separados por perna.
- Cada ponto a corrigir mostra os músculos a alongar e a fortalecer (com o lado, quando é de um lado só), exercícios e um botão para ver o momento no vídeo.
- Pisar de calcanhar não é marcado como erro sozinho, só junto com o pé muito à frente do corpo.
- É **triagem, não diagnóstico**: o aviso aparece no resultado.

As regras ficam em `src/corrida/analise.ts` e os músculos e exercícios em `src/corrida/recomendacoes.ts`; os limites são valores de referência e podem ser ajustados com o personal.

**Banco de Wells:** flexibilidade da cadeia posterior. O personal digita as 3 tentativas e o app classifica sozinho pela tabela canadense/ACSM (sexo e idade, pés na marca de 26 cm; outra marca é convertida), mostra quanto falta para a próxima classe, guarda o histórico por avaliado com gráfico de evolução e tem campo de observações e diagnóstico. Foto lateral opcional mede o ângulo tronco-coxa e avisa se o joelho dobrou.

**Teste de Adams:** foto da pessoa com o tronco inclinado para frente. O app recorta o contorno das costas, compara o ponto mais alto de cada lado e estima o ângulo de rotação do tronco (como o escoliômetro), com o lado da gibosidade. Cortes: menos de 5° normal, 5° a 6,9° reavaliar, 7° ou mais encaminhar ao médico. Aceita também a leitura de um escoliômetro físico, guarda histórico e observações.

Os dois testes trazem desenhos de como fazer, para o aluno usar como referência. São **triagem, não diagnóstico médico**, e o app diz isso nas telas.

**Modo estúdio (para o personal):** grava o exercício de referência com 2 ou 3 celulares ao mesmo tempo (frente, lateral e costas).

- um celular é o **controle**: abre o estúdio e mostra um código de 6 dígitos (ou manda o link pelo WhatsApp); ele também pode filmar;
- os outros entram como **câmera** com o código e escolhem o ângulo; mostram o esqueleto para ajudar a enquadrar;
- o controle acerta o relógio de todos e manda começar no mesmo instante, depois de uma contagem de 3 segundos com voz;
- ao parar, cada câmera envia o vídeo direto para o controle (WebRTC, de celular para celular; o servidor gratuito do PeerJS só apresenta um ao outro);
- o controle mostra os ângulos lado a lado, sincronizados, com câmera lenta e esqueleto, e salva como **exercício de referência** no aparelho (IndexedDB), com opção de baixar os vídeos.

Para testar sem internet, use `?local=1` no endereço: cada aba do navegador vira um celular.

**Em breve:** teste de mobilidade, caminhada de 6 minutos, painel do personal com relatórios e chamada com personal de plantão.

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

As regras de análise ficam em `src/pose/analysis.ts` (postura) e `src/movimento/exercicios.ts` (exercícios), e os limites (em graus) de "Atenção" e "Corrigir" podem ser ajustados com o personal.

## Publicação

Cada alteração na branch `main` é publicada no GitHub Pages pelo workflow `.github/workflows/deploy.yml`. Na primeira vez, ative em **Settings → Pages → Source: GitHub Actions**.
