-- =====================================================================
-- Lumê — Migração 08: assinatura eletrônica da(o) profissional
--   1. Imagem da assinatura da(o) profissional (desenhada uma vez)
--   2. Registro de cada prontuário assinado eletronicamente
--      (quem, quando e o código/hash do conteúdo assinado)
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

alter table public.professionals add column if not exists assinatura_path text;

create table if not exists public.assinaturas_prontuario (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references public.clinics(id) on delete cascade,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  professional_id   uuid not null references public.professionals(id),
  profissional_nome text,
  registro_conselho text,
  hash_documento    text not null,
  assinado_em       timestamptz not null default now()
);
create index if not exists assinaturas_prontuario_paciente on public.assinaturas_prontuario (patient_id, assinado_em desc);

alter table public.assinaturas_prontuario enable row level security;
drop policy if exists assinaturas_prontuario_select on public.assinaturas_prontuario;
create policy assinaturas_prontuario_select on public.assinaturas_prontuario
  for select using (clinic_id = public.current_clinic_id());
-- sem insert/update/delete pelo app: só pela função abaixo

create or replace function public.assinar_prontuario(p_patient uuid, p_hash text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid := public.current_clinic_id();
  v_info   record;
  v_id     uuid;
  v_em     timestamptz;
begin
  if v_clinic is null then raise exception 'Sessão não verificada.'; end if;
  if not exists (select 1 from patients where id = p_patient and clinic_id = v_clinic) then
    raise exception 'Paciente não encontrado.';
  end if;
  if coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'Código do documento inválido.'; end if;

  select * into v_info from public.profissional_atual_info();
  insert into assinaturas_prontuario (clinic_id, patient_id, professional_id, profissional_nome, registro_conselho, hash_documento)
  values (v_clinic, p_patient, v_info.p_id, v_info.p_nome, v_info.p_registro, p_hash)
  returning id, assinado_em into v_id, v_em;

  return json_build_object('id', v_id, 'assinado_em', v_em);
end $$;

revoke execute on function public.assinar_prontuario(uuid, text) from public, anon;
grant  execute on function public.assinar_prontuario(uuid, text) to authenticated;
