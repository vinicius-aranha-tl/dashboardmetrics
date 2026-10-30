import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aggregateEvolution, dedupeExecutions, filterExecutions, type Product, type Trigger } from "@/lib/metrics";
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

/** Data for one project (slug) or all projects (null), already deduped and filtered for one product. */
export function useDashboardData(slug: string | null, product: Product) {
  const { filters } = useFilters();
  const load = useServerFn(loadDashboardData);
  const q = useQuery({ queryKey: ["dataset", slug], queryFn: () => load({ data: { slug } }), staleTime: 5 * 60_000 });
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
    };
  }, [q.data, filters, product]);
  return { ...q, d, periodLabel: PERIOD_LABEL[filters.period] };
}

export type DashData = NonNullable<ReturnType<typeof useDashboardData>["d"]>;
