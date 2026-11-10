-- DIAM SaaS v1.15.0 — modèle normatif générique et migration non destructive.
-- Les contrôles, réponses, constats, preuves et événements historiques restent inchangés.

create table if not exists public.diam_audit_rubrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  reference text not null,
  domain_reference text,
  normative_level integer not null default 0,
  title text,
  source text,
  applicability_state text not null default 'CONDITIONAL' check (applicability_state in ('APPLICABLE','CONDITIONAL','NOT_APPLICABLE')),
  applicability_justification text,
  examination_state text not null default 'NOT_STARTED' check (examination_state in ('NOT_STARTED','EXAMINED','MORE_CHECKS','COMPLETED')),
  compliance_result text not null default 'UNDETERMINED' check (compliance_result in ('UNDETERMINED','COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT')),
  consolidation_justification text,
  conclusion text,
  legacy_snapshot jsonb not null default '{}'::jsonb,
  consolidation_proposal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(mission_id, reference)
);

create table if not exists public.diam_rubric_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  rubric_id uuid not null references public.diam_audit_rubrics(id) on delete cascade,
  question_id uuid not null references public.diam_questions(id) on delete cascade,
  relation_type text not null default 'PRIMARY' check (relation_type in ('PRIMARY','COMPLEMENTARY','CONDITIONAL','COMMON','REFERENCE')),
  obligation_nature text not null default 'EXPLANATORY' check (obligation_nature in ('MANDATORY','CONDITIONAL','OPTIONAL','EXPLANATORY')),
  nature_reviewed boolean not null default false,
  applicability_state text not null default 'CONDITIONAL' check (applicability_state in ('APPLICABLE','CONDITIONAL','NOT_APPLICABLE')),
  applicability_justification text,
  coverage_state text not null default 'NOT_COVERED' check (coverage_state in ('NOT_COVERED','PARTIAL','COVERED')),
  individual_result text check (individual_result is null or individual_result in ('UNDETERMINED','COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT')),
  observation text,
  verification_remaining text,
  normative_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(rubric_id, question_id)
);

create table if not exists public.diam_rubric_attestations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  rubric_id uuid not null references public.diam_audit_rubrics(id) on delete cascade,
  auditor_identity text not null,
  examined_at timestamptz not null default now(),
  work_performed text not null,
  evidence_ids uuid[] not null default '{}'::uuid[],
  examination_scope text not null,
  limits text,
  exceptions text,
  conclusion text not null,
  applicability_state text not null check (applicability_state in ('APPLICABLE','CONDITIONAL','NOT_APPLICABLE')),
  applicability_justification text,
  examination_state text not null check (examination_state in ('NOT_STARTED','EXAMINED','MORE_CHECKS','COMPLETED')),
  compliance_result text not null check (compliance_result in ('UNDETERMINED','COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT')),
  consolidation_justification text,
  contradictions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.diam_rubric_evidence_coverage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  rubric_id uuid not null references public.diam_audit_rubrics(id) on delete cascade,
  question_id uuid not null references public.diam_questions(id) on delete cascade,
  evidence_id uuid not null references public.diam_evidences(id) on delete cascade,
  justification text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique(rubric_id, question_id, evidence_id)
);

create table if not exists public.diam_obligation_relations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.diam_tenants(id) on delete cascade,
  mission_id uuid not null references public.diam_missions(id) on delete cascade,
  from_question_id uuid not null references public.diam_questions(id) on delete cascade,
  to_question_id uuid references public.diam_questions(id) on delete cascade,
  external_reference text,
  relationship text not null check (relationship in ('IDENTICAL','COMPLEMENTARY','CONDITIONAL','REFERENCE')),
  rationale text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (to_question_id is not null or external_reference is not null),
  unique(from_question_id, to_question_id, external_reference, relationship)
);

create index if not exists idx_diam_rubrics_mission on public.diam_audit_rubrics(tenant_id, mission_id, reference);
create index if not exists idx_diam_rubric_obligations_rubric on public.diam_rubric_obligations(tenant_id, rubric_id);
create index if not exists idx_diam_rubric_coverage_evidence on public.diam_rubric_evidence_coverage(tenant_id, evidence_id);
create index if not exists idx_diam_rubric_attestations_rubric on public.diam_rubric_attestations(tenant_id, rubric_id, examined_at desc);
create unique index if not exists idx_diam_obligation_external_relation_unique
  on public.diam_obligation_relations(from_question_id, to_question_id, external_reference, relationship) nulls not distinct;

create or replace function public.diam_save_rubric_attestation(
  p_tenant_id uuid,
  p_mission_id uuid,
  p_rubric_id uuid,
  p_actor text,
  p_payload jsonb,
  p_contradictions jsonb
) returns uuid language plpgsql as $$
declare
  v_attestation_id uuid;
  v_update jsonb;
begin
  if not exists(select 1 from public.diam_audit_rubrics where id=p_rubric_id and tenant_id=p_tenant_id and mission_id=p_mission_id) then
    raise exception 'Rubrique étrangère à la mission';
  end if;
  insert into public.diam_rubric_attestations(tenant_id,mission_id,rubric_id,auditor_identity,work_performed,evidence_ids,examination_scope,limits,exceptions,conclusion,applicability_state,applicability_justification,examination_state,compliance_result,consolidation_justification,contradictions)
  values(p_tenant_id,p_mission_id,p_rubric_id,p_actor,p_payload->>'work_performed',array(select jsonb_array_elements_text(coalesce(p_payload->'evidence_ids','[]'::jsonb))::uuid),p_payload->>'examination_scope',p_payload->>'limits',p_payload->>'exceptions',p_payload->>'conclusion',p_payload->>'applicability_state',p_payload->>'applicability_justification',p_payload->>'examination_state',p_payload->>'compliance_result',p_payload->>'consolidation_justification',coalesce(p_contradictions,'[]'::jsonb))
  returning id into v_attestation_id;
  for v_update in select * from jsonb_array_elements(coalesce(p_payload->'obligations','[]'::jsonb)) loop
    update public.diam_rubric_obligations set
      applicability_state=v_update->>'applicability_state',
      applicability_justification=coalesce(v_update->>'applicability_justification',''),
      coverage_state=v_update->>'coverage_state',
      individual_result=case when nullif(v_update->>'individual_result','') is null then null else v_update->>'individual_result' end,
      observation=coalesce(v_update->>'observation',''),
      verification_remaining=coalesce(v_update->>'verification_remaining',''),
      updated_at=now()
    where id=(v_update->>'id')::uuid and tenant_id=p_tenant_id and rubric_id=p_rubric_id;
    if not found then raise exception 'Obligation étrangère à la rubrique'; end if;
  end loop;
  update public.diam_audit_rubrics set applicability_state=p_payload->>'applicability_state',applicability_justification=p_payload->>'applicability_justification',examination_state=p_payload->>'examination_state',compliance_result=p_payload->>'compliance_result',consolidation_justification=p_payload->>'consolidation_justification',conclusion=p_payload->>'conclusion',updated_at=now()
  where id=p_rubric_id and tenant_id=p_tenant_id;
  insert into public.diam_audit_events(tenant_id,mission_id,actor,event_type,object_type,object_id,details)
  values(p_tenant_id,p_mission_id,p_actor,'RUBRIC_EXAMINATION_ATTESTED','AUDIT_RUBRIC',p_rubric_id,jsonb_build_object('attestation_id',v_attestation_id,'applicability_state',p_payload->>'applicability_state','examination_state',p_payload->>'examination_state','compliance_result',p_payload->>'compliance_result','contradictions',coalesce(p_contradictions,'[]'::jsonb)));
  return v_attestation_id;
end;
$$;
revoke execute on function public.diam_save_rubric_attestation(uuid,uuid,uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.diam_save_rubric_attestation(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;

-- Regroupement initial : niveau 4 et au-delà sous le niveau 3 ; les niveaux 1 à 3
-- restent évaluables directement. Aucun caractère obligatoire n'est déduit de la profondeur.
with parsed as (
  select q.*,
    regexp_replace(q.reference, '^§\s*', '') as clean_ref,
    regexp_split_to_array(regexp_replace(q.reference, '^§\s*', ''), '\.') as parts
  from public.diam_questions q
), normalized as (
  select p.*,
    case when cardinality(parts) >= 4 then '§' || array_to_string(parts[1:3], '.') else p.reference end as rubric_ref,
    case when cardinality(parts) >= 2 then '§' || array_to_string(parts[1:2], '.') else null end as domain_ref,
    case when cardinality(parts) >= 4 then 3 else cardinality(parts) end as rubric_level
  from parsed p
  where clean_ref ~ '^\d+(\.\d+)+$'
), aggregates as (
  select n.tenant_id,n.mission_id,n.rubric_ref,n.domain_ref,max(n.rubric_level) rubric_level,
    min(nullif(n.chapter,'')) title,min(nullif(n.source,'')) source,
    jsonb_build_object(
      'migrated_at', now(),
      'control_count', count(*),
      'answers', coalesce(jsonb_agg(jsonb_build_object('question_id',n.id,'status',coalesce(a.compliance_status,'NOT_STARTED'),'answered_at',a.answered_at)) filter (where a.id is not null), '[]'::jsonb),
      'question_ids', jsonb_agg(n.id)
    ) legacy_snapshot
  from normalized n
  left join public.diam_answers a on a.question_id=n.id
  group by n.tenant_id,n.mission_id,n.rubric_ref,n.domain_ref
)
insert into public.diam_audit_rubrics(tenant_id,mission_id,reference,domain_reference,normative_level,title,source,legacy_snapshot,consolidation_proposal)
select tenant_id,mission_id,rubric_ref,domain_ref,rubric_level,title,source,legacy_snapshot,
  jsonb_build_object('status','HUMAN_REVIEW_REQUIRED','message','Les résultats historiques sont conservés ; aucune conclusion de rubrique n’est appliquée automatiquement.')
from aggregates
on conflict(mission_id,reference) do nothing;

with parsed as (
  select q.*,regexp_replace(q.reference, '^§\s*', '') clean_ref,regexp_split_to_array(regexp_replace(q.reference, '^§\s*', ''), '\.') parts
  from public.diam_questions q
), normalized as (
  select p.*,case when cardinality(parts)>=4 then '§'||array_to_string(parts[1:3],'.') else p.reference end rubric_ref
  from parsed p where clean_ref ~ '^\d+(\.\d+)+$'
)
insert into public.diam_rubric_obligations(tenant_id,rubric_id,question_id,relation_type,obligation_nature,nature_reviewed)
select n.tenant_id,r.id,n.id,'PRIMARY',
  case
    when (n.title||' '||n.requirement) ~* '\m(si|lorsque|dans le cas où|sous réserve|le cas échéant)\M' then 'CONDITIONAL'
    when (n.title||' '||n.requirement) ~* '\m(peut|facultatif|facultative|optionnel|optionnelle)\M' then 'OPTIONAL'
    when (n.title||' '||n.requirement) ~* '\m(doit|doivent|obligatoire|exige)\M' then 'MANDATORY'
    else 'EXPLANATORY'
  end,false
from normalized n join public.diam_audit_rubrics r on r.mission_id=n.mission_id and r.reference=n.rubric_ref
on conflict(rubric_id,question_id) do nothing;

insert into public.diam_schema_versions(id,version,product_version,label,notes)
values('current','202611100001_normative_rubric_model','1.15.0','Modèle normatif par rubrique, obligations et matrice de couverture','Migration non destructive : les contrôles, réponses, constats, preuves et historiques restent inchangés. Les conclusions de rubrique sont indéterminées jusqu’à décision explicite de l’auditeur.')
on conflict(id) do update set version=excluded.version,product_version=excluded.product_version,label=excluded.label,notes=excluded.notes,applied_at=now();
