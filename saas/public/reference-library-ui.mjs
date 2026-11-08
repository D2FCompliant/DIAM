import {esc} from './report-template.mjs';
const programs={PA_DGFIP:'PA / DGFiP',SC_RLFC:'SC / Solution Compatible',CUSTOM_CDC:'Autre / ISO / programme personnalisé'};
const statuses={DRAFT:'À vérifier',VALIDATED:'Validé par l’administrateur',RETIRED:'Retiré pour les nouveaux audits'};
export function bindReferenceLibrary({api,run,showTab}){
 const el=id=>document.getElementById(id);let docs=[];
 async function load(){docs=await api('/api/reference-library');el('referenceExisting').innerHTML='<option value="">Nouveau fichier à charger</option>'+docs.map((d,i)=>`<option value="${i}">${esc(d.original_name)}</option>`).join('');
  el('referenceList').innerHTML=docs.length?`<table><thead><tr><th>Source et version</th><th>Programme</th><th>État</th><th>Fichier</th></tr></thead><tbody>${docs.map(d=>`<tr><td>${esc(d.catalogue?.title||'À cataloguer')}<br>${esc(d.catalogue?.edition||'Version à renseigner')}</td><td>${esc(programs[d.catalogue?.program]||'À choisir')}</td><td>${esc(statuses[d.catalogue?.status]||statuses.DRAFT)}</td><td>${esc(d.original_name)}<br><small>SHA-256 : ${esc(d.sha256)}</small></td></tr>`).join('')}</tbody></table>`:'Aucun référentiel chargé.';
 }
 el('openReferenceAdmin').onclick=()=>{showTab('admin');run(load,'referenceStatus');};
 el('reloadReferences').onclick=()=>run(load,'referenceStatus');
 el('referenceExisting').onchange=()=>{const value=el('referenceExisting').value,d=value===''?null:docs[Number(value)],c=d?.catalogue;for(const field of ['title','edition','origin','scope'])el('reference-'+field).value=c?.[field]||'';el('reference-program').value=c?.program||'PA_DGFIP';el('reference-state').value=c?.status||'DRAFT';el('referenceFile').disabled=Boolean(d);};
 el('saveReference').onclick=()=>run(async()=>{
  const metadata=Object.fromEntries(['title','edition','origin','scope'].map(k=>[k,el('reference-'+k).value.trim()]));if(Object.values(metadata).some(v=>!v))throw new Error('Renseigne le titre exact, la version, l’origine et le périmètre.');
  metadata.program=el('reference-program').value;metadata.status=el('reference-state').value;
  const selected=el('referenceExisting').value;let doc=selected===''?null:docs[Number(selected)];
  el('saveReference').disabled=true;
  try{if(!doc){const file=el('referenceFile').files[0];if(!file)throw new Error('Choisis le fichier source du référentiel.');if(file.size>45*1024*1024)throw new Error('Fichier limité à 45 Mo.');const form=new FormData();form.set('file',file);form.set('document_type','REGULATORY_REFERENCE');form.set('document_scope','GLOBAL');doc=await api('/api/documents',{method:'POST',body:form});}
   await api('/api/reference-library',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...metadata,document_id:doc.id})});await load();el('referenceFile').value='';el('referenceFile').disabled=false;el('referenceStatus').textContent='Référentiel enregistré. L’affectation à une mission et la validation des contrôles restent explicites.';
  }finally{el('saveReference').disabled=false;}
 },'referenceStatus');
}
