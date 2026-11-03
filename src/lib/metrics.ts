// Pure business rules for automation metrics. Keep free of React/IO so they are testable.

export type Product = "api" | "ui";
export type Trigger = "scheduled" | "post-merge" | "manual" | "unknown";
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
  projectedProductConditions?: number | null;
}

export interface DailyResult {
  date: string;
  passed: number;
  failed: number;
  unstable: number;
}

export interface DailyExecutionVolume {
  date: string;
  ciRuns: number;
  scenarioRuns: number | null;
}

/** Count recorded runs and their results. Empty results are treated as unavailable, not zero. */
export function dailyExecutionVolume(execs: Execution[]): DailyExecutionVolume[] {
  const days = new Map<string, DailyExecutionVolume>();
  for (const execution of execs) {
    const day = days.get(execution.date) ?? { date: execution.date, ciRuns: 0, scenarioRuns: 0 };
    day.ciRuns++;
    if (!execution.results.length) day.scenarioRuns = null;
    else if (day.scenarioRuns !== null) day.scenarioRuns += execution.results.length;
    days.set(execution.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
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
      (from == null || e.date >= from) && e.date <= daysAgoISO(f.now, 0),
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

/** Per-execution status preserves missing results instead of treating them as failures. */
export function summarizeExecutionHealth(execs: Execution[]) {
  const classified = execs.map((execution) => ({ execution, ...summarize([execution]) }));
  const critical = classified.filter((item) => item.rate != null && item.rate < 80).sort((a, b) => a.rate! - b.rate! || a.execution.date.localeCompare(b.execution.date));
  const attention = classified.filter((item) => item.rate != null && item.rate >= 80 && item.rate < 90).sort((a, b) => a.rate! - b.rate! || a.execution.date.localeCompare(b.execution.date));
  const healthy = classified.filter((item) => item.rate != null && item.rate >= 90);
  const missing = classified.filter((item) => item.rate == null);
  return { critical, attention, healthy, missing, healthySummary: summarize(healthy.map((item) => item.execution)) };
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
  for (const e of execs) {
    const oneRun = new Map<string, { title: string; failed: boolean }>();
    for (const r of e.results) {
      const key = `${e.dataSource}|${r.title}`;
      const current = oneRun.get(key);
      oneRun.set(key, { title: r.title, failed: Boolean(current?.failed || r.status === "flaky" || r.status === "failed") });
    }
    for (const [key, test] of oneRun) {
      const row = m.get(key) ?? { title: test.title, executions: 0, failureExecutions: 0, dataSource: e.dataSource };
      row.executions++;
      if (test.failed) row.failureExecutions++;
      m.set(key, row);
    }
  }
  return [...m.values()].filter((r) => r.failureExecutions >= 3).sort((a, b) => b.failureExecutions - a.failureExecutions);
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

/** Une registros equivalentes sem misturar origens ou motivos diferentes. */
export function groupFailureOccurrences<T extends { title: string; error: string; detail: string; dataSource: string; occurrences: number; firstSeen: string; firstOccurrence: string; lastOccurrence: string }>(rows: T[]): T[] {
  const groups = new Map<string, T>();
  const earlier = (a: string, b: string) => !a ? b : !b ? a : a < b ? a : b;
  const later = (a: string, b: string) => !a ? b : !b ? a : a > b ? a : b;
  for (const row of rows) {
    const key = JSON.stringify([row.dataSource, row.title, row.error, row.detail]);
    const previous = groups.get(key);
    if (!previous) groups.set(key, { ...row });
    else groups.set(key, { ...previous, occurrences: previous.occurrences + row.occurrences, firstSeen: earlier(previous.firstSeen, row.firstSeen), firstOccurrence: earlier(previous.firstOccurrence, row.firstOccurrence), lastOccurrence: later(previous.lastOccurrence, row.lastOccurrence) });
  }
  return [...groups.values()].sort((a, b) => b.occurrences - a.occurrences);
}

/** Groups definitive failures by source, scenario, error and detail. Each execution counts once. */
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
      const key = JSON.stringify([e.dataSource, r.title, r.error ?? "", r.detail ?? ""]);
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

function slope(ys: number[], weeks: number[]): number {
  const n = ys.length;
  const mx = weeks.reduce((sum, x) => sum + x, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  ys.forEach((y, i) => {
    num += (weeks[i]! - mx) * (y - my);
    den += (weeks[i]! - mx) ** 2;
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
  | { status: "beyond-horizon"; series: EvolutionPoint[]; currentGap: number; weeksRemaining: number }
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
  if (pts.length < MIN_POINTS_FOR_PROJECTION) return { status: "insufficient", series: pts, currentGap };
  const window = pts.slice(-8);
  const firstWeek = Date.parse(`${window[0]!.week}T00:00:00Z`);
  const weeks = window.map((p) => (Date.parse(`${p.week}T00:00:00Z`) - firstWeek) / (7 * 86_400_000));
  if (new Set(weeks).size < MIN_POINTS_FOR_PROJECTION || weeks.some((w) => !Number.isFinite(w))) return { status: "insufficient", series: pts, currentGap };
  const vp = slope(window.map((p) => p.productConditions), weeks);
  const va = slope(window.map((p) => p.automatedConditions), weeks);
  if (va <= vp || currentGap <= 0) {
    return { status: "no-parity", series: pts, currentGap, productVelocity: vp, automationVelocity: va };
  }
  const weeksRemaining = Math.ceil(currentGap / (va - vp));
  if (!Number.isFinite(weeksRemaining) || weeksRemaining > 520) return { status: "beyond-horizon", series: pts, currentGap, weeksRemaining };
  const series: EvolutionPoint[] = pts.map((p, i) =>
    i === pts.length - 1 ? { ...p, projectedAutomatedConditions: p.automatedConditions, projectedProductConditions: p.productConditions } : p,
  );
  for (let k = 1; k <= weeksRemaining; k++) {
    series.push({
      week: addWeeks(last.week, k),
      productConditions: null as unknown as number,
      automatedConditions: null as unknown as number,
      projectedAutomatedConditions: Math.round(last.automatedConditions + va * k),
      projectedProductConditions: Math.round(last.productConditions + vp * k),
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

// ---------- Extra chart datasets (catalog based on chart-type legend) ----------

/** Tests ranked by definitive failure occurrences (sum across errors). */
export function topFailingTests(rows: FailureRow[], n = 10): { title: string; value: number }[] {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.title, (m.get(r.title) ?? 0) + r.occurrences));
  return [...m.entries()].map(([title, value]) => ({ title, value })).sort((a, b) => b.value - a.value).slice(0, n);
}

/** Success rate per day (same rule as summarize). */
export function dailyRate(execs: Execution[]): { date: string; rate: number }[] {
  return dailyResults(execs).map((d) => {
    const total = d.passed + d.unstable + d.failed;
    return { date: d.date, rate: total ? Math.round(((d.passed + d.unstable) / total) * 10000) / 100 : 0 };
  });
}

/** Success rate per origin (trigger); origins without data are omitted. */
export function rateByOrigin(execs: Execution[]): { origin: Trigger; rate: number; total: number }[] {
  return (["scheduled", "post-merge", "manual"] as Trigger[])
    .map((origin) => {
      const s = summarize(execs.filter((e) => e.trigger === origin));
      return { origin, rate: s.rate == null ? -1 : Math.round(s.rate * 100) / 100, total: s.total };
    })
    .filter((r) => r.rate >= 0);
}

/** Per test: how many valid executions ran it vs how many ended flaky/failed. */
export function testStability(execs: Execution[]): { title: string; executions: number; problems: number }[] {
  const m = new Map<string, { title: string; executions: number; problems: number }>();
  for (const e of execs)
    for (const r of e.results) {
      const row = m.get(r.title) ?? { title: r.title, executions: 0, problems: 0 };
      row.executions++;
      if (r.status !== "passed") row.problems++;
      m.set(r.title, row);
    }
  return [...m.values()];
}

/** Weekday (0=Sun) x ISO week grid of definitive failures. */
export function failureHeatmap(execs: Execution[]): { week: string; day: number; failed: number; total: number }[] {
  const m = new Map<string, { week: string; day: number; failed: number; total: number }>();
  for (const e of execs) {
    const d = new Date(e.date + "T00:00:00Z");
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const week = monday.toISOString().slice(0, 10);
    const k = `${week}|${day}`;
    const c = m.get(k) ?? { week, day, failed: 0, total: 0 };
    for (const r of e.results) {
      c.total++;
      if (r.status === "failed") c.failed++;
    }
    m.set(k, c);
  }
  return [...m.values()];
}

/** Funnel: product conditions → automated → tests executed in period → tests without definitive failure. */
export function qualityFunnel(evo: EvolutionPoint[], execs: Execution[]): { stage: string; value: number }[] {
  const last = evo.filter((p) => p.productConditions > 0).at(-1);
  const titles = new Set<string>();
  const failed = new Set<string>();
  execs.forEach((e) => e.results.forEach((r) => { titles.add(r.title); if (r.status === "failed") failed.add(r.title); }));
  return [
    { stage: "Condições do produto", value: last?.productConditions ?? 0 },
    { stage: "Condições automatizadas", value: last?.automatedConditions ?? 0 },
    { stage: "Testes executados", value: titles.size },
    { stage: "Testes sem falha definitiva", value: titles.size - failed.size },
  ];
}

/** Waterfall of automated conditions: start value + weekly increments. */
export function coverageWaterfall(evo: EvolutionPoint[]): { label: string; base: number; delta: number; end: number }[] {
  const pts = evo.filter((p) => p.productConditions > 0);
  if (!pts.length) return [];
  const out = [{ label: pts[0]!.week, base: 0, delta: pts[0]!.automatedConditions, end: pts[0]!.automatedConditions }];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!.automatedConditions, cur = pts[i]!.automatedConditions;
    out.push({ label: pts[i]!.week, base: Math.min(prev, cur), delta: cur - prev, end: cur });
  }
  return out;
}
