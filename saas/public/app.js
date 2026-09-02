const $ = (id) => document.getElementById(id);
let state = { missions: [], missionId: "", chain: [], selected: null, documents: [], suggestions: [] };

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || JSON.stringify(data));
  return data;
}

function setStatus(text, type = "info") {
  $("actionStatus").textContent = text;
  $("actionStatus").style.color = type === "error" ? "#b42318" : type === "success" ? "#067647" : "#0d3b66";
}

async function init() {
  const boot = await api("/api/bootstrap");
  $("baseline").textContent = `${boot.baseline.label} - sources vérifiées ${boot.baseline.checkedAt}`;
  await loadMissions();
  bindEvents();
}

function bindEvents() {
  $("createMission").onclick = createMission;
  $("reload").onclick = refreshAll;
  $("saveAnswer").onclick = saveAnswer;
  $("saveFinding").onclick = saveFinding;
  $("closeFinding").onclick = updateFindingStatus;
  $("uploadEvidence").onclick = uploadEvidence;
  $("generateReport").onclick = generateReport;
  $("uploadAuditDocument").onclick = uploadAuditDocument;
  $("analyzeAuditDocument").onclick = analyzeAuditDocument;
  $("promoteSuggestion").onclick = promoteSuggestion;
  $("missionSelect").onchange = () => {
    state.missionId = $("missionSelect").value;
    refreshAll();
  };
}

async function loadMissions() {
  state.missions = await api("/api/missions");
  $("missionSelect").innerHTML = state.missions.map((m) => `<option value="${m.id}">${m.number} - ${escapeHtml(m.title)}</option>`).join("");
  state.missionId = $("missionSelect").value || state.missions[0]?.id || "";
  if (state.missionId) await refreshAll();
}

async function createMission() {
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
}

async function refreshAll() {
  if (!state.missionId) return;
  await Promise.all([loadChain(), loadDocuments(), loadSuggestions()]);
}

async function loadChain() {
  const data = await api(`/api/audit-chain?mission_id=${state.missionId}`);
  state.chain = data.chain;
  $("opinion").innerHTML = `<strong>${data.result.opinion}</strong><br>${escapeHtml(data.result.reason)}`;
  renderChain();
}

function renderChain() {
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
}

async function saveAnswer() {
  requireSelection();
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
}

async function saveFinding() {
  requireSelection();
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
}

async function updateFindingStatus() {
  requireSelection();
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
}

async function uploadEvidence() {
  requireSelection();
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
}

async function loadDocuments() {
  state.documents = await api(`/api/documents?mission_id=${state.missionId}`);
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
  const file = $("auditDocumentFile").files[0];
  if (!file) throw new Error("Choisis un document qualité/technique.");
  const fd = new FormData();
  fd.set("mission_id", state.missionId);
  fd.set("document_type", $("auditDocumentType").value);
  fd.set("file", file);
  setStatus("Dépôt documentaire...");
  const doc = await api("/api/documents", { method: "POST", body: fd });
  state.documentId = doc.id;
  setStatus("Document déposé et haché. Tu peux lancer l'analyse IA.", "success");
  await loadDocuments();
}

async function analyzeAuditDocument() {
  if (!state.documentId) throw new Error("Sélectionne un document à analyser.");
  const file = $("auditDocumentFile").files[0];
  if (!file) throw new Error("Pour cette version Worker, relance l'analyse avec le fichier original choisi dans le champ fichier.");
  const fd = new FormData();
  fd.set("file", file);
  setStatus("Analyse IA en cours...");
  const out = await api(`/api/documents/${state.documentId}/analyze`, { method: "POST", body: fd });
  setStatus(`${out.suggestions.length} proposition(s) d'écart générée(s). Validation auditeur requise.`, "success");
  await Promise.all([loadDocuments(), loadSuggestions()]);
}

async function loadSuggestions() {
  state.suggestions = await api(`/api/ai-suggestions?mission_id=${state.missionId}`);
  $("suggestionsTable").querySelector("tbody").innerHTML = state.suggestions.map((s, i) => `
    <tr data-index="${i}" class="${state.suggestionId === s.id ? "selected" : ""}">
      <td>${escapeHtml(s.reference || "-")}</td><td>${escapeHtml(s.suggested_qualification)}</td><td>${escapeHtml(s.potential_gap)}</td><td>${Math.round((s.confidence || 0) * 100)}%</td><td>${escapeHtml(s.status)}</td>
    </tr>`).join("");
  for (const row of $("suggestionsTable").querySelectorAll("tbody tr")) {
    row.onclick = () => { state.suggestionId = state.suggestions[Number(row.dataset.index)].id; loadSuggestions(); };
  }
}

async function promoteSuggestion() {
  if (!state.suggestionId) throw new Error("Sélectionne une proposition IA.");
  await api(`/api/ai-suggestions/${state.suggestionId}/promote`, { method: "POST" });
  setStatus("Proposition IA promue en constat auditeur à valider.", "success");
  await Promise.all([loadChain(), loadSuggestions()]);
}

async function generateReport() {
  const out = await api("/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mission_id: state.missionId })
  });
  $("reportCard").hidden = false;
  $("report").innerHTML = reportHtml(out);
  $("reportCard").scrollIntoView({ behavior: "smooth" });
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
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}
function badge(value) { return `<strong>${escapeHtml(value)}</strong>`; }

window.addEventListener("error", (e) => setStatus(e.error?.message || e.message, "error"));
init().catch((e) => setStatus(e.message, "error"));
