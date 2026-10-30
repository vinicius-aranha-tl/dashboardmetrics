import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/data/useDashboard";
import { computeProjection, dailyResults, summarize, testCount, type Product } from "@/lib/metrics";
import { DailyChart, EvolutionChart, Gauge } from "./charts";
import { EmptyState, PageTitle, Panel, StatCard, fmtDate, fmtInt, fmtPct } from "./primitives";

export const RATE_INFO = "Taxa = (aprovados + flaky) ÷ total de resultados. Flaky terminou aprovado após retry interno e não reduz o sucesso. Falha = teste que falhou definitivamente. Reruns da mesma Action são ignorados; só conta a primeira tentativa de cada gatilho. Verde ≥ 90%, amarelo 80–89,99%, vermelho < 80%.";

export function DataGate({ children }: { children: (d: NonNullable<ReturnType<typeof useDashboard>["d"]>) => ReactNode }) {
  const { d, error, isLoading } = useDashboard();
  if (error) return <EmptyState>Não foi possível carregar os dados: {String((error as Error).message)}</EmptyState>;
  if (isLoading || !d)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  return <>{children(d)}</>;
}

export function ProjectionSummary({ projection }: { projection: ReturnType<typeof computeProjection> }) {
  if (projection.status === "empty") return null;
  const gap = (
    <div><div className="text-xs text-muted-foreground">Diferença atual</div><div className="font-mono text-lg">{fmtInt(projection.currentGap)}</div></div>
  );
  if (projection.status === "insufficient")
    return <div className="mt-4 flex flex-wrap items-center gap-6 rounded-lg border border-dashed border-border p-3 text-sm"><span className="text-warning">Histórico insuficiente para calcular a projeção</span>{gap}</div>;
  if (projection.status === "no-parity")
    return <div className="mt-4 flex flex-wrap items-center gap-6 rounded-lg border border-dashed border-border p-3 text-sm"><span className="text-warning">Na velocidade atual, não há previsão de paridade.</span>{gap}</div>;
  return (
    <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg border border-projection/40 bg-projection/10 p-3">
      <div><div className="text-xs text-muted-foreground">Semana estimada de paridade</div><div className="font-mono text-lg text-projection">{fmtDate(projection.parityWeek)}</div></div>
      <div><div className="text-xs text-muted-foreground">Semanas restantes</div><div className="font-mono text-lg">{projection.weeksRemaining}</div></div>
      {gap}
    </div>
  );
}

export const PROJECTION_INFO = "Velocidade = inclinação (regressão linear) das últimas até 8 semanas. A projeção só é desenhada quando a automação cresce mais rápido que o produto e há pelo menos 3 semanas de histórico. Semanas restantes = diferença atual ÷ (velocidade automação − velocidade produto).";

export function filterWeeks<T extends { week: string }>(pts: T[], periodDays: number | null): T[] {
  if (periodDays == null) return pts;
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - periodDays);
  const iso = from.toISOString().slice(0, 10);
  return pts.filter((p) => p.week >= iso);
}

export function ProductPage({ product }: { product: Product }) {
  const { periodLabel } = useDashboard();
  const name = product === "api" ? "API" : "UI";
  return (
    <>
      <PageTitle title={`Testes ${name}`} subtitle={`Indicadores da automação ${name} — ${periodLabel.toLowerCase()}`} />
      <DataGate>
        {(d) => {
          const execs = d.inPeriod.filter((e) => e.product === product);
          const s = summarize(execs);
          const proj = computeProjection(filterWeeks(d.evolution[product], d.periodDays));
          return (
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Panel title={`Taxa de sucesso ${name}`} info={RATE_INFO}><Gauge rate={s.rate} label={periodLabel} /></Panel>
                <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                  <StatCard label="Testes" value={fmtInt(testCount(d.valid, product))} hint="Testes distintos conhecidos" />
                  <StatCard label="Execuções válidas" value={fmtInt(execs.length)} hint="Reruns ignorados" />
                  <StatCard label="Falhas definitivas" value={fmtInt(s.failed)} tone={s.failed ? "danger" : "success"} />
                  <StatCard label="Flaky" value={fmtInt(s.flaky)} tone={s.flaky ? "warning" : "success"} />
                </div>
              </div>
              <Panel title="Resultados diários" info="Soma dos resultados por dia considerando apenas a primeira tentativa de cada gatilho."><DailyChart data={dailyResults(execs)} /></Panel>
              <Panel title={`Evolução do produto versus automação ${name}`} info={PROJECTION_INFO}>
                <EvolutionChart projection={proj} />
                <ProjectionSummary projection={proj} />
                {proj.status !== "empty" && proj.series.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Cobertura atual: {fmtPct((proj.series.filter((p) => p.automatedConditions != null).at(-1)!.automatedConditions / proj.series.filter((p) => p.productConditions != null).at(-1)!.productConditions) * 100)}
                  </p>
                )}
              </Panel>
            </div>
          );
        }}
      </DataGate>
    </>
  );
}
