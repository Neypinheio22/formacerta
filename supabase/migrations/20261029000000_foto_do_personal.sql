-- Foto do profissional na lista "Encontrar personal" e lista que também
-- mostra o administrador quando ele atende como personal (com CREF e autorização).

alter table public.perfis add column if not exists foto_url text not null default '' check (char_length(foto_url) <= 400);
grant update (foto_url) on public.perfis to authenticated;

-- Pasta das fotos de perfil. Pública para leitura: a foto só é usada no cartão
-- que o próprio profissional autorizou mostrar. Cada um só mexe na própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create policy "fotos-perfil: enviar a minha" on storage.objects for insert to authenticated
with check (bucket_id = 'fotos-perfil' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "fotos-perfil: trocar a minha" on storage.objects for update to authenticated
using (bucket_id = 'fotos-perfil' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "fotos-perfil: apagar a minha" on storage.objects for delete to authenticated
using (bucket_id = 'fotos-perfil' and (split_part(name, '/', 1) = (select auth.uid())::text or public.eh_admin()));

-- A lista agora devolve a foto e inclui o administrador que se cadastrou como personal.
drop function if exists public.profissionais_habilitados();

create function public.profissionais_habilitados()
returns table (id uuid, nome text, registro text, cidade text, especialidade text, bio text, whatsapp text, foto_url text, liberado_desde timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.registro, p.cidade, p.especialidade, p.bio, p.whatsapp, p.foto_url, p.criado_em
  from public.perfis p
  where p.papel in ('profissional', 'admin')
    and p.situacao = 'liberado'
    and p.aparecer_na_lista
    and btrim(p.registro) <> ''
    and public.eh_liberado()
  order by p.nome
$$;

revoke execute on function public.profissionais_habilitados from public, anon;
grant execute on function public.profissionais_habilitados to authenticated;
