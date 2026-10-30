import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "@/components/dash/charts";
import { DataGate, RATE_INFO } from "@/components/dash/pages";
import { PageTitle, Panel, StatCard, fmtInt } from "@/components/dash/primitives";
import { useDashboard } from "@/data/useDashboard";
import { summarize, testCount } from "@/lib/metrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Automação Recomenda" },
      { name: "description", content: "Taxa de sucesso, falhas e flaky tests da automação API e UI do Recomenda." },
      { property: "og:title", content: "Visão geral — Automação Recomenda" },
      { property: "og:description", content: "Indicadores executivos da automação de testes do Recomenda." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { periodLabel, filters } = useDashboard();
  return (
    <>
      <PageTitle title="Visão Geral da Automação — Recomenda" subtitle="Indicadores executivos dos testes API e UI" />
      <DataGate>
        {(d) => {
          const api = summarize(d.inPeriod.filter((e) => e.product === "api"));
          const ui = summarize(d.inPeriod.filter((e) => e.product === "ui"));
          const all = summarize(d.inPeriod);
          const showApi = filters.product !== "ui";
          const showUi = filters.product !== "api";
          return (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                {showApi && <Panel title={`Taxa de sucesso dos testes API — ${periodLabel.toLowerCase()}`} info={RATE_INFO}><Gauge rate={api.rate} label="API" /></Panel>}
                {showUi && <Panel title={`Taxa de sucesso dos testes UI — ${periodLabel.toLowerCase()}`} info={RATE_INFO}><Gauge rate={ui.rate} label="UI" /></Panel>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total de testes API" value={fmtInt(testCount(d.valid, "api"))} tone="product" />
                <StatCard label="Total de testes UI" value={fmtInt(testCount(d.valid, "ui"))} tone="product" />
                <StatCard label="Falhas definitivas" value={fmtInt(all.failed)} hint={periodLabel} tone={all.failed ? "danger" : "success"} info="Cada falha definitiva conta uma vez por execução válida. Retries e reruns não somam." />
                <StatCard label="Flaky tests" value={fmtInt(all.flaky)} hint={periodLabel} tone={all.flaky ? "warning" : "success"} info="Testes que falharam em tentativa interna, mas terminaram aprovados. Indicador separado: não reduz a taxa de sucesso." />
              </div>
            </div>
          );
        }}
      </DataGate>
    </>
  );
}
