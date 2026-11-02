-- Treino acompanhado por chamada de vídeo.
-- O aluno compra chamadas do personal pelo chat (preço do FormaCerta). Cada
-- compra paga vira crédito. Quando o personal está "Disponível para vídeo", o
-- aluno toca em "Chamar por vídeo", o celular do personal toca e ele tem 2
-- minutos para atender; se não atender ou recusar, o crédito volta para o aluno.
-- O personal só oferece vídeo depois de aceitar o termo: 10% de comissão do
-- FormaCerta e uma taxa fixa por chamada realizada (R$ 2,69).
-- Pode rodar mais de uma vez.

-- Regras do vídeo (o administrador muda em Administração → Planos).
alter table public.config_cobranca add column if not exists taxa_video numeric(10, 2) not null default 2.69;
alter table public.config_cobranca drop constraint if exists config_cobranca_taxa_video_check;
alter table public.config_cobranca add constraint config_cobranca_taxa_video_check check (taxa_video between 0 and 50);
-- Versão do termo que o personal precisa ter aceitado. Mudou o texto, muda a versão.
alter table public.config_cobranca add column if not exists termo_video_versao text not null default '2026-11-02';

-- Catálogo: novo grupo "video" com minutos e quantas chamadas cada compra dá.
alter table public.catalogo_servicos drop constraint if exists catalogo_servicos_grupo_check;
alter table public.catalogo_servicos add constraint catalogo_servicos_grupo_check check (grupo in ('avaliacao', 'treino', 'video'));
alter table public.catalogo_servicos add column if not exists video_minutos integer;
alter table public.catalogo_servicos add column if not exists video_chamadas integer;

insert into public.catalogo_servicos (id, grupo, nome, descricao, preco_min, preco_max, preco_sugerido, mensal, ordem, video_minutos, video_chamadas) values
  ('video-15', 'video', 'Chamada rápida por vídeo (15 min)', 'Corrige um exercício ao vivo pela câmera.', 25, 50, 35, false, 11, 15, 1),
  ('video-30', 'video', 'Treino acompanhado por vídeo (30 min)', 'O personal acompanha seu treino ao vivo.', 50, 90, 60, false, 12, 30, 1),
  ('video-60', 'video', 'Aula completa por vídeo (60 min)', 'Aula inteira com o personal ao vivo.', 80, 150, 100, false, 13, 60, 1),
  ('video-pacote-4', 'video', 'Pacote 4 chamadas de vídeo (30 min)', 'Quatro treinos acompanhados de 30 minutos. Use quando quiser.', 180, 320, 200, false, 14, 30, 4)
on conflict (id) do nothing;

-- Termo aceito pelo personal.
create table if not exists public.termos_video (
  profissional_id uuid primary key references public.perfis (id) on delete cascade,
  versao text not null,
  aceito_em timestamptz not null default now()
);

alter table public.termos_video enable row level security;
drop policy if exists "ver termo de vídeo" on public.termos_video;
create policy "ver termo de vídeo" on public.termos_video for select to authenticated
using (profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.termos_video from authenticated, anon;

create or replace function public.aceitou_termo_video(profissional uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.termos_video t, public.config_cobranca c
    where t.profissional_id = profissional and t.versao = c.termo_video_versao
  )
$$;

create or replace function public.aceitar_termo_video() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v text;
begin
  if not (public.eh_profissional() or public.eh_admin()) then raise exception 'Só o personal aceita este termo'; end if;
  select termo_video_versao into v from public.config_cobranca;
  insert into public.termos_video (profissional_id, versao) values ((select auth.uid()), v)
  on conflict (profissional_id) do update set versao = excluded.versao, aceito_em = now();
end
$$;

-- Sem o termo aceito, o personal não liga serviço de vídeo.
create or replace function public.exigir_termo_video() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ativo and exists (select 1 from public.catalogo_servicos c where c.id = new.catalogo_id and c.grupo = 'video')
     and not public.aceitou_termo_video(new.profissional_id) then
    raise exception 'Aceite o termo da chamada de vídeo antes de ligar este serviço';
  end if;
  return new;
end
$$;

-- "zz" para rodar depois da trava de preço (os gatilhos rodam em ordem alfabética).
drop trigger if exists zz_exigir_termo_video on public.servicos;
create trigger zz_exigir_termo_video before insert or update on public.servicos
for each row execute function public.exigir_termo_video();

-- Personal disponível para vídeo até tal hora.
create table if not exists public.disponibilidade_video (
  profissional_id uuid primary key references public.perfis (id) on delete cascade,
  ate timestamptz not null
);

alter table public.disponibilidade_video enable row level security;
drop policy if exists "ver disponibilidade" on public.disponibilidade_video;
create policy "ver disponibilidade" on public.disponibilidade_video for select to authenticated using (true);
revoke insert, update, delete on public.disponibilidade_video from authenticated, anon;

-- Cada chamada: nasce como crédito quando o pagamento é confirmado.
create table if not exists public.chamadas_video (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid references public.pagamentos (id) on delete set null,
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  profissional_id uuid not null references public.perfis (id) on delete cascade,
  minutos integer not null check (minutos between 5 and 120),
  -- Valor desta chamada (no pacote, o total dividido pelas chamadas).
  valor numeric(10, 2) not null default 0,
  -- Parte do FormaCerta (comissão).
  comissao numeric(10, 2) not null default 0,
  -- Taxa por chamada realizada, gravada quando o personal atende.
  taxa numeric(10, 2) not null default 0,
  -- credito → chamando → em_andamento → feita. Recusou ou não atendeu: volta a credito.
  situacao text not null default 'credito' check (situacao in ('credito', 'chamando', 'em_andamento', 'feita', 'cancelada')),
  chamando_em timestamptz,
  inicio_em timestamptz,
  fim_em timestamptz,
  nota smallint check (nota between 1 and 5),
  -- Repasse feito ao personal (marcado pelo administrador).
  repassado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists chamadas_video_aluno_idx on public.chamadas_video (aluno_id, situacao);
create index if not exists chamadas_video_profissional_idx on public.chamadas_video (profissional_id, situacao);

alter table public.chamadas_video enable row level security;
drop policy if exists "ver chamadas" on public.chamadas_video;
create policy "ver chamadas" on public.chamadas_video for select to authenticated
using (aluno_id = (select auth.uid()) or profissional_id = (select auth.uid()) or public.eh_admin());
revoke insert, update, delete on public.chamadas_video from authenticated, anon;

-- Pagamento confirmado de um serviço de vídeo: cria os créditos do aluno.
create or replace function public.creditos_de_video() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c public.catalogo_servicos;
  n integer;
begin
  if new.situacao <> 'pago' or old.situacao = 'pago' or new.servico_id is null or new.recebedor_id is null then return new; end if;
  select cat.* into c from public.servicos s join public.catalogo_servicos cat on cat.id = s.catalogo_id
  where s.id = new.servico_id and cat.grupo = 'video';
  if c.id is null then return new; end if;
  -- Já criados (pagamento confirmado de novo depois de voltar a pendente).
  if exists (select 1 from public.chamadas_video where pagamento_id = new.id) then return new; end if;
  n := greatest(coalesce(c.video_chamadas, 1), 1);
  insert into public.chamadas_video (pagamento_id, aluno_id, profissional_id, minutos, valor, comissao)
  select new.id, new.pagador_id, new.recebedor_id, coalesce(c.video_minutos, 30), round(new.valor / n, 2), round(new.comissao / n, 2)
  from generate_series(1, n);
  return new;
end
$$;

drop trigger if exists creditos_de_video on public.pagamentos;
create trigger creditos_de_video after update of situacao on public.pagamentos
for each row execute function public.creditos_de_video();

-- Arruma chamadas paradas: não atendeu em 2 minutos volta a crédito; passou do
-- tempo (com 5 minutos de folga) fica como feita.
create or replace function public.arrumar_chamadas_video() returns void
language sql security definer set search_path = '' as $$
  update public.chamadas_video set situacao = 'credito', chamando_em = null
  where situacao = 'chamando' and chamando_em < now() - interval '2 minutes';
  update public.chamadas_video set situacao = 'feita', fim_em = inicio_em + make_interval(mins => minutos)
  where situacao = 'em_andamento' and inicio_em + make_interval(mins => minutos + 5) < now();
$$;

-- Personal liga (minutos > 0) ou desliga (0) o "Disponível para vídeo".
create or replace function public.ficar_disponivel_video(minutos integer) returns timestamptz
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
  insert into public.disponibilidade_video (profissional_id, ate) values (eu, ate_quando)
  on conflict (profissional_id) do update set ate = excluded.ate;
  return ate_quando;
end
$$;

-- Aluno chama o personal usando um crédito.
create or replace function public.chamar_video(profissional uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu uuid := (select auth.uid());
  id_chamada uuid;
begin
  perform public.arrumar_chamadas_video();
  if not exists (select 1 from public.disponibilidade_video d where d.profissional_id = profissional and d.ate > now()) then
    raise exception 'O personal não está disponível para vídeo agora';
  end if;
  if exists (select 1 from public.chamadas_video where profissional_id = profissional and situacao in ('chamando', 'em_andamento') and aluno_id <> eu) then
    raise exception 'O personal está em outra chamada. Tente de novo daqui a pouco';
  end if;
  -- Já está chamando: devolve a mesma.
  select id into id_chamada from public.chamadas_video
  where aluno_id = eu and profissional_id = profissional and situacao in ('chamando', 'em_andamento') limit 1;
  if id_chamada is not null then return id_chamada; end if;

  select id into id_chamada from public.chamadas_video
  where aluno_id = eu and profissional_id = profissional and situacao = 'credito'
  order by criado_em limit 1 for update skip locked;
  if id_chamada is null then raise exception 'Você não tem chamada de vídeo com este personal. Compre uma no chat'; end if;

  update public.chamadas_video set situacao = 'chamando', chamando_em = now() where id = id_chamada;
  return id_chamada;
end
$$;

-- Personal atende (true) ou recusa (false). Recusou: o crédito volta para o aluno.
create or replace function public.atender_video(chamada uuid, aceitar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ch public.chamadas_video;
  t numeric;
begin
  perform public.arrumar_chamadas_video();
  select * into ch from public.chamadas_video where id = chamada and profissional_id = (select auth.uid());
  if ch.id is null then raise exception 'Chamada não encontrada'; end if;
  if ch.situacao <> 'chamando' then raise exception 'O aluno não está mais chamando'; end if;
  if aceitar then
    select taxa_video into t from public.config_cobranca;
    update public.chamadas_video set situacao = 'em_andamento', inicio_em = now(), taxa = coalesce(t, 0) where id = ch.id;
  else
    update public.chamadas_video set situacao = 'credito', chamando_em = null where id = ch.id;
  end if;
end
$$;

-- Aluno desiste antes de o personal atender: o crédito continua.
create or replace function public.desistir_video(chamada uuid) returns void
language sql security definer set search_path = '' as $$
  update public.chamadas_video set situacao = 'credito', chamando_em = null
  where id = chamada and aluno_id = (select auth.uid()) and situacao = 'chamando'
$$;

-- Qualquer um dos dois encerra a chamada em andamento.
create or replace function public.encerrar_video(chamada uuid) returns void
language sql security definer set search_path = '' as $$
  update public.chamadas_video set situacao = 'feita', fim_em = now()
  where id = chamada and situacao = 'em_andamento' and (select auth.uid()) in (aluno_id, profissional_id)
$$;

-- Aluno dá a nota depois da chamada.
create or replace function public.avaliar_video(chamada uuid, nota integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if nota not between 1 and 5 then raise exception 'Nota de 1 a 5'; end if;
  update public.chamadas_video set nota = avaliar_video.nota
  where id = chamada and aluno_id = (select auth.uid()) and situacao = 'feita';
end
$$;

-- Administrador marca o repasse das chamadas feitas de um personal.
create or replace function public.admin_repassar_video(profissional uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode fazer isso'; end if;
  update public.chamadas_video set repassado_em = now()
  where profissional_id = profissional and situacao = 'feita' and repassado_em is null;
  get diagnostics n = row_count;
  return n;
end
$$;

-- As chamadas de quem está usando o app (aluno ou personal), com os nomes.
-- Arruma as paradas antes de responder.
create or replace function public.minhas_chamadas_video()
returns table (id uuid, aluno_id uuid, profissional_id uuid, aluno_nome text, profissional_nome text, profissional_foto text, minutos integer, valor numeric, comissao numeric, taxa numeric, situacao text, chamando_em timestamptz, inicio_em timestamptz, fim_em timestamptz, nota smallint, repassado_em timestamptz, criado_em timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.arrumar_chamadas_video();
  return query
  select ch.id, ch.aluno_id, ch.profissional_id,
    coalesce(nullif(a.nome, ''), split_part(a.email, '@', 1)),
    coalesce(nullif(p.nome, ''), split_part(p.email, '@', 1)),
    p.foto_url, ch.minutos, ch.valor, ch.comissao, ch.taxa, ch.situacao, ch.chamando_em, ch.inicio_em, ch.fim_em, ch.nota, ch.repassado_em, ch.criado_em
  from public.chamadas_video ch
  join public.perfis a on a.id = ch.aluno_id
  join public.perfis p on p.id = ch.profissional_id
  where ch.aluno_id = (select auth.uid()) or ch.profissional_id = (select auth.uid()) or public.eh_admin()
  order by ch.criado_em desc
  limit 500;
end
$$;

revoke execute on function public.aceitou_termo_video, public.aceitar_termo_video, public.arrumar_chamadas_video, public.ficar_disponivel_video,
  public.chamar_video, public.atender_video, public.desistir_video, public.encerrar_video, public.avaliar_video, public.admin_repassar_video,
  public.minhas_chamadas_video from public, anon;
grant execute on function public.aceitou_termo_video, public.aceitar_termo_video, public.arrumar_chamadas_video, public.ficar_disponivel_video,
  public.chamar_video, public.atender_video, public.desistir_video, public.encerrar_video, public.avaliar_video, public.admin_repassar_video,
  public.minhas_chamadas_video to authenticated;
revoke execute on function public.exigir_termo_video, public.creditos_de_video from public, anon, authenticated;
