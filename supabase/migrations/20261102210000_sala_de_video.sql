-- Sala de treino por vídeo: o personal escolhe quantos alunos atende ao mesmo
-- tempo (de 1 a 5) quando fica disponível. Cada aluno continua pagando a sua
-- chamada e cada chamada atendida tem a taxa do termo.
-- Pode rodar mais de uma vez.

alter table public.disponibilidade_video add column if not exists vagas integer not null default 1;
alter table public.disponibilidade_video drop constraint if exists disponibilidade_video_vagas_check;
alter table public.disponibilidade_video add constraint disponibilidade_video_vagas_check check (vagas between 1 and 5);

-- Agora com o número de vagas (alunos ao mesmo tempo).
drop function if exists public.ficar_disponivel_video(integer);
create or replace function public.ficar_disponivel_video(minutos integer, vagas integer default 1) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  ate_quando timestamptz;
begin
  if coalesce(minutos, 0) <= 0 then
    delete from public.disponibilidade_video where profissional_id = eu;
    return null;
  end if;
  if not (public.eh_profissional() or public.eh_admin()) then raise exception 'Só o personal fica disponível'; end if;
  if not public.aceitou_termo_video(eu) then raise exception 'Aceite o termo da chamada de vídeo primeiro'; end if;
  if not exists (
    select 1 from public.servicos s join public.catalogo_servicos c on c.id = s.catalogo_id
    where s.profissional_id = eu and s.ativo and c.grupo = 'video'
  ) then
    raise exception 'Ligue pelo menos uma chamada de vídeo em Meus serviços';
  end if;
  ate_quando := now() + make_interval(mins => least(minutos, 720));
  insert into public.disponibilidade_video (profissional_id, ate, vagas)
  values (eu, ate_quando, least(greatest(coalesce(ficar_disponivel_video.vagas, 1), 1), 5))
  on conflict (profissional_id) do update set ate = excluded.ate, vagas = excluded.vagas;
  return ate_quando;
end
$$;

-- O aluno entra se ainda houver vaga na sala do personal.
create or replace function public.chamar_video(profissional uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  id_chamada uuid;
  limite integer;
begin
  perform public.arrumar_chamadas_video();
  select d.vagas into limite from public.disponibilidade_video d where d.profissional_id = profissional and d.ate > now();
  if limite is null then
    raise exception 'O personal não está disponível para vídeo agora';
  end if;
  -- Já está chamando ou na sala: devolve a mesma.
  select id into id_chamada from public.chamadas_video
  where aluno_id = eu and profissional_id = profissional and situacao in ('chamando', 'em_andamento') limit 1;
  if id_chamada is not null then return id_chamada; end if;

  if (select count(*) from public.chamadas_video where profissional_id = profissional and situacao in ('chamando', 'em_andamento')) >= limite then
    raise exception 'A sala do personal está cheia agora. Tente de novo daqui a pouco';
  end if;

  select id into id_chamada from public.chamadas_video
  where aluno_id = eu and profissional_id = profissional and situacao = 'credito'
  order by criado_em limit 1 for update skip locked;
  if id_chamada is null then raise exception 'Você não tem chamada de vídeo com este personal. Compre uma no chat'; end if;

  update public.chamadas_video set situacao = 'chamando', chamando_em = now() where id = id_chamada;
  return id_chamada;
end
$$;

revoke execute on function public.ficar_disponivel_video(integer, integer), public.chamar_video(uuid) from public, anon;
grant execute on function public.ficar_disponivel_video(integer, integer), public.chamar_video(uuid) to authenticated;
