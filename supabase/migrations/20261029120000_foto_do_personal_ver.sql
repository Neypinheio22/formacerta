-- Foto do personal: o banco precisa deixar cada um "ver" os próprios arquivos
-- da pasta para conseguir trocar e apagar a foto antiga.
drop policy if exists "fotos-perfil: ver a minha" on storage.objects;
create policy "fotos-perfil: ver a minha" on storage.objects for select to authenticated
using (bucket_id = 'fotos-perfil' and split_part(name, '/', 1) = (select auth.uid())::text);

-- Confere se a pasta existe e é pública (deve mostrar: fotos-perfil | true).
select id, public from storage.buckets where id = 'fotos-perfil';
