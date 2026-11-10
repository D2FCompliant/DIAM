import {FINDING_MODEL} from '../public/audit-proposal.mjs';
// Deterministic documentary retrieval. This module never invokes an AI provider.
export const DOCUMENTARY_VERSION='diam-documentary-3';
const stop=new Set('avec pour dans des les une sur par aux est sont doit doivent cette ces qui que sans tous tout plus afin être entre leur leurs from with this that shall must and the for des lors ou du le la un de et en au of to as an is be on or it its by at'.split(' '));
const normalized=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const cleanCriterion=s=>String(s||'').replace(/^\[[^\]]*\]\s*/,'').replace(/\[Contexte source[\s\S]*$/,'').replace(/^§[0-9.]+\s*/, '');
const compact=s=>normalized(s).replace(/\s+/g,' ').trim();
const tokens=s=>[...new Set((normalized(s).match(/[a-z0-9][a-z0-9_-]{2,}/g)||[]).filter(t=>!stop.has(t)))];
export function validateExtractions(input,documents){if(!Array.isArray(input)||input.length!==documents.length)throw Error('Extraction attendue pour chaque document sélectionné.');const seen=new Set();let size=0;return input.map(x=>{const d=documents.find(d=>d.id===x.document_id);if(!d||seen.has(d.id)||x.source_sha256!==d.sha256)throw Error('Extraction étrangère, dupliquée ou périmée.');seen.add(d.id);if(!Array.isArray(x.pages)||!x.pages.length||x.pages.length>3000)throw Error('Nombre de pages invalide : maximum 3 000 par document et par extraction.');const pages=x.pages.map((p,i)=>{if(p.page!==i+1||typeof p.text!=='string'||p.text.length>150000)throw Error('Pages non séquentielles ou texte trop volumineux.');size+=p.text.length;if(size>10000000)throw Error('Lot extrait supérieur à 10 millions de caractères : divise le dossier en lots cohérents.');return {page:p.page,text:p.text};});return {document_id:d.id,source_sha256:d.sha256,extractor:String(x.extractor||'Extraction déclarée').slice(0,100),pages};});}
function passages(target,docs,indexes,{criterion=false}={}){
 const terms=tokens(cleanCriterion(target.expected||target.requirement||'')+' '+cleanCriterion(target.title)).filter(t=>!['referentiel','controle','logiciel','audit','nf525','document','exigences','partie','annexe','version','utilisation','premiere','depuis','debut','cas','notamment','permet','permettre','pouvoir','systeme','est-ce','respecte','obligation','comment','mettez','oeuvre','dispositions','relatives'].includes(t)),out=[];
 const ref=String(target.source?.match(/EX-[\d.]+/i)?.[0]||target.control||target.id||'').replace(/^§/,'');
 for(const doc of docs){const index=indexes.find(x=>x.document_id===doc.id);if(!index)continue;
  // The stored requirement identifies the original reference file, not every library file.
  const namedDocument=!criterion&&[...cleanCriterion(target.expected||'').matchAll(/\(([A-Z]{3,8})\)/g)].some(m=>new RegExp('(?:^|[/! _-])'+m[1]+'(?:[_. -]|$)','i').test(doc.original_name));
  const sourceTitle=String(target.expected||'').match(/^\[([^—]+) —/)?.[1]?.trim();
  if(criterion&&sourceTitle&&!normalized(doc.original_name).includes(normalized(sourceTitle)))continue;
  for(const p of index.pages){const plain=normalized(p.text),matches=terms.filter(t=>plain.includes(t));
   const body=compact(cleanCriterion(target.expected||target.requirement||'')),paragraph=compact(p.text);
   const exactText=criterion&&paragraph.length>=40&&body.includes(paragraph);
   const anchored=criterion&&new RegExp('(?:^|\\s|§)'+ref.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![.0-9])').test(p.text);
   if(criterion&&!anchored&&!exactText)continue;
   if(!criterion&&!namedDocument&&matches.length<Math.min(3,Math.max(2,terms.length)))continue;
   // Preserve complete sentences, not a fixed 900-character slice through a fact.
   const blocks=[...p.text.matchAll(/[^.!?]+(?:[.!?](?=\s+[A-ZÀ-Ý]|$)|$)/g)].filter(m=>m[0].trim());
   const candidates=blocks.length?blocks:[{0:p.text,index:0}];
   const block=criterion?{0:p.text,index:0}:candidates.sort((a,b)=>terms.filter(t=>normalized(b[0]).includes(t)).length-terms.filter(t=>normalized(a[0]).includes(t)).length)[0];
   if(!block)continue;const text=block[0],blockMatches=terms.filter(t=>normalized(text).includes(t));if(!criterion&&!namedDocument&&(blockMatches.length<Math.min(3,Math.max(2,terms.length))||blockMatches.length/(terms.length||1)<0.16))continue;const score=blockMatches.length/(terms.length||1)+(anchored||exactText?2:0)+(namedDocument?1:0);
   // Full text stays accessible in the original; unusually large unsegmented blocks are explicit limits.
   const truncated=text.length>6000,excerpt=truncated?text.slice(0,6000):text;
   out.push({document_id:doc.id,source_sha256:doc.sha256,page:p.page,section:criterion?'Critère '+(target.control||target.id):'Déclaration documentaire à examiner',excerpt,start:block.index||0,end:(block.index||0)+excerpt.length,truncated,score});
  }
 }
 return out.sort((a,b)=>b.score-a.score||a.document_id.localeCompare(b.document_id)||a.page-b.page).slice(0,3).map(({score,...c})=>c);
}
function sourceLabel(c,docs){return `${docs.find(d=>d.id===c.document_id)?.original_name?.split('/').at(-1)||c.document_id} — repère ${c.page}`;}
function documentaryFacts(sources,docs,indexes,target){
 const facts=[];const add=(text,citation,kind)=>facts.push({text,citation,kind});
 for(const c of sources)add(`Déclaration documentée : « ${c.excerpt} »`,c,'DECLARATION');
 // Document qualification uses exact, located metadata. A date alone never proves obsolescence.
 if(!/document|specification|version|qualite|conception/.test(normalized(cleanCriterion(target.expected||target.title))))return facts;
 for(const id of new Set(sources.map(c=>c.document_id))){const seen=new Set();const index=indexes.find(x=>x.document_id===id);for(const p of index.pages){
  const tests=[[/exemple simplifi[ée]/i,'Le document se présente comme un exemple simplifié.'],[/\[Nom (?:du|de la) [^\]]+\]/i,'Le document contient une rubrique laissée sous forme de champ à renseigner.'],[/possible au changement/i,'La version est accompagnée de la mention « Possible au changement ».']];
  for(const [re,text] of tests){const match=re.exec(p.text);if(!match||seen.has(text))continue;seen.add(text);const start=Math.max(0,p.text.lastIndexOf('\n',match.index)+1),end=p.text.indexOf('\n',match.index+match[0].length);const excerpt=p.text.slice(start,end<0?p.text.length:end);add(text,{document_id:id,source_sha256:docs.find(d=>d.id===id)?.sha256,page:p.page,section:'Qualification du document',excerpt,start,end:start+excerpt.length},'DOCUMENT_LIMIT');}
 } }
 return facts;
}
export function documentaryReview(targets,documents,indexes,context={}){
 const limitations=['Les propositions sont limitées aux déclarations documentaires citées ; les tests d’exécution, tableaux complexes et documents visuels restent à examiner.'];
 for(const d of documents){const index=indexes.find(x=>x.document_id===d.id),empty=index.pages.filter(p=>p.text.trim().length<20);if(index.extractor==='manual-review-required')limitations.push(`${d.original_name} : pièce à examiner visuellement ; aucune analyse textuelle effectuée.`);else if(empty.length)limitations.push(`${d.original_name} : ${empty.length} page(s) sans texte exploitable ; prévoir OCR ou contrôle visuel.`);if(d.role==='REFERENCE'&&d.reference?.status!=='VALIDATED')limitations.push(`${d.original_name} : version / applicabilité à valider dans la bibliothèque avant toute conclusion.`);}
 const items=targets.map(t=>{
  const sources=passages(t,documents.filter(d=>d.role==='CLIENT'),indexes),criteria=passages(t,documents.filter(d=>d.role==='REFERENCE'),indexes,{criterion:true});
  const facts=documentaryFacts(sources,documents,indexes,t),issues=facts.filter(f=>f.kind==='DOCUMENT_LIMIT');
  const requirement=t.expected||t.requirement||t.title;
  const limits=[...(!criteria.length?['Le critère source n’est pas localisé avec certitude dans les fichiers sélectionnés ; sa référence doit être vérifiée avant qualification.']:[]),...sources.filter(c=>c.truncated).map(c=>`${sourceLabel(c,documents)} : passage supérieur à 6 000 caractères ; consulter la source intégrale.`),'Aucun test d’exécution n’est attesté par cette préparation.'];
  const observed=facts.map(f=>f.text+' ['+sourceLabel(f.citation,documents)+']').join('\n\n')||'Aucun fait documentaire pertinent n’a été isolé pour ce contrôle. Ce résultat ne démontre ni une absence de preuve ni une non-conformité.';
  const relevantMethod=t.verification_method&&!/préciser par l.auditeur|référentiel libre/i.test(t.verification_method)?t.verification_method:'';
  const action=issues.length?'Obtenir une édition finalisée et approuvée des documents cités, et confirmer leur rattachement au périmètre « '+(context.client_scope?.declared_scope||'de la mission')+' ».':'Faire confirmer par le client les déclarations citées et leur application à la version et à l’environnement audités.';
  const countertest=relevantMethod||`Pour le contrôle ${t.control||t.id}, comparer chaque obligation du critère ci-dessus à la version approuvée des pièces citées ; consigner pour chaque obligation la page ou l’enregistrement qui la couvre, le résultat observé et les exceptions. ${issues.length?'Après remise de la version finalisée, vérifier la suppression des champs provisoires et son approbation.':'Faire réaliser les opérations décrites dans le critère lorsque celui-ci exige un comportement du système ; conserver entrée, sortie et trace datée.'}`;
  const conclusion=!sources.length?'Pièces complémentaires à demander ; aucune qualification de conformité proposée.':issues.length?'Observation documentaire à soumettre au contradictoire : pièces comportant des mentions provisoires. Qualification par rapport au critère à valider.':'Déclarations documentaires localisées ; leur couverture du critère et leur effectivité restent à valider.';
  const proposal={model:FINDING_MODEL,requirement,observation:observed+(issues.length?'\n\nAnalyse : les mentions provisoires citées nécessitent une confirmation de la version approuvée et applicable de ces pièces. Leur présence ne suffit pas, à elle seule, à établir un écart au critère.':'\n\nAnalyse : les éléments cités sont des déclarations documentaires ; leur rapprochement obligation par obligation avec le critère et les résultats de test reste à consigner.'),limits,risk:issues.length?'Risque à examiner : utiliser des documents provisoires pour apprécier un produit ou une version non rattachés au périmètre.':'Risque à examiner : conclure sur une déclaration documentaire sans vérifier le résultat attendu par le critère.',action,contradictory:'Réponse client non recueillie pour cette proposition. Cause, responsable et échéance non établis.',countertest,conclusion,facts};
  const evidence=issues.length?'Édition approuvée des documents cités, historique de version et validation de leur applicabilité au périmètre.':`Pour ${t.control||t.id}, fournir les pièces ou traces identifiées obligation par obligation dans le contre-test, avec leur version, date et environnement.`;
  return {...t,status:sources.length?'CLARIFY':'REQUEST_EVIDENCE',finding:conclusion,proposal,sources:[...sources,...issues.map(f=>f.citation)].filter((c,i,a)=>a.findIndex(x=>x.document_id===c.document_id&&x.page===c.page&&x.excerpt===c.excerpt)===i),criteria,warnings:limits,test:countertest,evidence_request:evidence,interlocutor:'Responsable des documents cités ; identité à confirmer.'};
 });
 return {summary:`${items.filter(i=>i.sources.length).length} propositions documentaires sourcées ; ${items.filter(i=>!i.sources.length).length} contrôles nécessitent des pièces ou un examen complémentaire.`,notice:'Propositions à revoir et valider par l’auditeur. Les déclarations citées ne valent pas résultat de test. Les décisions existantes restent inchangées.',limitations,items,additional_requirements:[],engine:DOCUMENTARY_VERSION,finding_model:FINDING_MODEL};
}
