import type { EvolutionPoint, Execution, Product, TestResult, Trigger } from "@/lib/metrics";

/** Files published by the automations under squaredup/ on the metrics branch. */
export const SQUAREDUP_FILES: Record<Product, string[]> = {
  api: [
    "latest.json", "history.json", "test-history.json", "test-stability-30d.json", "execution-trend-30d.json",
    "period-comparison.json", "failure-reasons-30d.json", "failure-lifecycle.json",
    "api-swagger-coverage-current.json", "api-swagger-coverage-history.json", "api-automation-evolution.json",
  ],
  ui: [
    "latest.json", "history.json", "test-history.json", "test-stability-30d.json", "execution-trend-30d.json",
    "period-comparison.json", "failure-reasons-30d.json", "failure-lifecycle.json",
  ],
};
/** Which file feeds executions and weekly evolution. */
export const EXECUTIONS_FILE = "history.json";
export const EVOLUTION_FILE: Record<Product, string | null> = { api: "api-automation-evolution.json", ui: null };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const pick = (o: Obj, keys: string[]) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };

/** Decodes a GitHub Contents API body (base64 in `content`) or passes raw JSON through. */
export function decodeGithubContent(body: unknown): unknown {
  if (isObj(body) && typeof body["content"] === "string" && body["encoding"] === "base64") {
    const bin = atob((body["content"] as string).replace(/\n/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  return body;
}

/** Finds the main list in a file: the array itself, or the first array under common keys. */
export function extractList(raw: unknown, keys: string[]): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!isObj(raw)) return null;
  for (const k of keys) if (Array.isArray(raw[k])) return raw[k] as unknown[];
  return null;
}

export function countRecords(raw: unknown): number | null {
  if (Array.isArray(raw)) return raw.length;
  if (isObj(raw)) { for (const v of Object.values(raw)) if (Array.isArray(v)) return v.length; return Object.keys(raw).length; }
  return null;
}

function toDate(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toStatus(v: unknown): TestResult["status"] | null {
  const s = String(v ?? "").toLowerCase();
  if (["passed", "pass", "success", "ok"].includes(s)) return "passed";
  if (["failed", "fail", "failure", "error", "broken"].includes(s)) return "failed";
  if (["flaky", "unstable", "retried"].includes(s)) return "flaky";
  return null;
}

function toTrigger(v: unknown): Trigger {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("merge") || s === "push" || s === "pull_request") return "post-merge";
  if (s.includes("manual") || s === "workflow_dispatch") return "manual";
  return "scheduled";
}

export class FormatError extends Error {}

function readTest(t: unknown, where: string): TestResult {
  if (!isObj(t)) throw new FormatError(`${where} não é um objeto`);
  const title = pick(t, ["title", "name", "test"]);
  const status = toStatus(pick(t, ["status", "outcome", "result"]));
  if (typeof title !== "string") throw new FormatError(`${where}.title ausente`);
  if (!status) throw new FormatError(`${where}.status desconhecido`);
  const str = (k: string[]) => { const v = pick(t, k); return v == null ? undefined : String(v); };
  const r: TestResult = { title, status };
  const error = str(["error", "message"]), detail = str(["detail", "details", "stack"]), cause = str(["cause", "reason", "category"]);
  if (error) r.error = error;
  if (detail) r.detail = detail;
  if (cause) r.cause = cause;
  return r;
}

/** Per-test list when published; otherwise rebuilt from the summary counts (tests.passed/failed/flaky). */
function readResults(item: Obj, i: number): TestResult[] {
  for (const key of ["results", "testResults"]) {
    const list = item[key];
    if (Array.isArray(list) && list.length) return list.map((t, j) => readTest(t, `[${i}].${key}[${j}]`));
  }
  const sum = isObj(item["tests"]) ? (item["tests"] as Obj) : null;
  if (Array.isArray(item["tests"])) return (item["tests"] as unknown[]).map((t, j) => readTest(t, `[${i}].tests[${j}]`));
  if (!sum) throw new FormatError(`[${i}].tests ausente (resumo ou lista de testes)`);
  if (sum["available"] === false) return [];
  const n = (k: string) => { const v = Number(sum[k] ?? 0); return Number.isFinite(v) ? v : 0; };
  const failed = n("failed") + n("errors");
  const flakyList = Array.isArray(item["flakyTests"]) ? (item["flakyTests"] as unknown[]) : [];
  const flakyTitles = flakyList.map((f, k) => (isObj(f) ? String(pick(f, ["title", "name"]) ?? `Teste instável ${k + 1}`) : String(f)));
  const flaky = Math.max(n("flaky"), flakyTitles.length);
  const total = Math.max(n("total"), n("passed") + failed + flaky);
  const out: TestResult[] = [];
  for (let k = 0; k < flaky; k++) out.push({ title: flakyTitles[k] ?? `Teste instável ${k + 1}`, status: "flaky" });
  for (let k = 0; k < failed; k++) out.push({ title: `Falha sem detalhe ${k + 1}`, status: "failed", cause: "Sem detalhe publicado" });
  for (let k = out.length; k < total; k++) out.push({ title: `Teste ${k + 1}`, status: "passed" });
  return out;
}

/** Normalizes a history file into executions. Throws FormatError naming the first invalid field. */
export function normalizeExecutions(raw: unknown, product: Product): Execution[] {
  const list = extractList(raw, ["executions", "runs", "history", "items", "data"]);
  if (!list) throw new FormatError("lista de execuções não encontrada (esperado array ou campo executions/runs/history)");
  return list.map((item, i) => {
    if (!isObj(item)) throw new FormatError(`[${i}] não é um objeto`);
    const run = isObj(item["run"]) ? (item["run"] as Obj) : {};
    const date = toDate(pick(item, ["date", "generatedAt", "startedAt", "started_at", "createdAt", "created_at", "timestamp"]));
    if (!date) throw new FormatError(`[${i}].date/generatedAt ausente ou inválida`);
    const id = String(pick(run, ["id"]) ?? pick(item, ["id", "runId", "run_id"]) ?? `${date}-${i}`);
    const attempt = Number(pick(run, ["attempt"]) ?? pick(item, ["runAttempt", "run_attempt", "attempt"]) ?? 1);
    const triggerId = String(pick(item, ["triggerId", "trigger_id"]) ?? id);
    const trigger = toTrigger(pick(run, ["event"]) ?? pick(item, ["trigger", "event", "origin"]));
    const results = readResults(item, i);
    return { id, product, triggerId, runAttempt: Number.isFinite(attempt) && attempt >= 1 ? attempt : 1, trigger, date, results, dataSource: String(pick(item, ["dataSource", "data_source", "workflow"]) ?? product.toUpperCase()) };
  });
}

/** Normalizes a weekly evolution file. */
export function normalizeEvolution(raw: unknown): EvolutionPoint[] {
  const list = extractList(raw, ["points", "weeks", "evolution", "history", "items", "data"]);
  if (!list) throw new FormatError("lista semanal não encontrada (esperado array ou campo weeks/evolution/history)");
  return list.map((item, i) => {
    if (!isObj(item)) throw new FormatError(`[${i}] não é um objeto`);
    const week = toDate(pick(item, ["week", "date", "weekEnd", "week_end"]));
    const p = Number(pick(item, ["productConditions", "product_conditions", "product", "total"]));
    const a = Number(pick(item, ["automatedConditions", "automated_conditions", "automated", "covered"]));
    if (!week) throw new FormatError(`[${i}].week ausente ou inválida`);
    if (!Number.isFinite(p)) throw new FormatError(`[${i}].productConditions não numérico`);
    if (!Number.isFinite(a)) throw new FormatError(`[${i}].automatedConditions não numérico`);
    return { week, productConditions: p, automatedConditions: a, projectedAutomatedConditions: null };
  });
}
