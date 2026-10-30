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
