import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { auditEvidence } from "./audit-api-evidence.mjs";

describe("auditoria de evidências da API", () => {
  it("distingue asserção de status de validação completa do contrato", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "quality-evidence-test-"));
    const specs = path.join(root, "specs");
    await mkdir(specs);
    const testFile = path.join(specs, "GET-case.spec.js");
    const candidates = path.join(root, "candidates.json");
    const openapi = path.join(root, "openapi.json");
    try {
      await writeFile(testFile, `test('cenário - HTTP 200', async () => { expect(response.status()).toBe(200); });\ntest('sem asserção - HTTP 400', async () => { expect(body.status).toBe(400); });`);
      await writeFile(candidates, JSON.stringify({ evidence: [{ testFile: "specs/GET-case.spec.js", scenario: "cenário", method: "GET", path: "/test", status: "200", contentType: "application/json" }, { testFile: "specs/GET-case.spec.js", scenario: "sem asserção", method: "GET", path: "/test", status: "400", contentType: "application/json" }] }));
      await writeFile(openapi, JSON.stringify({ paths: { "/test": { get: { responses: { "200": { content: { "application/json": { schema: { "x-csharp-type": "ResponseDto" } } } } } } } } }));
      const report = await auditEvidence({ candidates, openapi, repo: root });
      assert.deepEqual(report.counts, { candidates: 2, explicitStatusAssertions: 1, contractVerified: 0, manualReview: 1 });
      assert.equal(report.results[0].explicitStatusAssertion, true);
      assert.equal(report.results[0].contractVerified, false);
      assert.equal(report.results[0].declaredType, "ResponseDto");
      assert.equal(report.results[1].explicitStatusAssertion, false);
      assert.equal(report.results[1].contractVerified, false);
    } finally {
      await Promise.all([unlink(testFile), unlink(candidates), unlink(openapi)]);
      await rmdir(specs); await rmdir(root);
    }
  });
});
