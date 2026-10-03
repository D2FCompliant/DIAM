import {CYBER_TITLE,assessCyber} from './cyber.mjs';
import { periodLabel } from "./audit-period.mjs";
import { DIMENSIONS, STATUSES } from './lifecycle.mjs';
export const REPORT_TEMPLATE = {id:'D2F-PA-STRUCTURED',version:'1.1.0',language:'fr'};
export const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={COMPLIANT:'Conforme',PARTIALLY_COMPLIANT:'Partiellement conforme',NON_COMPLIANT:'Non conforme',NOT_STARTED:'Non évalué',NOT_APPLICABLE:'Non applicable',PASS:'Démontré',FAIL:'Échec'};
export const resultLabel = v => labels[v]||v||'Non évalué';
const p=v=>`<p>${esc(v||'Non renseigné')}</p>`;
const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">Aucun élément enregistré.</td></tr>`}</tbody></table>`;
function domain(r) {
  const ref=r.reference;
  if(ref==='DGFiP-RAPPORT') return 'Rapport et signature';
  if(ref.startsWith('DGFiP-1.')) return 'Interopérabilité et raccordements';
  if(ref.startsWith('DGFiP-2.')) return 'Identité, authentification et habilitations';
  if(ref.startsWith('DGFiP-3.')) return 'Émission, transmission et traçabilité';
  if(ref.startsWith('DGFiP-4.')) return 'E-reporting et données de paiement';
  if(ref.startsWith('DGFiP-5.')) return 'Transmission PPF et contrôles réglementaires';
  if(ref==='DGFiP-6'||ref.startsWith('DGFiP-7.')) return 'Sécurité, RGPD et accès';
  return 'Exigences complémentaires d’immatriculation';
}
export function reportSummary(chain=[]) {
  return Object.entries(labels).filter(([key])=>!['PASS','FAIL'].includes(key)).map(([key,label])=>[label,chain.filter(r=>r.reponse_statut===key).length]);
}
export function structuredReportHtml(out) {
  const {mission={},client={},chain=[],client_replies:replies=[],evidences=[],lifecycle={},release={}}=out;
  const template=out.template||REPORT_TEMPLATE;
  const scope=client.scope||{}, assessment=lifecycle.assessment||{status:'NOT_STARTED',issues:['Dossier non constitué.'],tests:[],statuses:[],passed:0,total:0};
  const dossier=lifecycle.dossier;
  const cyber=out.cyber||{assessment:assessCyber(null)};
  const ca=cyber.assessment;
  const cyberRows=()=>ca.tests.map(t=>[t.title,t.references,t.applicability_reason||'À déterminer',resultLabel(t.effective),t.observed||'Non évalué',t.missing.join(' '),proofNames(t.evidence_ids)]);
  const demo=dossier?.mode==='DEMO'||/DEMO|FICTI|APERÇU/i.test(`${mission.title||''} ${client.name||''}`);
  const report=out.report||{};
  const proofNames=ids=>(ids||[]).map(id=>{const e=evidences.find(v=>v.id===id);return e?`${e.number} — ${e.original_name}`:`Preuve non retrouvée : ${id}`;}).join(' ; ');
  const groups=[...new Set(chain.map(domain))];
  const significant=chain.filter(r=>r.constat && (r.statut_constat!=='CLOSED'||r.reponse_statut!=='COMPLIANT'||r.actions_correctives||replies.some(x=>x.finding_id===r.constat_id)));
  const pending=chain.filter(r=>!['COMPLIANT','NOT_APPLICABLE'].includes(r.reponse_statut));
  const statusRow=s=>{const d=assessment.statuses.find(x=>x.code===s.code);const t=assessment.tests.find(x=>x.id===`CDV-${s.code}`);return [s.code,s.label,s.mandatory?'Obligatoire selon événement / cas applicable':'Facultatif',d?.implemented==='YES'?'Déclaré pris en charge':d?.implemented==='NO'?'Non proposé':'À déclarer',resultLabel(t?.effective),d?.justification||t?.missing?.join(' ; ')||'',proofNames(t?.evidence_ids)];};
  return `<article class="d2fReport">
  <section class="reportCover"><p class="reportBrand">D2F COMPLIANT</p><h1>Rapport d’audit de conformité réglementaire</h1><p class="reportSubtitle">PLATEFORME AGRÉÉE — ${demo?'DÉMONSTRATION FICTIVE — NON OPPOSABLE':'DOSSIER D’AUDIT — À REVOIR ET SIGNER'}</p>
  ${table(['Identification','Dossier'],[
    ['Entité auditée',client.name||'Non renseignée'],['Référence mission',mission.number||mission.id],['Rapport',report.report_number||'Aperçu'],
    ['Programme','PA / DGFiP'],['Période auditée',periodLabel(mission.audit_period)],['Référentiel retenu',mission.referential_version],
    ['Modèle',`${template.id} v${template.version}`],['Généré le / par',`${report.generated_at||out.generated_at||'—'} / ${report.generated_by||out.generated_by||'—'}`],
    ['Version DIAM',`${release.version||'—'} · ${release.buildCommit||'—'}`]
  ])}<p class="reportNotice">${demo?'Les données de cette mission sont des exemples. Ce document ne certifie aucune plateforme réelle.':'Document généré à partir des enregistrements de la mission. La revue, le jugement professionnel et la signature de l’auditeur restent nécessaires avant transmission.'}</p></section>
  <section class="reportSection"><h2>1. Synthèse exécutive</h2><p class="reportOpinion">Opinion calculée : ${esc(out.result?.opinion||'AUDIT INCOMPLET')}</p>${p(out.result?.reason)}
  ${table(['Résultat des contrôles','Nombre'],reportSummary(chain))}
  <h3>Cycles de vie des factures — DGFiP-3.9</h3>${p(`${resultLabel(assessment.status)}. ${assessment.passed}/${assessment.total} cas démontrés ; ${assessment.excluded||0} exclusions documentées. Voir chapitre 5 et annexe D.`)}
  ${assessment.issues.length?p(assessment.issues.join(' ')):''}<h3>Cybersécurité</h3>${p(`${resultLabel(ca.status)} — ${ca.issues.join(' ')} Voir chapitre 6 et annexe C.`)}<h3>Points significatifs et limites</h3>${table(['Contrôle','Résultat','Élément à solder'],pending.map(r=>[r.reference,resultLabel(r.reponse_statut),r.report_limitation||r.synthese_constat||r.preuves_attendues]))}</section>
  <section class="reportSection"><h2>2. Périmètre et référentiels</h2><h3>2.1 Périmètre</h3>
  ${table(['Rubrique','Informations'],[['Client',client.name],['Identifiant légal',client.siren||scope.client_legal_identifier],['TVA',scope.client_vat_id],['Pays',client.country],['Adresse',[client.address,scope.client_postal_code,client.city].filter(Boolean).join(', ')],['Périmètre déclaré',scope.declared_scope],['Type d’audit',mission.audit_type],['Notes de mission',mission.lifecycle_notes]])}
  <h3>2.2 Référentiel officiel et exigences complémentaires</h3>${p(mission.referential_version)}
  <p>Les critères réglementaires et les exigences complémentaires D2F Compliant doivent être distingués. Le référentiel complémentaire ne se substitue pas aux textes officiels. Les versions et localisateurs des critères sont conservés dans la matrice des contrôles.</p>
  ${table(['Cycle de vie','Référence retenue'],[['Version applicable XP Z12-012 / spécifications',dossier?.reference_version||'À renseigner'],['Document / section / localisateur',dossier?.reference_locator||'À renseigner']])}
  </section>
  <section class="reportSection"><h2>3. Méthode d’audit et chaîne probatoire</h2><p>Mission → contrôle → preuve attendue → pièce collectée et empreinte → analyse → constat → contradictoire → correction → contre-test → décision → rapport.</p>
  ${table(['Étape','Traçabilité attendue'],[['Cadrage','Périmètre, période, référentiels versionnés et exclusions motivées'],['Collecte','Identifiant de pièce, fichier original, déposant, date et SHA-256'],['Tests','Scénario, attendu, observation, acteur, événements et pièces sources'],['Constats','Contrôle, qualification, risque et recommandation de l’auditeur'],['Contradictoire','Réponse datée, traduction française, correction et contre-test'],['Décision','Analyse de l’auditeur, limites, revue et signature']])}
  <p>Une empreinte enregistrée atteste l’identité des octets lors du dépôt ; elle ne démontre à elle seule ni la véracité des observations, ni un archivage probant, ni une signature.</p></section>
  <section class="reportSection"><h2>4. Résultats par domaine</h2>${groups.map(g=>{const rows=chain.filter(r=>domain(r)===g);return `<h3>${esc(g)}</h3>${table(['Contrôle','Résultat','Observation / limite'],rows.map(r=>[r.reference,resultLabel(r.reponse_statut),r.report_limitation||r.analyse_auditeur||r.synthese_constat]))}`;}).join('')}</section>
  <section class="reportSection"><h2>5. Audit des cycles de vie de la facture</h2><h3>5.1 Objet et exigence de contrôle</h3><p>Évaluer les statuts obligatoires et les statuts facultatifs déclarés, leur production, réception, transmission, restitution au SI, les acteurs, transitions, rejeux et traces. Un statut obligatoire doit pouvoir être traité lorsque son événement est applicable ; tous les statuts ne se produisent pas sur chaque facture.</p>${p(dossier?.scope)}
  <h3>5.2 Statuts obligatoires</h3>${table(['Code','Statut','Nature','Périmètre','Résultat','Justification / manque','Pièces'],STATUSES.filter(s=>s.mandatory).map(statusRow))}
  <h3>5.3 Statuts facultatifs</h3><p>Chaque statut déclaré implémenté fait l’objet d’une observation documentée. Les statuts non proposés sont distingués des fonctions auditées. Une déclaration, un modèle vide ou une preuve synthétique ne vaut pas démonstration.</p>
  ${table(['Code','Statut','Nature','Périmètre','Résultat','Justification / manque','Pièces'],STATUSES.filter(s=>!s.mandatory).map(statusRow))}<h3>5.4 Corrélation, idempotence et journalisation</h3>${table(['Test','Scénario','Résultat','Observation / exclusion'],assessment.tests.filter(t=>['PARCOURS','NEGATIF','REJET'].includes(t.kind)).map(t=>[t.id,t.title,resultLabel(t.effective),t.observed||t.justification||t.missing.join(' ; ')]))}
  <h3>5.5 Encaissement et données de paiement</h3><p>Le paiement transmis (211) est distinct de l’encaissement (212). Le refus métier (210) est distinct du rejet technique ou réglementaire (213). Les tests d’encaissement sont rapprochés de DGFiP-4.1, DGFiP-4.2 et DGFiP-4.3.</p>
  ${table(['Test','Date','Facture initiale','Encaissé cumulé','Solde','Devise','Résultat','Pièces'],assessment.tests.filter(t=>['CDV-212','PAY-212'].includes(t.id)).map(t=>[t.id,t.payment_date,t.invoice_amount,t.payment_amount,t.balance,t.currency,resultLabel(t.effective),proofNames(t.evidence_ids)]))}
  <h3>5.6 Conclusion sur les cycles de vie</h3>${table(['Domaine','Conclusion'],[
    ['Statuts obligatoires',STATUSES.filter(s=>s.mandatory).map(s=>`${s.code} : ${resultLabel(assessment.tests.find(t=>t.id===`CDV-${s.code}`)?.effective)}`).join(' ; ')],
    ['Statuts facultatifs déclarés',STATUSES.filter(s=>!s.mandatory).map(s=>`${s.code} : ${resultLabel(assessment.tests.find(t=>t.id===`CDV-${s.code}`)?.effective)}`).join(' ; ')],
    ...DIMENSIONS.map((d,i)=>[d,resultLabel(assessment.tests.find(t=>t.id===`AXE-${i+1}`)?.effective)])])}
  ${p(`Conclusion du dossier : ${resultLabel(assessment.status)}. ${assessment.issues.join(' ')}`)}${p(`Revue déclarée : ${dossier?.reviewer||'non renseignée'} — ${dossier?.reviewed_at||'non renseignée'}. Matrice conservée : ${lifecycle.evidence?.number||'non déposée'}.`)}
  </section>
  <section class="reportSection"><h2>6. ${esc(CYBER_TITLE)}</h2>
  <h3>6.1 Ancrage DGFiP et attente opérationnelle exprimée le 26 août 2026</h3><p>Les références indiquées dans le modèle du rapport sont conservées dans la matrice. Leur texte, version et applicabilité doivent être vérifiés et renseignés par l’auditeur pour la mission. Une référence non documentée n’est pas présentée comme une obligation vérifiée.</p>
  <h3>6.2 Périmètre de vérification</h3>${table(['Domaine','Périmètre examiné','Applicabilité'],ca.tests.map(t=>[t.title,t.scope,t.applicability_reason]))}
  <h3>6.3 ISO/IEC 27001 : contrôle du certificat, sans duplication de l’audit de certification</h3><p>Le certificat ISO/IEC 27001, sa validité et son périmètre sont examinés séparément de l’effectivité opérationnelle. La certification ne remplace pas les preuves et tests des autres domaines.</p>
  <h3>6.4 Matrice des contrôles de cybersécurité et preuves associées</h3>${table(['Domaine / exigence','Références','Applicabilité','Conclusion','Observation','Éléments à solder','Preuves'],cyberRows())}
  <h3>6.5 Tests opérationnels attendus dans un dossier de production</h3>${table(['Domaine','Preuves attendues','Procédure','Contre-test / décision'],ca.tests.map(t=>[t.title,t.expected,t.procedure,t.countertest]))}
  <h3>6.6 Conclusion cybersécurité</h3>${p(`${resultLabel(ca.status)}. ${ca.passed}/${ca.total} domaines démontrés. ${ca.issues.join(' ')}`)}${p(`Matrice : ${cyber.evidence?.number||'non déposée'}. ${cyber.integrity||''}`)}
  <h3>6.7 Références institutionnelles</h3>${table(['Domaine','Source, version et section vérifiées'],ca.tests.map(t=>[t.title,t.source||'À vérifier pour la mission']))}</section>
  <section class="reportSection"><h2>7. Constats significatifs et contradictoire</h2>${significant.map((r,i)=>`<h3>7.${i+1} ${esc(r.constat)} — ${esc(r.reference)}</h3>${table(['Rubrique','Éléments enregistrés'],[['Qualification / état',`${r.qualification_retenue} / ${r.statut_constat}`],['Constat',r.synthese_constat],['Analyse et risque',r.analyse_auditeur],['Recommandation',r.recommandation],['Actions',r.actions_correctives],['Contre-test / décision de clôture',r.commentaire_cloture||'Non renseigné — la clôture seule ne démontre pas un contre-test'],['Pièces rattachées',r.preuves_associees]])}${table(['Réponse datée','Réponse en français','Traduction validée','Preuve'],replies.filter(x=>x.finding_id===r.constat_id).map(x=>[x.submitted_at,x.message_language==='fr'?x.message:x.french_translation||'Traduction française manquante',x.message_language==='fr'||x.translation_validated?'Oui':'Non',proofNames([x.evidence_id].filter(Boolean))]))}`).join('')||p('Aucun constat significatif sélectionné ; la matrice complète figure en annexe A.')}</section>
  <section class="reportSection"><h2>8. Contrôle d’intégrité du dossier de preuves</h2><h3>8.1 Rattachement principal des contrôles</h3>${p(`${chain.filter(r=>r.evidence_ids?.length).length}/${chain.length} contrôles avec au moins une pièce rattachée. ${evidences.length} pièces distinctes dans le bordereau.`)}
  <h3>8.2 Contrôle d’intégrité</h3>${p(`Matrice cycle de vie : ${lifecycle.integrity||'aucune matrice vérifiée'}. Les SHA-256 de l’annexe B sont ceux enregistrés lors du dépôt ; les autres fichiers n’ont pas été relus automatiquement pour cette génération.`)}
  <p>Les états SAE du bordereau sont reproduits tels qu’enregistrés. Une pièce en état DISABLED, PENDING ou FAILED n’est pas présentée comme archivée. Les pièces historiques restent conservées et leur pertinence doit être appréciée par l’auditeur.</p></section>
  <section class="reportSection"><h2>9. Conclusion</h2>${p(`${out.result?.opinion||'AUDIT INCOMPLET'} — ${out.result?.reason||''}`)}${p(`Cycles de vie : ${resultLabel(assessment.status)} ; travaux et limites au chapitre 5.`)}
  <h3>9.1 Points restant à solder</h3>${table(['Contrôle','Action / limite'],pending.map(r=>[r.reference,r.report_limitation||r.recommandation||r.preuves_attendues]))}
  <h3>9.2 Revue et signature</h3>${p('L’opinion calculée est une aide à la revue. La décision et la signature de l’auditeur portent sur cette version du rapport et son dossier de preuves. Aucune signature ni certification n’est créée par la génération du document.')}</section>
  <section class="reportSection reportAnnex"><h2>Annexe A — Matrice complète des contrôles</h2>${table(['Référence / intitulé','Critère / source','Niveau','Résultat','Constat','Pièces'],chain.map(r=>[`${r.reference} — ${r.question}`,`${r.attendu_dgfip}\n${r.source||''}`,r.qualification_retenue,`${resultLabel(r.reponse_statut)}${r.report_limitation?' — '+r.report_limitation:''}`,`${r.constat} ${r.synthese_constat}`,r.preuves_associees]))}</section>
  <section class="reportSection reportAnnex"><h2>Annexe B — Bordereau des pièces et empreintes</h2>${table(['Pièce / fichier','Contrôles','Déposé le / par','SHA-256 complet','Archivage'],evidences.map(e=>[`${e.number} — ${e.original_name}`,chain.filter(r=>r.evidence_ids?.includes(e.id)).map(r=>r.reference).join(', ')||'Pièce transverse non rattachée',`${e.uploaded_at||''} / ${e.uploaded_by||''}`,e.sha256,`${e.archive_status||'Non renseigné'} ${e.archive_id||''}`]))}</section>
  <section class="reportSection reportAnnex"><h2>Annexe C — Matrice de couverture cybersécurité</h2>${table(['Domaine / exigence','Références','Applicabilité','Conclusion','Observation','Éléments à solder','Preuves'],cyberRows())}${table(['Domaine','Action attendue','Responsable','Échéance','Revue'],ca.tests.map(t=>[t.title,t.recommendation,t.owner,t.due_date,`${t.reviewer||''} ${t.reviewed_at||''}`]))}</section>
  <section class="reportSection reportAnnex"><h2>Annexe D — Matrice des tests de cycle de vie</h2>${assessment.tests.map(t=>`<h3>${esc(t.id)} — ${esc(t.title)}</h3>${table(['Champ','Valeur'],[['Attendu',t.expected],['Résultat déclaré / retenu',`${resultLabel(t.result)} / ${resultLabel(t.effective)}`],['Observé',t.observed],['Situation / déclencheur',`${t.initial_state||''} / ${t.trigger||''}`],['Acteur',t.actor],['Facture / corrélation',`${t.invoice_id||''} / ${t.correlation_id||''}`],['Message / horodatage',`${t.message_id||''} / ${t.timestamp||''}`],['Transitions',`${t.previous_status||''} → ${t.next_status||''} ; ${t.transition_rule||''}`],['Réception / restitution SI',`${t.reception||''} / ${t.si_restitution||''}`],['Rejeu / hors ordre',`${t.replay||''} / ${t.out_of_order||''}`],['Journal',t.journal_reference],['Pièces sources',proofNames(t.evidence_ids)],['SHA-256 payload',t.payload_sha256],['Exclusion / manques',t.exclusion||t.justification||t.missing.join(' ; ')]])}`).join('')}</section>
  <footer>D2F Compliant · Audit &amp; Compliance · ${esc(report.report_number||'Aperçu')} · modèle ${template.version}</footer></article>`;
}
export function standaloneReport(out, css='') {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(out.report?.report_number||'Rapport DIAM')}</title><style>${css}</style><body>${structuredReportHtml(out)}</body></html>`;
}
