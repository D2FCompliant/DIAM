export const CYBER_FILE='DIAM-CYBER-v1.json';
export const CYBER_TITLE='Cybersécurité : effectivité opérationnelle, résilience et preuves post-production';
export const CYBER_CONTROLS=[
  {
    "id": "CYB-01",
    "title": "MFA, comptes privilégiés et secours",
    "references": "DGFiP-2.2 / 7.1",
    "control": "DGFiP-2.2",
    "expected": "Tests MFA, comptes privilégiés et secours, révocation et revue des droits"
  },
  {
    "id": "CYB-02",
    "title": "Journalisation, traçabilité et intégrité",
    "references": "DGFiP-3.4 / 7.3",
    "control": "DGFiP-7.3",
    "expected": "Journaux, corrélation, intégrité et test de restitution"
  },
  {
    "id": "CYB-03",
    "title": "Protocoles sécurisés / certificats",
    "references": "DGFiP-3.3 / 3.7",
    "control": "DGFiP-3.3",
    "expected": "Certificats, validation OCSP/CRL, scan des protocoles"
  },
  {
    "id": "CYB-04",
    "title": "Idempotence, rejeu et reprise de flux",
    "references": "DGFiP-3.9 / 5.1",
    "control": "DGFiP-5.1",
    "expected": "Tests de rejeu, reprise et absence de duplication"
  },
  {
    "id": "CYB-05",
    "title": "Protection des données et isolation",
    "references": "DGFiP-6 / 7.1",
    "control": "DGFiP-6",
    "expected": "Tests de refus d’accès et isolation entre tenants"
  },
  {
    "id": "CYB-06",
    "title": "Localisation et accès de maintenance",
    "references": "DGFiP-A7",
    "control": "DGFiP-A7",
    "expected": "Contrats, liste des accès de maintenance et tests de restriction"
  },
  {
    "id": "CYB-07",
    "title": "Qualification hébergement",
    "references": "DGFiP-A5",
    "control": "DGFiP-A5",
    "expected": "Attestation de qualification et périmètre applicable"
  },
  {
    "id": "CYB-08",
    "title": "Certification ISO/IEC 27001",
    "references": "DGFiP-A6",
    "control": "DGFiP-A6",
    "expected": "Certificat ISO/IEC 27001, validité et périmètre"
  },
  {
    "id": "CYB-09",
    "title": "Conservation et restitution des preuves",
    "references": "DGFiP-A8",
    "control": "DGFiP-A8",
    "expected": "Politique de conservation, reçu SAE, restitution et durée"
  },
  {
    "id": "CYB-10",
    "title": "Réversibilité / résiliation / portabilité",
    "references": "DGFiP-A4.2 + exigence complémentaire PDP Integrity",
    "control": "DGFiP-A4.2",
    "expected": "Contrat de sortie, export et maintien du service"
  },
  {
    "id": "CYB-11",
    "title": "Gestion des incidents et notification sans délai",
    "references": "Demande opérationnelle DGFiP du 26/08/2026 ; NIS2 art. 21",
    "control": "DGFiP-7.3",
    "expected": "Procédure, registre incidents, escalade, notification et clôture"
  },
  {
    "id": "CYB-12",
    "title": "Tests d’intrusion / vulnérabilités / remédiation",
    "references": "Demande opérationnelle DGFiP du 26/08/2026 ; NIS2 art. 21",
    "control": "DGFiP-7.3",
    "expected": "Rapport de pentest, criticité, plan de correction et contre-test"
  },
  {
    "id": "CYB-13",
    "title": "PRA / PCA / gestion de crise",
    "references": "NIS2 art. 21 ; exigences complémentaires PDP Integrity",
    "control": "DGFiP-7.3",
    "expected": "Scénarios PRA/PCA, RTO/RPO, exercices et résultats de restauration"
  },
  {
    "id": "CYB-14",
    "title": "Sécurité fournisseurs / sous-traitants / support",
    "references": "NIS2 art. 21 ; DGFiP-A5/A7",
    "control": "DGFiP-A5",
    "expected": "Évaluation fournisseurs, contrats, accès de support et suivi"
  },
  {
    "id": "CYB-15",
    "title": "SLA, disponibilité, reprise et engagements de service",
    "references": "Exigences complémentaires PDP Integrity",
    "control": "DGFiP-A4.2",
    "expected": "Clauses SLA, mesures et historique de disponibilité"
  },
  {
    "id": "CYB-16",
    "title": "Services de confiance : signature, cachet, horodatage, archivage",
    "references": "DGFiP-RAPPORT / 3.3 / A8 ; eIDAS modifié par UE 2024/1183",
    "control": "DGFiP-3.3",
    "expected": "Services utilisés, certificats, révocation, horodatage et qualification applicable"
  },
  {
    "id": "CYB-17",
    "title": "Propagation inter-PA et confinement",
    "references": "DGFiP-1.3 / 3.7 / 7.3 ; attente opérationnelle DGFiP",
    "control": "DGFiP-1.3",
    "expected": "Message invalide, détection, quarantaine, confinement et traces"
  }
];
export const CYBER_FIELDS={applicability_reason:'Justification d’applicabilité',source:'Source, version et section vérifiées',scope:'Périmètre et période examinés',procedure:'Procédure et résultat attendu',observed:'Résultat observé et limites',reviewer:'Auditeur ayant effectué la revue',reviewed_at:'Date de revue ISO 8601',recommendation:'Action attendue',owner:'Responsable',due_date:'Échéance',countertest:'Contre-test et décision'};
export function blankCyber(mission_id) {return {schema:'diam.cyber/1',mission_id,mode:'REAL',tests:CYBER_CONTROLS.map(c=>({id:c.id,applicability:'UNKNOWN',result:'NOT_STARTED',evidence_ids:[],...Object.fromEntries(Object.keys(CYBER_FIELDS).map(k=>[k,'']))}))};}
export function normalizeCyber(input,missionId,proofs=[]) {
 if(input?.schema!=='diam.cyber/1'||input.mission_id!==missionId) throw new Error('Matrice Cyber : mission incorrecte.');
 if(!['REAL','DEMO'].includes(input.mode)) throw new Error('Nature de dossier invalide.');
 if(!Array.isArray(input.tests)||input.tests.length!==17||new Set(input.tests.map(t=>t.id)).size!==17) throw new Error('Les 17 domaines Cyber sont requis.');
 const d=blankCyber(missionId);d.mode=input.mode;
 d.tests=d.tests.map(def=>{const t=input.tests.find(t=>t.id===def.id);if(!t||!['UNKNOWN','YES','NO'].includes(t.applicability)||!['NOT_STARTED','COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT','NOT_APPLICABLE'].includes(t.result)) throw new Error('État Cyber invalide.');
 const row={...def,applicability:t.applicability,result:t.result};
 for(const key of Object.keys(CYBER_FIELDS)){if(typeof t[key]!=='string'||t[key].length>12000) throw new Error('Champ Cyber invalide ou trop long.');row[key]=t[key];}
 if(!Array.isArray(t.evidence_ids)||t.evidence_ids.some(id=>!proofs.some(p=>p.id===id&&p.mission_id===missionId&&p.original_name!==CYBER_FILE))) throw new Error('Preuve extérieure à la mission ou matrice utilisée comme preuve.');
 row.evidence_ids=[...new Set(t.evidence_ids)];return row;});return d;
}
export function assessCyber(d,proofs=[]) {
 const tests=CYBER_CONTROLS.map(c=>{const t=d?.tests.find(t=>t.id===c.id)||blankCyber('').tests.find(t=>t.id===c.id);const missing=[];
 if(t.applicability==='UNKNOWN') missing.push('Applicabilité à déterminer.');
 if(!t.applicability_reason?.trim()) missing.push('Justification d’applicabilité manquante.');
 if(!t.source?.trim()) missing.push('Source, version et section à vérifier.');
 if(!t.reviewer?.trim()||!Number.isFinite(Date.parse(t.reviewed_at))) missing.push('Revue datée manquante.');
 let effective=t.result;
 if(t.applicability==='NO'&&t.result==='NOT_APPLICABLE') {if(missing.length) effective='NOT_STARTED';}
 else {
 if(t.result==='NOT_APPLICABLE'||t.applicability!=='YES') missing.push('Exclusion non justifiée.');
 for(const k of ['scope','procedure','observed']) if(!t[k]?.trim()) missing.push(CYBER_FIELDS[k]+' manquant.');
 if(!t.evidence_ids.some(id=>proofs.some(p=>p.id===id&&p.mission_id===d?.mission_id&&p.original_name!==CYBER_FILE&&/^[a-f0-9]{64}$/i.test(p.sha256||'')))) missing.push('Pièce source avec empreinte manquante.');
 if(t.result!=='NON_COMPLIANT'&&(missing.length||t.result==='NOT_STARTED')) effective='NOT_STARTED';
 }
 return {...c,...t,effective,missing};});
 const issues=[];if(d?.mode==='DEMO') issues.push('Dossier exemple : aucune conformité réelle démontrée.');
 const pending=tests.filter(t=>!['COMPLIANT','NOT_APPLICABLE'].includes(t.effective));if(pending.length) issues.push(`${pending.length}/17 domaines Cyber à solder.`);
 return {status:tests.some(t=>t.effective==='NON_COMPLIANT')?'NON_COMPLIANT':pending.length||issues.length?'NOT_STARTED':'COMPLIANT',tests,issues,total:17,passed:tests.filter(t=>t.effective==='COMPLIANT').length};
}
