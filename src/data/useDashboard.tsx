import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { dedupeExecutions, filterExecutions, type Product, type Trigger } from "@/lib/metrics";
import { loadDataset } from "./sources";

export type PeriodKey = "7" | "30" | "90" | "all";
export const PERIOD_LABEL: Record<PeriodKey, string> = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias", all: "Todo o histórico" };
export const ORIGIN_LABEL: Record<Trigger, string> = { scheduled: "Agendada", "post-merge": "Pós-merge", manual: "Manual" };

interface Filters {
  product: "all" | Product;
  period: PeriodKey;
  origins: Trigger[];
}

const Ctx = createContext<{ filters: Filters; setFilters: (f: Filters) => void } | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({ product: "all", period: "30", origins: ["scheduled", "post-merge", "manual"] });
  return <Ctx.Provider value={{ filters, setFilters }}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const c = useContext(Ctx);
  if (!c) throw new Error("FiltersProvider ausente");
  return c;
}

export const datasetQuery = { queryKey: ["dataset"], queryFn: loadDataset, staleTime: 5 * 60_000 };

export function useDashboard() {
  const { filters } = useFilters();
  const q = useQuery(datasetQuery);
  const derived = useMemo(() => {
    if (!q.data) return null;
    const now = new Date();
    const valid = dedupeExecutions(q.data.executions);
    const base = { product: filters.product, origins: filters.origins, now };
    return {
      valid,
      inPeriod: filterExecutions(valid, { ...base, periodDays: filters.period === "all" ? null : Number(filters.period) }),
      allHistory: filterExecutions(valid, { ...base, periodDays: null }),
      evolution: q.data.evolution,
      mode: q.data.mode,
      periodDays: filters.period === "all" ? null : Number(filters.period),
    };
  }, [q.data, filters]);
  return { ...q, filters, d: derived, periodLabel: PERIOD_LABEL[filters.period] };
}
