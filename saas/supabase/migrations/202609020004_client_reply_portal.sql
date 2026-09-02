create table if not exists public.diam_client_replies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  finding_id uuid not null references public.diam_findings(id) on delete cascade,
  message text not null,
  evidence_id uuid references public.diam_evidences(id) on delete set null,
  submitted_by text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_diam_client_replies_finding
  on public.diam_client_replies(finding_id);
