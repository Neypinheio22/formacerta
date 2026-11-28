alter table public.whatsapp_conversas
  add column if not exists anuncio_meta_id text;

create or replace function public.whatsapp_registrar_anuncio(p_conversa uuid, p_anuncio text)
returns void language sql set search_path = '' as $$
  update public.whatsapp_conversas as c
     set anuncio_meta_id = coalesce(c.anuncio_meta_id, p_anuncio),
         etiquetas = case
           when e.id is null or e.id = any(c.etiquetas) then c.etiquetas
           else array_append(c.etiquetas, e.id)
         end
    from (select (select id from public.whatsapp_etiquetas where nome = 'Veio do anúncio') as id) as e
   where c.id = p_conversa and p_anuncio ~ '^[0-9]{1,32}$'
$$;

revoke execute on function public.whatsapp_registrar_anuncio(uuid, text) from public, anon, authenticated;
grant execute on function public.whatsapp_registrar_anuncio(uuid, text) to service_role;
