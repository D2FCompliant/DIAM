import assert from "node:assert/strict";
import test from "node:test";
import { BASE_CONTROLS } from "../worker/index.mjs";

test("DIAM SaaS regulatory baseline is seeded with DGFiP/PDP controls", () => {
  assert.equal(BASE_CONTROLS.length, 33);
  assert.ok(BASE_CONTROLS.some((c) => c.reference === "DGFiP-A9"));
  assert.ok(BASE_CONTROLS.every((c) => c.expected_evidence && c.base_qualification));
  assert.ok(BASE_CONTROLS.some((c) => c.expected_evidence.includes("Journaux")));
});

test("frontend contains document AI review and report workflow controls", async () => {
  const html = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/index.html", import.meta.url), "utf8"));
  for (const id of [
    "auditDocumentFile",
    "uploadAuditDocument",
    "analyzeAuditDocument",
    "suggestionsTable",
    "promoteSuggestion",
    "generateReport",
    "evidenceFile",
    "uploadEvidence"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const tab of ["dashboard", "audit", "detail", "documents", "report"]) {
    assert.ok(html.includes(`data-tab="${tab}"`), `missing tab ${tab}`);
    assert.ok(html.includes(`data-panel="${tab}"`), `missing panel ${tab}`);
  }
});
