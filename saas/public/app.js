const $ = (id) => document.getElementById(id);
let state = { missions: [], missionId: "", chain: [], selected: null, documents: [], suggestions: [], demo: false, activeTab: "dashboard" };

const DEMO_BASELINE = {
  label: "Aperçu local — DGFiP audit guide v1.3 + PDP Integrity v3.2",
  checkedAt: "2026-09-02"
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
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

function setStatus(text, type = "info", targetId = "actionStatus") {
  const el = $(targetId);
  if (!el) return;
  el.textContent = text;
  el.style.color = type === "error" ? "#b42318" : type === "success" ? "#067647" : "#0d3b66";
}

async function init() {
  bindEvents();
  try {
    const boot = await api("/api/bootstrap");
    $("runtimeMode").textContent = "API connectée";
    $("runtimeMode").className = "modePill ok";
    $("baseline").textContent = `${boot.baseline.label} - sources vérifiées ${boot.baseline.checkedAt}`;
    await loadMissions();
  } catch (e) {
    enableDemoMode(e);
  }
}

function bindEvents() {
  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.onclick = () => showTab(tab.dataset.tab);
  }
  $("createMission").onclick = () => run(createMission, "createStatus");
  $("openMission").onclick = () => run(() => openMission($("missionSelect").value), "createStatus");
  $("refreshMissions").onclick = () => run(loadMissions, "createStatus");
  $("reload").onclick = () => run(refreshAll, "createStatus");
  $("deleteMission").onclick = () => run(deleteMission, "createStatus");
  $("saveAnswer").onclick = () => run(saveAnswer);
  $("saveFinding").onclick = () => run(saveFinding);
  $("closeFinding").onclick = () => run(updateFindingStatus);
  $("uploadEvidence").onclick = () => run(uploadEvidence);
  $("generateReport").onclick = () => run(generateReport, "createStatus");
  $("uploadAuditDocument").onclick = () => run(uploadAuditDocument, "documentStatus");
  $("analyzeAuditDocument").onclick = () => run(analyzeAuditDocument, "documentStatus");
  $("promoteSuggestion").onclick = () => run(promoteSuggestion, "documentStatus");
  $("missionSelect").onchange = () => {
    state.missionId = $("missionSelect").value;
    run(refreshAll, "createStatus");
  };
  showTab("dashboard", { scroll: false });
}

async function loadMissions() {
  state.missions = await api("/api/missions");
  if (!state.missions.length) {
    state.missionId = "";
    state.chain = [];
    state.documents = [];
    state.suggestions = [];
    state.selected = null;
    $("missionSelect").innerHTML = `<option value="">Aucune mission — crée d’abord une mission</option>`;
    $("opinion").innerHTML = "<strong>Aucune mission active</strong><br>Crée une mission pour générer automatiquement les 33 contrôles DGFiP/PDP.";
    $("detailEmpty").hidden = false;
    $("detail").hidden = true;
    $("selectedDocument").textContent = "Aucune mission active : dépôt documentaire bloqué tant qu’une mission n’est pas créée.";
    renderChain();
    renderMissionList();
    renderDocuments();
    renderSuggestions();
    setMissionDependentEnabled(false);
    return;
  }
  $("missionSelect").innerHTML = state.missions.map((m) => `<option value="${m.id}">${m.number} - ${escapeHtml(m.title)}</option>`).join("");
  state.missionId = state.missionId && state.missions.some((m) => m.id === state.missionId) ? state.missionId : state.missions[0]?.id || "";
  $("missionSelect").value = state.missionId;
  setMissionDependentEnabled(true);
  renderMissionList();
  if (state.missionId) await refreshAll();
}

function renderMissionList() {
  const tbody = $("missionsTable")?.querySelector("tbody");
  if (!tbody) return;
  if (!state.missions.length) {
    tbody.innerHTML = `
      <tr class="noRows">
        <td colspan="5">
          <strong>Aucune mission créée.</strong><br>
          Crée une mission pour initialiser les 33 contrôles DGFiP/PDP.
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = state.missions.map((m) => `
    <tr class="${m.id === state.missionId ? "selected" : ""}">
      <td>${escapeHtml(m.number)}</td>
      <td>${escapeHtml(m.title)}</td>
      <td>${escapeHtml(m.status || "IN_PROGRESS")}</td>
      <td>${formatDate(m.created_at)}</td>
      <td><button class="small" data-open-mission="${m.id}" type="button">Ouvrir</button></td>
    </tr>`).join("");
  for (const button of tbody.querySelectorAll("[data-open-mission]")) {
    button.onclick = () => run(() => openMission(button.dataset.openMission), "createStatus");
  }
}

async function openMission(id) {
  if (!id) throw new Error("Choisis une mission à ouvrir.");
  state.missionId = id;
  $("missionSelect").value = id;
  state.selected = null;
  $("detailEmpty").hidden = false;
  $("detail").hidden = true;
  await refreshAll();
  renderMissionList();
  showTab("audit");
}

async function createMission() {
  if (state.demo) return demoOnly("Création réelle indisponible en aperçu local. Lance `npm run dev` dans `DIAM/saas` avec Supabase configuré.");
  $("createStatus").textContent = "Création en cours...";
  const out = await api("/api/missions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: $("clientName").value,
      siren: $("siren").value,
      title: $("missionTitle").value
    })
  });
  $("createStatus").textContent = `${out.mission.number} créée avec ${out.seeded_controls} contrôles.`;
  await loadMissions();
  showTab("audit");
}

async function deleteMission() {
  requireMission();
  if (state.demo) return demoOnly("Suppression réelle indisponible en aperçu local.");
  const mission = state.missions.find((m) => m.id === state.missionId);
  const label = mission ? `${mission.number} - ${mission.title}` : "la mission sélectionnée";
  if (!confirm(`Supprimer définitivement ${label} et sa chaîne d'audit ?`)) return;
  await api(`/api/missions/${state.missionId}`, { method: "DELETE" });
  state.missionId = "";
  state.selected = null;
  setStatus("Mission supprimée.", "success", "createStatus");
  await loadMissions();
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
  await Promise.all([loadChain(), loadDocuments(), loadSuggestions()]);
}

async function loadChain() {
  const data = await api(`/api/audit-chain?mission_id=${state.missionId}`);
  state.chain = data.chain;
  $("opinion").innerHTML = `<strong>${data.result.opinion}</strong><br>${escapeHtml(data.result.reason)}`;
  renderChain();
}

function renderChain() {
  if (!state.chain.length) {
    $("chainTable").querySelector("tbody").innerHTML = `
      <tr class="noRows">
        <td colspan="7">
          <strong>Aucune ligne d’audit à afficher.</strong><br>
          Crée une mission : DIAM générera alors le questionnaire DGFiP/PDP, les preuves attendues et la chaîne d’audit.
        </td>
      </tr>`;
    return;
  }
  $("chainTable").querySelector("tbody").innerHTML = state.chain.map((r, i) => `
    <tr data-index="${i}" class="${state.selected?.question_id === r.question_id ? "selected" : ""}">
      <td>${escapeHtml(r.reference)}</td>
      <td>${escapeHtml(r.question)}</td>
      <td>${badge(r.qualification_base)}</td>
      <td>${badge(r.qualification_retenue)}</td>
      <td>${escapeHtml(r.reponse_statut)}</td>
      <td>${escapeHtml(r.constat || "-")}<br>${escapeHtml(r.statut_constat || "")}</td>
      <td>${escapeHtml(r.preuves_associees || "Aucune preuve liée")}</td>
    </tr>`).join("");
  for (const row of $("chainTable").querySelectorAll("tbody tr")) {
    row.onclick = () => selectQuestion(Number(row.dataset.index));
  }
}

function selectQuestion(index) {
  state.selected = state.chain[index];
  $("detailEmpty").hidden = true;
  $("detail").hidden = false;
  $("detailTitle").textContent = `${state.selected.reference} - ${state.selected.question}`;
  $("requirement").textContent = state.selected.attendu_dgfip;
  $("expectedEvidence").textContent = state.selected.preuves_attendues;
  $("checklist").innerHTML = state.selected.checklist.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
  $("answerStatus").value = state.selected.reponse_statut;
  $("clientAnswer").value = state.selected.reponse_client;
  $("auditorAnalysis").value = state.selected.analyse_auditeur;
  $("findingSummary").value = state.selected.synthese_constat;
  $("retainedQualification").value = state.selected.qualification_retenue;
  $("recommendation").value = state.selected.recommandation || "";
  $("findingStatus").value = state.selected.statut_constat || "OPEN";
  renderChain();
  showTab("detail");
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
  setStatus("Traitement du constat mis à jour.", "success");
  await loadChain();
  showTab("detail");
}

async function uploadEvidence() {
  requireSelection();
  if (state.demo) return demoOnly("Le versement de preuve nécessite l’API, Supabase Storage et le hachage côté Worker.");
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
  state.documents = await api(`/api/documents?mission_id=${state.missionId}`);
  renderDocuments();
}

function renderDocuments() {
  if (!state.documents.length) {
    $("documentsTable").querySelector("tbody").innerHTML = `
      <tr class="noRows">
        <td colspan="4">Aucun document déposé pour cette mission.</td>
      </tr>`;
    renderDocumentsSelection();
    return;
  }
  $("documentsTable").querySelector("tbody").innerHTML = state.documents.map((d, i) => `
    <tr data-index="${i}" class="${state.documentId === d.id ? "selected" : ""}">
      <td>${escapeHtml(d.document_type)}</td><td>${escapeHtml(d.original_name)}</td><td>${escapeHtml(d.analysis_status)}</td><td>${escapeHtml(d.sha256.slice(0, 16))}...</td>
    </tr>`).join("");
  for (const row of $("documentsTable").querySelectorAll("tbody tr")) {
    row.onclick = () => { state.documentId = state.documents[Number(row.dataset.index)].id; renderDocumentsSelection(); };
  }
  renderDocumentsSelection();
}

function renderDocumentsSelection() {
  $("selectedDocument").textContent = state.documentId ? `Document sélectionné : ${state.documents.find((d) => d.id === state.documentId)?.original_name}` : "Aucun document sélectionné.";
}

async function uploadAuditDocument() {
  requireMission();
  if (state.demo) return demoOnly("Le dépôt documentaire nécessite l’API Cloudflare Worker et Supabase Storage.");
  const file = $("auditDocumentFile").files[0];
  if (!file) throw new Error("Choisis un document qualité/technique.");
  const fd = new FormData();
  fd.set("mission_id", state.missionId);
  fd.set("document_type", $("auditDocumentType").value);
  fd.set("file", file);
  setStatus("Dépôt documentaire...", "info", "documentStatus");
  const doc = await api("/api/documents", { method: "POST", body: fd });
  state.documentId = doc.id;
  setStatus("Document déposé et haché. Tu peux lancer l'analyse IA.", "success", "documentStatus");
  await loadDocuments();
  showTab("documents");
}

async function analyzeAuditDocument() {
  requireMission();
  if (state.demo) return demoOnly("L’analyse IA réelle nécessite l’API Worker, Supabase et une clé OpenAI configurée.");
  const file = $("auditDocumentFile").files[0];
  if (!state.documentId) {
    if (!file) throw new Error("Choisis un document à déposer/analyser.");
    await uploadAuditDocument();
  }
  if (!file) throw new Error("Pour cette version Worker, relance l'analyse avec le fichier original choisi dans le champ fichier.");
  const fd = new FormData();
  fd.set("file", file);
  setStatus("Analyse IA en cours...", "info", "documentStatus");
  const out = await api(`/api/documents/${state.documentId}/analyze`, { method: "POST", body: fd });
  setStatus(`${out.suggestions.length} proposition(s) d'écart générée(s). Validation auditeur requise.`, "success", "documentStatus");
  await Promise.all([loadDocuments(), loadSuggestions()]);
  showTab("documents");
}

async function loadSuggestions() {
  state.suggestions = await api(`/api/ai-suggestions?mission_id=${state.missionId}`);
  renderSuggestions();
}

function renderSuggestions() {
  if (!state.suggestions.length) {
    $("suggestionsTable").querySelector("tbody").innerHTML = `
      <tr class="noRows">
        <td colspan="5">Aucune proposition IA. Dépose un document dans une mission, puis lance l’analyse.</td>
      </tr>`;
    return;
  }
  $("suggestionsTable").querySelector("tbody").innerHTML = state.suggestions.map((s, i) => `
    <tr data-index="${i}" class="${state.suggestionId === s.id ? "selected" : ""}">
      <td>${escapeHtml(s.reference || "-")}</td><td>${escapeHtml(s.suggested_qualification)}</td><td>${escapeHtml(s.potential_gap)}</td><td>${Math.round((s.confidence || 0) * 100)}%</td><td>${escapeHtml(s.status)}</td>
    </tr>`).join("");
  for (const row of $("suggestionsTable").querySelectorAll("tbody tr")) {
    row.onclick = () => { state.suggestionId = state.suggestions[Number(row.dataset.index)].id; loadSuggestions(); };
  }
}

async function promoteSuggestion() {
  requireMission();
  if (state.demo) return demoOnly("La promotion IA en constat nécessite une mission enregistrée en base.");
  if (!state.suggestionId) throw new Error("Sélectionne une proposition IA.");
  await api(`/api/ai-suggestions/${state.suggestionId}/promote`, { method: "POST" });
  setStatus("Proposition IA promue en constat auditeur à valider.", "success");
  await Promise.all([loadChain(), loadSuggestions()]);
  showTab("audit");
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
  $("reportCard").hidden = false;
  $("report").innerHTML = reportHtml(out);
  showTab("report");
}

function reportHtml(out) {
  return `
    <h1>Rapport d'audit de conformité réglementaire</h1>
    <p><strong>Opinion :</strong> ${escapeHtml(out.result.opinion)}</p>
    <p><strong>Motif :</strong> ${escapeHtml(out.result.reason)}</p>
    <p><strong>Référentiel :</strong> ${escapeHtml(REG_LABEL())}</p>
    <h2>Evidence book</h2>
    <table><thead><tr><th>Contrôle</th><th>Attendu</th><th>Réponse</th><th>Constat</th><th>Preuves attendues</th><th>Preuves associées</th></tr></thead>
    <tbody>${out.chain.map((r) => `<tr><td>${escapeHtml(r.reference)}</td><td>${escapeHtml(r.attendu_dgfip)}</td><td>${escapeHtml(r.reponse_statut)}<br>${escapeHtml(r.reponse_client)}</td><td>${escapeHtml(r.constat)} ${escapeHtml(r.synthese_constat)}</td><td>${escapeHtml(r.preuves_attendues)}</td><td>${escapeHtml(r.preuves_associees)}</td></tr>`).join("")}</tbody></table>
  `;
}

function REG_LABEL() { return $("baseline").textContent; }
function requireSelection() { if (!state.selected) throw new Error("Sélectionne d'abord une question dans la chaîne d'audit."); }
function requireMission() { if (!state.missionId) throw new Error("Crée ou sélectionne d'abord une mission. Sans mission, DIAM ne peut pas rattacher le questionnaire, les preuves et le rapport."); }
function showTab(name, options = {}) {
  state.activeTab = name;
  for (const panel of document.querySelectorAll("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== name;
  }
  for (const tab of document.querySelectorAll("[data-tab]")) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }
  if (options.scroll !== false) document.querySelector(".tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function setMissionDependentEnabled(enabled) {
  for (const id of ["openMission", "reload", "generateReport", "deleteMission", "uploadAuditDocument", "analyzeAuditDocument", "promoteSuggestion"]) {
    const el = $(id);
    if (el) el.disabled = !enabled;
  }
}
async function run(fn, targetId = "actionStatus") {
  try {
    setStatus("", "info", targetId);
    await fn();
  } catch (e) {
    setStatus(e.message || String(e), "error", targetId);
  }
}
function enableDemoMode(error) {
  state.demo = true;
  state.missions = [{ id: "demo-mission", number: "APERÇU-LOCAL", title: "Audit PA — aperçu visuel" }];
  state.missionId = "demo-mission";
  state.chain = structuredClone(DEMO_CHAIN);
  $("runtimeMode").textContent = "Aperçu local";
  $("runtimeMode").className = "modePill warn";
  $("baseline").textContent = `${DEMO_BASELINE.label} - sources vérifiées ${DEMO_BASELINE.checkedAt}`;
  $("runtimeNotice").hidden = false;
  $("runtimeNotice").textContent = `Tu consultes l’interface hors API (${location.protocol}). Les écrans sont interactifs pour validation visuelle, mais les données ne sont pas enregistrées. Pour tester le vrai SaaS : lancer le Worker Cloudflare avec Supabase configuré. Détail technique : ${error.message}`;
  $("missionSelect").innerHTML = `<option value="demo-mission">APERÇU-LOCAL - Audit PA — aperçu visuel</option>`;
  $("opinion").innerHTML = "<strong>APERÇU LOCAL</strong><br>Interface chargée sans base Supabase. Les contrôles ci-dessous servent à valider l’ergonomie.";
  state.documents = [];
  state.suggestions = [];
  setMissionDependentEnabled(true);
  renderDemo();
}
function renderDemo() {
  renderChain();
  renderDocuments();
  state.suggestions = [{ id: "demo-suggestion", reference: "DGFiP-2.3", suggested_qualification: "CRITICAL", potential_gap: "Exemple : absence de preuve de restitution complète de la piste d’audit.", confidence: 0.82, status: "DEMO" }];
  renderSuggestions();
}
function demoOnly(message) {
  setStatus(message, "error");
  setStatus(message, "error", "documentStatus");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}
function badge(value) { return `<strong>${escapeHtml(value)}</strong>`; }
function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

window.addEventListener("error", (e) => setStatus(e.error?.message || e.message, "error"));
init().catch((e) => setStatus(e.message, "error"));
