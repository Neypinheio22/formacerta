-- Gravações de voz recebidas pelo número oficial, privadas e acessíveis somente à equipe.
alter table public.whatsapp_mensagens
  add column if not exists midia_tipo text,
  add column if not exists midia_id text,
  add column if not exists midia_caminho text;

-- A RLS existente em whatsapp_mensagens já restringe a leitura ao administrador.
-- Arquivos são enviados com service_role e acessados apenas por URL temporária
-- emitida pela função whatsapp-audio após conferir o administrador autenticado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-audios', 'whatsapp-audios', false, 16777216,
  array['audio/ogg','audio/mpeg','audio/mp4','audio/amr','audio/aac','audio/3gpp','audio/opus','audio/webm','audio/x-m4a']
)
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Intencionalmente sem policies de SELECT para usuários finais de Storage.
