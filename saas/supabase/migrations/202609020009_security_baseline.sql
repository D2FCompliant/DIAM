insert into public.diam_schema_versions (
  version,
  product_version,
  label,
  applied_at,
  notes
)
values (
  '202609020009_security_baseline',
  '0.3.2',
  'DIAM Secure Credential Gate',
  now(),
  'Authentification DIAM obligatoire pour les API internes, session HTTPS HttpOnly/Secure, séparation accès auditeur et portail client tokenisé.'
)
on conflict (version) do update
set
  product_version = excluded.product_version,
  label = excluded.label,
  applied_at = now(),
  notes = excluded.notes;
