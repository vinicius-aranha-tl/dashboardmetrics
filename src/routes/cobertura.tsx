import { createFileRoute } from "@tanstack/react-router";
import { EvolutionChart } from "@/components/dash/charts";
import { DataGate, PROJECTION_INFO, ProjectionSummary, filterWeeks } from "@/components/dash/pages";
import { PageTitle, Panel } from "@/components/dash/primitives";
import { computeProjection } from "@/lib/metrics";

export const Route = createFileRoute("/cobertura")({
  head: () => ({
    meta: [
      { title: "Cobertura e evolução — Automação Recomenda" },
      { name: "description", content: "Evolução semanal das condições do produto versus automação API e UI, com projeção de paridade." },
      { property: "og:title", content: "Cobertura e evolução — Automação Recomenda" },
      { property: "og:description", content: "Produto versus automação e projeção de paridade." },
    ],
  }),
  component: CoveragePage,
});

const API_INFO = `Produto API = condições mínimas documentadas no contrato atual (rota + método + status + contrato/resposta). Automação = condições com evidência de teste; vários testes na mesma condição contam uma vez e cenários extras fora do contrato não contam. ${PROJECTION_INFO}`;
const UI_INFO = `Produto UI = condições funcionais mapeadas. Automação = condições cobertas por ao menos um teste (deduplicadas). ${PROJECTION_INFO}`;

function CoveragePage() {
  return (
    <>
      <PageTitle title="Cobertura e evolução" subtitle="Cobertura de contrato/condições — separada da quantidade bruta de cenários de teste." />
      <DataGate>
        {(d) => (
          <div className="grid gap-4 xl:grid-cols-2">
            {(["api", "ui"] as const).filter((p) => d && (true)).map((p) => {
              const proj = computeProjection(filterWeeks(d.evolution[p], d.periodDays));
              return (
                <Panel key={p} title={`Evolução do produto versus automação ${p.toUpperCase()}`} info={p === "api" ? API_INFO : UI_INFO}>
                  <EvolutionChart projection={proj} />
                  <ProjectionSummary projection={proj} />
                </Panel>
              );
            })}
          </div>
        )}
      </DataGate>
    </>
  );
}
