-- Vitrine de fotos dos alunos: evolução (antes e depois) ou usando o FormaCerta.
-- Cada foto precisa da autorização de uso de imagem da pessoa (LGPD) e só
-- aparece para os outros depois que o administrador aprova.

create table public.vitrine (
  id uuid primary key default gen_random_uuid(),
  -- Quem enviou (o próprio aluno, o profissional ou o administrador).
  enviado_por uuid not null references public.perfis (id) on delete cascade,
  -- Aluno da foto, quando tem conta no app.
  aluno_id uuid references public.perfis (id) on delete cascade,
  -- Nome que aparece na vitrine (pode ser só o primeiro nome).
  nome text not null check (char_length(nome) between 1 and 60),
  legenda text not null default '' check (char_length(legenda) <= 200),
  tipo text not null check (tipo in ('evolucao', 'uso')),
  -- Caminhos no Storage (pasta vitrine). "antes" só na foto de evolução.
  foto text not null,
  foto_antes text,
  situacao text not null default 'pendente' check (situacao in ('pendente', 'aprovada', 'recusada')),
  -- Quando a pessoa da foto autorizou o uso da imagem.
  autorizacao_em timestamptz not null,
  criado_em timestamptz not null default now(),
  moderado_em timestamptz
);

create index vitrine_situacao_idx on public.vitrine (situacao, criado_em desc);
create index vitrine_enviado_por_idx on public.vitrine (enviado_por);
create index vitrine_aluno_idx on public.vitrine (aluno_id);

alter table public.vitrine enable row level security;

-- Fotos aprovadas: qualquer pessoa liberada no app vê. As outras: só quem
-- enviou, o aluno da foto e o administrador.
create policy "ver vitrine" on public.vitrine for select to authenticated
using (
  (situacao = 'aprovada' and public.eh_liberado())
  or enviado_por = (select auth.uid())
  or aluno_id = (select auth.uid())
  or public.eh_admin()
);

-- Toda foto nova entra como pendente, com as imagens na pasta de quem enviou.
create policy "enviar para a vitrine" on public.vitrine for insert to authenticated
with check (
  enviado_por = (select auth.uid())
  and public.eh_liberado()
  and situacao = 'pendente'
  and moderado_em is null
  and split_part(foto, '/', 1) = (select auth.uid())::text
  and (foto_antes is null or split_part(foto_antes, '/', 1) = (select auth.uid())::text)
  and (aluno_id is null or aluno_id = (select auth.uid()) or public.meu_aluno(aluno_id) or public.eh_admin())
);

-- Quem enviou, o aluno da foto e o administrador podem tirar da vitrine.
create policy "apagar da vitrine" on public.vitrine for delete to authenticated
using (enviado_por = (select auth.uid()) or aluno_id = (select auth.uid()) or public.eh_admin());

revoke update on public.vitrine from authenticated, anon;

-- Só o administrador aprova ou recusa.
create function public.admin_moderar_foto(id_foto uuid, nova text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  if nova not in ('aprovada', 'recusada', 'pendente') then raise exception 'Situação inválida'; end if;
  update public.vitrine set situacao = nova, moderado_em = now() where id = id_foto;
end
$$;

revoke execute on function public.admin_moderar_foto from public, anon;
grant execute on function public.admin_moderar_foto to authenticated;

-- Pasta das fotos. Privada: cada imagem só abre para quem pode ver a foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vitrine', 'vitrine', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

create function public.pode_ver_foto(caminho text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(caminho, '/', 1) = (select auth.uid())::text
    or public.eh_admin()
    or exists (
      select 1 from public.vitrine v
      where (v.foto = caminho or v.foto_antes = caminho)
        and ((v.situacao = 'aprovada' and public.eh_liberado()) or v.aluno_id = (select auth.uid()))
    )
$$;

revoke execute on function public.pode_ver_foto from public, anon;
grant execute on function public.pode_ver_foto to authenticated;

create policy "vitrine: ver fotos" on storage.objects for select to authenticated
using (bucket_id = 'vitrine' and public.pode_ver_foto(name));

create policy "vitrine: enviar fotos" on storage.objects for insert to authenticated
with check (bucket_id = 'vitrine' and split_part(name, '/', 1) = (select auth.uid())::text and public.eh_liberado());

-- O aluno da foto também apaga a imagem, mesmo que o personal tenha enviado.
create function public.pode_apagar_foto(caminho text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(caminho, '/', 1) = (select auth.uid())::text
    or public.eh_admin()
    or exists (
      select 1 from public.vitrine v
      where (v.foto = caminho or v.foto_antes = caminho) and v.aluno_id = (select auth.uid())
    )
$$;

revoke execute on function public.pode_apagar_foto from public, anon;
grant execute on function public.pode_apagar_foto to authenticated;

create policy "vitrine: apagar fotos" on storage.objects for delete to authenticated
using (bucket_id = 'vitrine' and public.pode_apagar_foto(name));
