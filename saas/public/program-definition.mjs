import {auditQuestion} from './audit-question.mjs';
export function selectedProgramDefinition(chosen,name='') {
 if(!chosen.length)throw Error('Sélectionne au moins un contrôle avant de préparer l’audit.');
 const used=[...new Map(chosen.map(c=>[c.doc.id,c.doc])).values()];
 const proposedName=String(name).trim()||used.map(d=>d.catalogue?.title||d.original_name).filter(Boolean).join(' + ');
 if(!proposedName)throw Error('Les sources n’ont pas de titre. Renseigne le nom du type d’audit.');
 const lines=chosen.map(c=>`[${c.doc.catalogue.title} — ${c.doc.catalogue.edition} — ${c.locator}] ${c.text.replace(/\r?\n/g,' ')}${c.context?` [Contexte source : ${c.context.replace(/\r?\n/g,' ')}]`:''}`);
 return {questions:lines.map((requirement,i)=>({requirement,question:chosen[i].question||auditQuestion(chosen[i])})),name:proposedName,referentials:used.map(d=>`${d.catalogue.title} — ${d.catalogue.edition} — ${d.catalogue.origin} — document ${d.id} — SHA-256 ${d.sha256}`).join('\n'),controls:lines.join('\n')};
}
