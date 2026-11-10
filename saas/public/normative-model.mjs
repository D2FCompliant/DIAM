const AXES = {
  applicability: new Set(['APPLICABLE','CONDITIONAL','NOT_APPLICABLE']),
  examination: new Set(['NOT_STARTED','EXAMINED','MORE_CHECKS','COMPLETED']),
  compliance: new Set(['UNDETERMINED','COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT'])
};

export const NORMATIVE_STATES = Object.freeze({
  applicability: [...AXES.applicability],
  examination: [...AXES.examination],
  compliance: [...AXES.compliance]
});

export function normativeReference(value='') {
  const raw=String(value).trim();
  const dictionary=raw.match(/\bR(?:12|13|19)\b/i)?.[0]?.toUpperCase()||'';
  const match=raw.match(/(?:§\s*)?(\d+(?:\.\d+)+)/);
  const components=match?match[1].split('.').map(Number):[];
  const exact=match?`§${components.join('.')}`:(dictionary||raw);
  const level=components.length;
  const rubricComponents=level>=4?components.slice(0,3):components;
  const domainComponents=components.slice(0,Math.min(2,components.length));
  return {
    raw, exact, level, components,
    domainReference: domainComponents.length?`§${domainComponents.join('.')}`:'',
    rubricReference: rubricComponents.length?`§${rubricComponents.join('.')}`:(dictionary||exact),
    dictionaryReference: dictionary,
    kind: dictionary?'NORMATIVE_DICTIONARY':level>=4?'ELEMENTARY_OBLIGATION':level===3?'EVALUATION_RUBRIC':level>0?'AUTONOMOUS_RUBRIC':'UNSTRUCTURED'
  };
}

export function obligationNature(text='') {
  const value=String(text).replace(/\s+/g,' ').trim();
  if(!value)return {nature:'EXPLANATORY',needsReview:true,basis:'Texte vide ou non exploitable'};
  if(/\b(si|lorsque|dans le cas où|sous réserve|le cas échéant|pour les catégories?)\b/i.test(value))return {nature:'CONDITIONAL',needsReview:true,basis:'Condition d’application détectée dans le texte'};
  if(/\b(peut|facultati(?:f|ve)|optionnel(?:le)?)\b/i.test(value))return {nature:'OPTIONAL',needsReview:true,basis:'Caractère facultatif ou possibilité détecté'};
  if(/\b(doit|doivent|est tenu|il est obligatoire|exige)\b/i.test(value))return {nature:'MANDATORY',needsReview:true,basis:'Formulation impérative détectée'};
  return {nature:'EXPLANATORY',needsReview:true,basis:'Nature à confirmer par l’administrateur du référentiel'};
}

export function groupNormativeControls(controls=[]) {
  const groups=new Map();
  for(const control of controls){
    const parsed=normativeReference(control.reference||control.source||'');
    const key=parsed.rubricReference||control.reference;
    if(!groups.has(key))groups.set(key,{reference:key,domain_reference:parsed.domainReference,title:'',normative_level:parsed.level>=4?3:parsed.level,obligations:[]});
    const nature=obligationNature(`${control.title||''} ${control.requirement||''}`);
    const group=groups.get(key);if(!group.title&&(parsed.exact===key||parsed.level<=3))group.title=control.title||control.chapter||'';
    group.obligations.push({...control,normative:parsed,obligation_nature:nature.nature,nature_reviewed:false,nature_basis:nature.basis});
  }
  return [...groups.values()];
}

export function rubricContradictions(rubric={}, obligations=[], findings=[]) {
  const issues=[];
  const applicable=obligations.filter(o=>(o.applicability_state||'CONDITIONAL')!=='NOT_APPLICABLE');
  if(rubric.compliance_result==='COMPLIANT'&&applicable.some(o=>(o.individual_result||o.legacy_result)==='NON_COMPLIANT'))issues.push('Rubrique déclarée conforme alors qu’une obligation applicable est non conforme.');
  if(rubric.examination_state==='COMPLETED'&&applicable.some(o=>String(o.verification_remaining||'').trim()&&o.coverage_state!=='COVERED'))issues.push('Rubrique déclarée terminée alors que des vérifications bloquantes restent ouvertes.');
  if(rubric.applicability_state==='NOT_APPLICABLE'&&!String(rubric.applicability_justification||'').trim())issues.push('Non-applicabilité sans justification.');
  if(rubric.compliance_result==='PARTIALLY_COMPLIANT'&&!String(rubric.consolidation_justification||rubric.conclusion||'').trim())issues.push('Conformité partielle sans observation ou justification.');
  if(findings.some(f=>f.status==='CLOSED'&&!String(f.closure_comment||'').trim()))issues.push('Constat clôturé sans décision ou vérification documentée.');
  return issues;
}

export function assertNormativeState(axis,value){
  if(!AXES[axis]?.has(value))throw new Error(`État ${axis} invalide : ${value}`);
  return value;
}
