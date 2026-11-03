import { describe, expect, it } from "vitest";
import {
  computeProjection,
  countCoveredConditions,
  dailyExecutionVolume,
  dedupeExecutions,
  failureRows,
  filterExecutions,
  flakyTable,
  rateTone,
  summarize,
  summarizeExecutionHealth,
  type EvolutionPoint,
  type Execution,
} from "./metrics";

const ex = (o: Partial<Execution>): Execution => ({
  id: "x", product: "api", triggerId: "t1", runAttempt: 1, trigger: "scheduled", date: "2026-10-01", dataSource: "ds", results: [], ...o,
});

it("separa execuções por faixa e calcula a taxa conjunta sem incluir dados ausentes", () => {
  const tests = (passed: number, failed: number) => [...Array.from({ length: passed }, (_, i) => ({ title: `p${i}`, status: "passed" as const })), ...Array.from({ length: failed }, (_, i) => ({ title: `f${i}`, status: "failed" as const }))];
  const result = summarizeExecutionHealth([ex({ id: "critica", results: tests(7, 3) }), ex({ id: "atencao", results: tests(8, 2) }), ex({ id: "boa", results: tests(9, 1) }), ex({ id: "vazia" })]);
  expect(result.critical.map(item => item.execution.id)).toEqual(["critica"]);
  expect(result.attention.map(item => item.execution.id)).toEqual(["atencao"]);
  expect(result.healthySummary.rate).toBe(90);
  expect(result.missing).toHaveLength(1);
});

it("conta ações e cenários por dia sem contar reruns", () => {
  const results = [{ title: "a", status: "passed" as const }, { title: "b", status: "failed" as const }];
  const data = dedupeExecutions([
    ex({ id: "1", triggerId: "projeto-a-1", results }),
    ex({ id: "1", triggerId: "projeto-a-1", runAttempt: 2, results }),
    ex({ id: "2", triggerId: "projeto-b-1", results }),
    ex({ id: "3", triggerId: "projeto-a-2", date: "2026-10-02", results: [] }),
  ]);
  expect(dailyExecutionVolume(data)).toEqual([
    { date: "2026-10-01", ciRuns: 2, scenarioRuns: 4 },
    { date: "2026-10-02", ciRuns: 1, scenarioRuns: null },
  ]);
});

it("filtra 15 dias incluindo hoje e os 14 dias anteriores", () => {
  const rows = [ex({ id: "dentro", date: "2026-10-17" }), ex({ id: "fora", date: "2026-10-16" }), ex({ id: "hoje", date: "2026-10-31" })];
  expect(filterExecutions(rows, { product: "api", origins: ["scheduled"], periodDays: 15, now: new Date("2026-10-31T12:00:00Z") }).map(row => row.id)).toEqual(["dentro", "hoje"]);
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
    expect(rows[0]?.occurrences).toBe(1);
  });
  it("separa falhas do mesmo cenário e erro quando os detalhes são diferentes", () => {
    const rows = failureRows([ex({ results: [{ title: "a", status: "failed", error: "E", detail: "motivo 1" }, { title: "a", status: "failed", error: "E", detail: "motivo 2" }] })]);
    expect(rows).toHaveLength(2);
  });
});

it("classifica como instável somente a partir de três execuções com falha", () => {
  const executions = [1, 2, 3].map(i => ex({ id: String(i), triggerId: String(i), results: [{ title: "instável", status: i === 3 ? "failed" : "flaky" }, { title: "com duas falhas", status: i === 3 ? "passed" : "flaky" }] }));
  expect(flakyTable(executions)).toEqual([{ title: "instável", executions: 3, failureExecutions: 3, dataSource: "ds" }]);
});

describe("coverage", () => {
  it("multiple tests on the same condition count once; extras outside contract ignored", () => {
    const c = { route: "/r", method: "GET", status: 200, contract: "R" };
    expect(countCoveredConditions([c, { ...c, status: 400 }], [c, c, { ...c, route: "/x" }])).toBe(1);
  });
});

const pts = (p: number[], a: number[]): EvolutionPoint[] =>
  p.map((v, i) => ({ week: `2026-0${1 + Math.floor(i / 4)}-${String(1 + (i % 4) * 7).padStart(2, "0")}`, productConditions: v, automatedConditions: a[i] ?? 0, projectedAutomatedConditions: null }));

describe("projection", () => {
  it("insufficient history with fewer than 3 weeks", () => {
    expect(computeProjection(pts([10, 11], [1, 2])).status).toBe("insufficient");
  });
  it("preserva os pontos existentes e calcula velocidade pelo tempo entre as datas", () => {
    const two = computeProjection(pts([10, 11], [1, 2]));
    expect(two.series).toHaveLength(2);
    const points = [{ week: "2026-10-01", productConditions: 100, automatedConditions: 10, projectedAutomatedConditions: null }, { week: "2026-10-08", productConditions: 102, automatedConditions: 20, projectedAutomatedConditions: null }, { week: "2026-10-22", productConditions: 106, automatedConditions: 40, projectedAutomatedConditions: null }];
    const result = computeProjection(points);
    expect(result.status).toBe("parity");
    if (result.status === "parity") { expect(result.productVelocity).toBeCloseTo(2); expect(result.automationVelocity).toBeCloseTo(10); }
  });
  it("projeta produto e automação e limita previsões excessivamente longas", () => {
    const result = computeProjection(pts([100, 101, 102], [10, 20, 30]));
    expect(result.status).toBe("parity");
    if (result.status === "parity") {
      const future = result.series.at(-1)!;
      expect(future.projectedProductConditions).toBeGreaterThan(102);
      expect(future.projectedAutomatedConditions).toBeGreaterThan(30);
    }
    expect(computeProjection(pts([10000, 10000, 10000], [1, 2, 3])).status).toBe("beyond-horizon");
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

import { coverageWaterfall as _cw, topFailingTests as _tf } from "./metrics";
describe("novos gráficos", () => {
  it("cascata: primeira barra é o total inicial, depois variações semanais", () => {
    const r = _cw([
      { week: "2026-01-05", productConditions: 100, automatedConditions: 10, projectedAutomatedConditions: null },
      { week: "2026-01-12", productConditions: 100, automatedConditions: 15, projectedAutomatedConditions: null },
      { week: "2026-01-19", productConditions: 100, automatedConditions: 12, projectedAutomatedConditions: null },
    ]);
    expect(r.map((x) => x.delta)).toEqual([10, 5, -3]);
    expect(r[2]!.base).toBe(12);
  });
  it("ranking de falhas soma ocorrências por teste e limita a 10", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ title: `t${i % 11}`, error: "", detail: "", cause: "", occurrences: 1, dataSource: "", firstSeen: "", firstOccurrence: "", lastOccurrence: "" }));
    const r = _tf(rows);
    expect(r).toHaveLength(10);
    expect(r[0]).toEqual({ title: "t0", value: 2 });
  });
});
