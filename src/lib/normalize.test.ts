import { describe, expect, it } from "vitest";
import { decodeGithubContent, FormatError, normalizeEvolution, normalizeExecutions } from "./normalize";

describe("decodeGithubContent", () => {
  it("decodes base64 content from the GitHub Contents API", () => {
    const content = btoa(JSON.stringify([{ a: 1 }]));
    expect(decodeGithubContent({ content, encoding: "base64" })).toEqual([{ a: 1 }]);
  });
});

describe("normalizeExecutions", () => {
  it("maps aliases, statuses and triggers", () => {
    const out = normalizeExecutions({ runs: [{ run_id: 9, run_attempt: 2, event: "workflow_dispatch", started_at: "2026-10-30T10:00:00Z", tests: [{ name: "x", outcome: "unstable" }] }] }, "api");
    expect(out[0]).toMatchObject({ id: "9", runAttempt: 2, trigger: "manual", date: "2026-10-30", product: "api" });
    expect(out[0]!.results[0]!.status).toBe("flaky");
  });
  it("rejects unknown status naming the field", () => {
    expect(() => normalizeExecutions([{ date: "2026-10-30", results: [{ title: "x", status: "weird" }] }], "ui")).toThrow(/results\[0\]\.status/);
  });
});

describe("normalizeEvolution", () => {
  it("reads weekly points", () => {
    expect(normalizeEvolution({ weeks: [{ week: "2026-10-30", product: 659, automated: 185 }] })[0]).toMatchObject({ productConditions: 659, automatedConditions: 185 });
  });
  it("throws FormatError when numbers missing", () => {
    expect(() => normalizeEvolution([{ week: "2026-10-30" }])).toThrow(FormatError);
  });
});

describe("formato real squaredup", () => {
  const history = { schemaVersion: 1, executions: [{ generatedAt: "2026-10-30T17:03:24.602Z", workflow: "Testes API", run: { id: "41095166285", attempt: 1, event: "schedule" }, tests: { available: true, total: 88, passed: 86, failed: 1, flaky: 1, errors: 0 }, flakyTests: [{ title: "GET /x" }], testResults: [] }] };
  it("rebuilds results from summary counts", () => {
    const [e] = normalizeExecutions(history, "api");
    expect(e).toMatchObject({ id: "41095166285", runAttempt: 1, trigger: "scheduled", date: "2026-10-30" });
    expect(e!.results).toHaveLength(88);
    expect(e!.results.filter((r) => r.status === "failed")).toHaveLength(1);
    expect(e!.results.find((r) => r.status === "flaky")!.title).toBe("GET /x");
  });
  it("reads evolution points", () => {
    expect(normalizeEvolution({ points: [{ week: "2026-10-30", productConditions: 659, automatedConditions: 0 }] })[0]!.productConditions).toBe(659);
  });
});

import { normalizeLifecycle, normalizeReasons, normalizeStability } from "./normalize";
describe("specialized files", () => {
  it("stability keeps real titles and only tests with failures", () => {
    const r = normalizeStability({ tests: [{ title: "Criar planejamento", executions: 25, failureExecutions: 6, successRatePercent: 76 }, { title: "ok", executions: 3, failureExecutions: 0 }] }, "P · UI");
    expect(r).toEqual([{ title: "Criar planejamento", executions: 25, failureExecutions: 6, successRate: 76, dataSource: "P · UI" }]);
  });
  it("reasons donut uses definitive failures only, not flaky breaks", () => {
    const r = normalizeReasons({ reasons: [{ reason: "Seletor", failedOccurrences: 0, breakOccurrences: 7 }, { reason: "Rede", failedOccurrences: 2 }], failures: [] }, "x");
    expect(r.reasons).toEqual([{ cause: "Rede", value: 2 }]);
  });
  it("never invents 'Falha sem detalhe' when error or detail exists", () => {
    const r = normalizeReasons({ reasons: [], failures: [{ error: "Timeout", occurrences: 1 }] }, "x");
    expect(r.failures[0]?.title).toBe("Timeout");
  });
  it("lifecycle sorts by occurrences desc and uses dataSourceName", () => {
    const r = normalizeLifecycle({ tests: [{ testKey: "k", firstSeen: "2026-01-01" }], failures: [{ title: "a", occurrences: 1, testKey: "k" }, { title: "b", occurrences: 5, dataSourceName: "PM API" }] }, "x");
    expect(r.map((x) => x.title)).toEqual(["b", "a"]);
    expect(r[0]?.dataSource).toBe("PM API");
    expect(r[1]?.firstSeen).toBe("2026-01-01");
  });
  it("missing failures list is a format error", () => {
    expect(() => normalizeLifecycle({ tests: [] }, "x")).toThrow();
  });
});
