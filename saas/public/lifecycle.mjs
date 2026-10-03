// Shared dossier contract: no fabricated observations, identifiers or proof hashes.
export const LIFECYCLE_FILE = 'DIAM-CYCLE-VIE-v1.json';
export const LIFECYCLE_SCHEMA = 'diam.invoice-lifecycle/1';
export const STATUSES = [
  [200,'Déposée',true,'PA d’émission'],[201,'Émise par la plateforme',false,'PA d’émission'],
  [202,'Reçue par la plateforme',false,'PA de réception'],[203,'Mise à disposition',false,'PA de réception'],
  [204,'Prise en charge',false,'Acheteur'],[205,'Approuvée',false,'Acheteur'],
  [206,'Approuvée partiellement',false,'Acheteur'],[207,'En litige',false,'Acheteur'],
  [208,'Suspendue',false,'Acheteur'],[209,'Complétée',false,'Vendeur'],
  [210,'Refusée',true,'Acheteur / destinataire'],[211,'Paiement transmis',false,'Acheteur'],
  [212,'Encaissée',true,'Vendeur / émetteur'],[213,'Rejetée',true,'PA']
].map(([code,label,mandatory,actor])=>({code,label,mandatory,actor}));
const negatives = [
  '212 avant existence de la facture : refus', '205 avant mise à disposition : règle de workflow respectée',
  '200 répété : absence de doublon métier', '213 après clôture incompatible : transition refusée',
  '210 par acteur non habilité : refus', '212 de montant négatif ou incohérent : refus',
  '212 pour facture inconnue : refus', 'Identifiant de corrélation manquant : refus',
  'Mauvais tenant : refus sans exposition de données', 'Statut reçu deux fois : idempotence',
  'Événements hors ordre : traitement conforme à la règle documentée',
  'Payload invalide : rejet documenté', 'Message altéré : détection de l’altération'
];
export const DIMENSIONS = [
  'Génération','Réception','Transmission','Restitution au SI','Acteurs habilités','Chronologie',
  'Idempotence','Corrélation','Refus distinct du rejet','Paiement transmis distinct de l’encaissement',
  'Conservation et restitution des journaux','Intégrité','Transmission à l’administration'
];
export const TESTS = [
  ...STATUSES.map(s=>({id:`CDV-${s.code}`,kind:'STATUT',code:s.code,title:`${s.code} — ${s.label}`,expected:'Génération, transmission, réception et restitution au SI vérifiées ; acteur, corrélation, journal, rejeu et événement hors ordre contrôlés.'})),
  ...['Parcours nominal selon les statuts implémentés','Rejet technique sans poursuite du flux','Refus métier restitué au vendeur','Litige et résolution','Suspension, complément et reprise','Approbation partielle sans altération de la facture'].map((title,i)=>({id:`PAR-${i+1}`,kind:'PARCOURS',title,expected:'Transitions et acteurs conformes au workflow applicable documenté ; traces à chaque étape.'})),
  ...negatives.map((title,i)=>({id:`NEG-${i+1}`,kind:'NEGATIF',title,expected:title})),
  ...DIMENSIONS.map((title,i)=>({id:`AXE-${i+1}`,kind:'TRANSVERSE',title,expected:`${title} démontrée par les traces des cas applicables.`})),
  {id:'PAY-212',kind:'PAIEMENT',code:212,title:'Encaissements partiel puis total',expected:'Rapprocher facture, encaissements datés et solde ; conserver le montant initial. Exemple de scénario à exécuter : 1 200 EUR, 600 EUR encaissés, solde 600 EUR, puis encaissement du solde.'},
  ...['Structure invalide','Règle sémantique invalide','Montants incohérents','Donnée obligatoire absente','Identité ou adresse invalide','Doublon de facture'].map((title,i)=>({id:`REJ-${i+1}`,kind:'REJET',code:213,title,expected:'Rejet motivé, horodaté, corrélé et restitué ; absence de poursuite du flux normal.'}))
];
export const TEST_FIELDS = {
  initial_state:'Situation initiale',actor:'Acteur réellement utilisé',trigger:'Déclencheur',
  previous_status:'Statut précédent',next_status:'Statut suivant autorisé',transition_rule:'Règle / transition interdite',
  invoice_id:'Identifiant facture (ou valeur volontairement invalide du test)',correlation_id:'Identifiant de corrélation du test',
  message_id:'Identifiant du message / de la requête de test',timestamp:'Horodatage ISO 8601 issu des traces',
  journal_reference:'Référence de journal',observed:'Résultat observé',reception:'Réception observée',
  si_restitution:'Restitution au SI',replay:'Résultat du rejeu',out_of_order:'Résultat hors ordre',
  payment_date:'Date d’encaissement',invoice_amount:'Montant initial',payment_amount:'Montant encaissé',
  balance:'Solde restant',currency:'Devise',justification:'Justification de non-applicabilité'
};
export function blankLifecycle(missionId='') {
  return {schema:LIFECYCLE_SCHEMA,mission_id:missionId,control:'DGFiP-3.9',mode:'REAL',
    reference_version:'',reference_locator:'',scope:'',reviewer:'',reviewed_at:'',
    statuses:STATUSES.map(s=>({code:s.code,implemented:s.mandatory?'YES':'UNKNOWN',justification:''})),
    tests:TESTS.map(t=>({id:t.id,result:'NOT_STARTED',...Object.fromEntries(Object.keys(TEST_FIELDS).map(k=>[k,''])),evidence_ids:[],payload_evidence_id:''}))};
}
const text = v => { if(typeof v!=='string') return ''; if(v.length>12000) fail('Un champ dépasse la limite de 12 000 caractères.'); return v.trim(); };
function fail(message) { throw Object.assign(new Error(message),{status:400}); }
export function normalizeLifecycle(input, missionId, evidences=[]) {
  if (!input || input.schema!==LIFECYCLE_SCHEMA || input.mission_id!==missionId || input.control!=='DGFiP-3.9') fail('Dossier cycle de vie : schéma, contrôle ou mission incorrect.');
  const out=blankLifecycle(missionId);
  if (!['REAL','DEMO'].includes(input.mode)) fail('Nature du dossier obligatoire : REAL ou DEMO.');
  out.mode=input.mode;
  for(const k of ['reference_version','reference_locator','scope','reviewer','reviewed_at']) out[k]=text(input[k]);
  if (!Array.isArray(input.statuses)||input.statuses.length!==STATUSES.length || !input.statuses.every(s=>s&&typeof s==='object') || new Set(input.statuses.map(s=>s.code)).size!==STATUSES.length) fail('La matrice doit contenir exactement les 14 statuts.');
  out.statuses=STATUSES.map(s=>{
    const v=input.statuses.find(x=>x.code===s.code);
    if(!v||!['YES','NO','UNKNOWN'].includes(v.implemented)) fail(`Déclaration invalide pour ${s.code}.`);
    return {code:s.code,implemented:v.implemented,justification:text(v.justification)};
  });
  if(!Array.isArray(input.tests)||input.tests.length!==TESTS.length||!input.tests.every(t=>t&&typeof t==='object')||new Set(input.tests.map(t=>t.id)).size!==TESTS.length) fail('La campagne doit conserver tous les cas du modèle ; justifier les exclusions.');
  const allowed=new Map(evidences.filter(e=>e.mission_id===missionId).map(e=>[e.id,e]));
  out.tests=TESTS.map(def=>{
    const v=input.tests.find(t=>t.id===def.id);
    if(!v||!['NOT_STARTED','PASS','FAIL','NOT_APPLICABLE'].includes(v.result)) fail(`Résultat invalide : ${def.id}.`);
    if(!Array.isArray(v.evidence_ids)||v.evidence_ids.some(id=>!allowed.has(id))) fail(`Preuve absente ou extérieure à la mission : ${def.id}.`);
    const t={id:def.id,result:v.result,...Object.fromEntries(Object.keys(TEST_FIELDS).map(k=>[k,text(v[k])])),evidence_ids:[...new Set(v.evidence_ids)],payload_evidence_id:text(v.payload_evidence_id)};
    if(t.payload_evidence_id && (!t.evidence_ids.includes(t.payload_evidence_id)||!allowed.has(t.payload_evidence_id))) fail(`Payload non rattaché aux preuves : ${def.id}.`);
    return t;
  });
  return out;
}
export function assessLifecycle(dossier,evidences=[]) {
  if(!dossier) return {status:'NOT_STARTED',issues:['Dossier cycle de vie non constitué.'],tests:[],statuses:[],passed:0,total:TESTS.length};
  const proofs=new Map(evidences.filter(e=>e.mission_id===dossier.mission_id).map(e=>[e.id,e]));
  const issues=[];
  for(const k of ['reference_version','reference_locator','scope','reviewer','reviewed_at']) if(!dossier[k]) issues.push(`À renseigner : ${k}.`);
  if(dossier.reviewed_at && !Number.isFinite(Date.parse(dossier.reviewed_at))) issues.push('Date de revue invalide.');
  if(dossier.mode!=='REAL') issues.push('Dossier de démonstration : aucune conclusion de conformité réelle.');
  const statuses=STATUSES.map(s=>{
    const declaration=dossier.statuses.find(v=>v.code===s.code)||{implemented:'UNKNOWN',justification:''};
    if(declaration.implemented==='UNKNOWN') issues.push(`Périmètre du statut ${s.code} non déclaré.`);
    if(declaration.implemented==='NO'&&!declaration.justification) issues.push(`Exclusion ${s.code} non justifiée.`);
    if(s.mandatory&&declaration.implemented==='NO') issues.push(`Capacité obligatoire ${s.code} non démontrée : ${declaration.justification||'absence de justification'}.`);
    return {...s,...declaration};
  });
  const tests=TESTS.map(def=>{
    const t=dossier.tests.find(v=>v.id===def.id)||{id:def.id,result:'NOT_STARTED',evidence_ids:[]};
    const missing=[];
    const declaration=statuses.find(s=>s.code===def.code);
    const excluded=def.kind==='STATUT'&&!declaration?.mandatory&&declaration?.implemented==='NO'&&!!declaration.justification;
    if(excluded) return {...def,...t,effective:'NOT_APPLICABLE',missing:[],exclusion:declaration.justification};
    if(t.result==='NOT_APPLICABLE') {
      if(!t.justification) missing.push('Justification d’exclusion');
      // Mandatory capabilities cannot disappear from the campaign, even if not triggered on every invoice.
      if(def.kind==='STATUT'&&(declaration?.mandatory||declaration?.implemented==='YES')) missing.push('Capacité obligatoire ou déclarée implémentée à tester sur un scénario adapté');
    } else if(['PASS','FAIL'].includes(t.result)) {
      for(const k of ['actor','invoice_id','correlation_id','message_id','timestamp','journal_reference','observed']) if(!t[k]) missing.push(TEST_FIELDS[k]);
      if(t.timestamp&&!Number.isFinite(Date.parse(t.timestamp))) missing.push('Horodatage valide');
      if(!t.evidence_ids?.length) missing.push('Pièce probante');
      if(t.evidence_ids?.some(id=>!proofs.has(id)||! /^[a-f0-9]{64}$/i.test(proofs.get(id)?.sha256||'')||proofs.get(id)?.original_name===LIFECYCLE_FILE)) missing.push('Pièce source valide (distincte de la matrice)');
      if(def.kind==='STATUT') {
        for(const k of ['initial_state','trigger','previous_status','next_status','transition_rule','reception','si_restitution','replay','out_of_order']) if(!t[k]) missing.push(TEST_FIELDS[k]);
        if(!t.payload_evidence_id||!t.evidence_ids.includes(t.payload_evidence_id)) missing.push('Payload rattaché');
      }
      if(def.id==='PAY-212'||def.id==='CDV-212') {
        for(const k of ['payment_date','invoice_amount','payment_amount','balance','currency']) if(!t[k]) missing.push(TEST_FIELDS[k]);
        if(t.result==='PASS' && [t.invoice_amount,t.payment_amount,t.balance].some(v=>!/^\d+(\.\d{1,2})?$/.test(v||''))) missing.push('Montants positifs décimaux documentés');
        if(t.result==='PASS' && Math.round(Number(t.invoice_amount)*100)!==Math.round(Number(t.payment_amount)*100)+Math.round(Number(t.balance)*100)) missing.push('Rapprochement facture = encaissement cumulé + solde');
      }
    }
    const effective=t.result==='FAIL'?'FAIL':missing.length?'NOT_STARTED':t.result;
    return {...def,...t,effective,missing,payload_sha256:proofs.get(t.payload_evidence_id)?.sha256||''};
  });
  const pending=tests.filter(t=>t.effective==='NOT_STARTED');
  if(pending.length) issues.push(`${pending.length} cas non évalués ou insuffisamment documentés.`);
  return {status:tests.some(t=>t.effective==='FAIL')?'NON_COMPLIANT':issues.length?'NOT_STARTED':'COMPLIANT',issues,tests,statuses,
    passed:tests.filter(t=>t.effective==='PASS').length,excluded:tests.filter(t=>t.effective==='NOT_APPLICABLE').length,total:tests.length};
}
