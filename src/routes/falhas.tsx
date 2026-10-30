import { createFileRoute } from "@tanstack/react-router";
import { CauseDonut } from "@/components/dash/charts";
import { DataTable } from "@/components/dash/DataTable";
import { DataGate } from "@/components/dash/pages";
import { PageTitle, Panel, StatCard, fmtDate, fmtInt } from "@/components/dash/primitives";
import { useDashboard } from "@/data/useDashboard";
import { causeDistribution, failureRows, flakyTable, type FailureRow, type FlakyRow } from "@/lib/metrics";

export const Route = createFileRoute("/falhas")({
  head: () => ({
    meta: [
      { title: "Falhas e instabilidades — Automação Recomenda" },
      { name: "description", content: "Flaky tests, detalhamento e histórico de falhas da automação do Recomenda." },
      { property: "og:title", content: "Falhas e instabilidades — Automação Recomenda" },
      { property: "og:description", content: "Flaky tests e falhas definitivas da automação API e UI." },
    ],
  }),
  component: FailuresPage,
});

const mono = "font-mono text-xs";

function FailuresPage() {
  const { periodLabel } = useDashboard();
  const p = periodLabel.toLowerCase();
  return (
    <>
      <PageTitle title="Falhas e instabilidades" subtitle="Reruns da mesma Action são ignorados; só a primeira tentativa de cada gatilho conta." />
      <DataGate>
        {(d) => {
          const flaky = flakyTable(d.inPeriod) as unknown as (FlakyRow & Record<string, unknown>)[];
          const fails = failureRows(d.inPeriod) as unknown as (FailureRow & Record<string, unknown>)[];
          const history = failureRows(d.allHistory) as unknown as (FailureRow & Record<string, unknown>)[];
          return (
            <div className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-4">
                <Panel title={`Flaky tests — ${p} — geral`} className="lg:col-span-3" info="Executions = execuções válidas em que o teste rodou. Failure Executions = execuções em que falhou internamente e terminou aprovado.">
                  <DataTable rows={flaky} empty="Nenhum flaky test no período." initialSort={{ key: "failureExecutions", dir: "desc" }} columns={[
                    { key: "title", label: "Title" },
                    { key: "executions", label: "Executions", numeric: true },
                    { key: "failureExecutions", label: "Failure Executions", numeric: true },
                    { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
                  ]} />
                </Panel>
                <StatCard label="Total de flaky tests" value={fmtInt(flaky.length)} hint={`Testes distintos — ${p}`} tone={flaky.length ? "warning" : "success"} />
              </div>
              <div className="grid gap-4 xl:grid-cols-4">
                <Panel title={`Detalhamento das falhas — ${p} — geral`} className="xl:col-span-3" info="Falhas definitivas agrupadas por teste e erro. Cada execução válida conta no máximo uma ocorrência.">
                  <DataTable rows={fails} empty="Nenhuma falha definitiva no período." initialSort={{ key: "occurrences", dir: "desc" }} columns={[
                    { key: "title", label: "Title" },
                    { key: "error", label: "Error", className: mono },
                    { key: "detail", label: "Detail", className: "text-muted-foreground" },
                    { key: "occurrences", label: "Occurrences", numeric: true },
                    { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
                    { key: "lastOccurrence", label: "Last Occurrence", render: (r) => fmtDate(r.lastOccurrence) },
                  ]} />
                </Panel>
                <Panel title="Falhas por causa" info="Distribuição das ocorrências de falhas definitivas do período por causa classificada.">
                  <CauseDonut data={causeDistribution(fails)} />
                </Panel>
              </div>
              <Panel title="Histórico de falhas — ciclo de vida — geral" info="Sem limite de período. First Seen = primeira vez que o teste apareceu em uma execução; First Occurrence = primeira falha definitiva. Ordenado por ocorrências.">
                <DataTable rows={history} empty="Nenhuma falha registrada." initialSort={{ key: "occurrences", dir: "desc" }} columns={[
                  { key: "title", label: "Title" },
                  { key: "error", label: "Error", className: mono },
                  { key: "detail", label: "Detail", className: "text-muted-foreground" },
                  { key: "occurrences", label: "Occurrences", numeric: true },
                  { key: "dataSource", label: "Data Source Name", className: "text-muted-foreground" },
                  { key: "firstSeen", label: "First Seen", render: (r) => fmtDate(r.firstSeen) },
                  { key: "firstOccurrence", label: "First Occurrence", render: (r) => fmtDate(r.firstOccurrence) },
                  { key: "lastOccurrence", label: "Last Occurrence", render: (r) => fmtDate(r.lastOccurrence) },
                ]} />
              </Panel>
            </div>
          );
        }}
      </DataGate>
    </>
  );
}
