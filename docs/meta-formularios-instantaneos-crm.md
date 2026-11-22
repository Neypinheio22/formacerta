# Formulários instantâneos da Meta → CRM FormaCerta

Estado: **preparado no backend; ainda não conectado à Página Meta**. Não ativar campanhas de novos formulários antes de verificar conexão, consentimento e teste real.

## Contas / destino
- Portfólio empresarial: **Formacerta**.
- Nova conta de anúncios: **Formacerta anuncios**, ID `1665073561724375` (criada pelo responsável; ainda não disponível na conexão do Supermetrics em 22/11/2026).
- Página Meta existente: **Forma certa app**, ID `111209725360310`. **Verificar que essa Página foi adicionada ao portfólio correto e autorizada à nova conta**.
- Formulários existentes na Página: `4573872749502711` ("FormaCerta | Avaliação grátis | Privacidade") e `1521875723109942` ("FormaCerta — 1ª avaliação grátis"). **Não conectar automaticamente**: o primeiro não contém perguntas de qualificação nem prova de consentimento no formato que o receptor exige, e o segundo tem apenas uma pergunta personalizada; ambos requerem revisão.
- Receptor seguro: `https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/meta-leads-webhook`.
- CRM: tabela privada `public.captacao_leads`; logs de importação: `public.meta_lead_ads_ingest`.
- Atendimento: **somente após a pessoa enviar a primeira mensagem** no WhatsApp; sem envio automático de mensagens iniciadas pela empresa, sem cobrança de template iniciada por este webhook.

## Criar dois formulários instantâneos (maior intenção, idioma pt-BR)

**Formulário de alunos** — nome `FormaCerta | Alunos | Primeira avaliação`
1. Nome completo (campo padrão FULL_NAME).
2. Telefone / WhatsApp (campo padrão PHONE).
3. (Opcional) E-mail (campo padrão EMAIL).
4. Pergunta de múltipla escolha: **O que você procura?**; respostas `Avaliar minha postura`, `Encontrar personal online`, `Conhecer a plataforma`.
5. Pergunta de múltipla escolha: **Quando pretende começar?**; respostas `Quero começar agora`, `Nos próximos 7 dias`, `Ainda estou pesquisando`.
6. Pergunta explícita, **obrigatória**, de aceite: **Autorizo receber contato sobre esta solicitação pelo WhatsApp ou e-mail?**; resposta `Sim`. Não pré-selecionar. Não agrupar consentimento de marketing nem de tratamento de saúde; manter a política de privacidade acessível.
7. Introdução: "Faça sua primeira avaliação postural gratuita no FormaCerta. O formulário registra seu interesse e não é um diagnóstico médico."
8. Tela de agradecimento: "Recebemos sua solicitação. Toque em Conversar no WhatsApp para começar o atendimento, ou acesse o aplicativo por conta própria". **Botão abrir WhatsApp**, se esse CTA existir no Gerenciador de Formulários; se não, usar destino para site do FormaCerta e incluir convite claro. O botão do WhatsApp deve apontar para `https://wa.me/551153040224?text=Ol%C3%A1%2C%20FormaCerta%21%20Preenchi%20o%20formul%C3%A1rio%20de%20aluno%20e%20quero%20come%C3%A7ar.`
9. Política: URL pública e válida do FormaCerta, com finalidade e contato descritos. Não prometer que mensagem será iniciada gratuitamente pelo robô.

**Formulário de profissionais** — nome `FormaCerta | Personal trainers | Conhecer plataforma`
1. FULL_NAME, PHONE e EMAIL opcional.
2. **O que você procura?**: `Avaliar alunos`, `Organizar atendimento online`, `Conhecer as ferramentas`.
3. **Quando pretende começar?**: `Quero começar agora`, `Nos próximos 7 dias`, `Ainda estou pesquisando`.
4. **Autorizo receber contato sobre esta solicitação pelo WhatsApp ou e-mail?**: `Sim` (obrigatório e não pré-selecionado).
5. Informar que a conta profissional pode exigir registro CREF e verificação. Não prometer ganhos ou aprovações.
6. Agradecimento com CTA voluntário para `https://wa.me/551153040224?text=Ol%C3%A1%2C%20FormaCerta%21%20Preenchi%20o%20formul%C3%A1rio%20de%20personal%20e%20quero%20conhecer%20a%20plataforma.`

**Atenção:** a Meta pode alterar o conjunto de perguntas e campos internos de um formulário; testar o payload exato e ajustar mapeamento antes de veicular anúncios. A categoria saúde/bem-estar requer revisão de política e não autoriza contornar restrições de eventos.

## Conectar Página Meta, app Meta e Supabase

1. No portfólio **Formacerta**, adicionar a Página **Forma certa app** com as permissões de controle apropriadas. Atribuir a nova conta de anúncios ao uso da Página (sem transferir a conta antiga Ney Alves).
2. Criar/usar aplicativo Meta for Developers com produto Webhooks para **Page**, assinar campo **leadgen** e concluir as permissões exigidas pela Meta, incluindo acesso à leitura de leads. Alguns acessos exigem revisão do aplicativo e aprovação administrativa.
3. No produto Webhooks, usar a URL de retorno acima e um **verify token aleatório**, guardado como segredo; a verificação GET usa `hub.challenge`.
4. Nas **variáveis secretas do Supabase Edge Functions**, cadastrar via interface segura, nunca pelo código nem pelo chat:
   - `META_APP_SECRET` — segredo do app Meta (para validar X-Hub-Signature-256);
   - `META_WEBHOOK_VERIFY_TOKEN` — segredo de verificação do webhook;
   - `META_PAGE_ACCESS_TOKEN` — token de Página com permissões adequadas para recuperar o lead via Graph API;
   - `META_PAGE_ID` — ID da Página autorizada;
   - `META_LEAD_FORM_ALUNO_ID` — ID do formulário revisado de alunos;
   - `META_LEAD_FORM_PERSONAL_ID` — ID do formulário revisado de profissionais;
   - `META_GRAPH_VERSION` — versão Graph API suportada, por exemplo `v24.0` (confirmar versão disponível).
5. Vincular o app Meta à Página e assinar `leadgen` em `/{page-id}/subscribed_apps` com token de Página válido. A mera verificação do webhook sem essa assinatura não entrega leads.
6. Autorizar o acesso a leads em **Configurações do negócio → Integrações → Acesso a leads** para a Página e o app CRM, se solicitado pela Meta.
7. Fazer um **lead de teste** por formulário com a ferramenta oficial de testes de lead ads, confirmar **uma** linha em `meta_lead_ads_ingest` com status `processado` e seu registro em `captacao_leads` com origem `meta_formulario_instantaneo`, perfil e qualificação esperados.
8. Testar duplicação da mesma entrega Meta: deve continuar com um único contato no CRM.
9. Confirmar o CTA abre WhatsApp com mensagem preenchida; o robô deve responder **somente depois da mensagem voluntária do interessado**. Não assumir que clicar no botão é o mesmo que enviar uma mensagem.
10. Manter anúncios **pausados** até todos os testes concluídos. Apenas depois escolher campanha de objetivo Leads e local de conversão Formulário instantâneo.

## Segurança e observabilidade
- Webhook POST exige assinatura HMAC-SHA256; rejeita eventos de Página não autorizada e formulários fora da lista.
- Enquanto faltar qualquer segredo/ID, POST responde 503 e **nenhum lead é importado**.
- Cada `leadgen_id` é registrado uma única vez como chave primária na tabela com RLS habilitada, acessível somente pelo serviço.
- Só há importação após consentimento específico `Sim`; sem consentimento, status `sem_consentimento`. Sem telefone válido, status `sem_telefone`. Outros casos são rastreados com status `erro`.
- Nomes, telefones e e-mails não devem aparecer em logs do webhook. Tokens e segredos não devem ser copiados para o chat.
- Não enviar `QualifiedLead` ou dados de saúde para o Pixel/Meta.
- Não é uma integração com início automático de conversas no WhatsApp. O início fica com o visitante para evitar cobranças de mensagem iniciada pela empresa.

## Referências
- Meta: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen
- Meta Page subscribed apps: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/
- Supabase Edge secrets: https://supabase.com/docs/guides/functions/secrets
