import { describe, expect, it } from "vitest";
import {
  computeProjection,
  countCoveredConditions,
  dedupeExecutions,
  failureRows,
  rateTone,
  summarize,
  type EvolutionPoint,
  type Execution,
} from "./metrics";

const ex = (o: Partial<Execution>): Execution => ({
  id: "x", product: "api", triggerId: "t1", runAttempt: 1, trigger: "scheduled", date: "2026-10-01", dataSource: "ds", results: [], ...o,
});

describe("success rate", () => {
  it("flaky counts as success, definitive failure does not", () => {
    const s = summarize([ex({ results: [{ title: "a", status: "passed" }, { title: "b", status: "flaky" }, { title: "c", status: "failed" }, { title: "d", status: "passed" }] })]);
    expect(s.rate).toBe(75);
    expect(s.flaky).toBe(1);
  });
  it("returns null without data", () => expect(summarize([]).rate).toBeNull());
  it("tone thresholds", () => {
    expect(rateTone(90)).toBe("success");
    expect(rateTone(89.99)).toBe("warning");
    expect(rateTone(80)).toBe("warning");
    expect(rateTone(79.99)).toBe("danger");
  });
});

describe("dedup", () => {
  it("ignores reruns of the same trigger, keeps first attempt", () => {
    const r = dedupeExecutions([
      ex({ id: "a2", runAttempt: 2, results: [{ title: "a", status: "passed" }] }),
      ex({ id: "a1", runAttempt: 1, results: [{ title: "a", status: "failed" }] }),
    ]);
    expect(r.map((e) => e.id)).toEqual(["a1"]);
  });
  it("counts a failure once per execution", () => {
    const rows = failureRows([ex({ results: [{ title: "a", status: "failed", error: "E" }, { title: "a", status: "failed", error: "E" }] })]);
    expect(rows[0].occurrences).toBe(1);
  });
});

describe("coverage", () => {
  it("multiple tests on the same condition count once; extras outside contract ignored", () => {
    const c = { route: "/r", method: "GET", status: 200, contract: "R" };
    expect(countCoveredConditions([c, { ...c, status: 400 }], [c, c, { ...c, route: "/x" }])).toBe(1);
  });
});

const pts = (p: number[], a: number[]): EvolutionPoint[] =>
  p.map((v, i) => ({ week: `2026-0${1 + Math.floor(i / 4)}-${String(1 + (i % 4) * 7).padStart(2, "0")}`, productConditions: v, automatedConditions: a[i], projectedAutomatedConditions: null }));

describe("projection", () => {
  it("insufficient history with fewer than 3 weeks", () => {
    expect(computeProjection(pts([10, 11], [1, 2])).status).toBe("insufficient");
  });
  it("no parity when automation grows slower or equal", () => {
    expect(computeProjection(pts([10, 12, 14], [1, 3, 5])).status).toBe("no-parity");
  });
  it("parity weeks = gap / velocity difference", () => {
    const r = computeProjection(pts([100, 101, 102], [10, 20, 30]));
    expect(r.status).toBe("parity");
    if (r.status === "parity") expect(r.weeksRemaining).toBe(Math.ceil(72 / 9));
  });
});
