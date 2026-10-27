-- Lista de profissionais habilitados para o aluno encontrar um personal:
-- nome, registro (CREF), cidade, especialidades, biografia curta e WhatsApp. Só aparece quem foi liberado pelo
-- administrador, tem registro preenchido e escolheu aparecer na lista (LGPD:
-- o telefone só é mostrado com a autorização do próprio profissional).

alter table public.perfis
  add column if not exists whatsapp text not null default '' check (char_length(whatsapp) <= 20),
  add column if not exists cidade text not null default '' check (char_length(cidade) <= 60),
  add column if not exists especialidade text not null default '' check (char_length(especialidade) <= 200),
  add column if not exists bio text not null default '' check (char_length(bio) <= 600),
  add column if not exists aparecer_na_lista boolean not null default false;

grant update (whatsapp, cidade, especialidade, bio, aparecer_na_lista) on public.perfis to authenticated;

-- Pela função, o aluno vê só estes campos públicos (nunca e-mail nem os alunos do personal).
create or replace function public.profissionais_habilitados()
returns table (id uuid, nome text, registro text, cidade text, especialidade text, bio text, whatsapp text, liberado_desde timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.registro, p.cidade, p.especialidade, p.bio, p.whatsapp, p.criado_em
  from public.perfis p
  where p.papel = 'profissional'
    and p.situacao = 'liberado'
    and p.aparecer_na_lista
    and btrim(p.registro) <> ''
    and public.eh_liberado()
  order by p.nome
$$;

revoke execute on function public.profissionais_habilitados from public, anon;
grant execute on function public.profissionais_habilitados to authenticated;
