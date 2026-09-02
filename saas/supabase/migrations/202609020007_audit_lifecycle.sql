-- DIAM SaaS - PA audit lifecycle
-- Adds initial/surveillance/complementary/renewal tracking for the 3-year PA label cycle.

alter table public.diam_missions
  add column if not exists audit_type text not null default 'INITIAL',
  add column if not exists parent_mission_id uuid references public.diam_missions(id) on delete set null,
  add column if not exists initial_mission_id uuid references public.diam_missions(id) on delete set null,
  add column if not exists label_valid_from date,
  add column if not exists label_valid_until date,
  add column if not exists surveillance_year integer,
  add column if not exists lifecycle_status text not null default 'INITIAL_LABEL',
  add column if not exists whats_new_required boolean not null default false,
  add column if not exists complementary_audit_required boolean not null default false,
  add column if not exists complementary_billing_mode text,
  add column if not exists lifecycle_notes text;

alter table public.diam_missions
  drop constraint if exists diam_missions_audit_type_check;

alter table public.diam_missions
  add constraint diam_missions_audit_type_check
  check (audit_type in ('INITIAL','SURVEILLANCE','COMPLEMENTARY','RENEWAL'));

create index if not exists idx_diam_missions_client_lifecycle
  on public.diam_missions(client_id, audit_type, created_at);

create index if not exists idx_diam_missions_initial_mission
  on public.diam_missions(initial_mission_id);
