-- =====================================================================
-- Lumê — Migração 07: ajustes de segurança da v9 (revisão)
--   1. Código do e-mail só vale NO MESMO aparelho que digitou a senha
--   2. Trava de tentativas do login por CPF sem brecha de "vários ao mesmo tempo"
--   3. Desbloqueio (PIN/senha): no máximo 5 erros, depois precisa entrar de novo
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vínculo senha -> código pelo aparelho (nonce guardado só nele)
-- ---------------------------------------------------------------------
alter table public.senha_confirmada add column if not exists nonce_hash text;

drop function if exists public.registrar_senha_ok();
create function public.registrar_senha_ok()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_nonce text;
begin
  if auth.uid() is null or not public.entrou_por(array['password', 'email/signup'], 15) then
    return null;
  end if;
  v_nonce := encode(gen_random_bytes(24), 'hex');
  insert into senha_confirmada (user_id, em, nonce_hash)
  values (auth.uid(), now(), encode(digest(v_nonce, 'sha256'), 'hex'))
  on conflict (user_id) do update set em = now(), nonce_hash = excluded.nonce_hash;
  return v_nonce;
end $$;

drop function if exists public.confirmar_sessao_email();
drop function if exists public.confirmar_sessao_email(text);
create function public.confirmar_sessao_email(p_nonce text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_sessao uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if auth.uid() is null or v_sessao is null or coalesce(p_nonce, '') = '' then return false; end if;
  if not public.entrou_por(array['otp', 'magiclink'], 15) then return false; end if;
  if not exists (select 1 from senha_confirmada
                 where user_id = auth.uid()
                   and em > now() - interval '15 minutes'
                   and nonce_hash = encode(digest(p_nonce, 'sha256'), 'hex')) then
    return false;
  end if;
  delete from senha_confirmada where user_id = auth.uid();  -- uso único
  insert into sessoes_verificadas (session_id, user_id) values (v_sessao, auth.uid())
  on conflict (session_id) do update set verificado_em = now();
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 2. Login por CPF: a linha fica travada enquanto confere (fila única)
-- ---------------------------------------------------------------------
create or replace function public.email_para_login(p_cpf text, p_senha text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cpf   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_t     tentativas_login;
  v_email text;
  v_hash  text;
begin
  if length(v_cpf) <> 11 then return null; end if;

  insert into tentativas_login (cpf) values (v_cpf) on conflict (cpf) do nothing;
  select * into v_t from tentativas_login where cpf = v_cpf for update;  -- um de cada vez

  if v_t.bloqueado_ate is not null and v_t.bloqueado_ate > now() then
    return 'BLOQUEADO';
  end if;
  if v_t.bloqueado_ate is not null then  -- bloqueio antigo já venceu: recomeça a contagem
    update tentativas_login set falhas = 0, bloqueado_ate = null where cpf = v_cpf;
    v_t.falhas := 0;
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
    from professionals p join auth.users u on u.id = p.user_id
   where p.cpf = v_cpf and p.ativo
   limit 1;

  if v_hash is not null and v_hash = crypt(coalesce(p_senha, ''), v_hash) then
    delete from tentativas_login where cpf = v_cpf;
    return v_email;
  end if;

  update tentativas_login
     set falhas = v_t.falhas + 1,
         bloqueado_ate = case when v_t.falhas + 1 >= 5 then now() + interval '15 minutes' end
   where cpf = v_cpf;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 3. Desbloqueio da tela: PIN ou senha, 5 erros no total -> sai
-- ---------------------------------------------------------------------
create table if not exists public.desbloqueio_falhas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  falhas  int not null default 0
);
alter table public.desbloqueio_falhas enable row level security;

-- registra um erro; devolve 'sair' se chegou a 5 (e desfaz a verificação deste aparelho)
create or replace function public.registrar_falha_desbloqueio()
returns text language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into desbloqueio_falhas (user_id, falhas) values (auth.uid(), 1)
  on conflict (user_id) do update set falhas = desbloqueio_falhas.falhas + 1
  returning falhas into v;
  if v >= 5 then
    delete from desbloqueio_falhas where user_id = auth.uid();
    delete from sessoes_verificadas where session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
    return 'sair';
  end if;
  return 'errado';
end $$;
revoke execute on function public.registrar_falha_desbloqueio() from public, anon, authenticated;

create or replace function public.verificar_pin(p_pin text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  if not public.sessao_mfa_ok() then return 'sair'; end if;
  select pin_hash into v_hash from pins where user_id = auth.uid();
  if v_hash is null then return 'sair'; end if;
  if v_hash = crypt(coalesce(p_pin, ''), v_hash) then
    delete from desbloqueio_falhas where user_id = auth.uid();
    return 'ok';
  end if;
  return public.registrar_falha_desbloqueio();
end $$;

drop function if exists public.verificar_senha(text);
create function public.verificar_senha(p_senha text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  if not public.sessao_mfa_ok() then return 'sair'; end if;
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  if v_hash is not null and v_hash = crypt(coalesce(p_senha, ''), v_hash) then
    delete from desbloqueio_falhas where user_id = auth.uid();
    return 'ok';
  end if;
  return public.registrar_falha_desbloqueio();
end $$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.registrar_senha_ok()         from public, anon;
revoke execute on function public.confirmar_sessao_email(text) from public, anon;
revoke execute on function public.verificar_pin(text)          from public, anon;
revoke execute on function public.verificar_senha(text)        from public, anon;
grant  execute on function public.registrar_senha_ok()         to authenticated;
grant  execute on function public.confirmar_sessao_email(text) to authenticated;
grant  execute on function public.verificar_pin(text)          to authenticated;
grant  execute on function public.verificar_senha(text)        to authenticated;
