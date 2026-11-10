import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../supabase/migrations/202611100001_normative_rubric_model.sql',import.meta.url),'utf8');

test('normative migration creates independent axes, attestations and explicit many-to-many coverage',()=>{
  for(const table of ['diam_audit_rubrics','diam_rubric_obligations','diam_rubric_attestations','diam_rubric_evidence_coverage','diam_obligation_relations'])assert.match(sql,new RegExp(`create table if not exists public\\.${table}`,'i'));
  assert.match(sql,/applicability_state[\s\S]+examination_state[\s\S]+compliance_result/i);
  assert.match(sql,/unique\(rubric_id, question_id, evidence_id\)/i);
  assert.match(sql,/function public\.diam_save_rubric_attestation[\s\S]+insert into public\.diam_rubric_attestations[\s\S]+update public\.diam_audit_rubrics[\s\S]+insert into public\.diam_audit_events/i);
  assert.match(sql,/grant execute to service_role|grant execute on function[\s\S]+to service_role/i);
});

test('PEEK backfill is non destructive and never infers compliance',()=>{
  assert.doesNotMatch(sql,/\b(delete from|truncate|drop table|update public\.diam_(questions|answers|findings|evidences))\b/i);
  assert.match(sql,/compliance_result text not null default 'UNDETERMINED'/i);
  assert.match(sql,/HUMAN_REVIEW_REQUIRED/);
});
