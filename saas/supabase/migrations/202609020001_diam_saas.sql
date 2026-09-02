-- DIAM SaaS - Supabase baseline
-- Separate schema from D2F Enterprise Platform.

create extension if not exists pgcrypto;

create table if not exists public.diam_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diam_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  name text not null,
  siren text,
  address text,
  city text,
  country text not null default 'France',
  scope jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, name)
);

create table if not exists public.diam_missions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  client_id uuid not null references public.diam_clients(id) on delete cascade,
  number text not null,
  title text not null,
  referential_version text not null default 'DGFiP audit guide v1.3 + PDP Integrity v3.2 + spécifications externes 2026',
  audit_period daterange,
  audit_type text not null default 'INITIAL' check (audit_type in ('INITIAL','SURVEILLANCE','COMPLEMENTARY','RENEWAL')),
  parent_mission_id uuid references public.diam_missions(id) on delete set null,
  initial_mission_id uuid references public.diam_missions(id) on delete set null,
  label_valid_from date,
  label_valid_until date,
  surveillance_year integer,
  lifecycle_status text not null default 'INITIAL_LABEL',
  whats_new_required boolean not null default false,
  complementary_audit_required boolean not null default false,
  complementary_billing_mode text,
  lifecycle_notes text,
  status text not null default 'IN_PROGRESS',
  opinion text not null default 'AUDIT_INCOMPLET',
  client_access_token text not null default encode(gen_random_bytes(32), 'hex'),
  client_access_enabled boolean not null default true,
  client_access_expires_at timestamptz,
  client_language text not null default 'fr',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, number)
);

create table if not exists public.diam_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  reference text not null,
  chapter text not null,
  title text not null,
  requirement text not null,
  source text not null,
  base_qualification text not null check (base_qualification in ('LOW','MEDIUM','HIGH','CRITICAL')),
  verification_method text not null,
  expected_evidence text not null,
  status text not null default 'NOT_STARTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mission_id, reference)
);

create table if not exists public.diam_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  question_id uuid not null references public.diam_questions(id) on delete cascade,
  compliance_status text not null check (compliance_status in ('NOT_STARTED','COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT','NOT_APPLICABLE')),
  client_answer text,
  auditor_analysis text,
  answered_by text,
  answered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id)
);

create table if not exists public.diam_evidences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  question_id uuid references public.diam_questions(id) on delete set null,
  number text not null,
  original_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  sha256 text not null,
  expected_evidence_ref text,
  archive_status text not null default 'PENDING' check (archive_status in ('PENDING','ARCHIVED','FAILED','DISABLED')),
  archive_provider text,
  archive_id text,
  archive_receipt jsonb,
  archived_at timestamptz,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  unique(tenant_id, mission_id, sha256)
);

create table if not exists public.diam_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  document_type text not null default 'TECHNICAL',
  original_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  sha256 text not null,
  analysis_status text not null default 'UPLOADED' check (analysis_status in ('UPLOADED','ANALYZED','FAILED')),
  archive_status text not null default 'PENDING' check (archive_status in ('PENDING','ARCHIVED','FAILED','DISABLED')),
  archive_provider text,
  archive_id text,
  archive_receipt jsonb,
  archived_at timestamptz,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  unique(tenant_id, mission_id, sha256)
);

create table if not exists public.diam_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  question_id uuid not null references public.diam_questions(id) on delete cascade,
  number text not null,
  summary text not null,
  base_qualification text not null,
  retained_qualification text not null check (retained_qualification in ('LOW','MEDIUM','HIGH','CRITICAL')),
  recommendation text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','CLOSED')),
  closure_comment text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(question_id)
);

create table if not exists public.diam_ai_gap_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  document_id uuid not null references public.diam_documents(id) on delete cascade,
  question_id uuid references public.diam_questions(id) on delete set null,
  reference text,
  title text not null,
  requirement_source text,
  requirement_excerpt text,
  evidence_document_name text,
  evidence_sha256 text,
  evidence_locator text,
  assessment_type text not null default 'POTENTIAL_GAP' check (assessment_type in ('POTENTIAL_GAP','INSUFFICIENT_EVIDENCE','MORE_INFO_REQUIRED')),
  potential_gap text not null,
  basis text not null,
  missing_evidence text,
  suggested_qualification text not null check (suggested_qualification in ('LOW','MEDIUM','HIGH','CRITICAL')),
  recommendation text,
  confidence numeric not null default 0,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','ACCEPTED','REJECTED')),
  created_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  reviewer_decision text,
  reviewer_justification text,
  decision_history jsonb not null default '[]'::jsonb
);

create table if not exists public.diam_finding_evidences (
  finding_id uuid not null references public.diam_findings(id) on delete cascade,
  evidence_id uuid not null references public.diam_evidences(id) on delete cascade,
  usage text not null default 'FINDING_PROOF',
  created_at timestamptz not null default now(),
  primary key(finding_id, evidence_id)
);

create table if not exists public.diam_client_replies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  finding_id uuid not null references public.diam_findings(id) on delete cascade,
  message text not null,
  message_language text not null default 'fr',
  french_translation text,
  translation_validated boolean not null default false,
  evidence_id uuid references public.diam_evidences(id) on delete set null,
  submitted_by text,
  submitted_at timestamptz not null default now()
);

create table if not exists public.diam_non_conformities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  finding_id uuid not null references public.diam_findings(id) on delete cascade,
  number text not null,
  severity text not null check (severity in ('MINOR','MAJOR','CRITICAL')),
  title text not null,
  description text,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','CLOSED','WAIVED')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diam_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  non_conformity_id uuid not null references public.diam_non_conformities(id) on delete cascade,
  number text not null,
  action text not null,
  owner text,
  priority text not null default 'MEDIUM',
  due_date date,
  status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','DONE','VERIFIED','CANCELLED')),
  verification_comment text,
  completion_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diam_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  report_number text not null,
  opinion text not null,
  payload jsonb not null,
  archive_status text not null default 'PENDING' check (archive_status in ('PENDING','ARCHIVED','FAILED','DISABLED')),
  archive_provider text,
  archive_id text,
  archive_receipt jsonb,
  archived_at timestamptz,
  generated_by text,
  generated_at timestamptz not null default now()
);

create table if not exists public.diam_archive_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.diam_tenants(id) on delete cascade,
  mission_id uuid references public.diam_missions(id) on delete cascade,
  object_type text not null,
  object_id uuid not null,
  provider text not null default 'SAE',
  status text not null check (status in ('PENDING','ARCHIVED','FAILED','DISABLED')),
  archive_id text,
  sha256 text,
  request_payload jsonb not null default '{}',
  receipt jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.diam_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.diam_tenants(id) on delete cascade,
  mission_id uuid references public.diam_missions(id) on delete cascade,
  actor text,
  event_type text not null,
  object_type text,
  object_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_diam_clients_tenant on public.diam_clients(tenant_id);
create index if not exists idx_diam_missions_tenant on public.diam_missions(tenant_id);
create index if not exists idx_diam_questions_mission on public.diam_questions(mission_id);
create index if not exists idx_diam_evidences_mission on public.diam_evidences(mission_id);
create index if not exists idx_diam_documents_mission on public.diam_documents(mission_id);
create index if not exists idx_diam_findings_question on public.diam_findings(question_id);
create index if not exists idx_diam_ai_suggestions_mission on public.diam_ai_gap_suggestions(mission_id);
create index if not exists idx_diam_client_replies_finding on public.diam_client_replies(finding_id);
create index if not exists idx_diam_nc_finding on public.diam_non_conformities(finding_id);
create index if not exists idx_diam_actions_nc on public.diam_actions(non_conformity_id);
create index if not exists idx_diam_archive_events_object on public.diam_archive_events(object_type, object_id);

insert into storage.buckets (id, name, public)
values ('diam-evidence', 'diam-evidence', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('diam-documents', 'diam-documents', false)
on conflict (id) do nothing;
