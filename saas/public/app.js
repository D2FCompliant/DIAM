const $ = (id) => document.getElementById(id);
let state = { missions: [], missionId: "", chain: [], selected: null, documents: [], suggestions: [], clientFindings: [], selectedClientFinding: null, d2fClients: [], d2fImportedClientUpdatedAt: "", clientToken: "", clientPortal: false, demo: false, activeTab: "dashboard", authenticated: false, actor: "" };

const DEMO_BASELINE = {
  label: "Aperçu local — DGFiP audit guide v1.3 + PDP Integrity v3.2",
  checkedAt: "2026-09-02"
};

let appRelease = {
  name: "DIAM SaaS",
  version: "0.3.8",
  release: "Audit Cockpit UX",
  schemaVersion: "202609020010_global_reference_documents",
  buildCommit: "mode local"
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
  if (/OPENAI_API_KEY|OpenAI/i.test(raw)) return "Analyse assistée indisponible : clé OpenAI absente ou invalide côté Cloudflare.";
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
    $("baseline").textContent = `${boot.baseline.label} - sources vérifiées ${boot.baseline.checkedAt}`;
    renderVersionStack(appRelease);
    if (state.clientPortal) {
      await loadClientFindings();
      showTab("client", { scroll: false });
    } else {
      await loadMissions();
    }
  } catch (e) {
    enableDemoMode(e);
  }
}

function bindEvents() {
  if ($("loginForm")) $("loginForm").onsubmit = (event) => {
    event.preventDefault();
    run(login, "loginStatus");
  };
  if ($("logoutButton")) $("logoutButton").onclick = () => run(logout, "createStatus");
  for (const tab of document.querySelectorAll("[data-tab]")) {
    tab.onclick = () => showTab(tab.dataset.tab);
  }
  $("createMission").onclick = () => run(createMission, "createStatus");
  $("topNewMission").onclick = () => prepareNewMission();
  $("topCreateMission").onclick = () => run(createMission, "createStatus");
  $("topSaveMission").onclick = () => run(updateMissionProfile, "createStatus");
  $("topOpenMission").onclick = () => focusExistingMissions();
  $("topGlobalLibrary").onclick = () => prepareGlobalLibrary();
  $("topDgfipFile").onclick = () => run(prepareDgfipAnalysis, "createStatus");
  $("topReport").onclick = () => run(generateReport, "createStatus");
  $("updateMissionProfile").onclick = () => run(updateMissionProfile, "createStatus");
  $("prepareDgfipAnalysis").onclick = () => run(prepareDgfipAnalysis, "createStatus");
  $("openMission").onclick = () => run(() => openMission($("missionSelect").value), "createStatus");
  $("copyClientLink").onclick = () => run(copyClientLink, "createStatus");
  $("searchD2FClients").onclick = () => run(searchD2FClients, "d2fSyncStatus");
  $("importD2FClient").onclick = () => run(importD2FClient, "d2fSyncStatus");
  $("auditProgram").onchange = () => applyAuditProgramDefaults();
  $("refreshMissions").onclick = () => run(loadMissions, "createStatus");
  $("reload").onclick = () => run(refreshAll, "createStatus");
  $("deleteMission").onclick = () => run(deleteMission, "createStatus");
  $("saveAnswer").onclick = () => run(saveAnswer);
  $("saveFinding").onclick = () => run(saveFinding);
  $("closeFinding").onclick = () => run(updateFindingStatus);
  $("uploadEvidence").onclick = () => run(uploadEvidence);
  $("generateReport").onclick = () => run(generateReport, "createStatus");
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
  $("missionSelect").onchange = () => {
    state.missionId = $("missionSelect").value;
    fillMissionForm(currentMission());
    run(refreshAll, "createStatus");
  };
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

function prepareNewMission() {
  showTab("mission_form");
  $("clientName")?.focus();
  setStatus("Mode création : renseigne/import le client, choisis le programme PA ou SC, puis clique “Créer mission + questionnaire”.", "info", "createStatus");
}

function focusExistingMissions() {
  showTab("dashboard");
  $("missionSelect")?.focus();
  setStatus("Sélectionne une mission existante puis clique “Ouvrir mission”. Le portefeuille en bas liste aussi toutes les missions.", "info", "createStatus");
}

function prepareGlobalLibrary() {
  $("auditDocumentType").value = "REGULATORY_REFERENCE";
  showTab("documents");
  setStatus("Bibliothèque transverse : dépose ici nouveau guide DGFiP, texte, CR DGFiP/AIFE ou référentiel D2F applicable à tous les audits.", "info", "documentStatus");
  $("auditDocumentFile")?.focus();
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
  setStatus("Client importé depuis Business Suite et mission DIAM mise à jour. La synchronisation est enregistrée dans la traçabilité.", "success", "d2fSyncStatus");
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
  const id = raw.dossierSourceId || raw.dossier_source_id || raw.id || raw.clientId || raw.stableId || raw.d2fClientId || raw.identity?.id || "";
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
    renderDocuments();
    renderSuggestions();
    renderClientFindings();
    setMissionDependentEnabled(false);
    return;
  }
  $("missionSelect").innerHTML = state.missions.map((m) => `<option value="${m.id}">${m.number} - ${escapeHtml(m.title)}</option>`).join("");
  state.missionId = state.missionId && state.missions.some((m) => m.id === state.missionId) ? state.missionId : state.missions[0]?.id || "";
  $("missionSelect").value = state.missionId;
  setMissionDependentEnabled(true);
  fillMissionForm(currentMission());
  renderClientFacts();
  renderMissionList();
  if (state.missionId) await refreshAll();
}

function currentMission() {
  return state.missions.find((m) => m.id === state.missionId) || null;
}

function fillMissionForm(mission) {
  if (!mission) return;
  const scope = mission.client_scope || {};
  $("clientName").value = mission.client_name || "";
  $("siren").value = mission.client_siren || "";
  $("legalIdentifier").value = scope.client_legal_identifier || "";
  $("vatId").value = scope.client_vat_id || "";
  $("auditProgram").value = auditProgramFromMission(mission).id;
  $("missionTitle").value = mission.title || "Audit de conformité PA";
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
  const scope = mission.client_scope || {};
  if (scope.audit_program && AUDIT_PROGRAMS[scope.audit_program]) return auditProgram(scope.audit_program);
  return String(mission.referential_version || "").includes("RLF-C:SC") ? AUDIT_PROGRAMS.SC_RLFC : AUDIT_PROGRAMS.PA_DGFIP;
}

function applyAuditProgramDefaults() {
  const program = auditProgram($("auditProgram").value);
  const title = $("missionTitle");
  if (!title.value.trim() || Object.values(AUDIT_PROGRAMS).some((p) => p.defaultTitle === title.value)) {
    title.value = program.defaultTitle;
  }
  $("declaredScope").placeholder = program.id === "SC_RLFC"
    ? "Ex. émission/réception, ERP, connecteur PA, annuaire, e-reporting, CDAR, SAE, pays/filiales..."
    : "Ex. émission, réception, e-reporting, marque blanche, Peppol, périmètre pays/filiales...";
  setStatus(`Programme sélectionné : ${program.label}. Le questionnaire créé contiendra ${program.expectedControls} contrôles.`, "info", "createStatus");
}

function missionProfilePayload() {
  return {
    ...clientIdentityPayload(),
    audit_program: selectedAuditProgramId(),
    title: $("missionTitle").value,
    client_language: $("clientLanguage").value,
    dgfip_application_status: $("dgfipApplicationStatus").value,
    d2f_business_suite_client_id: $("d2fSuiteClientId").value,
    d2f_business_suite_case_url: $("d2fSuiteCaseUrl").value,
    d2f_business_suite_source_updated_at: state.d2fImportedClientUpdatedAt || "",
    declared_scope: $("declaredScope").value
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
          Crée une mission pour initialiser le questionnaire PA ou SC.
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
      <td><button class="small" data-open-mission="${m.id}" type="button">Ouvrir</button></td>
    </tr>`).join("");
  for (const button of tbody.querySelectorAll("[data-open-mission]")) {
    button.onclick = () => run(() => openMission(button.dataset.openMission), "createStatus");
  }
}

function renderClientFacts() {
  const box = $("clientFacts");
  if (!box) return;
  const mission = state.missions.find((m) => m.id === state.missionId);
  if (!mission) {
    box.innerHTML = `<p class="muted">Ouvre une mission pour afficher la fiche client, le statut du dossier DGFiP et le périmètre déclaré.</p>`;
    return;
  }
  const scope = mission.client_scope || {};
  const identifier = countryIdentifier(mission, scope);
  const program = auditProgramFromMission(mission);
  box.innerHTML = `
    <div class="factGrid">
      <div><span>Programme</span><strong>${escapeHtml(program.label)}</strong></div>
      <div><span>Référentiel</span><strong>${escapeHtml(mission.referential_version || "Non renseigné")}</strong></div>
      <div><span>Client</span><strong>${escapeHtml(mission.client_name || "Non renseigné")}</strong></div>
      <div><span>${escapeHtml(identifier.label)}</span><strong>${escapeHtml(identifier.value || "Non renseigné")}</strong></div>
      <div><span>N° TVA</span><strong>${escapeHtml(scope.client_vat_id || "Non renseigné")}</strong></div>
      <div><span>Pays</span><strong>${escapeHtml(mission.client_country || "Non renseigné")}</strong></div>
      <div><span>Adresse</span><strong>${escapeHtml([mission.client_address, scope.client_address_line_2, [scope.client_postal_code, mission.client_city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Non renseignée")}</strong></div>
      <div><span>Contact</span><strong>${escapeHtml([scope.client_email, scope.client_phone].filter(Boolean).join(" · ") || "Non renseigné")}</strong></div>
      <div><span>Langue</span><strong>${escapeHtml(languageLabel(mission.client_language || scope.client_language || "fr"))}</strong></div>
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
    body: JSON.stringify(missionProfilePayload())
  });
  $("createStatus").textContent = `${out.mission.number} créée avec ${out.seeded_controls} contrôles ${out.audit_program?.shortLabel || auditProgram($("auditProgram").value).shortLabel}.`;
  await loadMissions();
  showTab("audit");
}

async function updateMissionProfile() {
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
          Crée une mission : DIAM générera alors le questionnaire PA ou SC, les preuves attendues et la chaîne d’audit.
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
  const query = state.missionId ? `?mission_id=${state.missionId}&include_global=true` : "?scope=global";
  state.documents = await api(`/api/documents${query}`);
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
  const files = [...$("auditDocumentFile").files];
  if (!files.length) throw new Error("Choisis un ou plusieurs documents à déposer : dossier DGFiP accepté, nouveau référentiel, CR réunion, note D2F, document qualité, technique ou sécurité.");
  const uploaded = [];
  setStatus(`Dépôt documentaire en cours (${files.length} fichier(s))...`, "info", "documentStatus");
  for (const file of files) {
    const fd = new FormData();
    if (state.missionId && !globalScope) fd.set("mission_id", state.missionId);
    fd.set("document_type", documentType);
    fd.set("document_scope", globalScope ? "GLOBAL" : "MISSION");
    fd.set("file", file);
    uploaded.push(await api("/api/documents", { method: "POST", body: fd }));
  }
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
  if (!state.missionId) throw new Error("Ouvre une mission avant l’analyse. Les référentiels/CR peuvent être déposés en bibliothèque transverse, mais l’analyse se fait toujours contre un programme d’audit.");
  const uploaded = await uploadAuditDocument({ silent: true });
  let total = 0;
  for (const doc of uploaded) {
    const out = await analyzeDocumentById(doc.id);
    total += out.suggestions?.length || 0;
  }
  setStatus(`${uploaded.length} document(s) déposé(s) puis analysé(s). ${total} proposition(s) générée(s) ou mise(s) à disposition pour revue auditeur.`, "success", "documentStatus");
  await Promise.all([loadDocuments(), loadSuggestions()]);
  showTab("documents", { preserveScroll: true });
}

async function analyzeAuditDocument() {
  requireMission();
  if (state.demo) return demoOnly("L’analyse IA réelle nécessite l’API Worker, Supabase et une clé OpenAI configurée.");
  if ($("auditDocumentFile").files.length) {
    throw new Error("Un nouveau fichier est choisi mais pas encore déposé. Clique “Déposer puis analyser”. Pour analyser un document déjà présent, sélectionne sa ligne dans le registre.");
  }
  if (!state.documentId) throw new Error("Sélectionne un document déjà présent dans le registre, ou choisis un fichier puis clique “Déposer puis analyser”.");
  const out = await analyzeDocumentById(state.documentId);
  setStatus(`${out.suggestions.length} proposition(s) d'écart générée(s). Validation auditeur requise.`, "success", "documentStatus");
  await Promise.all([loadDocuments(), loadSuggestions()]);
  showTab("documents", { preserveScroll: true });
}

async function loadSuggestions() {
  state.suggestions = await api(`/api/ai-suggestions?mission_id=${state.missionId}`);
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
  const query = state.clientPortal
    ? `mission_id=${encodeURIComponent(state.missionId)}&token=${encodeURIComponent(state.clientToken)}`
    : `mission_id=${encodeURIComponent(state.missionId)}`;
  state.clientFindings = await api(`/api/client/findings?${query}`);
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
  $("reportCard").hidden = false;
  $("report").innerHTML = reportHtml(out);
  showTab("report");
}

function reportHtml(out) {
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
    <tbody>${out.chain.map((r) => `<tr><td>${escapeHtml(r.reference)}</td><td>${escapeHtml(r.attendu_dgfip)}</td><td>${escapeHtml(r.reponse_statut)}<br>${escapeHtml(r.reponse_client)}</td><td>${escapeHtml(r.constat)} ${escapeHtml(r.synthese_constat)}</td><td>${escapeHtml(r.preuves_attendues)}</td><td>${escapeHtml(r.preuves_associees)}</td></tr>`).join("")}</tbody></table>
  `;
}

function REG_LABEL() { return $("baseline").textContent; }
function requireSelection() { if (!state.selected) throw new Error("Sélectionne d'abord une question dans la chaîne d'audit."); }
function requireMission() { if (!state.missionId) throw new Error("Crée ou sélectionne d'abord une mission. Sans mission, DIAM ne peut pas rattacher le questionnaire, les preuves et le rapport."); }
function showTab(name, options = {}) {
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
  for (const id of ["openMission", "copyClientLink", "reload", "generateReport", "deleteMission", "updateMissionProfile", "prepareDgfipAnalysis", "uploadAndAnalyzeDocument", "analyzeAuditDocument", "promoteSuggestion", "rejectSuggestion", "submitClientReply", "topSaveMission", "topDgfipFile", "topReport"]) {
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
  el.classList.toggle("warn", !schemaOk && schema.current);
  el.innerHTML = `
    <strong>${escapeHtml(app.name || "DIAM SaaS")} v${escapeHtml(app.version || "-")}</strong>
    · ${escapeHtml(app.release || "release")}
    · schéma ${escapeHtml(schema.current || app.schemaVersion || "-")}${schemaOk ? " ✓" : schema.current ? " ⚠ migration à vérifier" : ""}
    · D2F Suite ${app.d2fBusinessSuite?.configured ? "connectée" : "clé absente"}
    · build ${escapeHtml((app.buildCommit || "non renseigné").slice(0, 12))}
  `;
}
function enterClientPortalMode() {
  document.body.classList.add("clientPortal");
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
function enableDemoMode(error) {
  state.demo = true;
  state.missions = [{ id: "demo-mission", number: "APERÇU-LOCAL", title: "Audit PA — aperçu visuel" }];
  state.missionId = "demo-mission";
  state.chain = structuredClone(DEMO_CHAIN);
  $("runtimeMode").textContent = "Aperçu local";
  $("runtimeMode").className = "modePill warn";
  $("baseline").textContent = `${DEMO_BASELINE.label} - sources vérifiées ${DEMO_BASELINE.checkedAt}`;
  appRelease = { ...appRelease, buildCommit: "file-local", schema: { current: "hors API", ok: false } };
  renderVersionStack(appRelease);
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
  state.suggestions = [{ id: "demo-suggestion", reference: "DGFiP-2.3", requirement_source: "DGFiP v1.3 §7.3 / PDP Integrity EX-19.7", requirement_excerpt: "Preuve opposable de chaque traitement.", evidence_document_name: "Exemple.pdf", evidence_sha256: "demo", evidence_locator: "page 12 / section journalisation", assessment_type: "INSUFFICIENT_EVIDENCE", suggested_qualification: "CRITICAL", potential_gap: "Exemple : preuve de restitution complète de la piste d’audit insuffisante.", missing_evidence: "Export horodaté et manifest d’intégrité.", confidence: 0.82, status: "DEMO" }];
  renderSuggestions();
  state.clientFindings = state.chain.filter((row) => row.constat_id);
  renderClientFindings();
}
function demoOnly(message) {
  setStatus(message, "error");
  setStatus(message, "error", "documentStatus");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}
function badge(value) { return `<strong>${escapeHtml(value)}</strong>`; }
function assessmentLabel(value) {
  return ({
    POTENTIAL_GAP: "Écart potentiel",
    INSUFFICIENT_EVIDENCE: "Preuve insuffisante",
    MORE_INFO_REQUIRED: "Information requise"
  })[value] || "À examiner";
}
function analysisStatusLabel(value) {
  return ({
    UPLOADED: "Déposé — analyse non lancée",
    ANALYZED: "Analysé au regard du référentiel",
    FAILED: "Analyse impossible — voir message d’erreur"
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
  const status = scope.d2f_business_suite_sync_status === "SYNCED_API" ? "Synchronisé par API" : "Raccordé manuellement";
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
