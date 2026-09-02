-- DIAM SaaS v0.3.7
-- Sépare les documents de mission des documents transverses applicables à tous les audits.
-- Exemples transverses : nouveau guide DGFiP, texte réglementaire, CR réunion DGFiP/AIFE,
-- référentiel ou note D2F Compliant.

alter table public.diam_missions
  alter column client_access_token set default encode(gen_random_bytes(32), 'hex');

update public.diam_missions
set client_access_token = encode(gen_random_bytes(32), 'hex')
where client_access_token is null;

alter table public.diam_missions
  alter column client_access_token set not null;

alter table public.diam_documents
  add column if not exists document_scope text not null default 'MISSION',
  add column if not exists updated_at timestamptz not null default now();

alter table public.diam_documents
  drop constraint if exists diam_documents_document_scope_check;

alter table public.diam_documents
  add constraint diam_documents_document_scope_check
  check (document_scope in ('MISSION','GLOBAL'));

alter table public.diam_documents
  alter column mission_id drop not null;

update public.diam_documents
set document_scope = 'MISSION'
where document_scope is null;

drop index if exists idx_diam_documents_global_sha256;

create unique index if not exists idx_diam_documents_global_sha256
  on public.diam_documents(tenant_id, sha256)
  where document_scope = 'GLOBAL';

create index if not exists idx_diam_documents_scope
  on public.diam_documents(tenant_id, document_scope, uploaded_at desc);

insert into public.diam_schema_versions(id, version, product_version, label)
values (
  'current',
  '202609020010_global_reference_documents',
  '0.3.7',
  'Bibliothèque transverse des référentiels, guides, textes et CR applicables à tous les audits'
)
on conflict (id) do update set
  version = excluded.version,
  product_version = excluded.product_version,
  label = excluded.label,
  applied_at = now();
