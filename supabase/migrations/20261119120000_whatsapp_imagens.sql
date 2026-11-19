-- Imagens que o robô do WhatsApp pode mandar para explicar um processo
-- (pagar o Pix, confirmar o e-mail, criar conta...). O administrador troca,
-- liga/desliga e cria novas em Administração → WhatsApp → Imagens do robô.

create table if not exists public.whatsapp_imagens (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave ~ '^[a-z0-9-]{2,40}$'),
  titulo text not null check (char_length(titulo) between 1 and 80),
  quando_usar text not null default '' check (char_length(quando_usar) <= 300),
  legenda text not null default '' check (char_length(legenda) <= 900),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.whatsapp_imagens enable row level security;

drop policy if exists "admin lê imagens do robô" on public.whatsapp_imagens;
create policy "admin lê imagens do robô" on public.whatsapp_imagens
  for select to authenticated using (public.eh_admin());
drop policy if exists "admin cria imagens do robô" on public.whatsapp_imagens;
create policy "admin cria imagens do robô" on public.whatsapp_imagens
  for insert to authenticated with check (public.eh_admin());
drop policy if exists "admin muda imagens do robô" on public.whatsapp_imagens;
create policy "admin muda imagens do robô" on public.whatsapp_imagens
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "admin apaga imagens do robô" on public.whatsapp_imagens;
create policy "admin apaga imagens do robô" on public.whatsapp_imagens
  for delete to authenticated using (public.eh_admin());

revoke all on public.whatsapp_imagens from anon;
grant select, insert, update, delete on public.whatsapp_imagens to authenticated;

-- Pasta pública (o WhatsApp precisa baixar a imagem por um link aberto).
-- Só JPEG e PNG, até 5 MB: é o que o WhatsApp aceita.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('whatsapp-imagens', 'whatsapp-imagens', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "whatsapp-imagens: admin lista" on storage.objects;
create policy "whatsapp-imagens: admin lista" on storage.objects for select to authenticated
using (bucket_id = 'whatsapp-imagens' and public.eh_admin());
drop policy if exists "whatsapp-imagens: admin envia" on storage.objects;
create policy "whatsapp-imagens: admin envia" on storage.objects for insert to authenticated
with check (bucket_id = 'whatsapp-imagens' and public.eh_admin());
drop policy if exists "whatsapp-imagens: admin troca" on storage.objects;
create policy "whatsapp-imagens: admin troca" on storage.objects for update to authenticated
using (bucket_id = 'whatsapp-imagens' and public.eh_admin());
drop policy if exists "whatsapp-imagens: admin apaga" on storage.objects;
create policy "whatsapp-imagens: admin apaga" on storage.objects for delete to authenticated
using (bucket_id = 'whatsapp-imagens' and public.eh_admin());

-- As 5 primeiras, servidas pelo próprio site (pasta public/whatsapp).
insert into public.whatsapp_imagens (chave, titulo, quando_usar, legenda, url, ordem) values
  ('como-pagar-pix', 'Como pagar com Pix copia e cola',
   'Logo depois de mandar um código Pix, ou quando a pessoa não sabe como pagar o Pix.',
   'Passo a passo para pagar o Pix copia e cola no app do seu banco.',
   'https://formacerta.app.br/whatsapp/como-pagar-pix.png', 1),
  ('confirmar-email', 'Como confirmar o e-mail',
   'Quando a pessoa não confirmou o e-mail, não achou o e-mail de confirmação ou não consegue entrar por falta de confirmação.',
   'Como confirmar o seu e-mail no FormaCerta. Olhe também no Spam e em Promoções.',
   'https://formacerta.app.br/whatsapp/confirmar-email.png', 2),
  ('criar-conta', 'Como criar a conta',
   'Quando a pessoa quer se cadastrar e pergunta como fazer.',
   'Como criar sua conta no FormaCerta, direto no navegador do celular.',
   'https://formacerta.app.br/whatsapp/criar-conta.png', 3),
  ('assinar-pelo-app', 'Como assinar pelo app',
   'Quando a pessoa prefere assinar ou pagar com cartão pelo app em vez do Pix aqui na conversa.',
   'Como assinar um plano pelo app (Pix ou cartão).',
   'https://formacerta.app.br/whatsapp/assinar-pelo-app.png', 4),
  ('avaliacao-postura', 'Avaliação de postura',
   'Quando a pessoa quer saber como funciona ou como fazer a primeira avaliação de postura.',
   'Como fazer a sua avaliação de postura no app.',
   'https://formacerta.app.br/whatsapp/avaliacao-postura.png', 5)
on conflict (chave) do nothing;
