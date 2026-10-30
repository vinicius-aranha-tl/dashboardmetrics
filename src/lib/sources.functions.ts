import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mockEvolution, mockExecutions } from "@/data/mock";
import type { EvolutionPoint, Execution, Product } from "@/lib/metrics";

export const executionSchema = z.object({
  id: z.string(),
  product: z.enum(["api", "ui"]).optional(),
  triggerId: z.string(),
  runAttempt: z.number().int().min(1),
  trigger: z.enum(["scheduled", "post-merge", "manual"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataSource: z.string().optional(),
  results: z.array(
    z.object({
      title: z.string(),
      status: z.enum(["passed", "failed", "flaky"]),
      error: z.string().optional(),
      detail: z.string().optional(),
      cause: z.string().optional(),
    }),
  ),
});
export const evolutionSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  productConditions: z.number(),
  automatedConditions: z.number(),
  projectedAutomatedConditions: z.number().nullable().optional(),
});

export type SourceKind = "executions" | "evolution";
export interface SourceStatus {
  mode: "github" | "demo" | "error";
  url: string | null;
  message?: string;
  records?: number;
}

const ALLOWED_HOSTS = ["raw.githubusercontent.com", "api.github.com"];

/** Fetches JSON from GitHub on the server with GITHUB_TOKEN (never sent to the browser). */
async function fetchGithub(url: string): Promise<unknown> {
  const u = new URL(url);
  if (!ALLOWED_HOSTS.includes(u.hostname)) throw new Error(`Host não permitido (${u.hostname}). Use raw.githubusercontent.com ou api.github.com.`);
  const token = process.env["GITHUB_TOKEN"];
  const res = await fetch(u, {
    headers: {
      Accept: u.hostname === "api.github.com" ? "application/vnd.github.raw+json" : "application/json",
      "User-Agent": "dashboard-metrics-for-qa",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const hint = res.status === 404 && !token ? " — repositório privado? Configure o GITHUB_TOKEN." : res.status === 401 ? " — token inválido ou expirado." : "";
    throw new Error(`GitHub respondeu ${res.status}${hint}`);
  }
  return res.json();
}

async function readSource(url: string | null, kind: SourceKind) {
  if (!url) return { status: { mode: "demo", url: null } as SourceStatus, data: null };
  try {
    const raw = await fetchGithub(url);
    const parsed = z.array(kind === "executions" ? executionSchema : evolutionSchema).safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { status: { mode: "error", url, message: `Formato inválido em [${issue?.path.join(".")}]: ${issue?.message}` } as SourceStatus, data: null };
    }
    return { status: { mode: "github", url, records: parsed.data.length } as SourceStatus, data: parsed.data };
  } catch (e) {
    return { status: { mode: "error", url, message: (e as Error).message } as SourceStatus, data: null };
  }
}

export interface ProjectData {
  project: { id: string; name: string; slug: string };
  sources: Record<Product, Record<SourceKind, SourceStatus>>;
  executions: Execution[];
  evolution: Record<Product, EvolutionPoint[]>;
}

/** Loads dashboard data for one project (by slug) or all projects. Missing URL → demo data; failure → error, never silent mock. */
export const loadDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("projects").select("*").order("name");
    if (data.slug) q = q.eq("slug", data.slug);
    const { data: projects, error } = await q;
    if (error) throw new Error(error.message);
    const out: ProjectData[] = [];
    for (const p of projects ?? []) {
      const urls = {
        api: { executions: p.api_executions_url, evolution: p.api_evolution_url },
        ui: { executions: p.ui_executions_url, evolution: p.ui_evolution_url },
      };
      const sources = {} as ProjectData["sources"];
      const executions: Execution[] = [];
      const evolution = {} as ProjectData["evolution"];
      for (const product of ["api", "ui"] as const) {
        const [ex, ev] = await Promise.all([readSource(urls[product].executions, "executions"), readSource(urls[product].evolution, "evolution")]);
        sources[product] = { executions: ex.status, evolution: ev.status };
        const exData =
          ex.status.mode === "demo"
            ? mockExecutions(p, product)
            : ((ex.data ?? []) as z.infer<typeof executionSchema>[]).map((e) => ({
                ...e,
                product,
                triggerId: `${p.id}-${e.triggerId}`,
                dataSource: `${p.name} · ${product.toUpperCase()}`,
              }));
        executions.push(...(exData as Execution[]));
        evolution[product] =
          ev.status.mode === "demo"
            ? mockEvolution(p, product)
            : ((ev.data ?? []) as z.infer<typeof evolutionSchema>[]).map((e) => ({ ...e, projectedAutomatedConditions: null }));
      }
      out.push({ project: { id: p.id, name: p.name, slug: p.slug }, sources, executions, evolution });
    }
    return out;
  });

/** Tests a single source URL and reports what the platform would read. */
export const testSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url(), kind: z.enum(["executions", "evolution"]) }).parse(d))
  .handler(async ({ data }) => {
    const r = await readSource(data.url, data.kind);
    return { ...r.status, tokenConfigured: Boolean(process.env["GITHUB_TOKEN"]) };
  });
