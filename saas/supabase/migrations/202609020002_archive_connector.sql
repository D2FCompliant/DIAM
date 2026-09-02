alter table public.diam_evidences
  add column if not exists archive_status text not null default 'PENDING',
  add column if not exists archive_provider text,
  add column if not exists archive_id text,
  add column if not exists archive_receipt jsonb,
  add column if not exists archived_at timestamptz;

alter table public.diam_documents
  add column if not exists archive_status text not null default 'PENDING',
  add column if not exists archive_provider text,
  add column if not exists archive_id text,
  add column if not exists archive_receipt jsonb,
  add column if not exists archived_at timestamptz;

alter table public.diam_reports
  add column if not exists archive_status text not null default 'PENDING',
  add column if not exists archive_provider text,
  add column if not exists archive_id text,
  add column if not exists archive_receipt jsonb,
  add column if not exists archived_at timestamptz;

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
  request_payload jsonb not null default '{}'::jsonb,
  receipt jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_diam_archive_events_object
  on public.diam_archive_events(object_type, object_id);
