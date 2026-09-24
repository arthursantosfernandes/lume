-- =====================================================================
-- LUMÊ — Prontuário Estético
-- Schema inicial do banco (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Funções utilitárias
-- ---------------------------------------------------------------------

-- Atualiza a coluna updated_at automaticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Clínicas
-- ---------------------------------------------------------------------
create table public.clinics (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  documento     text,                      -- CNPJ ou CPF (opcional)
  telefone      text,
  email         text,
  cep           text,
  endereco      text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text,
  uf            char(2),
  logo_path     text,                      -- caminho no Storage (bucket clinic-assets)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Profissionais (1 usuário de login = 1 profissional)
-- ---------------------------------------------------------------------
create table public.professionals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  clinic_id     uuid not null references public.clinics(id) on delete restrict,
  nome          text not null,
  telefone      text,
  foto_path     text,                      -- foto da profissional (opcional)
  papel         text not null default 'colaboradora'
                check (papel in ('dona', 'colaboradora')),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.professionals (clinic_id);

-- Registros profissionais / habilitações (uma pessoa pode ter vários)
create table public.professional_credentials (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  professional_id  uuid not null references public.professionals(id) on delete cascade,
  profissao        text not null check (profissao in (
                     'enfermeiro', 'medico', 'farmaceutico', 'biomedico',
                     'dentista', 'fisioterapeuta', 'esteticista', 'outro')),
  conselho         text check (conselho in (
                     'COREN', 'CRM', 'CRF', 'CRBM', 'CRO', 'CREFITO', 'nenhum', 'outro')),
  numero_registro  text,
  uf               char(2),
  especialidade    text,                   -- ex: "Pós-graduação em Estética"
  formacao         text,
  documento_path   text,                   -- comprovante (opcional)
  validade         date,
  principal        boolean not null default true,  -- registro que aparece na impressão
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.professional_credentials (professional_id);

-- ---------------------------------------------------------------------
-- 3. Função de segurança: descobre a clínica do usuário logado
--    (usada por TODAS as regras de acesso / RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_clinic_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from public.professionals
  where user_id = auth.uid() and ativo
  limit 1
$$;

create or replace function public.current_professional_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.professionals
  where user_id = auth.uid() and ativo
  limit 1
$$;

-- ---------------------------------------------------------------------
-- 4. Pacientes
-- ---------------------------------------------------------------------
create table public.patients (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references public.clinics(id) on delete restrict,
  nome             text not null,
  data_nascimento  date,                   -- idade é calculada, não armazenada
  cpf              text,
  sexo             text,
  telefone         text,
  email            text,
  cep              text,
  endereco         text,
  cidade           text,
  uf               char(2),
  profissao        text,
  como_conheceu    text,
  observacoes      text,
  foto_path        text,
  ativo            boolean not null default true,
  created_by       uuid references public.professionals(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.patients (clinic_id, nome);

-- ---------------------------------------------------------------------
-- 5. Anamnese estética
-- ---------------------------------------------------------------------
create table public.anamneses (
  id                        uuid primary key default gen_random_uuid(),
  clinic_id                 uuid not null references public.clinics(id) on delete restrict,
  patient_id                uuid not null references public.patients(id) on delete restrict,
  queixa_principal          text,
  objetivos                 text,          -- necessidades / expectativas da paciente
  fototipo                  text check (fototipo in ('I','II','III','IV','V','VI')),
  tipo_pele                 text,
  alergias                  text,
  medicamentos_em_uso       text,
  doencas_preexistentes     text,
  gestante_lactante         boolean,
  doenca_neuromuscular      boolean,
  disturbio_coagulacao      boolean,
  historico_queloide        boolean,
  herpes_recorrente         boolean,
  procedimentos_anteriores  text,
  cirurgias_anteriores      text,
  habitos                   text,          -- tabagismo, álcool, sol, atividade física
  contraindicacoes          text,
  extras                    jsonb not null default '{}'::jsonb,
  created_by                uuid references public.professionals(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index on public.anamneses (patient_id);

-- ---------------------------------------------------------------------
-- 6. Catálogo de procedimentos (modelos) e o que cada profissional faz
-- ---------------------------------------------------------------------
create table public.procedure_templates (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid references public.clinics(id) on delete cascade, -- null = modelo global do Lumê
  slug                   text not null,
  nome                   text not null,
  categoria              text not null,   -- injetavel, tecnologia, bioestimulacao...
  profissoes_sugeridas   text[] not null default '{}',
  tipo_mapa              text not null default 'nenhum'
                         check (tipo_mapa in ('nenhum','facial','corporal','facial_corporal')),
  tipo_marcacao          text[] not null default '{}',  -- ponto, volume, linha, area
  campos                 jsonb not null default '[]'::jsonb, -- definição dos campos específicos
  ativo                  boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index procedure_templates_slug_uniq
  on public.procedure_templates (coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create table public.professional_procedures (
  professional_id        uuid not null references public.professionals(id) on delete cascade,
  procedure_template_id  uuid not null references public.procedure_templates(id) on delete cascade,
  clinic_id              uuid not null references public.clinics(id) on delete cascade,
  created_at             timestamptz not null default now(),
  primary key (professional_id, procedure_template_id)
);

-- ---------------------------------------------------------------------
-- 7. Atendimentos / evoluções
--    Campos comuns em colunas + específicos do procedimento em JSONB
--    Etapas do Processo de Enfermagem (Res. COFEN 736/2024) opcionais
-- ---------------------------------------------------------------------
create table public.atendimentos (
  id                     uuid primary key default gen_random_uuid(),
  clinic_id              uuid not null references public.clinics(id) on delete restrict,
  patient_id             uuid not null references public.patients(id) on delete restrict,
  professional_id        uuid not null references public.professionals(id),
  credential_id          uuid references public.professional_credentials(id), -- registro usado neste atendimento
  procedure_template_id  uuid references public.procedure_templates(id),
  data_atendimento       timestamptz not null default now(),
  -- Processo de Enfermagem
  pe_avaliacao           text,
  pe_diagnostico         text,
  pe_planejamento        text,
  pe_implementacao       text,
  pe_evolucao            text,
  -- Campos comuns
  regiao                 text,
  produto                text,
  fabricante             text,
  lote                   text,
  validade_produto       date,
  tecnica                text,
  dados_procedimento     jsonb not null default '{}'::jsonb, -- campos específicos do modelo
  mapa                   jsonb not null default '[]'::jsonb, -- marcações (coordenadas 0 a 1)
  orientacoes            text,
  intercorrencias        text,
  conduta_intercorrencia text,
  sessao_numero          int,
  sessoes_previstas      int,
  retorno_previsto       date,
  observacoes            text,
  -- Retificação: nunca apagar, só corrigir apontando para o original
  retifica_id            uuid references public.atendimentos(id),
  motivo_retificacao     text,
  status                 text not null default 'ativo' check (status in ('ativo','retificado')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on public.atendimentos (patient_id, data_atendimento desc);
create index on public.atendimentos (clinic_id, data_atendimento desc);

-- ---------------------------------------------------------------------
-- 8. Consentimentos (uso de imagem, termo do procedimento etc.)
-- ---------------------------------------------------------------------
create table public.consents (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references public.clinics(id) on delete restrict,
  patient_id        uuid not null references public.patients(id) on delete restrict,
  atendimento_id    uuid references public.atendimentos(id),
  tipo              text not null check (tipo in ('uso_imagem','procedimento','lgpd','outro')),
  titulo            text not null,
  texto_termo       text not null,         -- cópia do texto exato aceito
  versao_termo      text,
  aceito            boolean not null,
  aceito_em         timestamptz not null default now(),
  assinatura_path   text,                  -- imagem da assinatura (fase 2)
  registrado_por    uuid references public.professionals(id),
  revogado_em       timestamptz,
  motivo_revogacao  text,
  created_at        timestamptz not null default now()
);
create index on public.consents (patient_id);

-- Paciente tem consentimento de imagem válido?
create or replace function public.has_image_consent(p_patient uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.consents
    where patient_id = p_patient and tipo = 'uso_imagem'
      and aceito and revogado_em is null
  )
$$;

-- ---------------------------------------------------------------------
-- 9. Fotos (antes / depois)
-- ---------------------------------------------------------------------
create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references public.clinics(id) on delete restrict,
  patient_id      uuid not null references public.patients(id) on delete restrict,
  atendimento_id  uuid references public.atendimentos(id),
  tipo            text not null check (tipo in ('antes','depois','retorno','intercorrencia','outro')),
  pose            text,                    -- repouso, contração frontal, sorriso...
  regiao          text,
  storage_path    text not null,           -- bucket privado patient-photos
  tirada_em       timestamptz not null default now(),
  observacao      text,
  created_by      uuid references public.professionals(id),
  created_at      timestamptz not null default now()
);
create index on public.photos (patient_id, tirada_em desc);

-- Bloqueia foto sem consentimento de uso de imagem
create or replace function public.check_photo_consent()
returns trigger language plpgsql as $$
begin
  if not public.has_image_consent(new.patient_id) then
    raise exception 'Paciente sem consentimento de uso de imagem registrado.';
  end if;
  return new;
end $$;

create trigger photos_require_consent
  before insert on public.photos
  for each row execute function public.check_photo_consent();

-- ---------------------------------------------------------------------
-- 10. Auditoria (quem alterou o quê e quando)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  clinic_id    uuid,
  tabela       text not null,
  registro_id  uuid,
  acao         text not null,              -- INSERT / UPDATE / DELETE
  user_id      uuid default auth.uid(),
  dados_antes  jsonb,
  dados_depois jsonb,
  criado_em    timestamptz not null default now()
);
create index on public.audit_log (clinic_id, criado_em desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_log (clinic_id, tabela, registro_id, acao, dados_antes, dados_depois)
  values (
    case when tg_table_name = 'clinics'
         then coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid)
         else coalesce((v_new->>'clinic_id')::uuid, (v_old->>'clinic_id')::uuid) end,
    tg_table_name,
    coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid),
    tg_op, v_old, v_new
  );
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- 11. Triggers de updated_at e auditoria
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clinics','professionals','professional_credentials',
                           'patients','anamneses','procedure_templates','atendimentos']
  loop
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.set_updated_at()', t||'_updated_at', t);
  end loop;

  foreach t in array array['clinics','professionals','professional_credentials','patients',
                           'anamneses','atendimentos','consents','photos']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t||'_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. Cadastro inicial: cria clínica + profissional + registro
--     (chamado pelo app logo após a profissional criar a conta)
-- ---------------------------------------------------------------------
create or replace function public.onboard_professional(
  p_clinic_nome     text,
  p_nome            text,
  p_profissao       text,
  p_conselho        text default null,
  p_numero_registro text default null,
  p_uf              char(2) default null,
  p_especialidade   text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid;
  v_prof   uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  if exists (select 1 from professionals where user_id = auth.uid()) then
    raise exception 'Profissional já cadastrada';
  end if;

  insert into clinics (nome) values (p_clinic_nome) returning id into v_clinic;

  insert into professionals (user_id, clinic_id, nome, papel)
  values (auth.uid(), v_clinic, p_nome, 'dona') returning id into v_prof;

  insert into professional_credentials
    (clinic_id, professional_id, profissao, conselho, numero_registro, uf, especialidade)
  values (v_clinic, v_prof, p_profissao, p_conselho, p_numero_registro, p_uf, p_especialidade);

  return v_clinic;
end $$;

-- ---------------------------------------------------------------------
-- 13. Segurança: Row Level Security (cada clínica só vê o que é seu)
-- ---------------------------------------------------------------------
alter table public.clinics                  enable row level security;
alter table public.professionals            enable row level security;
alter table public.professional_credentials enable row level security;
alter table public.patients                 enable row level security;
alter table public.anamneses                enable row level security;
alter table public.procedure_templates      enable row level security;
alter table public.professional_procedures  enable row level security;
alter table public.atendimentos             enable row level security;
alter table public.consents                 enable row level security;
alter table public.photos                   enable row level security;
alter table public.audit_log                enable row level security;

-- Clínica: ver e editar só a própria
create policy clinic_select on public.clinics for select using (id = public.current_clinic_id());
create policy clinic_update on public.clinics for update using (id = public.current_clinic_id());

-- Profissionais: ver colegas da clínica; editar só o próprio perfil
create policy prof_select on public.professionals for select using (clinic_id = public.current_clinic_id());
create policy prof_update on public.professionals for update using (user_id = auth.uid());

-- Tabelas da clínica: selecionar, inserir e editar (sem DELETE = nada é apagado)
do $$
declare t text;
begin
  foreach t in array array['professional_credentials','patients','anamneses',
                           'atendimentos','consents','photos','professional_procedures']
  loop
    execute format('create policy %I on public.%I for select using (clinic_id = public.current_clinic_id())', t||'_select', t);
    execute format('create policy %I on public.%I for insert with check (clinic_id = public.current_clinic_id())', t||'_insert', t);
    execute format('create policy %I on public.%I for update using (clinic_id = public.current_clinic_id()) with check (clinic_id = public.current_clinic_id())', t||'_update', t);
  end loop;
end $$;

-- Vínculo profissional-procedimento pode ser removido (é configuração, não prontuário)
create policy professional_procedures_delete on public.professional_procedures
  for delete using (clinic_id = public.current_clinic_id());

-- Catálogo: todos veem os modelos globais + os da própria clínica
create policy templates_select on public.procedure_templates
  for select using (clinic_id is null or clinic_id = public.current_clinic_id());
create policy templates_insert on public.procedure_templates
  for insert with check (clinic_id = public.current_clinic_id());
create policy templates_update on public.procedure_templates
  for update using (clinic_id = public.current_clinic_id());

-- Auditoria: só leitura, só da própria clínica
create policy audit_select on public.audit_log for select using (clinic_id = public.current_clinic_id());

-- ---------------------------------------------------------------------
-- 14. Storage: buckets privados para fotos e logos
--     Caminho dos arquivos: <clinic_id>/<paciente_ou_pasta>/<arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', false),
       ('clinic-assets',  'clinic-assets',  false)
on conflict (id) do nothing;

create policy "clinica le seus arquivos" on storage.objects for select
  using (bucket_id in ('patient-photos','clinic-assets')
         and (storage.foldername(name))[1] = public.current_clinic_id()::text);

create policy "clinica envia seus arquivos" on storage.objects for insert
  with check (bucket_id in ('patient-photos','clinic-assets')
              and (storage.foldername(name))[1] = public.current_clinic_id()::text);

create policy "clinica atualiza logos" on storage.objects for update
  using (bucket_id = 'clinic-assets'
         and (storage.foldername(name))[1] = public.current_clinic_id()::text);

-- ---------------------------------------------------------------------
-- 15. Modelos dos 7 procedimentos iniciais
--     "campos": cada item = { chave, rotulo, tipo, opcoes?, unidade?, obrigatorio? }
--     Os valores são sempre definidos pela profissional; o app só registra e soma.
-- ---------------------------------------------------------------------
insert into public.procedure_templates
  (slug, nome, categoria, profissoes_sugeridas, tipo_mapa, tipo_marcacao, campos)
values
(
  'toxina-botulinica', 'Toxina botulínica', 'injetavel',
  array['enfermeiro','medico','farmaceutico','biomedico','dentista'],
  'facial', array['ponto'],
  '[
    {"chave":"unidades_frasco","rotulo":"Unidades do frasco","tipo":"numero","unidade":"U","obrigatorio":true},
    {"chave":"diluicao_ml","rotulo":"Diluição (soro fisiológico)","tipo":"numero","unidade":"mL","obrigatorio":true},
    {"chave":"concentracao","rotulo":"Concentração","tipo":"calculado","formula":"unidades_frasco / diluicao_ml / 10","unidade":"U por 0,1 mL"},
    {"chave":"data_reconstituicao","rotulo":"Data da reconstituição","tipo":"data"},
    {"chave":"frasco_compartilhado","rotulo":"Frasco compartilhado","tipo":"booleano"},
    {"chave":"agulha","rotulo":"Agulha / seringa","tipo":"texto"},
    {"chave":"total_unidades","rotulo":"Total aplicado","tipo":"calculado","formula":"soma(mapa.valor)","unidade":"U"},
    {"chave":"data_retoque","rotulo":"Data do retoque","tipo":"data"}
  ]'::jsonb
),
(
  'bioestimulador-colageno', 'Bioestimulador de colágeno', 'injetavel',
  array['enfermeiro','medico','farmaceutico','biomedico','dentista'],
  'facial_corporal', array['volume','area'],
  '[
    {"chave":"tipo_produto","rotulo":"Tipo de bioestimulador","tipo":"selecao","opcoes":["Ácido poli-L-lático (PLLA)","Hidroxiapatita de cálcio (CaHA)","Policaprolactona (PCL)","Outro"],"obrigatorio":true},
    {"chave":"diluicao","rotulo":"Diluição / reconstituição","tipo":"texto"},
    {"chave":"volume_total_ml","rotulo":"Volume total aplicado","tipo":"calculado","formula":"soma(mapa.valor)","unidade":"mL"},
    {"chave":"dispositivo","rotulo":"Agulha ou cânula","tipo":"selecao","opcoes":["Agulha","Cânula"]},
    {"chave":"calibre","rotulo":"Calibre","tipo":"texto","unidade":"G"},
    {"chave":"tecnica_aplicacao","rotulo":"Técnica","tipo":"texto"},
    {"chave":"anestesia","rotulo":"Anestesia","tipo":"texto"}
  ]'::jsonb
),
(
  'fios-pdo', 'Fios de PDO', 'injetavel',
  array['enfermeiro','medico','biomedico','dentista'],
  'facial_corporal', array['linha'],
  '[
    {"chave":"tipo_fio","rotulo":"Tipo de fio","tipo":"selecao","opcoes":["Liso (mono)","Espiculado (cog)","Parafuso (screw)","Outro"],"obrigatorio":true},
    {"chave":"calibre","rotulo":"Calibre","tipo":"texto","unidade":"G"},
    {"chave":"comprimento_mm","rotulo":"Comprimento","tipo":"numero","unidade":"mm"},
    {"chave":"quantidade_fios","rotulo":"Quantidade de fios","tipo":"calculado","formula":"contar(mapa)"},
    {"chave":"pontos_entrada","rotulo":"Pontos de entrada","tipo":"texto"},
    {"chave":"anestesia","rotulo":"Anestesia","tipo":"texto"}
  ]'::jsonb
),
(
  'prp', 'PRP (plasma rico em plaquetas)', 'injetavel',
  array['enfermeiro','medico','biomedico','dentista','farmaceutico'],
  'facial_corporal', array['area'],
  '[
    {"chave":"volume_sangue_ml","rotulo":"Volume de sangue coletado","tipo":"numero","unidade":"mL","obrigatorio":true},
    {"chave":"numero_tubos","rotulo":"Número de tubos","tipo":"numero"},
    {"chave":"centrifugacao_rotacao","rotulo":"Rotação da centrífuga","tipo":"texto","unidade":"rpm ou g"},
    {"chave":"centrifugacao_tempo_min","rotulo":"Tempo de centrifugação","tipo":"numero","unidade":"min"},
    {"chave":"ciclos","rotulo":"Ciclos de centrifugação","tipo":"selecao","opcoes":["1","2"]},
    {"chave":"volume_plasma_ml","rotulo":"Volume de plasma obtido","tipo":"numero","unidade":"mL"},
    {"chave":"forma_aplicacao","rotulo":"Forma de aplicação","tipo":"selecao","opcoes":["Injeção","Microagulhamento","Tópico","Outra"]}
  ]'::jsonb
),
(
  'preenchimento-acido-hialuronico', 'Preenchimento com ácido hialurônico', 'injetavel',
  array['enfermeiro','medico','farmaceutico','biomedico','dentista'],
  'facial', array['volume'],
  '[
    {"chave":"volume_seringa_ml","rotulo":"Volume da seringa","tipo":"numero","unidade":"mL","obrigatorio":true},
    {"chave":"com_lidocaina","rotulo":"Produto com lidocaína","tipo":"booleano"},
    {"chave":"volume_total_ml","rotulo":"Volume total aplicado","tipo":"calculado","formula":"soma(mapa.valor)","unidade":"mL"},
    {"chave":"plano","rotulo":"Plano de aplicação","tipo":"selecao","opcoes":["Supraperiosteal","Subcutâneo","Dérmico","Outro"]},
    {"chave":"dispositivo","rotulo":"Agulha ou cânula","tipo":"selecao","opcoes":["Agulha","Cânula"]},
    {"chave":"calibre","rotulo":"Calibre","tipo":"texto","unidade":"G"},
    {"chave":"hialuronidase_usada","rotulo":"Hialuronidase utilizada","tipo":"booleano"},
    {"chave":"hialuronidase_detalhes","rotulo":"Hialuronidase: produto, lote e quantidade","tipo":"texto"}
  ]'::jsonb
),
(
  'peim', 'PEIM (microvasos)', 'injetavel',
  array['enfermeiro','medico','biomedico'],
  'corporal', array['ponto','area'],
  '[
    {"chave":"substancia","rotulo":"Substância","tipo":"texto","obrigatorio":true},
    {"chave":"concentracao","rotulo":"Concentração","tipo":"texto"},
    {"chave":"volume_total_ml","rotulo":"Volume total","tipo":"numero","unidade":"mL"},
    {"chave":"numero_puncoes","rotulo":"Número de punções","tipo":"calculado","formula":"contar(mapa)"},
    {"chave":"compressao","rotulo":"Compressão / meia indicada","tipo":"texto"}
  ]'::jsonb
),
(
  'ultrassom-micro-macro-focado', 'Ultrassom micro e macro focado', 'tecnologia',
  array['enfermeiro','medico','biomedico','fisioterapeuta','esteticista'],
  'facial_corporal', array['area'],
  '[
    {"chave":"modalidade","rotulo":"Modalidade","tipo":"selecao","opcoes":["Microfocado","Macrofocado"],"obrigatorio":true},
    {"chave":"equipamento","rotulo":"Equipamento","tipo":"texto"},
    {"chave":"ponteiras","rotulo":"Ponteiras usadas (profundidade, energia, disparos ou linhas por região)","tipo":"lista","itens":[
      {"chave":"profundidade_mm","rotulo":"Profundidade","tipo":"numero","unidade":"mm"},
      {"chave":"energia","rotulo":"Energia","tipo":"texto","unidade":"J"},
      {"chave":"regiao","rotulo":"Região","tipo":"texto"},
      {"chave":"disparos","rotulo":"Disparos / linhas","tipo":"numero"}
    ]},
    {"chave":"dor_relatada","rotulo":"Dor relatada (0 a 10)","tipo":"numero"}
  ]'::jsonb
);

-- =====================================================================
-- Fim. Tabelas criadas com segurança por clínica (RLS) ativada.
-- =====================================================================
