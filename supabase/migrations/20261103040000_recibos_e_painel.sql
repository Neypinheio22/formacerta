-- Itens 15 a 17 da auditoria (03/11/2026):
-- 15. Volta do cartão: o app mostra "Pagamento confirmado" (só muda a função mercado-pago).
-- 16. Recibo: dados do recibo para o PDF e e-mail automático quando o pagamento é confirmado.
-- 17. Painel de vendas do administrador.
-- Pode rodar mais de uma vez.

create extension if not exists pg_net with schema extensions;

alter table public.pagamentos add column if not exists recibo_em timestamptz;

-- Dados do recibo: quem pagou, quem recebeu, valor, forma e data. Só para quem pagou,
-- para o personal que recebeu e para o administrador.
create or replace function public.recibo_pagamento(pagamento uuid)
returns table (id uuid, numero text, tipo text, descricao text, valor numeric, forma text, pago_em timestamptz, gateway_id text,
  pagador_nome text, pagador_email text, recebedor_nome text)
language sql stable security definer set search_path = '' as $$
  select pg.id, 'FC-' || upper(left(replace(pg.id::text, '-', ''), 8)), pg.tipo, pg.descricao, pg.valor, pg.forma, pg.pago_em, pg.gateway_id,
    coalesce(nullif(a.nome, ''), split_part(a.email, '@', 1)), a.email,
    case when r.id is null then null else coalesce(nullif(r.nome, ''), split_part(r.email, '@', 1)) end
  from public.pagamentos pg
  join public.perfis a on a.id = pg.pagador_id
  left join public.perfis r on r.id = pg.recebedor_id
  where pg.id = recibo_pagamento.pagamento and pg.situacao = 'pago'
    and ((select auth.uid()) in (pg.pagador_id, pg.recebedor_id) or public.eh_admin())
$$;

-- Pagamento confirmado: manda o recibo por e-mail (função enviar-recibo, uma vez só).
create or replace function public.recibo_por_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.situacao = 'pago' and old.situacao is distinct from 'pago' and new.valor > 0 then
    begin
      perform net.http_post(
        url := 'https://zyxftkspkerttjqvepbg.supabase.co/functions/v1/enviar-recibo',
        body := jsonb_build_object('pagamento', new.id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    exception when others then
      raise warning 'recibo_por_email: %', sqlerrm;
    end;
  end if;
  return new;
end
$$;

drop trigger if exists recibo_por_email on public.pagamentos;
create trigger recibo_por_email after update of situacao on public.pagamentos
for each row execute function public.recibo_por_email();

-- Painel de vendas de um mês (horário de Brasília): quanto entrou, quanto é do FormaCerta,
-- quanto falta repassar, quantos assinantes ativos, os últimos 6 meses e os personais que mais venderam.
create or replace function public.admin_painel_vendas(mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m date := date_trunc('month', coalesce(mes, (now() at time zone 'America/Sao_Paulo')::date))::date;
  ini timestamptz := m::timestamp at time zone 'America/Sao_Paulo';
  fim timestamptz := (m + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';
  r jsonb;
begin
  if not public.eh_admin() then raise exception 'Só o administrador pode ver o painel'; end if;

  with pagos as (
    select pg.*,
      case when pg.tipo = 'assinatura' then 'assinatura'
           when exists (select 1 from public.chamadas_video c where c.pagamento_id = pg.id) then 'video'
           else 'servico' end as grupo
    from public.pagamentos pg
    where pg.situacao = 'pago' and pg.pago_em >= ini and pg.pago_em < fim
  ), grupos as (
    select grupo, count(*) as qtd, coalesce(sum(valor), 0) as valor, coalesce(sum(comissao), 0) as comissao from pagos group by grupo
  ), taxas as (
    select count(*) as qtd, coalesce(sum(taxa), 0) as valor from public.chamadas_video
    where situacao = 'feita' and inicio_em >= ini and inicio_em < fim
  ), aberto as (
    select coalesce(sum(pg.valor - pg.comissao), 0) as v from public.pagamentos pg
    where pg.tipo = 'avaliacao' and pg.situacao = 'pago' and pg.recebedor_id is not null and pg.repassado_em is null
      and not exists (select 1 from public.chamadas_video c where c.pagamento_id = pg.id)
    union all
    select coalesce(sum(c.valor - c.comissao - c.taxa), 0) from public.chamadas_video c where c.situacao = 'feita' and c.repassado_em is null
  ), validas as (
    select a.*, p.publico, p.preco_mensal from public.assinaturas a join public.planos p on p.id = a.plano_id
    where a.situacao in ('ativa', 'teste') and (a.valido_ate is null or a.valido_ate > now())
  ), meses as (
    select to_char(d, 'YYYY-MM') as rotulo,
      (select coalesce(sum(pg.valor), 0) from public.pagamentos pg
        where pg.situacao = 'pago' and pg.pago_em >= (d::timestamp at time zone 'America/Sao_Paulo') and pg.pago_em < ((d + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')) as bruto,
      (select coalesce(sum(case when pg.tipo = 'assinatura' then pg.valor else pg.comissao end), 0) from public.pagamentos pg
        where pg.situacao = 'pago' and pg.pago_em >= (d::timestamp at time zone 'America/Sao_Paulo') and pg.pago_em < ((d + interval '1 month')::timestamp at time zone 'America/Sao_Paulo'))
      + (select coalesce(sum(c.taxa), 0) from public.chamadas_video c
        where c.situacao = 'feita' and c.inicio_em >= (d::timestamp at time zone 'America/Sao_Paulo') and c.inicio_em < ((d + interval '1 month')::timestamp at time zone 'America/Sao_Paulo')) as receita
    from generate_series(m - interval '5 months', m, interval '1 month') d
  ), top as (
    select coalesce(nullif(p.nome, ''), split_part(p.email, '@', 1)) as nome, count(*) as vendas, sum(pg.valor) as valor
    from pagos pg join public.perfis p on p.id = pg.recebedor_id
    where pg.recebedor_id is not null
    group by p.id, p.nome, p.email order by sum(pg.valor) desc limit 5
  )
  select jsonb_build_object(
    'mes', to_char(m, 'YYYY-MM'),
    'bruto', (select coalesce(sum(valor), 0) from pagos),
    'vendas', (select count(*) from pagos),
    'assinaturas', jsonb_build_object('qtd', coalesce((select qtd from grupos where grupo = 'assinatura'), 0), 'valor', coalesce((select valor from grupos where grupo = 'assinatura'), 0)),
    'servicos', jsonb_build_object('qtd', coalesce((select qtd from grupos where grupo = 'servico'), 0), 'valor', coalesce((select valor from grupos where grupo = 'servico'), 0), 'comissao', coalesce((select comissao from grupos where grupo = 'servico'), 0)),
    'video', jsonb_build_object('qtd', coalesce((select qtd from grupos where grupo = 'video'), 0), 'valor', coalesce((select valor from grupos where grupo = 'video'), 0), 'comissao', coalesce((select comissao from grupos where grupo = 'video'), 0),
      'chamadas', (select qtd from taxas), 'taxas', (select valor from taxas)),
    'receita', coalesce((select valor from grupos where grupo = 'assinatura'), 0)
      + coalesce((select sum(comissao) from grupos where grupo <> 'assinatura'), 0) + (select valor from taxas),
    'a_repassar', (select coalesce(sum(v), 0) from aberto),
    'pendentes', jsonb_build_object('qtd', (select count(*) from public.pagamentos where situacao = 'pendente' and criado_em >= ini and criado_em < fim),
      'valor', (select coalesce(sum(valor), 0) from public.pagamentos where situacao = 'pendente' and criado_em >= ini and criado_em < fim)),
    'ativos', jsonb_build_object(
      'aluno_pro', (select count(*) from validas where publico = 'aluno' and situacao = 'ativa' and preco_mensal > 0 and not cortesia),
      'personais', (select count(*) from validas where publico = 'profissional' and situacao = 'ativa' and preco_mensal > 0 and not cortesia),
      'testes', (select count(*) from validas where situacao = 'teste'),
      'cortesias', (select count(*) from validas where cortesia)),
    'meses', (select jsonb_agg(jsonb_build_object('mes', x.rotulo, 'bruto', x.bruto, 'receita', x.receita) order by x.rotulo) from meses x),
    'top', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'vendas', vendas, 'valor', valor)) from top), '[]'::jsonb)
  ) into r;
  return r;
end
$$;

revoke execute on function public.recibo_pagamento(uuid), public.admin_painel_vendas(date) from public, anon;
grant execute on function public.recibo_pagamento(uuid), public.admin_painel_vendas(date) to authenticated;
revoke execute on function public.recibo_por_email() from public, anon, authenticated;
