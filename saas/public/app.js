import {bindControlDocuments} from './control-documents.mjs';
let controlDocumentsWorkspace;
import {expandDossierFiles} from './dossier-files.mjs';
let preparedQuestions=[];
let navigationEpoch=0;
let controlBusy=false;
let answerBaseline='',findingBaseline='',treatmentBaseline='';
const answerFields=['answerStatus','clientAnswer','auditorAnalysis'];
const findingFields=['findingSummary','retainedQualification','recommendation'];
const snapshot=ids=>JSON.stringify(ids.map(id=>document.getElementById(id)?.value||''));
function controlDirty(){return Boolean(state.selected&&answerBaseline&&(snapshot(answerFields)!==answerBaseline||snapshot(findingFields)!==findingBaseline||$('findingStatus').value!==treatmentBaseline||$('evidenceFile').files?.length));}
function allowControlLeave(){if(!controlDirty())return true;if(!confirm('Des saisies de ce contrôle ne sont pas enregistrées. Quitter sans les enregistrer ?'))return false;const q=state.selected;for(const [id,key] of Object.entries({answerStatus:'reponse_statut',clientAnswer:'reponse_client',auditorAnalysis:'analyse_auditeur',findingSummary:'synthese_constat',retainedQualification:'qualification_retenue',recommendation:'recommandation',findingStatus:'statut_constat'}))$(id).value=q[key]||(id==='findingStatus'?'OPEN':'');$('evidenceFile').value='';answerBaseline=snapshot(answerFields);findingBaseline=snapshot(findingFields);treatmentBaseline=$('findingStatus').value;return true;}
function renderControlNavigation(){
 const index=state.chain.findIndex(q=>q.question_id===state.selected?.question_id);
 $('controlPosition').textContent=index<0?'Choisir un contrôle':`Contrôle ${index+1} sur ${state.chain.length}`;
 $('controlProgress').textContent=`${state.chain.filter(q=>q.reponse_statut&&q.reponse_statut!=='NOT_STARTED').length} réponses renseignées sur ${state.chain.length}`;
 $('controlJump').innerHTML=state.chain.map((q,i)=>`<option value="${i}">${escapeHtml(q.reference)} — ${escapeHtml(q.question)}</option>`).join('');$('controlJump').value=String(index);
 for(const id of ['controlPrevious','controlNext','controlJump','controlList','controlSaveNext','saveAnswer','saveFinding','closeFinding','uploadEvidence'])$(id).disabled=controlBusy||index<0;
 for(const id of [...answerFields,...findingFields,'findingStatus','evidenceFile'])$(id).disabled=controlBusy;
 $('controlPrevious').disabled=controlBusy||index<=0;$('controlNext').disabled=controlBusy||index<0||index>=state.chain.length-1;
 $('controlSaveNext').textContent=index===state.chain.length-1?'Enregistrer ce dernier contrôle':'Enregistrer et suivant →';
}
async function controlAction(fn){if(controlBusy)return;controlBusy=true;renderControlNavigation();try{await run(fn,'actionStatus');}finally{controlBusy=false;renderControlNavigation();}}
async function saveAndNextControl(){const id=state.selected?.question_id;if($('evidenceFile').files?.length)throw Error('Verse la preuve choisie avant de passer au contrôle suivant.');if(snapshot(findingFields)!==findingBaseline&&!$('findingSummary').value.trim())throw Error('Renseigne la synthèse du constat avant de l’enregistrer.');await saveAnswer();if(snapshot(findingFields)!==findingBaseline)await saveFinding();if($('findingStatus').value!==treatmentBaseline)await updateFindingStatus();const index=state.chain.findIndex(q=>q.question_id===id);if(index<state.chain.length-1)selectQuestion(index+1,true);else setStatus('Dernier contrôle enregistré. La revue de la mission reste à effectuer.','success','actionStatus');}
import {bindProgramBuilder} from './program-builder.mjs';
import {sameClientIdentity} from './client-identity.mjs';
import {bindAuditPreparation} from './audit-preparation-ui.mjs';
let auditPreparation;
let dossierWorkspace;
import {bindReferenceLibrary} from './reference-library-ui.mjs';
import {bindGuide} from './audit-guide.mjs';
let auditGuide;
import {bindDossier} from './dossier-ui.mjs';
import {bindCyber} from './cyber-ui.mjs';
import { periodDates } from "./audit-period.mjs";
import { structuredReportHtml, standaloneReport } from "./report-template.mjs";
import { bindLifecycle, downloadFile } from "./lifecycle-ui.mjs";
let lastReport = null;
let missionEpoch = 0;
const $ = (id) => document.getElementById(id);
let state = { missions: [], missionId: "", chain: [], selected: null, documents: [], suggestions: [], clientFindings: [], selectedClientFinding: null, d2fClients: [], d2fImportedClientUpdatedAt: "", auditors: [], auditorAssignments: [], clientToken: "", clientPortal: false, demo: false, activeTab: "dashboard", authenticated: false, actor: "", authRole: "" };

const DEMO_BASELINE = {
  label: "Aperçu local — DGFiP audit guide v1.3 + PDP Integrity v3.2",
  checkedAt: "2026-09-02"
};

let appRelease = {
  name: "DIAM SaaS",
  version: "1.12.1",
  release: "Dossier complet, préparation des contrôles et rapport par programme",
  schemaVersion: "202609030001_multi_auditor_access",
  buildCommit: "local-v1.12.1",
  versioningPolicy: "ISO 9001 / SemVer DIAM : patch=correction, minor=évolution fonctionnelle compatible, major=rupture ou refonte structurante"
};

const AUDIT_PROGRAMS = {
  PA_DGFIP: {
    id: "PA_DGFIP",
    label: "PA / DGFiP + PDP Integrity",
    shortLabel: "PA",
    defaultTitle: "Audit de conformité PA",
    expectedControls: 33
  },
  SC_RLFC: {
    id: "SC_RLFC",
    label: "SC / Solution Compatible RLF-C",
    shortLabel: "SC",
    defaultTitle: "Audit de conformité SC",
    expectedControls: 62
  },
  CUSTOM_CDC: {
    id: "CUSTOM_CDC",
    label: "Audit personnalisé / référentiel libre",
    shortLabel: "LIBRE",
    defaultTitle: "Audit personnalisé",
    expectedControls: 0
  }
};

const DEMO_CHAIN = [
  {
    question_id: "demo-dgfip-gouvernance",
    reference: "DGFiP-1.1",
    question: "Gouvernance du dispositif PA",
    attendu_dgfip: "La plateforme doit démontrer que le périmètre, les responsabilités, les habilitations et le pilotage du dispositif sont maîtrisés et documentés.",
    preuves_attendues: "Dossier de candidature DGFiP, organigramme, RACI, procédures de gouvernance, comités, délégations, registre des habilitations, comptes rendus de revue.",
    checklist: [
      "Vérifier que le périmètre déclaré correspond aux services réellement opérés.",
      "Contrôler la cohérence entre responsabilités, procédures et preuves opérationnelles.",
      "Identifier les écarts entre candidature DGFiP et fonctionnement observé."
    ],
    qualification_base: "HIGH",
    qualification_retenue: "HIGH",
    reponse_statut: "NOT_STARTED",
    reponse_client: "",
    analyse_auditeur: "",
    constat: "",
    synthese_constat: "",
    statut_constat: "",
    recommandation: "",
    preuves_associees: ""
  },
  {
    question_id: "demo-tracabilite",
    reference: "DGFiP-2.3",
    question: "Traçabilité, journaux et piste d’audit",
    attendu_dgfip: "Les événements significatifs doivent être journalisés, horodatés, protégés, exploitables et conservés pour permettre la reconstitution des traitements.",
    preuves_attendues: "Politique de journalisation, exports de logs, schéma des événements, preuve d’horodatage, matrice d’accès aux journaux, tests de restitution, procédure de conservation.",
    checklist: [
      "Comparer les journaux disponibles avec les événements attendus.",
      "Vérifier l’intégrité et la non-altération des journaux.",
      "Tester la capacité à restituer une chaîne de traitement complète."
    ],
    qualification_base: "CRITICAL",
    qualification_retenue: "CRITICAL",
    reponse_statut: "PARTIALLY_COMPLIANT",
    reponse_client: "Le client indique disposer de journaux applicatifs et de journaux d’accès.",
    analyse_auditeur: "À compléter avec exports réels et test de reconstitution.",
    constat: "Ouvert",
    synthese_constat: "Preuves de restitution de piste d’audit non encore versées.",
    statut_constat: "OPEN",
    recommandation: "Fournir un export horodaté complet et une procédure de conservation.",
    preuves_associees: "Aucune preuve liée"
  },
  {
    question_id: "demo-rapport",
    reference: "DGFiP-RAPPORT",
    question: "Rapport final et evidence book",
    attendu_dgfip: "Le rapport doit présenter la méthode, le périmètre, les travaux réalisés, les constats, l’opinion, les réserves éventuelles et les preuves associées.",
    preuves_attendues: "Plan de mission, matrice des contrôles, réponses client, constats validés, evidence book, certificat, revue qualité, lettre d’affirmation si applicable.",
    checklist: [
      "S’assurer que chaque opinion est rattachée à des preuves.",
      "Vérifier que les réserves et non-conformités sont explicites.",
      "Contrôler la lisibilité du rapport pour une revue DGFiP."
    ],
    qualification_base: "HIGH",
    qualification_retenue: "HIGH",
    reponse_statut: "NOT_STARTED",
    reponse_client: "",
    analyse_auditeur: "",
    constat: "",
    synthese_constat: "",
    statut_constat: "",
    recommandation: "",
    preuves_associees: ""
  }
];

async function api(path, options = {}) {
  if (state.demo) throw new Error("Mode aperçu local : lance l'API Cloudflare Worker pour utiliser la base Supabase et les exports réels.");
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.auth_required || res.status === 401) showLogin(data);
    throw new Error(friendlyApiError(data, res.status));
  }
  return data;
}

function friendlyApiError(data, status) {
  const raw = String(data?.error || data?.message || data?.details || JSON.stringify(data || {}));
  if (/client_access_token/i.test(raw)) return "Impossible de créer la mission : la migration Supabase du token client manque. Applique 202609020010_global_reference_documents.sql puis réessaie.";
  if (/document_scope/i.test(raw)) return "Impossible de gérer les référentiels transverses : la migration Supabase 202609020010_global_reference_documents.sql n’est pas encore appliquée.";
  if (/duplicate key|23505|already exists/i.test(raw)) return "Ce document existe déjà. Sélectionne sa ligne dans le registre puis clique “Analyser le document sélectionné”.";
  if (/OPENAI_API_KEY.*(?:absente|missing|not configured)|invalid_api_key/i.test(raw)) return "Analyse assistée indisponible : clé OpenAI absente ou invalide côté Cloudflare.";
  if (/storage|bucket|diam-documents/i.test(raw)) return "Dépôt impossible : vérifie que le bucket Supabase Storage `diam-documents` existe et que la clé service role est configurée côté Cloudflare.";
  if (/relation .* does not exist|42P01/i.test(raw)) return "Base Supabase incomplète : applique les migrations SQL DIAM dans l’ordre depuis le dossier saas/supabase/migrations.";
  return raw || `Erreur API ${status}`;
}

function setStatus(text, type = "info", targetId = "actionStatus") {
  const el = $(targetId);
  if (!el) return;
  el.textContent = text;
  el.style.color = type === "error" ? "#b42318" : type === "success" ? "#067647" : "#0d3b66";
}

async function init() {
  bindEvents();
  const initialNavigationEpoch=navigationEpoch;
  const params = new URLSearchParams(location.search);
  if (params.get("portal") === "client") {
    state.clientPortal = true;
    state.missionId = params.get("mission_id") || "";
    state.clientToken = params.get("token") || "";
    enterClientPortalMode();
  }
  try {
    if (!state.clientPortal) {
      const auth = await fetch("/api/auth/me").then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }));
      if (!auth.ok) {
        showLogin(auth.data);
        renderVersionStack(appRelease);
        return;
      }
      state.authenticated = true;
      state.actor = auth.data.actor || "";
      hideLogin();
    }
    const boot = await api("/api/bootstrap");
    $("runtimeMode").textContent = "API connectée";
    $("runtimeMode").className = "modePill ok";
    appRelease = boot.app || appRelease;
    state.authRole = boot.auth?.role || "";
    applyAccessUi(Boolean(boot.auth?.full_access));
    $("baseline").textContent = `${boot.baseline.label} - sources vérifiées ${boot.baseline.checkedAt}`;
    renderVersionStack(appRelease);
    if (state.clientPortal) {
      await loadClientFindings();
      await auditPreparation.load();
      showTab("client", { scroll: false });
    } else {
      await loadMissions();
      if (boot.auth?.full_access) await loadAuditorAdmin();
      if(navigationEpoch===initialNavigationEpoch) await auditGuide.open();
    }
  } catch (e) {
    showInitializationFailure(e);
  }
}

function bindEvents() {
  window.addEventListener('beforeunload',event=>{if(controlDirty()){event.preventDefault();event.returnValue='';}});
  if ($("loginForm")) $("loginForm").onsubmit = (event) => {
    event.preventDefault();
    run(login, "loginStatus");
  };
  if ($("logoutButton")) $("logoutButton").onclick = () => run(logout, "createStatus");
  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.onclick = () => showTab(tab.dataset.tab);
  }
  $("createMission").onclick = () => run(createMission, "createStatus");
  $("topNewMission").onclick = () => prepareNewMission({ blank: true });
  $("topCreateMission").onclick = () => run(createMissionFromTopBar, "createStatus");
  $("topSaveMission").onclick = () => run(updateMissionProfile, "createStatus");
  $("topOpenMission").onclick = () => run(openSelectedMissionFromTopBar, "createStatus");
  $("topGlobalLibrary").onclick = () => showTab("admin");
  $("topMissionDocuments").onclick = () => run(prepareMissionDocuments, "createStatus");
  $("topDgfipFile").onclick = () => run(prepareDgfipAnalysis, "createStatus");
  $("topReport").onclick = () => run(generateReport, "createStatus");
  $("updateMissionProfile").onclick = () => run(updateMissionProfile, "createStatus");
  $("prepareDgfipAnalysis").onclick = () => run(prepareDgfipAnalysis, "createStatus");
  $("adminPrepareCustomAudit").onclick = () => prepareCustomAuditFromAdmin();
  $("adminOpenGlobalLibrary").onclick = () => prepareGlobalLibrary();
  $("adminOpenGlobalLibrary2").onclick = () => prepareGlobalLibrary();
  $("adminAddMissionDocs").onclick = () => run(prepareMissionDocuments, "adminStatus");
  $("adminOpenDgfipFile").onclick = () => run(prepareDgfipAnalysis, "adminStatus");
  $("inviteAuditor") && ($("inviteAuditor").onclick = () => run(inviteAuditor, "auditorAdminStatus"));
  $("assignAuditor") && ($("assignAuditor").onclick = () => run(assignAuditorToMission, "auditorAdminStatus"));
  $("openMission").onclick = () => run(() => openMission($("missionSelect").value), "createStatus");
  $("copyClientLink").onclick = () => run(copyClientLink, "createStatus");
  $("searchD2FClients").onclick = () => run(searchD2FClients, "d2fSyncStatus");
  $("importD2FClient").onclick = () => run(importD2FClient, "d2fSyncStatus");
  $("auditProgram").onchange = () => applyAuditProgramDefaults();
  $("refreshMissions").onclick = () => run(loadMissions, "createStatus");
  $("reload").onclick = () => run(refreshAll, "createStatus");
  $("deleteMission").onclick = () => run(deleteMission, "createStatus");
  $("saveAnswer").onclick = () => controlAction(saveAnswer);
  $("saveFinding").onclick = () => controlAction(saveFinding);
  $("closeFinding").onclick = () => controlAction(updateFindingStatus);
  $("uploadEvidence").onclick = () => controlAction(uploadEvidence);
  $('controlPrevious').onclick=()=>selectQuestion(state.chain.findIndex(q=>q.question_id===state.selected?.question_id)-1);
  $('controlNext').onclick=()=>selectQuestion(state.chain.findIndex(q=>q.question_id===state.selected?.question_id)+1);
  $('controlJump').onchange=()=>{selectQuestion(Number($('controlJump').value));renderControlNavigation();};
  $('controlList').onclick=()=>showTab('audit');
  $('controlSaveNext').onclick=()=>controlAction(saveAndNextControl);
  $("generateReport").onclick = () => run(generateReport, "createStatus");
  bindReferenceLibrary({api,run,showTab});
  bindProgramBuilder({api,run,onPrepare:prepareCustomDefinition});
  auditPreparation=bindAuditPreparation({api,getMission:()=>state.missionId,getClient:()=>({portal:state.clientPortal,token:state.clientToken}),showTab,run});
  auditGuide=bindGuide({api,getMission:currentMission,getMissions:()=>state.missions,getChain:()=>state.chain,openMission,showTab,run});
  $("printReport").onclick=()=>window.print();
  $("changeActiveMission").onclick=()=>run(()=>auditGuide.open(),"guideStatus");
  controlDocumentsWorkspace=bindControlDocuments({api,getMission:()=>state.missionId,getSelected:()=>state.selected,getAnalysis:()=>$('auditorAnalysis').value,setAnalysis:v=>{$('auditorAnalysis').value=v;},act:controlAction,refresh:loadChain});
  dossierWorkspace=bindDossier({api,getReferenceIds:()=>new Set(state.chain.flatMap(q=>(q.source||'').match(/[a-f0-9]{8}-[a-f0-9-]{27}/gi)||[])),getMission:()=>state.missionId,run,showTab,openControl:(item,job)=>{const index=state.chain.findIndex(q=>q.question_id===item.question_id);if(index>=0){selectQuestion(index);if(state.selected?.question_id===item.question_id)controlDocumentsWorkspace.open(state.selected,job).catch(e=>setStatus(e.message,'error'));}}});
  bindCyber({ api, getMission: () => state.missionId, run, showTab, refresh: loadChain });
  bindLifecycle({ api, getMission: () => state.missionId, run, showTab, refresh: loadChain });
  $("loadLastReport").onclick = () => run(async () => {
    requireMission();
    const out = await api(`/api/reports?mission_id=${encodeURIComponent(state.missionId)}`);
    if (!out) throw new Error("Aucun rapport enregistré pour cette mission.");
    lastReport = out; $("report").innerHTML = reportHtml(out);
  }, "createStatus");
  $("downloadReport").onclick = () => run(async () => {
    if (!lastReport || lastReport.mission?.id !== state.missionId) throw new Error("Génère ou relis le rapport de la mission active.");
    if (!lastReport.template) throw new Error("Ce rapport historique utilise l’ancien modèle. Génère une nouvelle version pour utiliser le modèle D2F.");
    const response = await fetch("./report.css");
    if (!response.ok) throw new Error("La mise en page du rapport n’a pas pu être chargée.");
    downloadFile(`${lastReport.report.report_number}.html`, standaloneReport(lastReport, await response.text()), "text/html;charset=utf-8");
  }, "createStatus");
  $("uploadAuditDocument").onclick = () => run(uploadAuditDocument, "documentStatus");
  $("uploadAndAnalyzeDocument").onclick = () => run(uploadAndAnalyzeDocument, "documentStatus");
  $("analyzeAuditDocument").onclick = () => run(analyzeAuditDocument, "documentStatus");
  $("promoteSuggestion").onclick = () => run(promoteSuggestion, "documentStatus");
  $("rejectSuggestion").onclick = () => run(rejectSuggestion, "documentStatus");
  $("submitClientReply").onclick = () => run(submitClientReply, "clientStatus");
  for (const button of document.querySelectorAll("[data-doc-type]")) {
    button.onclick = () => {
      $("auditDocumentType").value = button.dataset.docType;
      setStatus(`Type de dépôt sélectionné : ${documentTypeLabel(button.dataset.docType)}. Choisis un ou plusieurs fichiers, puis clique “Déposer”.`, "info", "documentStatus");
      $("auditDocumentFile")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
  }
  $("missionSelect").onchange = () => run(() => openMission($("missionSelect").value), "createStatus");
  $("clientCountry").addEventListener("input", syncCountryIdentifierFields);
  $("clientCountry").addEventListener("change", syncCountryIdentifierFields);
  for (const id of ["clientName", "siren", "legalIdentifier", "vatId", "clientAddress", "clientAddressLine2", "clientPostalCode", "clientCity", "clientEmail", "clientPhone", "clientLanguage", "d2fSuiteClientId", "d2fSuiteCaseUrl", "declaredScope"]) {
    $(id)?.addEventListener("input", () => {
      if (state.missionId) setStatus("Modifications manuelles non enregistrées. Clique “Enregistrer les modifications manuelles”.", "info", "createStatus");
    });
  }
  syncCountryIdentifierFields();
  showTab("dashboard", { scroll: false });
}

function prepareNewMission(options = {}) {
  if(showTab("mission_form")===false)return false;
  if (options.blank) {
    missionEpoch++;
    state.missionId = "";
    state.selected = null;
    resetMissionForm();
    if ($("missionSelect")) $("missionSelect").value = "";
    renderMissionList();
    renderClientFacts();
    $("opinion").innerHTML = "<strong>Nouveau brouillon d’audit</strong><br>Aucune mission existante n’est modifiée tant que tu ne cliques pas “Créer mission + questionnaire”.";
  }
  $("clientName")?.focus();
  setStatus("Nouveau brouillon : renseigne/import le client, choisis le programme PA, SC ou personnalisé, puis clique “Créer mission + questionnaire”. Aucune mission existante n’est active.", "info", "createStatus");
}

async function createMissionFromTopBar() {
  if (state.activeTab !== "mission_form") {
    showTab("mission_form");
    $("clientName")?.focus();
    setStatus("Création sécurisée : complète ou vérifie la fiche mission, puis clique “Créer mission + questionnaire”. Aucune mission n’a été créée depuis cet écran.", "info", "createStatus");
    return;
  }
  await createMission();
}

function resetMissionForm() {
  $("clientName").value = "";
  $("siren").value = "";
  $("legalIdentifier").value = "";
  $("vatId").value = "";
  $("auditProgram").value = "PA_DGFIP";
  $("customAuditTypeName").value = "";
  $("customReferentials").value = "";
  $("customControlsText").value = "";preparedQuestions=[];
  $("missionTitle").value = AUDIT_PROGRAMS.PA_DGFIP.defaultTitle;
  $("auditPeriodStart").value = "";
  $("auditPeriodEnd").value = "";
  $("clientCountry").value = "France";
  $("clientAddress").value = "";
  $("clientAddressLine2").value = "";
  $("clientPostalCode").value = "";
  $("clientCity").value = "";
  $("clientEmail").value = "";
  $("clientPhone").value = "";
  $("clientLanguage").value = "fr";
  $("dgfipApplicationStatus").value = "UNKNOWN";
  $("d2fSuiteClientId").value = "";
  $("d2fSuiteCaseUrl").value = "";
  $("declaredScope").value = "";
  state.d2fClients = [];
  state.d2fImportedClientUpdatedAt = "";
  $("d2fClientSearch").value = "";
  $("d2fClientResults").innerHTML = `<option value="">Aucun client D2F chargé</option>`;
  applyAuditProgramDefaults();
}

function focusExistingMissions() {
  showTab("dashboard");
  $("missionSelect")?.focus();
  setStatus("Sélectionne une mission existante puis clique “Ouvrir mission”. Le portefeuille en bas liste aussi toutes les missions.", "info", "createStatus");
}

async function openSelectedMissionFromTopBar() {
  const selectedMissionId = $("missionSelect")?.value || state.missionId;
  if (!selectedMissionId) {
    focusExistingMissions();
    throw new Error("Aucune mission sélectionnée. Choisis une mission dans la liste puis relance l’ouverture.");
  }
  await openMission(selectedMissionId);
}

function prepareGlobalLibrary() {
  $("auditDocumentType").value = "REGULATORY_REFERENCE";
  showTab("documents");
  setStatus("Bibliothèque transverse : dépose ici nouveau guide DGFiP, texte, CR DGFiP/AIFE ou référentiel D2F applicable à tous les audits.", "info", "documentStatus");
  $("auditDocumentFile")?.focus();
}

function prepareMissionDocuments() {
  requireMission();
  const mission = state.missions.find((item) => item.id === state.missionId);
  $("auditDocumentType").value = "QUALITY";
  showTab("documents");
  setStatus(`Documents mission ${mission?.number || ""} : choisis Qualité, Technique, Sécurité, Dossier DGFiP, Export D2F ou Autre, puis “Déposer dans la mission”. Ces pièces seront rattachées uniquement à cet audit.`, "info", "documentStatus");
  $("auditDocumentFile")?.focus();
}

function prepareCustomAuditFromAdmin() {
  const name = $("adminAuditTypeName").value.trim();
  const referentials = $("adminAuditReferentials").value.trim();
  const controls = $("adminAuditControls").value.trim();
  if (!name || !referentials || !controls) {
    setStatus("Renseigne le nom du type d’audit, au moins un référentiel/source et au moins un contrôle.", "error", "programStatus");
    $("programStatus")?.scrollIntoView({block:"center"});
    return;
  }
  prepareCustomDefinition({name,referentials,controls});
}

function prepareCustomDefinition({name,referentials,controls,questions=[]}) {
  if(prepareNewMission({ blank: true })===false)return;
  $("auditProgram").value = "CUSTOM_CDC";
  $("customAuditTypeName").value = name;
  $("customReferentials").value = referentials;
  $("customControlsText").value = controls;
  preparedQuestions=questions;
  $("missionTitle").value = name;
  applyAuditProgramDefaults();
  setStatus("Programme préparé avec les contrôles sélectionnés. Vérifie le nom proposé, complète le client puis clique “Créer mission + questionnaire”. Les contrôles saisis généreront une chaîne dédiée au référentiel libre.", "success", "createStatus");
}

function showLogin(details = {}) {
  const gate = $("loginGate");
  if (!gate || state.clientPortal) return;
  gate.hidden = false;
  document.body.classList.add("authLocked");
  $("logoutButton") && ($("logoutButton").hidden = true);
  const message = details.setup_required
    ? "Sécurité DIAM à finaliser côté Cloudflare : ajoute DIAM_ADMIN_EMAIL, DIAM_ADMIN_PASSWORD_SHA256 ou DIAM_ADMIN_PASSWORD, et DIAM_SESSION_SECRET."
    : details.error || "Connexion auditeur requise pour accéder aux missions, preuves, analyses et rapports.";
  setStatus(message, details.setup_required ? "error" : "info", "loginStatus");
}

function hideLogin() {
  const gate = $("loginGate");
  if (gate) gate.hidden = true;
  document.body.classList.remove("authLocked");
  if ($("logoutButton") && !state.clientPortal) $("logoutButton").hidden = false;
}

async function login() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Connexion impossible.");
  state.authenticated = true;
  state.actor = data.actor || email;
  hideLogin();
  setStatus("Connexion sécurisée active.", "success", "createStatus");
  await init();
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  state.authenticated = false;
  state.actor = "";
  location.reload();
}

async function searchD2FClients() {
  if (state.demo) return demoOnly("La recherche D2F Business Suite nécessite l’API Cloudflare Worker et le secret D2F_BUSINESS_SUITE_API_KEY.");
  const q = $("d2fClientSearch").value.trim();
  const query = new URLSearchParams({ limit: "25" });
  if (q) query.set(q.startsWith("D2F-BS-CLIENT-") ? "clientId" : "q", q);
  setStatus("Recherche D2F Business Suite...", "info", "d2fSyncStatus");
  const out = await api(`/api/integrations/d2f-business-suite/audit-clients?${query}`);
  state.d2fClients = (out.clients || []).map(normalizeD2FClient);
  const select = $("d2fClientResults");
  if (!state.d2fClients.length) {
    select.innerHTML = `<option value="">Aucun client trouvé</option>`;
    const mode = out.integration?.lookup_mode ? ` Mode : ${out.integration.lookup_mode}.` : "";
    const fallback = Number.isFinite(out.integration?.fallback_count) ? ` ${out.integration.fallback_count} client(s) reçu(s) en recherche élargie, 0 correspondant à “${q}”.` : "";
    const path = out.integration?.response_path ? ` Réponse lue dans ${out.integration.response_path}.` : "";
    setStatus(`Business Suite a répondu, mais aucun client ne correspond à ces critères.${mode}${fallback}${path} Vérifie le nom, le SIREN/SIRET ou l’ID D2F-BS-CLIENT.`, "info", "d2fSyncStatus");
    return;
  }
  select.innerHTML = state.d2fClients.map((c, i) => `<option value="${i}">${escapeHtml(c.label)}</option>`).join("");
  const correlation = out.integration?.correlation_id ? ` · corrélation ${out.integration.correlation_id}` : "";
  const mode = out.integration?.lookup_mode ? ` · recherche ${out.integration.lookup_mode}` : "";
  setStatus(`${state.d2fClients.length} client(s) D2F chargé(s) depuis Business Suite ${out.integration?.version || ""}${mode}${correlation}.`, "success", "d2fSyncStatus");
}

async function importD2FClient() {
  const index = $("d2fClientResults").value;
  if (index === "") throw new Error("Recherche et sélectionne d’abord un client D2F Business Suite.");
  const client = state.d2fClients?.[Number(index)];
  if (!client) throw new Error("Client D2F introuvable dans la sélection.");
  if (currentMission() && !sameClientIdentity(currentMission(),client)) throw new Error(`Le client Gestion « ${client.name} » est distinct de l’entité auditée « ${currentMission().client_name} ». Le rattachement du commanditaire doit être séparé : aucune identité n’a été remplacée.`);
  $("clientName").value = client.name || $("clientName").value;
  $("clientCountry").value = client.country || $("clientCountry").value;
  const french = isFrenchCountry($("clientCountry").value);
  $("siren").value = french ? frenchSiren(client) : "";
  $("legalIdentifier").value = client.legalIdentifier || (french ? frenchSiren(client) : client.vatId) || "";
  $("vatId").value = client.vatId || $("vatId").value;
  $("clientAddress").value = client.address || $("clientAddress").value;
  $("clientAddressLine2").value = client.addressLine2 || $("clientAddressLine2").value;
  $("clientPostalCode").value = client.postalCode || $("clientPostalCode").value;
  $("clientCity").value = client.city || $("clientCity").value;
  $("clientEmail").value = client.email || $("clientEmail").value;
  $("clientPhone").value = client.phone || $("clientPhone").value;
  $("clientLanguage").value = client.language || $("clientLanguage").value;
  $("d2fSuiteClientId").value = client.id || $("d2fSuiteClientId").value;
  $("d2fSuiteCaseUrl").value = client.caseUrl || client.sourceUrl || $("d2fSuiteCaseUrl").value;
  state.d2fImportedClientUpdatedAt = client.updatedAt || "";
  syncCountryIdentifierFields();
  if (!state.missionId) {
    setStatus("Client D2F importé dans la fiche. Crée maintenant la première mission pour l’enregistrer.", "success", "d2fSyncStatus");
    return;
  }
  setStatus("Synchronisation et enregistrement de la mission active...", "info", "d2fSyncStatus");
  const out = await api(`/api/missions/${state.missionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(missionProfilePayload())
  });
  state.missionId = out.mission.id;
  await loadMissions();
  setStatus("Données importées dans DIAM. Aucune modification n’a été renvoyée à Gestion.", "success", "d2fSyncStatus");
}

function normalizedCountry(value) {
  return String(value || "").trim().toUpperCase();
}

function isFrenchCountry(value) {
  return ["FR", "FRA", "FRANCE", "RÉPUBLIQUE FRANÇAISE", "REPUBLIQUE FRANCAISE"].includes(normalizedCountry(value));
}

function frenchSiren(client = {}) {
  const direct = String(client.siren || "").replace(/\D/g, "");
  if (direct.length === 9) return direct;
  const siret = String(client.siret || "").replace(/\D/g, "");
  if (siret.length === 14) return siret.slice(0, 9);
  const legal = String(client.legalIdentifier || "").replace(/\D/g, "");
  return legal.length === 9 ? legal : "";
}

function syncCountryIdentifierFields() {
  const country = $("clientCountry")?.value || "";
  const french = isFrenchCountry(country);
  if ($("sirenField")) $("sirenField").hidden = !french;
  if ($("legalIdentifierField")) $("legalIdentifierField").hidden = french;
  if ($("legalIdentifierLabel")) $("legalIdentifierLabel").textContent = "Identifiant légal national";
}

function countryIdentifier(mission = {}, scope = {}) {
  const french = isFrenchCountry(mission.client_country);
  return {
    label: french ? "SIREN" : "Identifiant légal national",
    value: french
      ? mission.client_siren || scope.client_legal_identifier || ""
      : scope.client_legal_identifier || scope.client_vat_id || ""
  };
}

function normalizeD2FClient(raw = {}) {
  const name = raw.name || raw.clientName || raw.legalName || raw.raison_sociale || raw.identity?.name || "";
  const id = raw.id || raw.clientId || raw.dossierSourceId || raw.dossier_source_id || raw.stableId || raw.d2fClientId || raw.identity?.id || "";
  const siren = raw.siren || raw.SIREN || raw.identity?.siren || "";
  const siret = raw.siret || raw.SIRET || raw.identity?.siret || "";
  const legalIdentifier = raw.legalIdentifier || raw.legal_identifier || raw.legalId || raw.identity?.legalIdentifier || siren || siret || "";
  const vatId = raw.vatId || raw.vat_id || raw.vatNumber || raw.identity?.vatId || "";
  const addressObj = raw.address || raw.identity?.address || {};
  const address = typeof addressObj === "string" ? addressObj : [addressObj.line1, addressObj.line2, addressObj.street].filter(Boolean).join(" ");
  const addressLine2 = raw.addressLine2 || raw.address_line_2 || raw.street2 || (typeof addressObj === "object" ? addressObj.line2 || "" : "");
  const postalCode = raw.postalCode || raw.postal_code || raw.postal || (typeof addressObj === "object" ? addressObj.postalCode || addressObj.postal_code || addressObj.zip || "" : "");
  const city = raw.city || addressObj.city || raw.identity?.city || "";
  const country = raw.country || addressObj.country || raw.identity?.country || "";
  const language = normalizeLanguage(raw.language || raw.clientLanguage || raw.identity?.language || "fr");
  const email = raw.email || raw.identity?.email || "";
  const phone = raw.phone || raw.identity?.phone || "";
  const caseUrl = raw.caseUrl || raw.case_url || raw.url || raw.sourceUrl || "";
  return {
    raw,
    id,
    name,
    siren,
    siret,
    legalIdentifier,
    vatId,
    address,
    addressLine2,
    postalCode,
    city,
    country,
    language,
    email,
    phone,
    caseUrl,
    sourceUrl: raw.sourceUrl || raw.source_url || "",
    updatedAt: raw.updatedAt || raw.updated_at || "",
    label: `${id || "Client D2F"} — ${name || "Sans nom"}${siren || siret || legalIdentifier || vatId ? ` · ${siren || siret || legalIdentifier || vatId}` : ""}`
  };
}

function normalizeLanguage(value) {
  const v = String(value || "fr").toLowerCase();
  if (v.startsWith("en")) return "en";
  if (v.startsWith("es")) return "es";
  if (v.startsWith("de")) return "de";
  if (v.startsWith("it")) return "it";
  return "fr";
}

async function loadMissions() {
  state.missions = await api("/api/missions");
  if (!state.missions.length) {
    state.missionId = "";
    state.chain = [];
    state.documents = [];
    state.suggestions = [];
    state.clientFindings = [];
    state.selected = null;
    state.selectedClientFinding = null;
    $("missionSelect").innerHTML = `<option value="">Aucune mission — crée d’abord une mission</option>`;
    $("opinion").innerHTML = "<strong>Aucune mission active</strong><br>Crée une mission pour générer automatiquement le questionnaire PA ou SC.";
    $("detailEmpty").hidden = false;
    $("detail").hidden = true;
    $("selectedDocument").textContent = "Aucune mission active : dépôt documentaire bloqué tant qu’une mission n’est pas créée.";
    renderClientFacts();
    renderChain();
    renderMissionList();
    renderAuditorAdmin();
    renderDocuments();
    renderSuggestions();
    renderClientFindings();
    setMissionDependentEnabled(false);
    return;
  }
  $("missionSelect").innerHTML = state.missions.map((m) => `<option value="${m.id}">${m.number} - ${escapeHtml(m.title)}</option>`).join("");
  let remembered='';try{remembered=localStorage.getItem('diam.mission.'+state.actor)||'';}catch{}
  state.missionId=[state.missionId,remembered].find(id=>state.missions.some(m=>m.id===id))||state.missions.find(m=>![m.client_name,m.title].some(value=>/^\[(?:TEST|DEMO)/i.test(value||'')))?.id||'';
  $("missionSelect").value = state.missionId;
  setMissionDependentEnabled(Boolean(state.missionId));
  fillMissionForm(currentMission());
  renderClientFacts();
  renderMissionList();
  renderAuditorAdmin();
  if (state.missionId) await refreshAll();
}

function currentMission() {
  return state.missions.find((m) => m.id === state.missionId) || null;
}

function fillMissionForm(mission) {
  if (!mission) return;
  const pa=auditProgramFromMission(mission).id==='PA_DGFIP';
  const reportTab=document.querySelector('[data-tab="report"]');if(reportTab)reportTab.textContent=pa?'Rapport DGFiP':'Rapport d’audit';
  $('openLifecycleReport').hidden=!pa;
  $('generateReport').textContent=pa?'Générer rapport DGFiP':'Générer le rapport d’audit';
  for(const id of ['topDgfipFile','prepareDgfipAnalysis','openLifecycle','openCyber'])if($(id))$(id).hidden=!pa;

  const scope = mission.client_scope || {};
  $("clientName").value = mission.client_name || "";
  $("siren").value = mission.client_siren || "";
  $("legalIdentifier").value = scope.client_legal_identifier || "";
  $("vatId").value = scope.client_vat_id || "";
  $("auditProgram").value = auditProgramFromMission(mission).id;
  $("customAuditTypeName").value = scope.custom_audit_type_name || "";
  $("customReferentials").value = scope.custom_referentials || "";
  $("customControlsText").value = "";preparedQuestions=[];
  $("missionTitle").value = mission.title || "Audit de conformité PA";
  const period = periodDates(mission.audit_period);
  $("auditPeriodStart").value = period.start;
  $("auditPeriodEnd").value = period.end;
  $("clientCountry").value = mission.client_country || "France";
  $("clientAddress").value = mission.client_address || "";
  $("clientAddressLine2").value = scope.client_address_line_2 || "";
  $("clientPostalCode").value = scope.client_postal_code || "";
  $("clientCity").value = mission.client_city || "";
  $("clientEmail").value = scope.client_email || "";
  $("clientPhone").value = scope.client_phone || "";
  $("clientLanguage").value = mission.client_language || scope.client_language || "fr";
  $("dgfipApplicationStatus").value = scope.dgfip_application_status || "UNKNOWN";
  $("d2fSuiteClientId").value = scope.d2f_business_suite_client_id || "";
  $("d2fSuiteCaseUrl").value = scope.d2f_business_suite_case_url || "";
  state.d2fImportedClientUpdatedAt = scope.d2f_business_suite_source_updated_at || "";
  $("declaredScope").value = scope.declared_scope || "";
  applyAuditProgramDefaults();
  syncCountryIdentifierFields();
}

function clientIdentityPayload() {
  const french = isFrenchCountry($("clientCountry").value);
  return {
    client_name: $("clientName").value,
    siren: french ? $("siren").value : "",
    legal_identifier: french ? ($("siren").value || $("legalIdentifier").value) : $("legalIdentifier").value,
    vat_id: $("vatId").value,
    country: $("clientCountry").value,
    address: $("clientAddress").value,
    address_line_2: $("clientAddressLine2").value,
    postal_code: $("clientPostalCode").value,
    city: $("clientCity").value,
    email: $("clientEmail").value,
    phone: $("clientPhone").value
  };
}

function auditProgram(id) {
  return AUDIT_PROGRAMS[id] || AUDIT_PROGRAMS.PA_DGFIP;
}

function selectedAuditProgramId() {
  const value = $("auditProgram")?.value;
  if (value && AUDIT_PROGRAMS[value]) return value;
  const current = auditProgramFromMission(currentMission());
  return current.id || "PA_DGFIP";
}

function auditProgramFromMission(mission = {}) {
  const referential = String(mission.referential_version || "");
  if (referential.includes("RLF-C:SC")) return AUDIT_PROGRAMS.SC_RLFC;
  if (referential.includes("Audit personnalisé") || referential.includes("CDC personnalisé")) return AUDIT_PROGRAMS.CUSTOM_CDC;
  if (referential.includes("DGFiP") || referential.includes("PDP Integrity")) return AUDIT_PROGRAMS.PA_DGFIP;
  const scope = mission.client_scope || {};
  if (scope.audit_program && AUDIT_PROGRAMS[scope.audit_program]) return auditProgram(scope.audit_program);
  return AUDIT_PROGRAMS.PA_DGFIP;
}

function applyAuditProgramDefaults() {
  const program = auditProgram($("auditProgram").value);
  const title = $("missionTitle");
  if (!title.value.trim() || Object.values(AUDIT_PROGRAMS).some((p) => p.defaultTitle === title.value)) {
    title.value = program.defaultTitle;
  }
  $("declaredScope").placeholder = program.id === "SC_RLFC"
    ? "Ex. émission/réception, ERP, connecteur PA, annuaire, e-reporting, CDAR, SAE, pays/filiales..."
    : program.id === "CUSTOM_CDC"
      ? "Décris le périmètre audité, les activités, les livrables attendus et les référentiels/documents à charger."
      : "Ex. émission, réception, e-reporting, marque blanche, Peppol, périmètre pays/filiales...";
  const controlsMessage = program.expectedControls
    ? `Le questionnaire créé contiendra ${program.expectedControls} contrôles.`
    : "Renseigne le nom du type d’audit, les référentiels attachés et les contrôles à générer avant création.";
  const customFields = ["customAuditTypeName", "customReferentials", "customControlsText"];
  for (const id of customFields) {
    const wrapper = $(id)?.closest("label");
    if (wrapper) wrapper.hidden = program.id !== "CUSTOM_CDC";
  }
  setStatus(`Programme sélectionné : ${program.label}. ${controlsMessage}`, "info", "createStatus");
}

function missionProfilePayload() {
  return {
    ...clientIdentityPayload(),
    audit_program: selectedAuditProgramId(),
    title: $("missionTitle").value,
    audit_period_start: $("auditPeriodStart").value,
    audit_period_end: $("auditPeriodEnd").value,
    client_language: $("clientLanguage").value,
    dgfip_application_status: $("dgfipApplicationStatus").value,
    d2f_business_suite_client_id: $("d2fSuiteClientId").value,
    d2f_business_suite_case_url: $("d2fSuiteCaseUrl").value,
    d2f_business_suite_source_updated_at: state.d2fImportedClientUpdatedAt || "",
    declared_scope: $("declaredScope").value,
    custom_audit_type_name: $("customAuditTypeName").value,
    custom_referentials: $("customReferentials").value,
    custom_questions: preparedQuestions,
    custom_controls_text: $("customControlsText").value
  };
}

function renderMissionList() {
  const tbody = $("missionsTable")?.querySelector("tbody");
  if (!tbody) return;
  if (!state.missions.length) {
    tbody.innerHTML = `
      <tr class="noRows">
        <td colspan="5">
          <strong>Aucune mission créée.</strong><br>
          Crée une mission pour initialiser le questionnaire PA, SC ou personnalisé.
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = state.missions.map((m) => `
    <tr class="${m.id === state.missionId ? "selected" : ""}">
      <td>${escapeHtml(m.number)}</td>
      <td>${escapeHtml(m.title)}<br><span class="muted">${escapeHtml(m.client_name || "")}${m.client_country ? " · " + escapeHtml(m.client_country) : ""} · ${escapeHtml(auditProgramFromMission(m).shortLabel)} · ${escapeHtml(auditTypeLabel(m.audit_type))}</span></td>
      <td>${escapeHtml(m.status || "IN_PROGRESS")}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>
        <button class="small" data-open-mission="${m.id}" type="button">Ouvrir</button>
        <button class="small danger" data-delete-mission="${m.id}" type="button">Supprimer</button>
      </td>
    </tr>`).join("");
  for (const button of tbody.querySelectorAll("[data-open-mission]")) {
    button.onclick = () => run(() => openMission(button.dataset.openMission), "createStatus");
  }
  for (const button of tbody.querySelectorAll("[data-delete-mission]")) {
    button.onclick = () => run(() => deleteMissionById(button.dataset.deleteMission), "createStatus");
  }
}

function applyAccessUi(fullAccess) {
  document.body.classList.toggle("limitedUser", !fullAccess);
  if (!fullAccess && state.activeTab === "admin") showTab("dashboard", { scroll: false });
}

async function loadAuditorAdmin() {
  if (state.demo || state.clientPortal) return;
  try {
    const out = await api("/api/admin/auditors");
    state.auditors = out.users || [];
    state.auditorAssignments = out.assignments || [];
    renderAuditorAdmin();
  } catch (e) {
    setStatus(e.message || "Administration auditeurs indisponible.", "error", "auditorAdminStatus");
  }
}

function renderAuditorAdmin() {
  const auditorSelect = $("assignmentAuditor");
  const missionSelect = $("assignmentMission");
  const auditorsBody = $("auditorsTable")?.querySelector("tbody");
  const assignmentsBody = $("assignmentsTable")?.querySelector("tbody");
  if (!auditorSelect || !missionSelect || !auditorsBody || !assignmentsBody) return;

  auditorSelect.innerHTML = state.auditors.length
    ? state.auditors.map((u) => `<option value="${u.id}">${escapeHtml(u.display_name || u.email)} — ${escapeHtml(u.email)} (${escapeHtml(u.role)})</option>`).join("")
    : `<option value="">Aucun auditeur invité</option>`;
  missionSelect.innerHTML = state.missions.length
    ? state.missions.map((m) => `<option value="${m.id}">${escapeHtml(m.number)} — ${escapeHtml(m.title)}${m.client_name ? " · " + escapeHtml(m.client_name) : ""}</option>`).join("")
    : `<option value="">Aucune mission disponible</option>`;

  auditorsBody.innerHTML = state.auditors.length
    ? state.auditors.map((u) => `
      <tr>
        <td>${escapeHtml(u.display_name || "-")}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>${escapeHtml(u.status)}</td>
        <td>${u.assigned_missions || 0}</td>
        <td><button class="small danger" data-disable-auditor="${u.id}" type="button">Désactiver</button></td>
      </tr>`).join("")
    : `<tr class="noRows"><td colspan="6">Aucun collaborateur invité. Crée un accès avec un mot de passe temporaire.</td></tr>`;

  assignmentsBody.innerHTML = state.auditorAssignments.length
    ? state.auditorAssignments.map((a) => `
      <tr>
        <td>${escapeHtml(a.auditor_name || a.auditor_email)}</td>
        <td>${escapeHtml(a.auditor_email)}</td>
        <td>${escapeHtml(a.mission_number)} — ${escapeHtml(a.mission_title)}</td>
        <td>${escapeHtml(a.mission_role)}</td>
        <td><button class="small danger" data-revoke-assignment="${a.id}" type="button">Retirer</button></td>
      </tr>`).join("")
    : `<tr class="noRows"><td colspan="5">Aucune affectation active. Un auditeur invité sans affectation ne verra aucune mission.</td></tr>`;

  for (const button of assignmentsBody.querySelectorAll("[data-revoke-assignment]")) {
    button.onclick = () => run(() => revokeAuditorAssignment(button.dataset.revokeAssignment), "auditorAdminStatus");
  }
  for (const button of auditorsBody.querySelectorAll("[data-disable-auditor]")) {
    button.onclick = () => run(() => disableAuditor(button.dataset.disableAuditor), "auditorAdminStatus");
  }
}

async function inviteAuditor() {
  const email = $("auditorEmail").value.trim();
  const displayName = $("auditorName").value.trim();
  const role = $("auditorRole").value;
  const tempPassword = $("auditorPassword").value;
  const invitationBox = $("auditorInvitationNotice");
  if (!email || !tempPassword) throw new Error("Renseigne l’e-mail auditeur et un mot de passe temporaire.");
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.toLowerCase())) {
    $("auditorEmail").focus();
    throw new Error("E-mail collaborateur invalide : corrige l’adresse avant invitation.");
  }
  const user = await api("/api/admin/auditors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, display_name: displayName, role, temp_password: tempPassword })
  });
  const invitation = [
    "Invitation DIAM SaaS",
    `URL : ${location.origin}`,
    `E-mail : ${user.email}`,
    `Mot de passe temporaire : ${tempPassword}`,
    "Après connexion, l’accès est limité aux missions affectées par D2F."
  ].join("\n");
  if (invitationBox) {
    invitationBox.hidden = false;
    invitationBox.textContent = invitation;
  }
  await navigator.clipboard?.writeText(invitation).catch(() => {});
  $("auditorPassword").value = "";
  setStatus(`${user.display_name || user.email} : accès créé. L’invitation a été copiée si le navigateur l’autorise ; sinon copie le bloc vert ci-dessus. DIAM n’envoie pas encore d’e-mail.`, "success", "auditorAdminStatus");
  await loadAuditorAdmin();
}

async function assignAuditorToMission() {
  const userId = $("assignmentAuditor").value;
  const missionId = $("assignmentMission").value || state.missionId;
  const missionRole = $("assignmentRole").value;
  if (!userId || !missionId) throw new Error("Choisis un auditeur et une mission.");
  const assignment = await api("/api/admin/mission-auditors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, mission_id: missionId, mission_role: missionRole })
  });
  setStatus(`Affectation enregistrée : accès mission limité côté serveur (${assignment.mission_role || missionRole}).`, "success", "auditorAdminStatus");
  await loadAuditorAdmin();
}

async function revokeAuditorAssignment(assignmentId) {
  if (!assignmentId) throw new Error("Affectation introuvable.");
  if (!confirm("Retirer cet auditeur de la mission ? Il ne pourra plus ouvrir cet audit.")) return;
  await api(`/api/admin/mission-auditors/${assignmentId}`, { method: "DELETE" });
  setStatus("Affectation retirée. L’accès à cette mission est coupé.", "success", "auditorAdminStatus");
  await loadAuditorAdmin();
}

async function disableAuditor(userId) {
  if (!userId) throw new Error("Collaborateur introuvable.");
  const user = state.auditors.find((u) => u.id === userId);
  const label = user ? `${user.display_name || user.email} (${user.email})` : "ce collaborateur";
  if (!confirm(`Désactiver ${label} et retirer ses accès mission ?`)) return;
  const out = await api(`/api/admin/auditors/${userId}`, { method: "DELETE" });
  setStatus(`Collaborateur désactivé. Affectations retirées : ${out.revoked_assignments || 0}.`, "success", "auditorAdminStatus");
  await loadAuditorAdmin();
}

function renderClientFacts() {
  const box = $("clientFacts");
  if (!box) return;
  const mission = state.missions.find((m) => m.id === state.missionId);
  if (!mission) {
    $("activeMissionLabel").textContent = "Aucune mission ouverte";
    $("changeActiveMission").textContent = "Choisir un audit";
    box.innerHTML = `<p class="muted">Ouvre une mission pour afficher la fiche client, le statut du dossier DGFiP et le périmètre déclaré.</p>`;
    return;
  }
  $("activeMissionLabel").textContent = `${mission.number} · ${mission.client_name || mission.title}`;
  $("changeActiveMission").innerHTML = 'Changer d’audit <span aria-hidden="true">↗</span>';
  const scope = mission.client_scope || {};
  const identifier = countryIdentifier(mission, scope);
  const program = auditProgramFromMission(mission);
  box.innerHTML = `
    <div class="actions"><button type="button" id="editActiveClient">Compléter la fiche client / mission</button><button type="button" id="openClientIntegration">Données D2F Gestion</button></div>
    <div class="factGrid">
      <div><span>Programme</span><strong>${escapeHtml(program.label)}</strong></div>
      <div><span>Référentiel</span><strong>${escapeHtml(mission.referential_version || "Non renseigné")}</strong></div>
      <div><span>Client</span><strong>${escapeHtml(mission.client_name || "Non renseigné")}</strong></div>
      <div><span>${escapeHtml(identifier.label)}</span><strong>${escapeHtml(identifier.value || "Non renseigné")}</strong></div>
      <div><span>N° TVA</span><strong>${escapeHtml(scope.client_vat_id || "Non renseigné")}</strong></div>
      <div><span>Pays</span><strong>${escapeHtml(mission.client_country || "Non renseigné")}</strong></div>
      <div><span>Adresse</span><strong>${escapeHtml([mission.client_address, scope.client_address_line_2, [scope.client_postal_code, mission.client_city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Non renseignée")}</strong></div>
      <div><span>Contact</span><strong>${escapeHtml([scope.client_email, scope.client_phone].filter(Boolean).join(" · ") || "Non renseigné")}</strong></div>
      <div><span>Conduite audit</span><strong>${escapeHtml(languageLabel(mission.client_language || scope.client_language || "fr"))}</strong></div>
      <div><span>Rapport DGFiP</span><strong>Français obligatoire</strong></div>
      <div><span>Dossier DGFiP</span><strong>${escapeHtml(applicationStatusLabel(scope.dgfip_application_status))}</strong></div>
      <div><span>Périmètre déclaré</span><strong>${escapeHtml(scope.declared_scope || "À cadrer par dossier de candidature accepté")}</strong></div>
      <div><span>Cycle label</span><strong>${escapeHtml(auditTypeLabel(mission.audit_type))}</strong></div>
      <div><span>Validité label</span><strong>${escapeHtml(labelValidity(mission))}</strong></div>
      <div><span>Surveillance</span><strong>${escapeHtml(surveillanceLabel(mission))}</strong></div>
      <div><span>What’s new</span><strong>${mission.whats_new_required ? "Analyse obligatoire" : "Non requis"}</strong></div>
      <div><span>Audit complémentaire</span><strong>${mission.complementary_audit_required ? "À déclencher — temps passé" : "Non déclenché"}</strong></div>
      <div><span>Statut cycle</span><strong>${escapeHtml(lifecycleStatusLabel(mission.lifecycle_status))}</strong></div>
      <div><span>D2F Business Suite</span><strong>${escapeHtml(d2fSuiteLabel(scope))}</strong></div>
    </div>
    <p class="notice">${escapeHtml(mission.lifecycle_notes || `Après dépôt des documents de cadrage ${program.shortLabel}, des référentiels et des notes D2F/réunions récentes, l’analyse assistée met en évidence les preuves manquantes et les demandes complémentaires applicables au périmètre déclaré.`)}</p>
  `;
  $("editActiveClient").addEventListener("click", () => { fillMissionForm(mission); showTab("mission_form"); $("clientName").focus(); });
  $("openClientIntegration").addEventListener("click", () => { fillMissionForm(mission); showTab("mission_form"); $("d2fClientSearch").value = mission.client_name || ""; $("d2fClientSearch").focus(); $("d2fClientSearch").scrollIntoView({block:"center"}); });
}

async function openMission(id) {
  if(controlBusy)throw Error('Enregistrement en cours : attends sa fin avant de changer de mission.');
  if(!allowControlLeave())return;
  const mission = state.missions.find(m => m.id === id);
  if (!mission) throw new Error("Choisis une mission autorisée à ouvrir.");
  const epoch = ++missionEpoch;
  state.missionId = id;
  try{localStorage.setItem('diam.mission.'+state.actor,id);}catch{}
  $("missionSelect").value = id;
  state.selected = null;
  state.documentId = null;
  state.suggestionId = null;
  state.selectedClientFinding = null;
  state.chain = []; state.documents = []; state.suggestions = []; state.clientFindings = [];
  lastReport = null;
  $("report").replaceChildren();
  $("detailEmpty").hidden = false;
  $("detail").hidden = true;
  fillMissionForm(mission);
  renderClientFacts();
  renderChain(); renderDocuments(); renderSuggestions(); renderClientFindings();
  await refreshAll();
  if (epoch !== missionEpoch) return;
  renderMissionList();
  await auditGuide.open();
}

async function createMission() {
  if (state.demo) return demoOnly("Création réelle indisponible en aperçu local. Lance `npm run dev` dans `DIAM/saas` avec Supabase configuré.");
  if (selectedAuditProgramId() === "CUSTOM_CDC" && !$("customControlsText").value.trim()) {
    showTab("mission_form");
    $("customControlsText")?.focus();
    throw new Error("Audit personnalisé : renseigne au moins un contrôle à générer. Une ligne = un contrôle dans la chaîne d’audit.");
  }
  if ($("createMission").disabled) return;
  $("createMission").disabled = true;
  $("createStatus").textContent = "Création en cours...";
  try {
  const out = await api("/api/missions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(missionProfilePayload())
  });
  $("createStatus").textContent = out.reused_existing
    ? `${out.mission.number} existait déjà pour ce client et ce programme : mission rouverte, aucun doublon créé.`
    : `${out.mission.number} créée avec ${out.seeded_controls} contrôles ${out.audit_program?.shortLabel || auditProgram($("auditProgram").value).shortLabel}.`;
  state.missionId = out.mission.id;
  await loadMissions();
  await loadAuditorAdmin();
  state.missionId = out.mission.id;
  if ($("missionSelect")) $("missionSelect").value = state.missionId;
  await refreshAll();
  await auditGuide.open();
  } finally { $("createMission").disabled = false; }
}

async function updateMissionProfile() {
  if (!state.missionId) {
    const selectedMissionId = $("missionSelect")?.value || "";
    if (selectedMissionId) {
      await openMission(selectedMissionId);
      setStatus("Mission sélectionnée ouverte. Modifie la fiche puis clique à nouveau sur “Enregistrer fiche”.", "info", "createStatus");
      return;
    }
    setStatus("Brouillon détecté : DIAM crée maintenant la mission et son questionnaire au lieu de modifier une ancienne mission.", "info", "createStatus");
    await createMission();
    return;
  }
  requireMission();
  if (state.demo) return demoOnly("Mise à jour réelle indisponible en aperçu local. Ouvre l’URL Cloudflare pour enregistrer en base Supabase.");
  $("createStatus").textContent = "Mise à jour de la fiche mission...";
  const out = await api(`/api/missions/${state.missionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(missionProfilePayload())
  });
  state.missionId = out.mission.id;
  await loadMissions();
  setStatus("Fiche mission active mise à jour : client, langue, programme d’audit et périmètre sont enregistrés.", "success", "createStatus");
  showTab("mission_form", { preserveScroll: true });
}

function prepareDgfipAnalysis() {
  requireMission();
  $("auditDocumentType").value = "DGFiP_APPLICATION_ACCEPTED";
  const program = auditProgram($("auditProgram").value);
  setStatus(`Dépose le dossier de cadrage ${program.shortLabel} : DIAM l’utilisera pour cadrer le périmètre et identifier les preuves manquantes.`, "info", "documentStatus");
  showTab("documents");
  $("auditDocumentFile")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteMission() {
  requireMission();
  await deleteMissionById(state.missionId);
}

async function deleteMissionById(missionId) {
  if (!missionId) throw new Error("Choisis une mission à supprimer.");
  if (state.demo) return demoOnly("Suppression réelle indisponible en aperçu local.");
  const mission = state.missions.find((m) => m.id === missionId);
  const label = mission ? `${mission.number} - ${mission.title}` : "la mission sélectionnée";
  if (!confirm(`Supprimer définitivement ${label} et sa chaîne d'audit ?`)) return;
  await api(`/api/missions/${missionId}`, { method: "DELETE" });
  if (state.missionId === missionId) state.missionId = "";
  state.selected = null;
  setStatus("Mission supprimée.", "success", "createStatus");
  await loadMissions();
  await loadAuditorAdmin();
}

async function copyClientLink() {
  requireMission();
  if (state.demo) return demoOnly("Lien client indisponible en aperçu local.");
  const out = await api(`/api/client-link?mission_id=${state.missionId}`);
  await navigator.clipboard.writeText(out.link);
  setStatus("Lien client copié. Tu peux l’envoyer au client audité.", "success", "createStatus");
}

async function refreshAll() {
  if (!state.missionId) {
    renderChain();
    return;
  }
  if (state.demo) {
    renderDemo();
    return;
  }
  await Promise.all([loadChain(), loadDocuments(), loadSuggestions(), loadClientFindings()]);
}

async function loadChain() {
  const id=state.missionId, epoch=missionEpoch;
  const data = await api(`/api/audit-chain?mission_id=${id}`);
  if (id!==state.missionId || epoch!==missionEpoch) return;
  state.chain = data.chain;
  if(state.selected) state.selected=state.chain.find(q=>q.question_id===state.selected.question_id)||null;
  if (selectedAuditProgramId() === "CUSTOM_CDC") {$("customControlsText").value = data.chain.map(q=>q.attendu_dgfip||q.question).join("\n");preparedQuestions=data.chain.map(q=>({requirement:q.attendu_dgfip,question:q.question}));}
  $("opinion").innerHTML = `<strong>${data.result.opinion}</strong><br>${escapeHtml(data.result.reason)}`;
  renderChain();
}

function renderChain() {
  if (!state.chain.length) {
    $("chainTable").querySelector("tbody").innerHTML = `
      <tr class="noRows">
        <td colspan="8">
          <strong>Aucune ligne d’audit à afficher.</strong><br>
          Crée une mission : DIAM générera alors le questionnaire PA ou SC, les preuves attendues et la chaîne d’audit.
        </td>
      </tr>`;
    return;
  }
  $("chainTable").querySelector("tbody").innerHTML = state.chain.map((r, i) => `
    <tr data-index="${i}" class="${state.selected?.question_id === r.question_id ? "selected" : ""}">
      <td>${escapeHtml(r.reference)}</td>
      <td>${escapeHtml(r.question)}</td>
      <td>${applicabilityBadge(r.applicabilite_statut)}<br><span class="muted smallText">${escapeHtml(r.applicabilite_raison || "")}</span></td>
      <td>${badge(r.qualification_base)}</td>
      <td>${badge(r.qualification_retenue)}</td>
      <td>${escapeHtml(controlLabel(r.reponse_statut))}${r.report_limitation ? `<br><small>${escapeHtml(r.report_limitation)}</small>` : ""}</td>
      <td>${escapeHtml(r.constat || "-")}<br>${escapeHtml(controlLabel(r.statut_constat || ""))}</td>
      <td>${escapeHtml(r.preuves_associees || "Aucune preuve liée")}</td>
    </tr>`).join("");
  for (const row of $("chainTable").querySelectorAll("tbody tr")) {
    row.onclick = () => selectQuestion(Number(row.dataset.index));
  }
}

function selectQuestion(index,afterSave=false) {
  if(!state.chain[index]||(!afterSave&&controlBusy))return;
  if(!afterSave&&!allowControlLeave())return;
  state.selected = state.chain[index];
  $("detailEmpty").hidden = true;
  $("detail").hidden = false;
  const reference=state.selected.reference||'';const title=state.selected.question||'';
  $("detailTitle").textContent=title.startsWith(reference)?title:`${reference} — ${title}`;
  $('requirementLabel').textContent=auditProgramFromMission(currentMission()).id==='PA_DGFIP'?'Attendu DGFiP':'Exigence du référentiel';
  $("requirement").textContent = state.selected.attendu_dgfip;
  $("expectedEvidence").textContent = state.selected.preuves_attendues;
  $("applicabilityNote").innerHTML = `
    <strong>${escapeHtml(applicabilityLabel(state.selected.applicabilite_statut))}</strong><br>
    ${escapeHtml(state.selected.applicabilite_raison || "Applicabilité à confirmer par l'auditeur.")}<br>
    <span class="muted">${escapeHtml(state.selected.conduite_audit || (auditProgramFromMission(currentMission()).id==='PA_DGFIP'?auditLanguagePolicy(currentMission()?.client_language || "fr"):'Rapport selon le programme et les modalités de la mission.'))}</span>
  `;
  $("checklist").innerHTML = state.selected.checklist.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  $("answerStatus").value = state.selected.reponse_statut;
  $("clientAnswer").value = state.selected.reponse_client;
  $("auditorAnalysis").value = state.selected.analyse_auditeur;
  $("findingSummary").value = state.selected.synthese_constat;
  $("retainedQualification").value = state.selected.qualification_retenue;
  $("recommendation").value = state.selected.recommandation || "";
  $("findingStatus").value = state.selected.statut_constat || "OPEN";
  answerBaseline=snapshot(answerFields);findingBaseline=snapshot(findingFields);treatmentBaseline=$('findingStatus').value;$('evidenceFile').value='';
  renderControlNavigation();renderChain();
  showTab("detail");
  controlDocumentsWorkspace?.open(state.selected).catch(e=>setStatus(e.message,"error"));
}

async function saveAnswer() {
  requireSelection();
  if (state.demo) {
    state.selected.reponse_statut = $("answerStatus").value;
    state.selected.reponse_client = $("clientAnswer").value;
    state.selected.analyse_auditeur = $("auditorAnalysis").value;
    setStatus("Aperçu local : réponse simulée à l’écran. Non enregistrée en base.", "success");
    renderChain();
    return;
  }
  const submittedAnswer=snapshot(answerFields);
  await api("/api/answers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question_id: state.selected.question_id,
      compliance_status: $("answerStatus").value,
      client_answer: $("clientAnswer").value,
      auditor_analysis: $("auditorAnalysis").value
    })
  });
  answerBaseline=submittedAnswer;
  setStatus("Réponse enregistrée.", "success");
  await loadChain();
  showTab("detail");
}

async function saveFinding() {
  requireSelection();
  if (state.demo) {
    state.selected.constat_id = state.selected.constat_id || `demo-finding-${state.selected.question_id}`;
    state.selected.constat = "Constat auditeur";
    state.selected.synthese_constat = $("findingSummary").value;
    state.selected.qualification_retenue = $("retainedQualification").value;
    state.selected.recommandation = $("recommendation").value;
    state.selected.statut_constat = $("findingStatus").value || "OPEN";
    setStatus("Aperçu local : constat simulé. Non enregistré en base.", "success");
    renderChain();
    return;
  }
  const submittedFinding=snapshot(findingFields);
  await api("/api/findings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question_id: state.selected.question_id,
      summary: $("findingSummary").value,
      retained_qualification: $("retainedQualification").value,
      recommendation: $("recommendation").value
    })
  });
  findingBaseline=submittedFinding;
  setStatus("Constat créé/mis à jour. La qualification retenue est tracée.", "success");
  await loadChain();
  showTab("detail");
}

async function updateFindingStatus() {
  requireSelection();
  if (state.demo) {
    state.selected.statut_constat = $("findingStatus").value;
    state.selected.qualification_retenue = $("retainedQualification").value;
    setStatus("Aperçu local : traitement simulé. Non enregistré en base.", "success");
    renderChain();
    return;
  }
  if (!state.selected.constat_id) throw new Error("Crée d'abord le constat.");
  await api(`/api/findings/${state.selected.constat_id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: $("findingStatus").value,
      retained_qualification: $("retainedQualification").value,
      closure_comment: "Traitement saisi par l'auditeur"
    })
  });
  treatmentBaseline=$("findingStatus").value;
  setStatus("Traitement du constat mis à jour.", "success");
  await loadChain();
  showTab("detail");
}

async function uploadEvidence() {
  requireSelection();
  if (state.demo) return demoOnly("Le versement de preuve nécessite l’API, Supabase Storage et le hachage côté Worker.");
  if (!$("evidenceFile").files[0]) throw new Error("Choisis un fichier de preuve.");
  if (!state.selected.constat_id) await saveFinding();
  await loadChain();
  state.selected = state.chain.find((x) => x.question_id === state.selected.question_id);
  const file = $("evidenceFile").files[0];
  if (!file) throw new Error("Choisis un fichier de preuve.");
  const fd = new FormData();
  fd.set("mission_id", state.missionId);
  fd.set("question_id", state.selected.question_id);
  fd.set("finding_id", state.selected.constat_id);
  fd.set("file", file);
  setStatus("Versement de la preuve...");
  await api("/api/evidences", { method: "POST", body: fd });
  setStatus("Preuve versée, hachée et liée au constat.", "success");
  $("evidenceFile").value = "";
  await loadChain();
  showTab("detail");
}

async function loadDocuments() {
  const id=state.missionId, epoch=missionEpoch;
  const query = state.missionId ? `?mission_id=${state.missionId}&include_global=true` : "?scope=global";
  const docs = await api(`/api/documents${query}`);
  if (id!==state.missionId || epoch!==missionEpoch) return;
  state.documents = docs;
  renderDocuments();
}

function renderDocuments() {
  if (!state.documents.length) {
    $("documentsTable").querySelector("tbody").innerHTML = `
      <tr class="noRows">
        <td colspan="5">Aucun document déposé. Ajoute un document de mission ou un document transverse : guide DGFiP, texte, CR DGFiP/AIFE, référentiel D2F.</td>
      </tr>`;
    renderDocumentsSelection();
    return;
  }
  $("documentsTable").querySelector("tbody").innerHTML = state.documents.map((d, i) => `
    <tr data-index="${i}" class="${state.documentId === d.id ? "selected" : ""}">
      <td>${d.document_scope === "GLOBAL" ? badge("Transverse") : badge("Mission")}</td><td>${escapeHtml(documentTypeLabel(d.document_type))}</td><td>${escapeHtml(d.original_name)}</td><td>${escapeHtml(analysisStatusLabel(d.analysis_status))}</td><td>${escapeHtml(d.sha256.slice(0, 16))}...</td>
    </tr>`).join("");
  for (const row of $("documentsTable").querySelectorAll("tbody tr")) {
    row.onclick = () => { state.documentId = state.documents[Number(row.dataset.index)].id; renderDocumentsSelection(); };
  }
  renderDocumentsSelection();
}

function renderDocumentsSelection() {
  const selected = state.documents.find((d) => d.id === state.documentId);
  $("selectedDocument").textContent = selected
    ? `Document sélectionné : ${selected.original_name}${selected.document_scope === "GLOBAL" ? " — référentiel/CR transverse applicable à toutes les missions" : ""}. Clique “Analyser le document sélectionné” pour l’analyser sans le redéposer.`
    : "Aucun document sélectionné. Dépose un document ou sélectionne une ligne déjà présente.";
}

function isGlobalDocumentType(type) {
  return ["REGULATORY_REFERENCE", "REGULATORY_UPDATE", "DGFIP_MEETING_NOTE", "D2F_REFERENCE"].includes(type);
}

async function uploadAuditDocument(options = {}) {
  const documentType = $("auditDocumentType").value;
  const globalScope = isGlobalDocumentType(documentType);
  if (!globalScope) requireMission();
  if (state.demo) return demoOnly("Le dépôt documentaire nécessite l’API Cloudflare Worker et Supabase Storage.");
  const selectedFiles = [...$("auditDocumentFile").files];
  const files=await expandDossierFiles(selectedFiles);
  if (!files.length) throw new Error("Choisis un ou plusieurs documents à déposer : dossier DGFiP accepté, nouveau référentiel, CR réunion, note D2F, document qualité, technique ou sécurité.");
  const uploadMission=state.missionId;
  const uploaded = [];
  setStatus(`Dépôt documentaire en cours (${files.length} fichier(s))...`, "info", "documentStatus");
  for (const file of files) {
    if(!globalScope&&state.missionId!==uploadMission)throw Error(`Mission changée. ${uploaded.length} fichiers déjà déposés dans la mission initiale ; aucun fichier envoyé à la nouvelle mission.`);
    setStatus(`Dépôt ${uploaded.length+1}/${files.length} : ${file.name}`, "info", "documentStatus");
    const fd = new FormData();
    if (state.missionId && !globalScope) fd.set("mission_id", state.missionId);
    fd.set("document_type", documentType);
    fd.set("document_scope", globalScope ? "GLOBAL" : "MISSION");
    fd.set("file", file);
    try{uploaded.push(await api("/api/documents", { method: "POST", body: fd }));}catch(e){await loadDocuments();throw Error(`${uploaded.length}/${files.length} fichiers déposés. Échec pour ${file.name} : ${e.message}. Relance le même dépôt : les fichiers déjà présents sont reconnus par leur empreinte.`);}
  }
  controlDocumentsWorkspace?.invalidate();
  state.documentId = uploaded.at(-1)?.id || state.documentId;
  const duplicates = uploaded.filter((doc) => doc.duplicate).length;
  const created = uploaded.length - duplicates;
  if (!options.silent) {
    const scopeLabel = globalScope ? "dans la bibliothèque transverse" : "dans la mission";
    setStatus(`${created} document(s) déposé(s) ${scopeLabel}, ${duplicates} déjà présent(s).`, "success", "documentStatus");
  }
  $("auditDocumentFile").value = "";
  await loadDocuments();
  showTab("documents", { preserveScroll: true });
  return uploaded;
}

async function analyzeDocumentById(documentId) {
  const selected = state.documents.find((d) => d.id === documentId);
  if (!selected) throw new Error("Sélectionne une ligne documentaire existante à analyser.");
  if (!state.missionId) throw new Error("Ouvre une mission pour analyser ce document au regard du programme d’audit PA ou SC.");
  const fd = new FormData();
  fd.set("mission_id", state.missionId);
  setStatus(`Analyse au regard du référentiel en cours : ${selected.original_name}...`, "info", "documentStatus");
  return api(`/api/documents/${documentId}/analyze`, { method: "POST", body: fd });
}

async function uploadAndAnalyzeDocument() {
  requireMission();
  const uploaded = await uploadAuditDocument({ silent: true });
  await dossierWorkspace.open(uploaded.map(d=>d.id));
}

async function analyzeAuditDocument() {
  requireMission();
  if ($("auditDocumentFile").files.length) throw new Error("Dépose d’abord le nouveau fichier ou clique « Déposer puis analyser ».");
  if (!state.documentId) throw new Error("Sélectionne un document dans le registre.");
  await dossierWorkspace.open([state.documentId]);
}

async function loadSuggestions() {
  const id=state.missionId, epoch=missionEpoch;
  const suggestions = await api(`/api/ai-suggestions?mission_id=${id}`);
  if (id!==state.missionId || epoch!==missionEpoch) return;
  state.suggestions = suggestions;
  renderSuggestions();
}

function renderSuggestions() {
  if (!state.suggestions.length) {
    $("suggestionsTable").querySelector("tbody").innerHTML = `
      <tr class="noRows">
        <td colspan="8">Aucune proposition IA. Dépose un document dans une mission, puis lance l’analyse au regard du référentiel.</td>
      </tr>`;
    return;
  }
  $("suggestionsTable").querySelector("tbody").innerHTML = state.suggestions.map((s, i) => `
    <tr data-index="${i}" class="${state.suggestionId === s.id ? "selected" : ""}">
      <td>${escapeHtml(assessmentLabel(s.assessment_type))}</td>
      <td>${escapeHtml(s.reference || "-")}</td>
      <td><strong>${escapeHtml(s.requirement_source || "-")}</strong><br>${escapeHtml(s.requirement_excerpt || "")}</td>
      <td>${escapeHtml(s.evidence_document_name || "-")}<br><span class="muted">${escapeHtml(s.evidence_locator || "")}</span><br><span class="mono">${escapeHtml((s.evidence_sha256 || "").slice(0, 16))}${s.evidence_sha256 ? "..." : ""}</span></td>
      <td>${escapeHtml(s.potential_gap)}<br><span class="muted">${escapeHtml(s.missing_evidence || "")}</span></td>
      <td>${escapeHtml(s.suggested_qualification)}</td>
      <td>${Math.round((s.confidence || 0) * 100)}%</td>
      <td>${escapeHtml(s.status)}${s.reviewer_justification ? `<br><span class="muted">${escapeHtml(s.reviewer_justification)}</span>` : ""}</td>
    </tr>`).join("");
  for (const row of $("suggestionsTable").querySelectorAll("tbody tr")) {
    row.onclick = () => { state.suggestionId = state.suggestions[Number(row.dataset.index)].id; loadSuggestions(); };
  }
}

async function promoteSuggestion() {
  requireMission();
  if (state.demo) return demoOnly("La promotion IA en constat nécessite une mission enregistrée en base.");
  if (!state.suggestionId) throw new Error("Sélectionne une proposition IA.");
  await api(`/api/ai-suggestions/${state.suggestionId}/promote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ justification: $("suggestionJustification").value })
  });
  setStatus("Proposition IA promue en constat auditeur à valider.", "success");
  await Promise.all([loadChain(), loadSuggestions()]);
  showTab("audit");
}

async function rejectSuggestion() {
  requireMission();
  if (state.demo) return demoOnly("Le rejet d’une proposition nécessite une mission enregistrée en base.");
  if (!state.suggestionId) throw new Error("Sélectionne une proposition IA.");
  await api(`/api/ai-suggestions/${state.suggestionId}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ justification: $("suggestionJustification").value })
  });
  setStatus("Proposition rejetée et décision tracée.", "success", "documentStatus");
  $("suggestionJustification").value = "";
  await loadSuggestions();
}

async function loadClientFindings() {
  const id=state.missionId, epoch=missionEpoch;
  const query = state.clientPortal
    ? `mission_id=${encodeURIComponent(state.missionId)}&token=${encodeURIComponent(state.clientToken)}`
    : `mission_id=${encodeURIComponent(state.missionId)}`;
  const findings = await api(`/api/client/findings?${query}`);
  if (id!==state.missionId || epoch!==missionEpoch) return;
  state.clientFindings = findings;
  renderClientFindings();
}

function renderClientFindings() {
  const tbody = $("clientFindingsTable")?.querySelector("tbody");
  if (!tbody) return;
  if (!state.clientFindings.length) {
    tbody.innerHTML = `
      <tr class="noRows">
        <td colspan="5">Aucun constat ouvert pour l’espace client.</td>
      </tr>`;
    $("clientFindingSelected").textContent = "Aucun constat ouvert à traiter.";
    return;
  }
  tbody.innerHTML = state.clientFindings.map((r, i) => `
    <tr data-index="${i}" class="${state.selectedClientFinding?.constat_id === r.constat_id ? "selected" : ""}">
      <td>${escapeHtml(r.reference)}<br>${escapeHtml(r.question)}</td>
      <td><strong>${escapeHtml(r.constat || "Constat")}</strong><br>${escapeHtml(r.synthese_constat || "")}</td>
      <td>${escapeHtml(r.attendu_dgfip)}</td>
      <td>${escapeHtml(r.preuves_attendues)}</td>
      <td>${escapeHtml(r.preuves_associees || "Aucune preuve liée")}</td>
    </tr>`).join("");
  for (const row of tbody.querySelectorAll("tr[data-index]")) {
    row.onclick = () => {
      state.selectedClientFinding = state.clientFindings[Number(row.dataset.index)];
      $("clientFindingSelected").textContent = `${state.selectedClientFinding.reference} — ${state.selectedClientFinding.synthese_constat || state.selectedClientFinding.question}`;
      renderClientFindings();
    };
  }
}

async function submitClientReply() {
  requireMission();
  if (!state.selectedClientFinding?.constat_id) throw new Error("Sélectionne un constat ouvert à traiter.");
  const fd = new FormData();
  fd.set("message", $("clientReplyMessage").value);
  fd.set("message_language", $("clientReplyLanguage").value);
  fd.set("french_translation", $("clientReplyFrenchTranslation").value);
  fd.set("translation_validated", $("translationValidated").checked ? "true" : "false");
  const file = $("clientReplyFile").files[0];
  if (file) fd.set("file", file);
  setStatus("Envoi de la réponse client...", "info", "clientStatus");
  const suffix = state.clientPortal ? `?mission_id=${encodeURIComponent(state.missionId)}&token=${encodeURIComponent(state.clientToken)}` : `?mission_id=${encodeURIComponent(state.missionId)}`;
  await api(`/api/client/findings/${state.selectedClientFinding.constat_id}/reply${suffix}`, { method: "POST", body: fd });
  setStatus("Réponse client enregistrée, preuve liée au constat.", "success", "clientStatus");
  $("clientReplyMessage").value = "";
  $("clientReplyFrenchTranslation").value = "";
  $("translationValidated").checked = false;
  $("clientReplyFile").value = "";
  await Promise.all([loadChain(), loadClientFindings()]);
}

async function generateReport() {
  requireMission();
  if (state.demo) {
    $("reportCard").hidden = false;
    $("report").innerHTML = reportHtml({
      result: { opinion: "APERÇU — non opposable", reason: "Mode local sans base Supabase : rapport de démonstration visuelle uniquement." },
      chain: state.chain
    });
    showTab("report");
    return;
  }
  const out = await api("/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mission_id: state.missionId })
  });
  lastReport = out;
  $("reportCard").hidden = false;
  $("report").innerHTML = reportHtml(out);
  showTab("report");
}

function reportHtml(out) {
  if (out.template || /Audit personnalisé|RLF-C:SC/.test(out.mission?.referential_version||"")) return structuredReportHtml(out);
  return legacyReportHtml(out);
}

function legacyReportHtml(out) {
  const scope = out.client?.scope || {};
  const identifier = countryIdentifier({ client_country: out.client?.country, client_siren: out.client?.siren }, scope);
  return `
    <h1>Rapport d'audit de conformité réglementaire</h1>
    <p><strong>Opinion :</strong> ${escapeHtml(out.result.opinion)}</p>
    <p><strong>Motif :</strong> ${escapeHtml(out.result.reason)}</p>
    <p><strong>Référentiel :</strong> ${escapeHtml(REG_LABEL())}</p>
    <p><strong>Version DIAM :</strong> ${escapeHtml(appRelease.name)} v${escapeHtml(appRelease.version)} — ${escapeHtml(appRelease.release)} · schéma ${escapeHtml(appRelease.schema?.current || appRelease.schemaVersion || "-")} · build ${escapeHtml(appRelease.buildCommit || "non renseigné")}</p>
    <h2>Fiche client et périmètre audité</h2>
    <p><strong>Client :</strong> ${escapeHtml(out.client?.name || "-")} · <strong>${escapeHtml(identifier.label)} :</strong> ${escapeHtml(identifier.value || "-")} · <strong>N° TVA :</strong> ${escapeHtml(scope.client_vat_id || "-")} · <strong>Pays :</strong> ${escapeHtml(out.client?.country || "-")}</p>
    <p><strong>Adresse :</strong> ${escapeHtml([out.client?.address, scope.client_address_line_2, [scope.client_postal_code, out.client?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "-")} · <strong>Contact :</strong> ${escapeHtml([scope.client_email, scope.client_phone].filter(Boolean).join(" · ") || "-")}</p>
    <p><strong>Langue client :</strong> ${escapeHtml(languageLabel(out.mission?.client_language || scope.client_language || "fr"))}</p>
    <p><strong>Statut dossier DGFiP :</strong> ${escapeHtml(applicationStatusLabel(scope.dgfip_application_status))}</p>
    <p><strong>Périmètre PA déclaré :</strong> ${escapeHtml(scope.declared_scope || "-")}</p>
    <p><strong>Rattachement D2F Business Suite :</strong> ${escapeHtml(d2fSuiteLabel(scope))}</p>
    <h2>Cycle du label PA</h2>
    <p><strong>Type d’audit :</strong> ${escapeHtml(auditTypeLabel(out.mission?.audit_type))} · <strong>Validité label :</strong> ${escapeHtml(labelValidity(out.mission || {}))} · <strong>Surveillance :</strong> ${escapeHtml(surveillanceLabel(out.mission || {}))}</p>
    <p><strong>Analyse what's new :</strong> ${out.mission?.whats_new_required ? "Requise" : "Non requise"} · <strong>Audit complémentaire :</strong> ${out.mission?.complementary_audit_required ? "À déclencher — facturation au temps passé" : "Non déclenché"}</p>
    <p>${escapeHtml(out.mission?.lifecycle_notes || "")}</p>
    <h2>Réponses client et traductions françaises</h2>
    <table><thead><tr><th>Date</th><th>Langue</th><th>Réponse originale</th><th>Traduction française DGFiP</th><th>Validation</th></tr></thead>
    <tbody>${(out.client_replies || []).map((r) => `<tr><td>${formatDate(r.submitted_at)}</td><td>${escapeHtml(languageLabel(r.message_language))}</td><td>${escapeHtml(r.message)}</td><td>${escapeHtml(r.french_translation || "")}</td><td>${r.translation_validated ? "Validée" : "À valider"}</td></tr>`).join("") || `<tr><td colspan="5">Aucune réponse client enregistrée.</td></tr>`}</tbody></table>
    <h2>Evidence book</h2>
    <table><thead><tr><th>Contrôle</th><th>Attendu</th><th>Réponse</th><th>Constat</th><th>Preuves attendues</th><th>Preuves associées</th></tr></thead>
    <tbody>${out.chain.map((r) => `<tr><td>${escapeHtml(r.reference)}</td><td>${escapeHtml(r.attendu_dgfip)}</td><td>${escapeHtml(controlLabel(r.reponse_statut))}<br>${escapeHtml(r.reponse_client)}</td><td>${escapeHtml(r.constat)} ${escapeHtml(r.synthese_constat)}</td><td>${escapeHtml(r.preuves_attendues)}</td><td>${escapeHtml(r.preuves_associees)}</td></tr>`).join("")}</tbody></table>
  `;
}

function REG_LABEL() { return $("baseline").textContent; }
function requireSelection() { if (!state.selected) throw new Error("Sélectionne d'abord une question dans la chaîne d'audit."); }
function requireMission() {
  const selectedMissionId = $("missionSelect")?.value || "";
  if (!state.missionId && selectedMissionId) state.missionId = selectedMissionId;
  if (!state.missionId) {
    throw new Error("Aucune mission ouverte. Si tu es sur un nouveau brouillon, clique “Créer mission + questionnaire”. Si tu veux travailler une mission existante, clique “Ouvrir mission”.");
  }
}
function showTab(name, options = {}) {
  if(state.activeTab==='detail'&&name!=='detail'&&(controlBusy||!allowControlLeave()))return false;
  navigationEpoch++;
  state.activeTab = name;
  const layout = document.querySelector(".layout");
  layout?.classList.toggle("dashboardMode", name === "dashboard");
  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== name;
    if (!panel.hidden && options.preserveScroll !== true) panel.scrollTop = 0;
  }
  for (const tab of document.querySelectorAll("[data-tab]")) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }
  if (options.preserveScroll !== true) {
    if (layout) layout.scrollTop = 0;
    window.scrollTo(0, 0);
  }
}
function setMissionDependentEnabled(enabled) {
  for (const id of ["openMission", "copyClientLink", "reload", "generateReport", "deleteMission", "updateMissionProfile", "prepareDgfipAnalysis", "uploadAndAnalyzeDocument", "analyzeAuditDocument", "promoteSuggestion", "rejectSuggestion", "submitClientReply", "topSaveMission", "topOpenMission", "topMissionDocuments", "topDgfipFile", "topReport"]) {
    const el = $(id);
    if (el) el.disabled = !enabled;
  }
  const upload = $("uploadAuditDocument");
  if (upload) upload.disabled = false;
}
function renderVersionStack(app = appRelease) {
  const schema = app.schema || {};
  const el = $("versionStack");
  if (!el) return;
  const schemaOk = schema.ok === true;
  const build = app.buildCommit || `${app.channel || "local"}-v${app.version || "-"}-${String(app.schemaVersion || "schema").slice(0, 12)}`;
  el.classList.toggle("warn", !schemaOk && schema.current);
  el.innerHTML = `
    <strong>${escapeHtml(app.name || "DIAM SaaS")} v${escapeHtml(app.version || "-")}</strong>
    · ${escapeHtml(app.release || "release")}
    · schéma ${escapeHtml(schema.current || app.schemaVersion || "-")}${schemaOk ? " ✓" : schema.current ? " ⚠ migration à vérifier" : ""}
    · D2F Suite ${app.d2fBusinessSuite?.configured ? "connectée" : "clé absente"}
    · build ${escapeHtml(String(build).slice(0, 24))}
    <br><span>${escapeHtml(app.versioningPolicy || "Versioning DIAM : patch=correction, minor=évolution, major=rupture")}</span>
  `;
}
function enterClientPortalMode() {
  document.body.classList.add("clientPortal");
  $("missionContext").hidden = true;
  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.hidden = tab.dataset.tab !== "client";
  }
  $("runtimeMode").textContent = "Portail client";
  $("baseline").textContent = "Réponse client aux constats — accès limité à la mission partagée";
  renderVersionStack(appRelease);
  $("clientPortalIntro").textContent = "Client portal: reply to open findings and upload corrective evidence. French translation is required for the DGFiP audit file / Portail client : répondez aux constats ouverts et versez les preuves de correction. La traduction française est requise pour le dossier DGFiP.";
  $("clientReplyLabel").childNodes[0].textContent = "Client reply / Réponse client ";
  $("clientReplyLanguage").value = "en";
}
async function run(fn, targetId = "actionStatus") {
  try {
    setStatus("", "info", targetId);
    await fn();
  } catch (e) {
    setStatus(e.message || String(e), "error", targetId);
  }
}
function showInitializationFailure(error) {
  state.demo = false;
  state.missions = [];
  state.missionId = null;
  state.chain = [];
  state.documents = [];
  state.suggestions = [];
  state.clientFindings = [];
  $("runtimeMode").textContent = "Chargement interrompu";
  $("runtimeMode").className = "modePill warn";
  $("runtimeNotice").hidden = false;
  $("runtimeNotice").textContent = `Les données n’ont pas pu être chargées : ${error.message || String(error)}. Recharge la page pour réessayer. Aucune donnée de démonstration n’a été substituée.`;
  $("missionSelect").replaceChildren();
  $("activeMissionLabel").textContent = "Aucune mission chargée";
  setMissionDependentEnabled(false);
  renderChain();
  renderDocuments();
  renderSuggestions();
  renderClientFindings();
}
function demoOnly(message) {
  setStatus(message, "error");
  setStatus(message, "error", "documentStatus");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}
function controlLabel(value){return ({NOT_STARTED:'À examiner',COMPLIANT:'Conforme',PARTIALLY_COMPLIANT:'Partiellement conforme',NON_COMPLIANT:'Non conforme',NOT_APPLICABLE:'Non applicable',LOW:'Faible',MEDIUM:'Moyenne',HIGH:'Élevée',CRITICAL:'Critique',OPEN:'Ouvert',IN_REVIEW:'En revue',CLOSED:'Clôturé'})[value]||value;}
function badge(value) { return `<strong>${escapeHtml(controlLabel(value))}</strong>`; }
function applicabilityLabel(value) {
  return ({
    A_CONFIRMER: "Applicabilité à confirmer",
    OBLIGATOIRE: "Obligatoire",
    CONDITIONNEL: "Conditionnel",
    HORS_PERIMETRE_A_CONFIRMER: "Hors périmètre à confirmer"
  })[value] || "À cadrer";
}
function applicabilityBadge(value) {
  const cls = value === "OBLIGATOIRE" ? "criticalBadge" : value === "CONDITIONNEL" ? "warningBadge" : "neutralBadge";
  return `<strong class="${cls}">${escapeHtml(applicabilityLabel(value))}</strong>`;
}
function auditLanguagePolicy(language = "fr") {
  return String(language || "fr").toLowerCase() === "en"
    ? "Conduite FR/EN : réponses client en anglais acceptées, rapport DGFiP final en français."
    : "Conduite en français : rapport DGFiP final en français.";
}
function assessmentLabel(value) {
  return ({
    POTENTIAL_GAP: "Écart potentiel",
    INSUFFICIENT_EVIDENCE: "Preuve insuffisante",
    MORE_INFO_REQUIRED: "Information requise"
  })[value] || "À examiner";
}
function analysisStatusLabel(value) {
  return ({
    UPLOADED: "Déposé — IA non lancée (facultative)",
    ANALYZED: "Propositions IA disponibles — revue requise",
    FAILED: "Dernière IA échouée — préparation sans IA disponible"
  })[value] || value || "-";
}
function languageLabel(value) {
  return ({ fr: "Français", en: "English", es: "Español", de: "Deutsch", it: "Italiano" })[value] || value || "-";
}
function applicationStatusLabel(value) {
  return ({
    ACCEPTED: "Dossier accepté DGFiP",
    SUBMITTED: "Dossier déposé",
    DRAFT: "Dossier en préparation",
    UNKNOWN: "Non renseigné"
  })[value] || "Non renseigné";
}
function auditTypeLabel(value) {
  return ({
    INITIAL: "Audit initial",
    SURVEILLANCE: "Audit de surveillance",
    COMPLEMENTARY: "Audit complémentaire",
    RENEWAL: "Audit de renouvellement"
  })[value] || "Audit initial";
}
function lifecycleStatusLabel(value) {
  return ({
    INITIAL_LABEL: "Label initial",
    SURVEILLANCE_YEAR_1: "Surveillance année 1",
    SURVEILLANCE_YEAR_2: "Surveillance année 2",
    COMPLEMENTARY_AUDIT_REQUIRED: "Audit complémentaire requis",
    RENEWAL_REQUIRED: "Renouvellement requis",
    LABEL_EXPIRED: "Label expiré"
  })[value] || value || "-";
}
function labelValidity(mission) {
  if (!mission?.label_valid_from && !mission?.label_valid_until) return "Non renseignée";
  return `${formatDateOnly(mission.label_valid_from) || "-"} → ${formatDateOnly(mission.label_valid_until) || "-"}`;
}
function surveillanceLabel(mission) {
  if (mission?.audit_type === "SURVEILLANCE") return `Année ${mission.surveillance_year || "?"} sur 2`;
  if (mission?.audit_type === "INITIAL") return "À planifier sur 2 ans après l'initial";
  if (mission?.audit_type === "RENEWAL") return "Nouveau cycle de 3 ans";
  if (mission?.audit_type === "COMPLEMENTARY") return "Ciblée sur impact label";
  return "-";
}
function d2fSuiteLabel(scope = {}) {
  const clientId = scope.d2f_business_suite_client_id || "";
  const caseUrl = scope.d2f_business_suite_case_url || "";
  if (!clientId && !caseUrl) return "Non raccordé";
  const status = scope.d2f_business_suite_sync_status === "SYNCED_API" ? "Import historique — synchronisation à vérifier" : "Lien enregistré — retour vers Gestion non confirmé";
  const syncedAt = scope.d2f_business_suite_synced_at ? `le ${formatDate(scope.d2f_business_suite_synced_at)}` : "";
  return [status, syncedAt, clientId, caseUrl].filter(Boolean).join(" · ");
}
function documentTypeLabel(value) {
  return ({
    QUALITY: "Qualité / ISO",
    TECHNICAL: "Technique / architecture",
    SECURITY: "Sécurité / IAM / journalisation",
    DGFiP_APPLICATION: "Dossier de candidature DGFiP",
    DGFiP_APPLICATION_ACCEPTED: "Dossier de candidature accepté DGFiP",
    D2F_REFERENCE: "Référentiel / note D2F Compliant",
    REGULATORY_REFERENCE: "Nouveau référentiel applicable",
    REGULATORY_UPDATE: "Demande récente DGFiP/AIFE",
    DGFIP_MEETING_NOTE: "Compte rendu réunion DGFiP/AIFE",
    D2F_BUSINESS_SUITE_EXPORT: "Export D2F Business Suite",
    EVIDENCE_EXPORT: "Export de logs / preuve",
    OTHER: "Autre"
  })[value] || value || "-";
}
function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function formatDateOnly(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(value));
}

window.addEventListener("error", (e) => setStatus(e.error?.message || e.message, "error"));
init().catch((e) => setStatus(e.message, "error"));
