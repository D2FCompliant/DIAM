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
    "uploadEvidence"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const id of ["topNewMission", "topCreateMission", "topSaveMission", "topOpenMission", "topGlobalLibrary", "topDgfipFile", "topReport"]) {
    assert.ok(html.includes(`id="${id}"`), `missing top action #${id}`);
  }
  for (const tab of ["dashboard", "mission_form", "audit", "detail", "documents", "client", "report"]) {
    assert.ok(html.includes(`data-tab="${tab}"`), `missing tab ${tab}`);
    assert.ok(html.includes(`data-panel="${tab}"`), `missing panel ${tab}`);
  }
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
  assert.equal(pkg.version, "1.0.1");
  assert.match(app, /version: "1\.0\.1"/);
  assert.match(worker, /version: "1\.0\.1"/);
  assert.match(html, /Préparer nouvel audit/);
  assert.match(html, /Créer depuis fiche/);
  assert.match(html, /CDC \/ audit personnalisé/);
  assert.match(css, /html\s*\{[^}]*height: 100%;[^}]*overflow: hidden;/s);
  assert.match(css, /body\s*\{[^}]*height: 100%;[^}]*overflow: hidden;[^}]*display: flex;[^}]*flex-direction: column;/s);
  assert.match(css, /\.layout\s*\{[^}]*flex: 1 1 auto;[^}]*overflow: hidden;/s);
  assert.match(css, /\.card\s*\{[^}]*overflow: auto;/s);
});

test("Business Suite import is country-aware and persists the active mission", async () => {
  const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/app.js", import.meta.url), "utf8"));
  assert.match(app, /async function importD2FClient/);
  assert.match(app, /api\(`\/api\/missions\/\$\{state\.missionId\}`/);
  assert.match(app, /function isFrenchCountry/);
  assert.match(app, /french \? \$\("siren"\)\.value : ""/);
  assert.match(app, /d2f_business_suite_source_updated_at/);
});
