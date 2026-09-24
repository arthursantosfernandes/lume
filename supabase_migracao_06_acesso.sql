-- =====================================================================
-- Lumê — Migração 06: novo acesso (v9)
--   1. Cadastro completo do profissional (CPF, nascimento)
--   2. Cadastro fechado: só e-mails liberados + lista de espera
--   3. Login com CPF ou e-mail (com trava contra tentativas)
--   4. Verificação por código no e-mail (1ª vez em cada aparelho)
--   5. Tela de bloqueio: PIN e tempo configurável por clínica
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dados completos do profissional
-- ---------------------------------------------------------------------
alter table public.professionals
  add column if not exists cpf             text,
  add column if not exists data_nascimento date;

create unique index if not exists professionals_cpf_unico on public.professionals (cpf) where cpf is not null;

alter table public.professionals drop constraint if exists professionals_cpf_valido;
alter table public.professionals add constraint professionals_cpf_valido
  check (cpf is null or public.valida_cpf(cpf));

-- CPF do profissional: pode ser preenchido uma vez, depois não muda
create or replace function public.proteger_professional()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.clinic_id is distinct from old.clinic_id or new.user_id is distinct from old.user_id
    or new.papel     is distinct from old.papel     or new.ativo   is distinct from old.ativo
    or (old.cpf is not null and new.cpf is distinct from old.cpf)) then
    raise exception 'Alteração não permitida.';
  end if;
  if new.cpf is not null then
    new.cpf := regexp_replace(new.cpf, '\D', '', 'g');
  end if;
  return new;
end $$;

-- Tempo até a tela de bloqueio (minutos), escolhido pela clínica
alter table public.clinics
  add column if not exists bloqueio_minutos int not null default 15;
alter table public.clinics drop constraint if exists clinics_bloqueio_valido;
alter table public.clinics add constraint clinics_bloqueio_valido
  check (bloqueio_minutos in (5, 15, 30, 60));

-- ---------------------------------------------------------------------
-- 2. Cadastro fechado + lista de espera
-- ---------------------------------------------------------------------
create table if not exists public.acesso_liberado (
  email      text primary key,
  observacao text,
  created_at timestamptz not null default now()
);
alter table public.acesso_liberado enable row level security;  -- sem regras: ninguém lê pelo app

insert into public.acesso_liberado (email, observacao) values
  ('arthurdudu994@gmail.com', 'Arthur'),
  ('suelidomingos83@gmail.com', 'Sueli')
on conflict (email) do nothing;

create table if not exists public.lista_espera (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  email      text not null unique,
  telefone   text,
  profissao  text,
  cidade     text,
  created_at timestamptz not null default now()
);
alter table public.lista_espera enable row level security;  -- sem regras: só você vê, pelo Supabase

create or replace function public.cadastro_liberado(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from acesso_liberado where email = lower(trim(p_email)))
$$;

create or replace function public.entrar_lista_espera(
  p_nome text, p_email text, p_telefone text, p_profissao text, p_cidade text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_nome, ''))) < 3 or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Preencha nome e e-mail válidos.';
  end if;
  insert into lista_espera (nome, email, telefone, profissao, cidade)
  values (left(trim(p_nome), 120), lower(trim(p_email)), left(p_telefone, 30), left(p_profissao, 60), left(p_cidade, 80))
  on conflict (email) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- 3. Login com CPF: devolve o e-mail SÓ se a senha estiver certa
--    (ninguém descobre e-mail de ninguém só com o CPF)
--    5 erros seguidos -> CPF travado por 15 minutos
-- ---------------------------------------------------------------------
create table if not exists public.tentativas_login (
  cpf           text primary key,
  falhas        int not null default 0,
  bloqueado_ate timestamptz
);
alter table public.tentativas_login enable row level security;

create or replace function public.email_para_login(p_cpf text, p_senha text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cpf   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_t     tentativas_login;
  v_email text;
  v_hash  text;
begin
  if length(v_cpf) <> 11 then return null; end if;

  select * into v_t from tentativas_login where cpf = v_cpf;
  if v_t.bloqueado_ate is not null and v_t.bloqueado_ate > now() then
    return 'BLOQUEADO';
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
    from professionals p join auth.users u on u.id = p.user_id
   where p.cpf = v_cpf and p.ativo
   limit 1;

  if v_hash is not null and v_hash = crypt(coalesce(p_senha, ''), v_hash) then
    delete from tentativas_login where cpf = v_cpf;
    return v_email;
  end if;

  insert into tentativas_login (cpf, falhas) values (v_cpf, 1)
  on conflict (cpf) do update
    set falhas = case when tentativas_login.bloqueado_ate is not null then 1 else tentativas_login.falhas + 1 end,
        bloqueado_ate = null;
  update tentativas_login set bloqueado_ate = now() + interval '15 minutes'
   where cpf = v_cpf and falhas >= 5;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4. Verificação por código no e-mail
--    Passo A: entrou com a senha      -> registrar_senha_ok()
--    Passo B: digitou o código do e-mail -> confirmar_sessao_email()
--    Só marca o aparelho como verificado se os DOIS passos aconteceram
--    em até 15 minutos. Vale 30 dias ou até sair.
-- ---------------------------------------------------------------------
create table if not exists public.senha_confirmada (
  user_id uuid primary key references auth.users(id) on delete cascade,
  em      timestamptz not null default now()
);
alter table public.senha_confirmada enable row level security;

create table if not exists public.sessoes_verificadas (
  session_id    uuid primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  verificado_em timestamptz not null default now()
);
alter table public.sessoes_verificadas enable row level security;

-- A sessão atual entrou por este método nos últimos X minutos?
create or replace function public.entrou_por(p_metodos text[], p_minutos int)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' = any (p_metodos)
      and to_timestamp((a ->> 'timestamp')::double precision) > now() - make_interval(mins => p_minutos)
  )
$$;

create or replace function public.registrar_senha_ok()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.entrou_por(array['password', 'email/signup'], 15) then
    return false;
  end if;
  insert into senha_confirmada (user_id, em) values (auth.uid(), now())
  on conflict (user_id) do update set em = now();
  return true;
end $$;

create or replace function public.confirmar_sessao_email()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_sessao uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null or v_sessao is null then return false; end if;
  if not public.entrou_por(array['otp', 'magiclink'], 15) then return false; end if;
  if not exists (select 1 from senha_confirmada
                 where user_id = auth.uid() and em > now() - interval '15 minutes') then
    return false;
  end if;
  delete from senha_confirmada where user_id = auth.uid();  -- uso único
  insert into sessoes_verificadas (session_id, user_id) values (v_sessao, auth.uid())
  on conflict (session_id) do update set verificado_em = now();
  return true;
end $$;

-- Sessão confiável = código do app autenticador (aal2) OU código do e-mail
create or replace function public.sessao_mfa_ok()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or exists (
        select 1 from public.sessoes_verificadas s
        where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
          and s.user_id = auth.uid()
          and s.verificado_em > now() - interval '30 days')
$$;

-- sessao_mfa_ok lê sessoes_verificadas; precisa rodar como dono
alter function public.sessao_mfa_ok() security definer;

-- ---------------------------------------------------------------------
-- 5. Tela de bloqueio: PIN (guardado criptografado, fora do alcance do app)
-- ---------------------------------------------------------------------
create table if not exists public.pins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  falhas   int not null default 0
);
alter table public.pins enable row level security;

create or replace function public.tem_pin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pins where user_id = auth.uid())
$$;

create or replace function public.definir_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.sessao_mfa_ok() then raise exception 'Sessão não verificada.'; end if;
  if p_pin !~ '^\d{4,6}$' then raise exception 'O PIN deve ter de 4 a 6 números.'; end if;
  insert into pins (user_id, pin_hash) values (auth.uid(), crypt(p_pin, gen_salt('bf')))
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, falhas = 0;
end $$;

-- Retorna 'ok', 'errado' ou 'sair' (5 erros -> precisa entrar de novo)
create or replace function public.verificar_pin(p_pin text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v pins;
begin
  select * into v from pins where user_id = auth.uid();
  if not found then return 'sair'; end if;
  if v.pin_hash = crypt(coalesce(p_pin, ''), v.pin_hash) then
    update pins set falhas = 0 where user_id = auth.uid();
    return 'ok';
  end if;
  update pins set falhas = falhas + 1 where user_id = auth.uid();
  if v.falhas + 1 >= 5 then
    update pins set falhas = 0 where user_id = auth.uid();
    delete from sessoes_verificadas where session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
    return 'sair';
  end if;
  return 'errado';
end $$;

-- Desbloquear com a senha (sem criar nova sessão)
create or replace function public.verificar_senha(p_senha text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  return v_hash is not null and v_hash = crypt(coalesce(p_senha, ''), v_hash);
end $$;

-- ---------------------------------------------------------------------
-- 6. Cadastro completo (substitui onboard_professional)
-- ---------------------------------------------------------------------
create or replace function public.cadastrar_profissional(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid;
  v_prof   uuid;
  v_cpf    text := regexp_replace(coalesce(p ->> 'cpf', ''), '\D', '', 'g');
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  if not public.sessao_mfa_ok() then raise exception 'Confirme o código de verificação antes de continuar.'; end if;
  if not public.cadastro_liberado(v_email) then
    raise exception 'O Lumê ainda está em fase de testes. Entre na lista de espera.';
  end if;
  if exists (select 1 from professionals where user_id = auth.uid()) then
    raise exception 'Profissional já cadastrado.';
  end if;
  if length(trim(coalesce(p ->> 'nome', ''))) < 5 then raise exception 'Informe o nome completo.'; end if;
  if not public.valida_cpf(v_cpf) then raise exception 'CPF inválido. Confira os números.'; end if;
  if exists (select 1 from professionals where cpf = v_cpf) then
    raise exception 'Este CPF já está cadastrado.';
  end if;
  if length(trim(coalesce(p ->> 'clinica_nome', ''))) < 2 then raise exception 'Informe o nome da clínica.'; end if;

  insert into clinics (nome, documento, telefone, cep, endereco, numero, complemento, bairro, cidade, uf)
  values (trim(p ->> 'clinica_nome'), nullif(p ->> 'clinica_cnpj', ''), nullif(p ->> 'clinica_telefone', ''),
          nullif(p ->> 'clinica_cep', ''), nullif(p ->> 'clinica_endereco', ''), nullif(p ->> 'clinica_numero', ''),
          nullif(p ->> 'clinica_complemento', ''), nullif(p ->> 'clinica_bairro', ''),
          nullif(p ->> 'clinica_cidade', ''), nullif(p ->> 'clinica_uf', ''))
  returning id into v_clinic;

  insert into professionals (user_id, clinic_id, nome, papel, telefone, cpf, data_nascimento)
  values (auth.uid(), v_clinic, trim(p ->> 'nome'), 'dona', nullif(p ->> 'telefone', ''), v_cpf,
          nullif(p ->> 'data_nascimento', '')::date)
  returning id into v_prof;

  insert into professional_credentials
    (clinic_id, professional_id, profissao, conselho, numero_registro, uf, especialidade, principal)
  values (v_clinic, v_prof, p ->> 'profissao', nullif(p ->> 'conselho', ''), nullif(p ->> 'numero_registro', ''),
          nullif(p ->> 'registro_uf', ''), nullif(p ->> 'especialidade', ''), true);

  return v_clinic;
end $$;

-- O cadastro antigo não pode mais ser usado (não confere a lista de liberados)
revoke execute on function public.onboard_professional(text, text, text, text, text, char, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.cadastro_liberado(text)                         from public;
revoke execute on function public.entrar_lista_espera(text, text, text, text, text) from public;
revoke execute on function public.email_para_login(text, text)                     from public;
revoke execute on function public.registrar_senha_ok()                             from public, anon;
revoke execute on function public.confirmar_sessao_email()                         from public, anon;
revoke execute on function public.tem_pin()                                        from public, anon;
revoke execute on function public.definir_pin(text)                                from public, anon;
revoke execute on function public.verificar_pin(text)                              from public, anon;
revoke execute on function public.verificar_senha(text)                            from public, anon;
revoke execute on function public.cadastrar_profissional(jsonb)                    from public, anon;

grant execute on function public.cadastro_liberado(text)                         to anon, authenticated;
grant execute on function public.entrar_lista_espera(text, text, text, text, text) to anon, authenticated;
grant execute on function public.email_para_login(text, text)                     to anon, authenticated;
grant execute on function public.registrar_senha_ok()                             to authenticated;
grant execute on function public.confirmar_sessao_email()                         to authenticated;
grant execute on function public.tem_pin()                                        to authenticated;
grant execute on function public.definir_pin(text)                                to authenticated;
grant execute on function public.verificar_pin(text)                              to authenticated;
grant execute on function public.verificar_senha(text)                            to authenticated;
grant execute on function public.cadastrar_profissional(jsonb)                    to authenticated;
