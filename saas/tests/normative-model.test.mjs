import test from 'node:test';
import assert from 'node:assert/strict';
import {normativeReference,obligationNature,groupNormativeControls,rubricContradictions} from '../public/normative-model.mjs';

test('NF525 Part 10 groups level 4 obligations under level 3 rubric',()=>{
  const parsed=normativeReference('§6.3.1.2');
  assert.equal(parsed.domainReference,'§6.3');
  assert.equal(parsed.rubricReference,'§6.3.1');
  assert.equal(parsed.kind,'ELEMENTARY_OBLIGATION');
});

test('Part 9 autonomous level 2 remains directly evaluable',()=>{
  const parsed=normativeReference('§4.3');
  assert.equal(parsed.rubricReference,'§4.3');
  assert.equal(parsed.kind,'AUTONOMOUS_RUBRIC');
});

test('R12 R13 and R19 are normative references',()=>{
  for(const ref of ['R12','R13','R19'])assert.equal(normativeReference(ref).kind,'NORMATIVE_DICTIONARY');
});

test('obligation nature comes from wording and never hierarchy depth',()=>{
  assert.equal(obligationNature('Le logiciel doit conserver la trace.').nature,'MANDATORY');
  assert.equal(obligationNature('Si la fonction est utilisée, la trace doit être conservée.').nature,'CONDITIONAL');
  assert.equal(obligationNature('Note explicative').nature,'EXPLANATORY');
  assert.equal(groupNormativeControls([{reference:'§6.1.1.1',title:'Note',requirement:'Description'}])[0].obligations[0].obligation_nature,'EXPLANATORY');
});

test('contradictions are signalled but auditor decisions are not changed',()=>{
  const rubric={applicability_state:'NOT_APPLICABLE',applicability_justification:'',examination_state:'COMPLETED',compliance_result:'COMPLIANT'};
  const issues=rubricContradictions(rubric,[{applicability_state:'APPLICABLE',individual_result:'NON_COMPLIANT',verification_remaining:'Effectuer le contre-test',coverage_state:'PARTIAL'}],[{status:'CLOSED',closure_comment:''}]);
  assert.equal(rubric.compliance_result,'COMPLIANT');
  assert.equal(issues.length,4);
});
