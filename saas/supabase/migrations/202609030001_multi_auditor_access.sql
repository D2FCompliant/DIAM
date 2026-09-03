-- DIAM SaaS v1.4.0
-- Gestion multi-auditeur et affectation par mission.
-- Un collaborateur peut se connecter à DIAM, mais ne voit et ne traite que les missions
-- sur lesquelles il est explicitement missionné.

create table if not exists public.diam_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  email text not null,
  email_key text not null,
  display_name text,
  role text not null default 'AUDITOR',
  status text not null default 'INVITED',
  password_sha256 text,
  invited_by text,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diam_users_role_check check (role in ('OWNER','MANAGER','AUDITOR','CLIENT')),
  constraint diam_users_status_check check (status in ('INVITED','ACTIVE','DISABLED')),
  constraint diam_users_password_sha256_check check (password_sha256 is null or password_sha256 ~ '^[a-f0-9]{64}$')
);

create unique index if not exists idx_diam_users_tenant_email_key
  on public.diam_users(tenant_id, email_key);

create index if not exists idx_diam_users_tenant_status
  on public.diam_users(tenant_id, status, role);

create table if not exists public.diam_mission_auditors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  user_id uuid not null references public.diam_users(id) on delete cascade,
  mission_role text not null default 'AUDITOR',
  assigned_by text,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diam_mission_auditors_role_check check (mission_role in ('LEAD','AUDITOR','REVIEWER'))
);

create unique index if not exists idx_diam_mission_auditors_active_unique
  on public.diam_mission_auditors(tenant_id, mission_id, user_id)
  where revoked_at is null;

create index if not exists idx_diam_mission_auditors_user
  on public.diam_mission_auditors(tenant_id, user_id, revoked_at);

create index if not exists idx_diam_mission_auditors_mission
  on public.diam_mission_auditors(tenant_id, mission_id, revoked_at);

insert into public.diam_schema_versions(id, version, product_version, label, notes)
values (
  'current',
  '202609030001_multi_auditor_access',
  '1.4.0',
  'Gestion multi-auditeur avec invitation, connexion collaborateur et affectation par mission',
  'Ajoute diam_users et diam_mission_auditors. Le contrôle d’accès mission est appliqué côté Cloudflare Worker : un auditeur invité ne liste, ouvre, analyse, modifie ou génère un rapport que sur les missions auxquelles il est affecté.'
)
on conflict (id) do update set
  version = excluded.version,
  product_version = excluded.product_version,
  label = excluded.label,
  notes = excluded.notes,
  applied_at = now();
