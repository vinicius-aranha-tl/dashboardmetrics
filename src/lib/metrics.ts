// Pure business rules for automation metrics. Keep free of React/IO so they are testable.

export type Product = "api" | "ui";
export type Trigger = "scheduled" | "post-merge" | "manual";
export type TestStatus = "passed" | "failed" | "flaky";

export interface TestResult {
  title: string;
  /** passed = first try ok; flaky = failed internally but passed on retry; failed = definitive failure */
  status: TestStatus;
  error?: string;
  detail?: string;
  cause?: string;
}

export interface Execution {
  id: string;
  product: Product;
  /** Identifies the trigger (schedule tick, merge commit, manual dispatch). Reruns share it. */
  triggerId: string;
  /** GitHub Actions run_attempt. 1 = first attempt; >1 = rerun of the same Action. */
  runAttempt: number;
  trigger: Trigger;
  date: string; // YYYY-MM-DD
  dataSource: string;
  results: TestResult[];
}

export interface EvolutionPoint {
  week: string;
  productConditions: number;
  automatedConditions: number;
  projectedAutomatedConditions: number | null;
}

export interface DailyResult {
  date: string;
  passed: number;
  failed: number;
  unstable: number;
}

/** Keep only the first attempt of each trigger: reruns of the same Action are ignored. */
export function dedupeExecutions(execs: Execution[]): Execution[] {
  const best = new Map<string, Execution>();
  for (const e of execs) {
    const key = `${e.product}|${e.triggerId}`;
    const cur = best.get(key);
    if (!cur || e.runAttempt < cur.runAttempt) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface ExecFilter {
  product: "all" | Product;
  periodDays: number | null; // null = all history
  origins: Trigger[];
  now: Date;
}

export function daysAgoISO(now: Date, days: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function filterExecutions(execs: Execution[], f: ExecFilter): Execution[] {
  const from = f.periodDays == null ? null : daysAgoISO(f.now, f.periodDays - 1);
  return execs.filter(
    (e) =>
      (f.product === "all" || e.product === f.product) &&
      f.origins.includes(e.trigger) &&
      (from == null || e.date >= from),
  );
}

export interface Summary {
  passed: number;
  flaky: number;
  failed: number;
  total: number;
  /** success rate in %, null when there is no data */
  rate: number | null;
}

/** sucesso = aprovados (inclui flaky recuperado por retry) / total; falha = definitiva. */
export function summarize(execs: Execution[]): Summary {
  let passed = 0,
    flaky = 0,
    failed = 0;
  for (const e of execs)
    for (const r of e.results) {
      if (r.status === "passed") passed++;
      else if (r.status === "flaky") flaky++;
      else failed++;
    }
  const total = passed + flaky + failed;
  return { passed, flaky, failed, total, rate: total ? ((passed + flaky) / total) * 100 : null };
}

export type Tone = "success" | "warning" | "danger";
export function rateTone(rate: number): Tone {
  if (rate >= 90) return "success";
  if (rate >= 80) return "warning";
  return "danger";
}

export function testCount(execs: Execution[], product: Product): number {
  const titles = new Set<string>();
  for (const e of execs) if (e.product === product) e.results.forEach((r) => titles.add(r.title));
  return titles.size;
}

export function dailyResults(execs: Execution[]): DailyResult[] {
  const m = new Map<string, DailyResult>();
  for (const e of execs) {
    const d = m.get(e.date) ?? { date: e.date, passed: 0, failed: 0, unstable: 0 };
    for (const r of e.results) {
      if (r.status === "passed") d.passed++;
      else if (r.status === "flaky") d.unstable++;
      else d.failed++;
    }
    m.set(e.date, d);
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface FlakyRow {
  title: string;
  executions: number;
  failureExecutions: number;
  dataSource: string;
}

export function flakyTable(execs: Execution[]): FlakyRow[] {
  const m = new Map<string, FlakyRow>();
  for (const e of execs)
    for (const r of e.results) {
      const key = `${e.dataSource}|${r.title}`;
      const row = m.get(key) ?? { title: r.title, executions: 0, failureExecutions: 0, dataSource: e.dataSource };
      row.executions++;
      if (r.status === "flaky") row.failureExecutions++;
      m.set(key, row);
    }
  return [...m.values()].filter((r) => r.failureExecutions > 0).sort((a, b) => b.failureExecutions - a.failureExecutions);
}

export interface FailureRow {
  title: string;
  error: string;
  detail: string;
  cause: string;
  occurrences: number;
  dataSource: string;
  firstSeen: string;
  firstOccurrence: string;
  lastOccurrence: string;
}

/** Groups definitive failures by test + error. Each valid execution counts once. */
export function failureRows(execs: Execution[]): FailureRow[] {
  const firstSeen = new Map<string, string>();
  for (const e of execs)
    for (const r of e.results) {
      const k = `${e.dataSource}|${r.title}`;
      const cur = firstSeen.get(k);
      if (!cur || e.date < cur) firstSeen.set(k, e.date);
    }
  const m = new Map<string, FailureRow>();
  for (const e of execs) {
    const seenInExec = new Set<string>();
    for (const r of e.results) {
      if (r.status !== "failed") continue;
      const key = `${e.dataSource}|${r.title}|${r.error ?? ""}`;
      if (seenInExec.has(key)) continue;
      seenInExec.add(key);
      const row =
        m.get(key) ??
        ({
          title: r.title,
          error: r.error ?? "—",
          detail: r.detail ?? "—",
          cause: r.cause ?? "Não classificada",
          occurrences: 0,
          dataSource: e.dataSource,
          firstSeen: firstSeen.get(`${e.dataSource}|${r.title}`) ?? e.date,
          firstOccurrence: e.date,
          lastOccurrence: e.date,
        } as FailureRow);
      row.occurrences++;
      if (e.date < row.firstOccurrence) row.firstOccurrence = e.date;
      if (e.date > row.lastOccurrence) row.lastOccurrence = e.date;
      m.set(key, row);
    }
  }
  return [...m.values()].sort((a, b) => b.occurrences - a.occurrences);
}

export function causeDistribution(rows: FailureRow[]): { cause: string; value: number }[] {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.cause, (m.get(r.cause) ?? 0) + r.occurrences));
  return [...m.entries()].map(([cause, value]) => ({ cause, value })).sort((a, b) => b.value - a.value);
}

/** Counts distinct minimum conditions: route + method + status + contract. Duplicated scenarios count once. */
export function countCoveredConditions(
  contract: { route: string; method: string; status: number; contract: string }[],
  evidences: { route: string; method: string; status: number; contract: string }[],
): number {
  const key = (c: { route: string; method: string; status: number; contract: string }) =>
    `${c.method.toUpperCase()} ${c.route} ${c.status} ${c.contract}`;
  const valid = new Set(contract.map(key));
  const covered = new Set(evidences.map(key).filter((k) => valid.has(k)));
  return covered.size;
}

export const MIN_POINTS_FOR_PROJECTION = 3;

function slope(ys: number[]): number {
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  ys.forEach((y, i) => {
    num += (i - mx) * (y - my);
    den += (i - mx) ** 2;
  });
  return den ? num / den : 0;
}

function addWeeks(iso: string, w: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + w * 7);
  return d.toISOString().slice(0, 10);
}

export type Projection =
  | { status: "empty"; series: EvolutionPoint[] }
  | { status: "insufficient"; series: EvolutionPoint[]; currentGap: number }
  | { status: "no-parity"; series: EvolutionPoint[]; currentGap: number; productVelocity: number; automationVelocity: number }
  | {
      status: "parity";
      series: EvolutionPoint[];
      currentGap: number;
      productVelocity: number;
      automationVelocity: number;
      parityWeek: string;
      weeksRemaining: number;
    };

/** Projection only exists when automation grows faster than the product (linear regression, weekly). */
export function computeProjection(points: EvolutionPoint[]): Projection {
  const pts = [...points].sort((a, b) => a.week.localeCompare(b.week)).map((p) => ({ ...p, projectedAutomatedConditions: null }));
  if (!pts.length) return { status: "empty", series: [] };
  const last = pts[pts.length - 1]!;
  const currentGap = last.productConditions - last.automatedConditions;
  if (pts.length < MIN_POINTS_FOR_PROJECTION) return { status: "insufficient", series: pts.slice(-1), currentGap };
  const window = pts.slice(-8);
  const vp = slope(window.map((p) => p.productConditions));
  const va = slope(window.map((p) => p.automatedConditions));
  if (va <= vp || currentGap <= 0) {
    return { status: "no-parity", series: pts, currentGap, productVelocity: vp, automationVelocity: va };
  }
  const weeksRemaining = Math.ceil(currentGap / (va - vp));
  const series: EvolutionPoint[] = pts.map((p, i) =>
    i === pts.length - 1 ? { ...p, projectedAutomatedConditions: p.automatedConditions } : p,
  );
  for (let k = 1; k <= weeksRemaining; k++) {
    series.push({
      week: addWeeks(last.week, k),
      productConditions: null as unknown as number,
      automatedConditions: null as unknown as number,
      projectedAutomatedConditions: Math.round(Math.min(last.automatedConditions + va * k, last.productConditions + vp * k)),
    });
  }
  return {
    status: "parity",
    series,
    currentGap,
    productVelocity: vp,
    automationVelocity: va,
    parityWeek: addWeeks(last.week, weeksRemaining),
    weeksRemaining,
  };
}

/** Sums several projects' weekly evolution into one series (weeks aligned by date). */
export function aggregateEvolution(series: EvolutionPoint[][]): EvolutionPoint[] {
  const m = new Map<string, EvolutionPoint>();
  for (const s of series)
    for (const p of s) {
      const cur = m.get(p.week) ?? { week: p.week, productConditions: 0, automatedConditions: 0, projectedAutomatedConditions: null };
      cur.productConditions += p.productConditions;
      cur.automatedConditions += p.automatedConditions;
      m.set(p.week, cur);
    }
  return [...m.values()].sort((a, b) => a.week.localeCompare(b.week));
}
