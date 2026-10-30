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

/** Normalizes a history file into executions. Throws FormatError naming the first invalid field. */
export function normalizeExecutions(raw: unknown, product: Product): Execution[] {
  const list = extractList(raw, ["executions", "runs", "history", "items", "data"]);
  if (!list) throw new FormatError("lista de execuções não encontrada (esperado array ou campo executions/runs/history)");
  return list.map((item, i) => {
    if (!isObj(item)) throw new FormatError(`[${i}] não é um objeto`);
    const date = toDate(pick(item, ["date", "startedAt", "started_at", "createdAt", "created_at", "timestamp"]));
    if (!date) throw new FormatError(`[${i}].date ausente ou inválida`);
    const id = String(pick(item, ["id", "runId", "run_id"]) ?? `${date}-${i}`);
    const attempt = Number(pick(item, ["runAttempt", "run_attempt", "attempt"]) ?? 1);
    const triggerId = String(pick(item, ["triggerId", "trigger_id", "runId", "run_id", "id"]) ?? id);
    const testsRaw = pick(item, ["results", "tests", "testResults"]);
    if (!Array.isArray(testsRaw)) throw new FormatError(`[${i}].results ausente (lista de testes)`);
    const results: TestResult[] = testsRaw.map((t, j) => {
      if (!isObj(t)) throw new FormatError(`[${i}].results[${j}] não é um objeto`);
      const title = pick(t, ["title", "name", "test"]);
      const status = toStatus(pick(t, ["status", "outcome", "result"]));
      if (typeof title !== "string") throw new FormatError(`[${i}].results[${j}].title ausente`);
      if (!status) throw new FormatError(`[${i}].results[${j}].status desconhecido`);
      const str = (k: string[]) => { const v = pick(t, k); return v == null ? undefined : String(v); };
      return { title, status, error: str(["error", "message"]), detail: str(["detail", "details", "stack"]), cause: str(["cause", "reason", "category"]) };
    });
    return { id, product, triggerId, runAttempt: Number.isFinite(attempt) && attempt >= 1 ? attempt : 1, trigger: toTrigger(pick(item, ["trigger", "event", "origin"])), date, results };
  });
}

/** Normalizes a weekly evolution file. */
export function normalizeEvolution(raw: unknown): EvolutionPoint[] {
  const list = extractList(raw, ["weeks", "evolution", "history", "items", "data"]);
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
