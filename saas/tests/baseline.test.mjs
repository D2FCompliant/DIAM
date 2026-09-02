import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CONTROLS, d2fClientMatches, extractD2FClients } from "../worker/index.mjs";

test("DIAM SaaS regulatory baseline is seeded with DGFiP/PDP controls", () => {
  assert.equal(BASE_CONTROLS.length, 33);
  assert.ok(BASE_CONTROLS.some((c) => c.reference === "DGFiP-A9"));
  assert.ok(BASE_CONTROLS.every((c) => c.expected_evidence && c.base_qualification));
  assert.ok(BASE_CONTROLS.some((c) => c.expected_evidence.includes("Journaux")));
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
    "clientCountry",
    "clientAddress",
    "clientCity",
    "legalIdentifier",
    "vatId",
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
  for (const tab of ["dashboard", "audit", "detail", "documents", "client", "report"]) {
    assert.ok(html.includes(`data-tab="${tab}"`), `missing tab ${tab}`);
    assert.ok(html.includes(`data-panel="${tab}"`), `missing panel ${tab}`);
  }
});
