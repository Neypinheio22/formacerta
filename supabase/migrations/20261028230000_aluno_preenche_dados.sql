-- O aluno preenche os próprios dados (altura, nascimento, objetivo, saúde) e
-- anota as medidas dele em casa. As medidas já podiam ser guardadas pelo aluno
-- na própria ficha (política "enviar resultados"); faltava a ficha em si.

-- Aluno que entrou sozinho, sem personal, também tem ficha: fica sem dono até
-- ele escolher um personal.
alter table public.fichas alter column profissional_id drop not null;

-- Quando o próprio aluno mudou os dados pessoais (o personal vê um aviso).
alter table public.fichas add column if not exists aluno_atualizou_em timestamptz;

-- O aluno não edita a ficha direto (observações e meta são do personal):
-- só estes campos, por esta função. Cria a ficha se ainda não existir.
create or replace function public.salvar_meus_dados(
  p_nascimento date,
  p_sexo text,
  p_altura smallint,
  p_telefone text,
  p_objetivo text,
  p_saude text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eu public.perfis;
  f uuid;
begin
  select * into eu from public.perfis where id = (select auth.uid());
  if eu.id is null or eu.papel <> 'aluno' or eu.situacao <> 'liberado' then
    raise exception 'Só o aluno, com a conta liberada, preenche os próprios dados.';
  end if;

  select id into f from public.fichas where aluno_id = eu.id;
  if f is null then
    insert into public.fichas (profissional_id, aluno_id, nome, nascimento, sexo, altura_cm, telefone, objetivo, saude, consentimento_em, aluno_atualizou_em)
    values (eu.profissional_id, eu.id, coalesce(nullif(btrim(eu.nome), ''), eu.email), p_nascimento, p_sexo, p_altura,
            coalesce(p_telefone, ''), coalesce(p_objetivo, ''), coalesce(p_saude, ''), now(), now())
    returning id into f;
    update public.resultados set ficha_id = f where aluno_id = eu.id and ficha_id is null;
  else
    update public.fichas set
      nascimento = p_nascimento,
      sexo = p_sexo,
      altura_cm = p_altura,
      telefone = coalesce(p_telefone, ''),
      objetivo = coalesce(p_objetivo, ''),
      saude = coalesce(p_saude, ''),
      consentimento_em = coalesce(consentimento_em, now()),
      aluno_atualizou_em = now(),
      atualizado_em = now()
    where id = f;
  end if;
  return f;
end
$$;

revoke execute on function public.salvar_meus_dados from public, anon;
grant execute on function public.salvar_meus_dados to authenticated;

-- Quando o aluno escolhe um personal, a ficha sem dono passa a ser dele.
create or replace function public.ficha_do_novo_aluno() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  f uuid;
begin
  if new.papel <> 'aluno' or new.profissional_id is null then return new; end if;
  if exists (select 1 from public.fichas where aluno_id = new.id) then
    update public.fichas set profissional_id = new.profissional_id, atualizado_em = now()
    where aluno_id = new.id and profissional_id is null;
    return new;
  end if;
  select id into f from public.fichas
  where profissional_id = new.profissional_id and aluno_id is null
    and lower(btrim(nome)) = lower(btrim(new.nome)) and btrim(new.nome) <> ''
  order by criado_em desc limit 1;
  if f is null then
    insert into public.fichas (profissional_id, aluno_id, nome)
    values (new.profissional_id, new.id, coalesce(nullif(btrim(new.nome), ''), new.email))
    returning id into f;
  else
    update public.fichas set aluno_id = new.id, atualizado_em = now() where id = f;
    update public.resultados set aluno_id = new.id where ficha_id = f and aluno_id is null;
  end if;
  update public.resultados set ficha_id = f where aluno_id = new.id and ficha_id is null;
  return new;
end
$$;

revoke execute on function public.ficha_do_novo_aluno from public, anon, authenticated;
