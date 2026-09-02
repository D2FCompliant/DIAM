-- DIAM SaaS - Versioning and schema traceability
-- Records the deployed database schema baseline visible from the application.

create table if not exists public.diam_schema_versions (
  id text primary key,
  version text not null,
  product_version text not null,
  label text not null,
  applied_at timestamptz not null default now(),
  notes text
);

insert into public.diam_schema_versions (
  id,
  version,
  product_version,
  label,
  notes
) values (
  'current',
  '202609020008_versioning',
  '0.3.1',
  'DIAM SaaS schema with PA lifecycle, document registry, audit evidence and version traceability',
  'Includes initial/surveillance/complementary/renewal audit lifecycle, 3-year PA label validity tracking, D2F Business Suite manual linkage, document AI traceability and SAE archive foundations.'
)
on conflict (id) do update set
  version = excluded.version,
  product_version = excluded.product_version,
  label = excluded.label,
  notes = excluded.notes,
  applied_at = now();
