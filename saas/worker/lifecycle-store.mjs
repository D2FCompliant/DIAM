import { LIFECYCLE_FILE, blankLifecycle, normalizeLifecycle, assessLifecycle } from '../public/lifecycle.mjs';
export async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
export async function readLifecycle(db,tenantId,missionId,questionId,evidences,config={file:LIFECYCLE_FILE,blank:blankLifecycle,normalize:normalizeLifecycle,assess:assessLifecycle}) {
  const evidence=evidences.find(e=>e.original_name===config.file&&e.question_id===questionId&&e.tenant_id===tenantId&&e.mission_id===missionId);
  if(!evidence) return {dossier:config.blank(missionId),assessment:config.assess(null),evidence:null,integrity:'Non constituée'};
  try {
    if(evidence.file_size>1024*1024) throw new Error('Matrice trop volumineuse.');
    if(!evidence.storage_path?.startsWith(`${tenantId}/${missionId}/`)) throw new Error('Chemin de stockage extérieur à la mission.');
    const bytes=await db.downloadFromBucket('diam-evidence',evidence.storage_path);
    if(await sha256(bytes)!==evidence.sha256) throw new Error('Empreinte de la matrice différente du dépôt.');
    const dossier=config.normalize(JSON.parse(new TextDecoder().decode(bytes)),missionId,evidences);
    return {dossier,assessment:config.assess(dossier,evidences),evidence:{id:evidence.id,number:evidence.number,sha256:evidence.sha256,uploaded_at:evidence.uploaded_at},integrity:'SHA-256 de la matrice relu et vérifié'};
  } catch(e) {
    return {dossier:null,assessment:{...config.assess(null),issues:[`Dernière matrice inexploitable : ${e.message}`]},evidence:{id:evidence.id,number:evidence.number},integrity:'ÉCHEC — matrice non exploitable'};
  }
}
export function applyLifecycleGate(chain,lifecycle) {
  return chain.map(r=>{
    if(r.reference!=='DGFiP-3.9'||lifecycle.assessment.status==='COMPLIANT') return r;
    const status=r.reponse_statut==='NON_COMPLIANT'||lifecycle.assessment.status==='NON_COMPLIANT'?'NON_COMPLIANT':'NOT_STARTED';
    return {...r,recorded_reponse_statut:r.reponse_statut,reponse_statut:status,report_limitation:lifecycle.assessment.issues.join(' ')||'Échec de test de cycle de vie.'};
  });
}

export function applyEvidenceGates(chain, evidences) {
  const proofs=new Map(evidences.map(e=>[e.id,e]));
  return chain.map(r=>{
    if(!['COMPLIANT','NOT_APPLICABLE'].includes(r.reponse_statut)) return r;
    const missing=[];
    if(!r.analyse_auditeur?.trim()) missing.push('Analyse / justification de l’auditeur manquante.');
    if(r.reponse_statut==='COMPLIANT' && !r.evidence_ids?.some(id=>/^[a-f0-9]{64}$/i.test(proofs.get(id)?.sha256||''))) missing.push('Aucune pièce probante avec empreinte rattachée.');
    return missing.length?{...r,recorded_reponse_statut:r.recorded_reponse_statut||r.reponse_statut,reponse_statut:'NOT_STARTED',report_limitation:[r.report_limitation,...missing].filter(Boolean).join(' ')}:r;
  });
}
export function applyCyberGate(chain,cyber) {
 return chain.map(r=>{const gaps=cyber.assessment.tests.filter(t=>t.control===r.reference&&!['COMPLIANT','NOT_APPLICABLE'].includes(t.effective));if(!gaps.length)return r;
 const failed=gaps.some(t=>t.effective==='NON_COMPLIANT');
 return {...r,recorded_reponse_statut:r.recorded_reponse_statut||r.reponse_statut,reponse_statut:r.reponse_statut==='NON_COMPLIANT'||failed?'NON_COMPLIANT':'NOT_STARTED',report_limitation:[r.report_limitation,...gaps.map(t=>`${t.title} : ${t.missing.join(' ')||t.observed||'Non évalué'}`)].filter(Boolean).join(' ')};
 });
}
