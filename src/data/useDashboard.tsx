import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aggregateEvolution, dedupeExecutions, failureRows, filterExecutions, flakyTable, causeDistribution, type Product, type Trigger } from "@/lib/metrics";
import type { ReasonRow, SpecialFailureRow, StabilityRow } from "@/lib/normalize";
import type { ProjectData } from "@/lib/sources.functions";
import { loadDashboardData } from "@/lib/sources.functions";

export type PeriodKey = "7" | "30" | "90" | "all";
export const PERIOD_LABEL: Record<PeriodKey, string> = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias", all: "Todo o histórico" };
export const ORIGIN_LABEL: Record<Trigger, string> = { scheduled: "Agendada", "post-merge": "Pós-merge", manual: "Manual" };

interface Filters {
  period: PeriodKey;
  origins: Trigger[];
}

const Ctx = createContext<{ filters: Filters; setFilters: (f: Filters) => void } | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({ period: "30", origins: ["scheduled", "post-merge", "manual"] });
  return <Ctx.Provider value={{ filters, setFilters }}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const c = useContext(Ctx);
  if (!c) throw new Error("FiltersProvider ausente");
  return c;
}

/** "Atualizar dados" bypasses the 5-min server cache on the next loads (window of a few seconds). */
let forceUntil = 0;
export function requestForcedRefresh() {
  forceUntil = Date.now() + 5000;
}

/** Data for one project (slug) or all projects (null), already deduped and filtered for one product. */
export function useDashboardData(slug: string | null, product: Product) {
  const { filters } = useFilters();
  const load = useServerFn(loadDashboardData);
  const q = useQuery({ queryKey: ["dataset", slug], queryFn: () => load({ data: { slug, force: Date.now() < forceUntil } }), staleTime: 5 * 60_000 });
  const d = useMemo(() => {
    if (!q.data) return null;
    const now = new Date();
    const all = q.data.flatMap((p) => p.executions);
    const valid = dedupeExecutions(all).filter((e) => e.product === product);
    const periodDays = filters.period === "all" ? null : Number(filters.period);
    const base = { product, origins: filters.origins, now };
    return {
      projects: q.data,
      valid,
      inPeriod: filterExecutions(valid, { ...base, periodDays }),
      allHistory: filterExecutions(valid, { ...base, periodDays: null }),
      evolution: aggregateEvolution(q.data.map((p) => p.evolution[product])),
      periodDays,
      special: buildSpecial(q.data, now),
    };
  }, [q.data, filters, product]);
  return { ...q, d, periodLabel: PERIOD_LABEL[filters.period] };
}

export type DashData = NonNullable<ReturnType<typeof useDashboardData>["d"]>;

/** Where a specialized panel's rows came from, per product. */
export interface SourceUse { product: Product; file: string; fallback: boolean; reason?: string | undefined }
export interface SpecialData {
  flaky: { rows: StabilityRow[]; used: SourceUse[] };
  failures: { rows: SpecialFailureRow[]; used: SourceUse[] };
  reasons: { rows: ReasonRow[]; used: SourceUse[] };
  lifecycle: { rows: SpecialFailureRow[]; used: SourceUse[] };
}

/** API + UI grouped. Specialized file is primary; history.json only when the file is missing/failed (demo projects use their demo history). */
export function buildSpecial(projects: ProjectData[], now: Date): SpecialData {
  const out: SpecialData = { flaky: { rows: [], used: [] }, failures: { rows: [], used: [] }, reasons: { rows: [], used: [] }, lifecycle: { rows: [], used: [] } };
  const origins: Trigger[] = ["scheduled", "post-merge", "manual"];
  const use = (list: SourceUse[], u: SourceUse) => { if (!list.some((x) => x.product === u.product && x.file === u.file && x.fallback === u.fallback)) list.push(u); };
  for (const p of projects)
    for (const product of ["api", "ui"] as const) {
      const sp = p.special?.[product];
      const mine = dedupeExecutions(p.executions).filter((e) => e.product === product);
      const d30 = filterExecutions(mine, { product, origins, periodDays: 30, now });
      const reason = (s?: { status: { mode: string; message?: string } }) => (s?.status.mode === "error" ? s.status.message : s?.status.mode === "demo" ? "fonte não configurada (demonstração)" : undefined);
      const fb = (f: SpecialData[keyof SpecialData]["used"], s: { status: { mode: string; message?: string } } | undefined) => use(f, { product, file: "history.json", fallback: true, reason: reason(s) });

      if (sp?.stability.data) { out.flaky.rows.push(...sp.stability.data); use(out.flaky.used, { product, file: sp.stability.file, fallback: false }); }
      else { out.flaky.rows.push(...flakyTable(d30).map((r) => ({ ...r, successRate: r.executions ? Math.round(((r.executions - r.failureExecutions) / r.executions) * 10000) / 100 : null }))); fb(out.flaky.used, sp?.stability); }

      if (sp?.reasons.data) {
        out.failures.rows.push(...sp.reasons.data.failures); out.reasons.rows.push(...sp.reasons.data.reasons);
        use(out.failures.used, { product, file: sp.reasons.file, fallback: false }); use(out.reasons.used, { product, file: sp.reasons.file, fallback: false });
      } else {
        const rows = failureRows(d30); out.failures.rows.push(...rows); out.reasons.rows.push(...causeDistribution(rows));
        fb(out.failures.used, sp?.reasons); fb(out.reasons.used, sp?.reasons);
      }

      if (sp?.lifecycle.data) { out.lifecycle.rows.push(...sp.lifecycle.data); use(out.lifecycle.used, { product, file: sp.lifecycle.file, fallback: false }); }
      else { out.lifecycle.rows.push(...failureRows(filterExecutions(mine, { product, origins, periodDays: null, now }))); fb(out.lifecycle.used, sp?.lifecycle); }
    }
  const merged = new Map<string, number>();
  out.reasons.rows.forEach((r) => merged.set(r.cause, (merged.get(r.cause) ?? 0) + r.value));
  out.reasons.rows = [...merged.entries()].map(([cause, value]) => ({ cause, value })).sort((a, b) => b.value - a.value);
  out.lifecycle.rows.sort((a, b) => b.occurrences - a.occurrences);
  return out;
}
