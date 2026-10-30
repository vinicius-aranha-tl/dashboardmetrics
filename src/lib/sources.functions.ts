import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mockEvolution, mockExecutions } from "@/data/mock";
import type { EvolutionPoint, Execution, Product } from "@/lib/metrics";
import { countRecords, decodeGithubContent, EVOLUTION_FILE, EXECUTIONS_FILE, FormatError, normalizeEvolution, normalizeExecutions, SQUAREDUP_FILES } from "@/lib/normalize";

export type SourceKind = "executions" | "evolution";
export interface SourceStatus {
  mode: "github" | "demo" | "error";
  url: string | null;
  message?: string;
  records?: number;
}

const ALLOWED_HOSTS = ["raw.githubusercontent.com", "api.github.com"];
const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const nameRe = /^[A-Za-z0-9_.-]{1,100}$/;

/** Fetches JSON from GitHub on the server with GITHUB_TOKEN (never sent to the browser). Cached 5 min. */
async function fetchGithub(url: string, force = false): Promise<unknown> {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.value;
  const u = new URL(url);
  if (!ALLOWED_HOSTS.includes(u.hostname)) throw new Error(`Host não permitido (${u.hostname}).`);
  const token = process.env["GITHUB_TOKEN"];
  const res = await fetch(u, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "dashboard-metrics-for-qa",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const hint = res.status === 404 ? (token ? " — arquivo, branch ou repositório não encontrado (ou token sem acesso)." : " — repositório privado? Configure o GITHUB_TOKEN.") : res.status === 401 ? " — token inválido ou expirado." : res.status === 403 ? " — sem permissão ou limite de uso do GitHub." : "";
    throw new Error(`GitHub respondeu ${res.status}${hint}`);
  }
  const value = decodeGithubContent(await res.json());
  cache.set(url, { at: Date.now(), value });
  return value;
}

export function contentsUrl(owner: string, repo: string, branch: string, file: string) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/squaredup/${file}?ref=${encodeURIComponent(branch)}`;
}

async function readSource<T>(url: string | null, normalize: (raw: unknown) => T[], force: boolean) {
  if (!url) return { status: { mode: "demo", url: null } as SourceStatus, data: null };
  try {
    const data = normalize(await fetchGithub(url, force));
    return { status: { mode: "github", url, records: data.length } as SourceStatus, data };
  } catch (e) {
    const msg = e instanceof FormatError ? `Formato não reconhecido: ${e.message}` : (e as Error).message;
    return { status: { mode: "error", url, message: msg } as SourceStatus, data: null };
  }
}

export interface ProjectData {
  project: { id: string; name: string; slug: string };
  sources: Record<Product, Record<SourceKind, SourceStatus>>;
  executions: Execution[];
  evolution: Record<Product, EvolutionPoint[]>;
  fetchedAt: string;
}

/** Loads dashboard data for one project (by slug) or all projects. Missing config → demo data; failure → error, never silent mock. */
export const loadDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().nullable(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const force = Boolean(data.force);
    let q = context.supabase.from("projects").select("*").order("name");
    if (data.slug) q = q.eq("slug", data.slug);
    const { data: projects, error } = await q;
    if (error) throw new Error(error.message);
    const out: ProjectData[] = [];
    for (const p of projects ?? []) {
      const repo = {
        api: p.api_repo_owner && p.api_repo_name ? { owner: p.api_repo_owner, name: p.api_repo_name, branch: p.api_branch } : null,
        ui: p.ui_repo_owner && p.ui_repo_name ? { owner: p.ui_repo_owner, name: p.ui_repo_name, branch: p.ui_branch } : null,
      };
      const legacy = {
        api: { executions: p.api_executions_url, evolution: p.api_evolution_url },
        ui: { executions: p.ui_executions_url, evolution: p.ui_evolution_url },
      };
      const sources = {} as ProjectData["sources"];
      const executions: Execution[] = [];
      const evolution = {} as ProjectData["evolution"];
      for (const product of ["api", "ui"] as const) {
        const r = repo[product];
        const evoFile = EVOLUTION_FILE[product];
        const exUrl = r ? contentsUrl(r.owner, r.name, r.branch, EXECUTIONS_FILE) : legacy[product].executions;
        const evUrl = r ? (evoFile ? contentsUrl(r.owner, r.name, r.branch, evoFile) : null) : legacy[product].evolution;
        const [ex, ev] = await Promise.all([
          readSource(exUrl, (raw) => normalizeExecutions(raw, product), force),
          readSource(evUrl, normalizeEvolution, force),
        ]);
        sources[product] = { executions: ex.status, evolution: ev.status };
        const exData = ex.status.mode === "demo"
          ? mockExecutions(p, product)
          : (ex.data ?? []).map((e) => ({ ...e, product, triggerId: `${p.id}-${e.triggerId}`, dataSource: `${p.name} · ${product.toUpperCase()}` }));
        executions.push(...exData);
        evolution[product] = ev.status.mode === "demo" ? mockEvolution(p, product) : (ev.data ?? []);
      }
      const errors = (["api", "ui"] as const).flatMap((pr) => (["executions", "evolution"] as const).filter((k) => sources[pr][k].mode === "error").map((k) => `${pr.toUpperCase()} ${k}: ${sources[pr][k].message}`));
      const anyReal = (["api", "ui"] as const).some((pr) => sources[pr].executions.mode !== "demo" || sources[pr].evolution.mode !== "demo");
      if (anyReal) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("projects").update({ last_synced_at: new Date().toISOString(), last_sync_error: errors.join(" | ") || null }).eq("id", p.id);
      }
      out.push({ project: { id: p.id, name: p.name, slug: p.slug }, sources, executions, evolution, fetchedAt: new Date().toISOString() });
    }
    return out;
  });

export interface FileCheck { file: string; ok: boolean; records: number | null; updatedAt: string | null; expected: boolean; message?: string }

/** Lists every file in squaredup/ and reads each one, reporting status, records and updatedAt. */
export const testRepo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    owner: z.string().regex(nameRe), repo: z.string().regex(nameRe), branch: z.string().min(1).max(100).regex(/^[A-Za-z0-9_./-]+$/), product: z.enum(["api", "ui"]),
  }).parse(d))
  .handler(async ({ data }) => {
    const tokenConfigured = Boolean(process.env["GITHUB_TOKEN"]);
    const dirUrl = `https://api.github.com/repos/${encodeURIComponent(data.owner)}/${encodeURIComponent(data.repo)}/contents/squaredup?ref=${encodeURIComponent(data.branch)}`;
    let names: string[];
    try {
      const dir = await fetchGithub(dirUrl, true);
      if (!Array.isArray(dir)) throw new Error("squaredup/ não é uma pasta");
      names = dir.filter((f) => f && f.type === "file" && String(f.name).endsWith(".json")).map((f) => String(f.name));
    } catch (e) {
      return { files: [] as FileCheck[], tokenConfigured, error: `Não foi possível listar squaredup/: ${(e as Error).message}` };
    }
    const expected = SQUAREDUP_FILES[data.product];
    const all = [...new Set([...expected, ...names])];
    const files: FileCheck[] = await Promise.all(all.map(async (file) => {
      const isExpected = expected.includes(file);
      if (!names.includes(file)) return { file, ok: false, records: null, updatedAt: null, expected: isExpected, message: "Arquivo não publicado na pasta." };
      try {
        const raw = await fetchGithub(contentsUrl(data.owner, data.repo, data.branch, file), true);
        let records = countRecords(raw);
        if (file === EXECUTIONS_FILE) records = normalizeExecutions(raw, data.product).length;
        if (file === EVOLUTION_FILE[data.product]) records = normalizeEvolution(raw).length;
        const up = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>)["updatedAt"] : null;
        return { file, ok: true, records, updatedAt: typeof up === "string" ? up : null, expected: isExpected };
      } catch (e) {
        const msg = e instanceof FormatError ? `Formato não reconhecido: ${e.message}` : (e as Error).message;
        return { file, ok: false, records: null, updatedAt: null, expected: isExpected, message: msg };
      }
    }));
    return { files, tokenConfigured, error: null as string | null };
  });
