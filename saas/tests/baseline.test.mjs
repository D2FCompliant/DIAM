import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CONTROLS, SC_CONTROLS, d2fClientMatches, extractD2FClients } from "../worker/index.mjs";

test("DIAM SaaS regulatory baseline is seeded with DGFiP/PDP controls", () => {
  assert.equal(BASE_CONTROLS.length, 33);
  assert.ok(BASE_CONTROLS.some((c) => c.reference === "DGFiP-A9"));
  assert.ok(BASE_CONTROLS.every((c) => c.expected_evidence && c.base_qualification));
  assert.ok(BASE_CONTROLS.some((c) => c.expected_evidence.includes("Journaux")));
});

test("DIAM SaaS SC audit baseline is seeded with RLF-C:SC controls", () => {
  assert.equal(SC_CONTROLS.length, 62);
  assert.ok(SC_CONTROLS.some((c) => c.reference === "SC-EX-2.1"));
  assert.ok(SC_CONTROLS.some((c) => c.reference === "SC-EX-14.3"));
  assert.ok(SC_CONTROLS.every((c) => c.source.includes("RLF-C:SC") || c.reference === "SC-RAPPORT"));
  assert.ok(SC_CONTROLS.every((c) => c.expected_evidence && c.base_qualification));
});

test("reads the actual wrapped Business Suite audit-client contract", () => {
  const wrapped = extractD2FClients({ ok: true, result: { clients: [{ id: "client-1", dossierSourceId: "D2F-BS-CLIENT-client-1", name: "ADEMICO SOFTWARE" }] } });
  assert.equal(wrapped.recognized, true);
  assert.equal(wrapped.path, "result.clients");
  assert.equal(wrapped.clients.length, 1);
  assert.equal(extractD2FClients({ ok: true, result: { clients: [] } }).recognized, true);
  assert.equal(extractD2FClients({ ok: true, result: { count: 0 } }).recognized, false);
});

test("matches expanded Business Suite results by name or stable dossier id", () => {
  const client = { id: "client-1", dossierSourceId: "D2F-BS-CLIENT-client-1", name: "ADEMICO SOFTWARE SAS", siren: "123456789" };
  assert.equal(d2fClientMatches(client, "ademico software"), true);
  assert.equal(d2fClientMatches(client, "D2F-BS-CLIENT-client-1"), true);
  assert.equal(d2fClientMatches(client, "987654321"), false);
});

test("frontend contains document AI review and report workflow controls", async () => {
  const html = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"));
  for (const id of [
    "auditDocumentFile",
    "uploadAuditDocument",
    "analyzeAuditDocument",
    "uploadAndAnalyzeDocument",
    "clientCountry",
    "clientAddress",
    "clientCity",
    "legalIdentifier",
    "vatId",
    "auditProgram",
    "customAuditTypeName",
    "customReferentials",
    "customControlsText",
    "clientAddressLine2",
    "clientPostalCode",
    "clientEmail",
    "clientPhone",
    "dgfipApplicationStatus",
    "d2fSuiteClientId",
    "d2fSuiteCaseUrl",
    "d2fClientSearch",
    "searchD2FClients",
    "d2fClientResults",
    "importD2FClient",
    "d2fSyncStatus",
    "declaredScope",
    "clientFacts",
    "versionStack",
    "loginGate",
    "loginEmail",
    "loginPassword",
    "loginButton",
    "logoutButton",
    "suggestionsTable",
    "promoteSuggestion",
    "rejectSuggestion",
    "suggestionJustification",
    "clientFindingsTable",
    "clientLanguage",
    "clientReplyLanguage",
    "clientReplyFrenchTranslation",
    "translationValidated",
    "submitClientReply",
    "generateReport",
    "missionsTable",
    "openMission",
    "copyClientLink",
    "refreshMissions",
    "evidenceFile",
    "uploadEvidence",
    "adminAuditTypeName",
    "adminAuditReferentials",
    "adminAuditControls",
    "adminPrepareCustomAudit",
    "adminOpenGlobalLibrary",
    "applicabilityNote"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const id of ["topNewMission", "topCreateMission", "topSaveMission", "topOpenMission", "topGlobalLibrary", "topDgfipFile", "topReport"]) {
    assert.ok(html.includes(`id="${id}"`), `missing top action #${id}`);
  }
  for (const tab of ["dashboard", "mission_form", "admin", "audit", "detail", "documents", "client", "report"]) {
    assert.ok(html.includes(`data-tab="${tab}"`), `missing tab ${tab}`);
    assert.ok(html.includes(`data-panel="${tab}"`), `missing panel ${tab}`);
  }
  assert.match(html, /<th>Applicabilité<\/th>/);
  assert.match(html, /Admin référentiels/);
});

test("top cockpit actions are wired to real handlers", async () => {
  const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"));
  assert.match(app, /\$\("topNewMission"\)\.onclick = \(\) => prepareNewMission\(\{ blank: true \}\)/);
  assert.match(app, /\$\("topCreateMission"\)\.onclick = \(\) => run\(createMissionFromTopBar, "createStatus"\)/);
  assert.match(app, /\$\("topSaveMission"\)\.onclick = \(\) => run\(updateMissionProfile, "createStatus"\)/);
  assert.match(app, /\$\("topOpenMission"\)\.onclick = \(\) => run\(openSelectedMissionFromTopBar, "createStatus"\)/);
  assert.match(app, /async function createMissionFromTopBar/);
  assert.match(app, /state\.activeTab !== "mission_form"/);
  assert.match(app, /Aucune mission n’a été créée depuis cet écran/);
  assert.match(app, /async function openSelectedMissionFromTopBar/);
  assert.doesNotMatch(app, /\$\("topCreateMission"\)\.onclick = \(\) => run\(createMission, "createStatus"\)/);
  assert.doesNotMatch(app, /topMissionForm/);
});

test("production cockpit keeps global chrome fixed and scrolls inside work windows", async () => {
  const fs = await import("node:fs/promises");
  const [html, css, app, worker, pkgRaw] = await Promise.all([
    fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../package.json", import.meta.url), "utf8")
  ]);
  const pkg = JSON.parse(pkgRaw);
  assert.equal(pkg.version, "1.3.0");
  assert.match(app, /version: "1\.3\.0"/);
  assert.match(worker, /version: "1\.3\.0"/);
  assert.match(app, /patch=correction, minor=évolution fonctionnelle compatible, major=rupture/);
  assert.match(worker, /patch=correction, minor=évolution fonctionnelle compatible, major=rupture/);
  assert.match(html, /Préparer nouvel audit/);
  assert.match(html, /Créer depuis fiche/);
  assert.match(html, /Audit personnalisé \/ référentiel libre/);
  assert.match(html, /dashboardHero/);
  assert.match(html, /dashboardMission/);
  assert.match(html, /dashboardFacts/);
  assert.match(html, /dashboardPortfolio/);
  assert.doesNotMatch(css, /nth-of-type/);
  assert.match(css, /\.layout:not\(\.dashboardMode\)/);
  assert.match(css, /\.layout\.dashboardMode \.dashboardHero/);
  assert.match(css, /html\s*\{[^}]*height: 100%;[^}]*overflow: hidden;/s);
  assert.match(css, /body\s*\{[^}]*height: 100%;[^}]*overflow: hidden;[^}]*display: flex;[^}]*flex-direction: column;/s);
  assert.match(css, /\.layout\s*\{[^}]*flex: 1 1 auto;[^}]*overflow: hidden;/s);
  assert.match(css, /\.card\s*\{[^}]*overflow: auto;/s);
});

test("audit scoping is multilingual and dynamically frames applicability", async () => {
  const fs = await import("node:fs/promises");
  const [app, worker, html] = await Promise.all([
    fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/index.html", import.meta.url), "utf8")
  ]);
  assert.match(worker, /function assessApplicability/);
  assert.match(worker, /OBLIGATOIRE/);
  assert.match(worker, /CONDITIONNEL/);
  assert.match(worker, /HORS_PERIMETRE_A_CONFIRMER/);
  assert.match(worker, /auditLanguagePolicy/);
  assert.match(worker, /rapport final DGFiP obligatoirement en français/);
  assert.match(worker, /moteur d'analyse assistée D2F Compliant/);
  assert.match(worker, /lis et exploite les preuves en français ou en anglais/);
  assert.match(app, /applicabilite_statut/);
  assert.match(app, /applicabilityBadge/);
  assert.match(app, /Rapport DGFiP<\/span><strong>Français obligatoire/);
  assert.match(html, /Langue de conduite \/ réponses client/);
  assert.match(html, /Nouveau programme libre/);
});

test("version banner always exposes a usable build reference", async () => {
  const fs = await import("node:fs/promises");
  const [app, worker] = await Promise.all([
    fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8")
  ]);
  assert.match(worker, /const gitCommit = env\.DIAM_BUILD_COMMIT \|\| env\.CF_PAGES_COMMIT_SHA \|\| ""/);
  assert.match(worker, /buildRef = gitCommit \|\| `\$\{APP_RELEASE\.channel\}-v\$\{APP_RELEASE\.version\}-/);
  assert.match(worker, /buildSource: gitCommit \? "git" : "release"/);
  assert.match(app, /const build = app\.buildCommit \|\| `\$\{app\.channel \|\| "local"\}-v/);
  assert.doesNotMatch(app, /build \$\{escapeHtml\(\(app\.buildCommit \|\| "non renseigné"\)/);
  assert.doesNotMatch(worker, /buildCommit: env\.DIAM_BUILD_COMMIT \|\| env\.CF_PAGES_COMMIT_SHA \|\| "non renseigné"/);
});

test("worker exposes a public D2F marketplace manifest without secrets", async () => {
  const fs = await import("node:fs/promises");
  const [worker, readme] = await Promise.all([
    fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../README.md", import.meta.url), "utf8")
  ]);
  assert.match(worker, /function marketplaceManifest/);
  assert.match(worker, /application\/vnd\.d2f\.marketplace-app\+json;version=1/);
  assert.match(worker, /d2f-diam-saas/);
  assert.match(worker, /\/\.well-known\/d2f-marketplace-app\.json/);
  assert.match(worker, /path === "\/api\/marketplace\/app"/);
  assert.match(worker, /secretsExposed: false/);
  assert.match(worker, /browserStoresServiceKeys: false/);
  assert.match(readme, /Publication marketplace D2F Compliant/);
  assert.match(readme, /\.well-known\/d2f-marketplace-app\.json/);
});

test("custom audit missions are explicit and generate their own audit chain", async () => {
  const fs = await import("node:fs/promises");
  const [html, app, worker] = await Promise.all([
    fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8")
  ]);
  assert.match(html, /Nom du type d’audit personnalisé/);
  assert.match(html, /Référentiels attachés/);
  assert.match(html, /Contrôles à générer/);
  assert.match(html, /SAE \/ CFN \/ GED \/ CDC \/ autre/);
  assert.match(html, /Préparer type d’audit personnalisé/);
  assert.doesNotMatch(html, /Préparer mission CDC/);
  assert.match(app, /custom_controls_text: \$\("customControlsText"\)\.value/);
  assert.match(app, /Audit personnalisé : renseigne au moins un contrôle à générer/);
  assert.match(app, /state\.missionId = out\.mission\.id/);
  assert.match(app, /reused_existing/);
  assert.match(worker, /function controlsFromMissionDefinition/);
  assert.match(worker, /reference: `AUD-\$\{String\(index \+ 1\)\.padStart\(2, "0"\)\}`/);
  assert.match(worker, /Audit personnalisé : ajoute au moins un contrôle/);
});

test("server reuses the client before creating another mission", async () => {
  const worker = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8"));
  assert.match(worker, /async function findOrSaveClient/);
  assert.match(worker, /d2f_business_suite_client_id/);
  assert.match(worker, /wantedSiren && wantedSiren === digits\(client\.siren\)/);
  assert.match(worker, /wantedLegal && wantedLegal === normalizeKey\(scope\.client_legal_identifier\)/);
  assert.match(worker, /wantedVat && wantedVat === normalizeKey\(scope\.client_vat_id\)/);
  assert.match(worker, /wantedName && wantedName === normalizeKey\(client\.name\)/);
  assert.match(worker, /const previous = allPrevious\.filter/);
  assert.match(worker, /function nonBlankEntries/);
  assert.match(worker, /\.\.\.nonBlankEntries\(nextScope\)/);
});

test("portfolio exposes delete per mission and server avoids open mission duplicates", async () => {
  const fs = await import("node:fs/promises");
  const [app, worker] = await Promise.all([
    fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../worker/index.mjs", import.meta.url), "utf8")
  ]);
  assert.match(app, /data-delete-mission="\$\{m\.id\}"/);
  assert.match(app, /async function deleteMissionById/);
  assert.match(app, /button\.dataset\.deleteMission/);
  assert.match(worker, /async function findReusableOpenMission/);
  assert.match(worker, /reused_existing: true/);
  assert.match(worker, /Mission ouverte existante réutilisée/);
});

test("preparing a new audit detaches the active mission before editing", async () => {
  const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"));
  assert.match(app, /function prepareNewMission/);
  assert.match(app, /state\.missionId = ""/);
  assert.match(app, /Aucune mission existante n’est active/);
  assert.match(app, /Nouveau brouillon d’audit/);
  assert.match(app, /referential\.includes\("RLF-C:SC"\)/);
  assert.match(app, /referential\.includes\("Audit personnalisé"\)/);
});

test("saving the mission form handles draft and selected mission states explicitly", async () => {
  const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"));
  assert.match(app, /async function updateMissionProfile/);
  assert.match(app, /Brouillon détecté : DIAM crée maintenant la mission/);
  assert.match(app, /await createMission\(\)/);
  assert.match(app, /Mission sélectionnée ouverte/);
  assert.match(app, /function requireMission/);
  assert.match(app, /if \(!state\.missionId && selectedMissionId\) state\.missionId = selectedMissionId/);
  assert.match(app, /Aucune mission ouverte/);
});

test("Business Suite import is country-aware and persists the active mission", async () => {
  const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"));
  assert.match(app, /async function importD2FClient/);
  assert.match(app, /api\(`\/api\/missions\/\$\{state\.missionId\}`/);
  assert.match(app, /function isFrenchCountry/);
  assert.match(app, /french \? \$\("siren"\)\.value : ""/);
  assert.match(app, /d2f_business_suite_source_updated_at/);
});
