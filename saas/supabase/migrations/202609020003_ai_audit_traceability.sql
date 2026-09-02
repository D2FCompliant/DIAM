alter table public.diam_ai_gap_suggestions
  add column if not exists requirement_source text,
  add column if not exists requirement_excerpt text,
  add column if not exists evidence_document_name text,
  add column if not exists evidence_sha256 text,
  add column if not exists evidence_locator text,
  add column if not exists assessment_type text not null default 'POTENTIAL_GAP',
  add column if not exists reviewer_decision text,
  add column if not exists reviewer_justification text,
  add column if not exists decision_history jsonb not null default '[]'::jsonb;
