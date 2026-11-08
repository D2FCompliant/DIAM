import {esc} from './report-template.mjs';
export function guideFacts(chain=[],reviews=[],lifecycle,cyber){
 const pending=chain.filter(q=>!q.reponse_statut||q.reponse_statut==='NOT_STARTED').length;
 const open=chain.filter(q=>q.constat&&q.statut_constat!=='CLOSED').length;
 const matrix=x=>!x?'État non chargé':`${x.assessment?.tests?.filter(t=>t.effective==='NOT_STARTED').length||0} points non évalués · ${x.assessment?.issues?.length||0} observations à examiner`;
 return {pending,open,pa:chain.some(q=>q.reference==='DGFiP-3.9'),phases:new Set(reviews.filter(r=>r.status==='COMPLETED').map(r=>r.phase)).size,lifecycle:matrix(lifecycle),cyber:matrix(cyber)};
}
export function bindGuide({api,getMission,getMissions,getChain,openMission,showTab,run}){
 const el=id=>document.getElementById(id);let serial=0;
 async function open(){const mine=++serial,m=getMission();showTab('guide');el('guideMissionSelect').innerHTML='<option value="">Choisir une mission existante</option>'+getMissions().map(x=>`<option value="${esc(x.id)}" ${x.id===m?.id?'selected':''}>${esc(x.number)} — ${esc(x.title)}</option>`).join('');
  el('guideMissionName').textContent=m?`${m.number} — ${m.title}`:'Commence par choisir ou créer une mission.';
  el('guideSteps').replaceChildren();el('guideStatus').textContent=m?'Chargement des éléments enregistrés…':'';
  if(!m)return;
  const paths=[`/api/documents?mission_id=${m.id}&include_global=true`,`/api/dossier-reviews?mission_id=${m.id}`];const pa=getChain().some(q=>q.reference==='DGFiP-3.9');if(pa)paths.push(`/api/lifecycle?mission_id=${m.id}`,`/api/cyber?mission_id=${m.id}`);
  const values=await Promise.allSettled(paths.map(p=>api(p)));if(mine!==serial||getMission()?.id!==m.id)return;
  const data=values.map(x=>x.status==='fulfilled'?x.value:null),f=guideFacts(getChain(),data[1]||[],data[2],data[3]);
  el('guideStatus').textContent=values.some(x=>x.status==='rejected')?'Certains états sont indisponibles. Actualise avant de conclure.':'';
  const steps=[
   ['Fiche mission','Confirme le client, le périmètre, la période et la version du référentiel.',m.audit_period?'Période enregistrée — périmètre à revoir':'Période auditée à renseigner','Vérifier la fiche',()=>showTab('mission_form')],
   ['Lettre et plan d’audit','Définis la mission, les séances, les participants et leurs disponibilités ; recueille la confirmation du client.','Ouvrir le dossier de préparation pour vérifier son état','Préparer et planifier',()=>el('openAuditPlanning').click()],
   ['Documents & IA','Ajoute les pièces du client. Sépare-les des référentiels et du dossier exemple.',data[0]?`${data[0].filter(d=>d.document_scope!=='GLOBAL').length} documents de mission · ${data[0].filter(d=>d.document_scope==='GLOBAL').length} sources en bibliothèque`:'Documents non chargés','Charger le dossier',()=>showTab('documents')],
   ['Préparation d’audit','Sélectionne les sources. DIAM propose les points à clarifier, les pièces à demander et les tests à conduire.',`${f.phases} volet(s) documentaire(s) préparé(s) — propositions à valider`,'Préparer le dossier',()=>el('openDossier').click()],
   ['Chaîne d’audit','Pour chaque exigence : examiner la réponse, ouvrir la source, réaliser le contrôle et enregistrer la conclusion.',`${f.pending} / ${getChain().length} contrôles non évalués`,'Examiner les contrôles',()=>showTab('audit')],
   ...(pa?[
    ['Cycles de vie','Vérifie les statuts obligatoires et optionnels, leur applicabilité et les traces de chaque scénario.',f.lifecycle,'Conduire les tests',()=>el('openLifecycle').click()],
    ['Cybersécurité','Examine chaque domaine, documente les tests et rattache les preuves réellement obtenues.',f.cyber,'Examiner la cybersécurité',()=>el('openCyber').click()]
   ]:[]),
   ['Constats et réponses client','Documente les écarts, recueille les réponses et réalise les contre-tests avant de clôturer.',`${f.open} constat(s) non clôturé(s)`,'Traiter les constats',()=>showTab('audit')],
   [pa?'Rapport DGFiP':'Rapport d’audit','Revois les conclusions, annexes, réponses, traductions, signature et archivage avant toute transmission.',f.pending||f.open?'Des points restent à traiter. Le rapport doit les restituer.':'Revue finale de l’auditeur requise','Préparer le rapport',()=>el('topReport').click()]
  ];
  el('guideSteps').innerHTML=steps.map((s,i)=>`<article class="guideStep"><span class="guideNumber">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(s[0])}</h3><p>${esc(s[1])}</p><p class="guideState">${esc(s[2])}</p></div><button type="button" data-guide-action="${i}">${esc(s[3])} <span aria-hidden="true">→</span></button></article>`).join('');
  el('guideSteps').querySelectorAll('[data-guide-action]').forEach(b=>b.onclick=()=>{if(getMission()?.id===m.id)steps[Number(b.dataset.guideAction)][4]();});
 }
 el('openGuide').onclick=()=>run(open,'guideStatus');el('refreshGuide').onclick=()=>run(open,'guideStatus');
 el('guideOpenMission').onclick=()=>run(()=>openMission(el('guideMissionSelect').value),'guideStatus');
 el('guideNewMission').onclick=()=>el('topNewMission').click();
 el('toggleExpert').onclick=()=>{const guided=document.body.classList.toggle('guidedMode');el('toggleExpert').textContent=guided?'Tous les écrans':'Navigation guidée';};
 return {open};
}
