import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dash/Dashboard";
import { PageTitle } from "@/components/dash/primitives";

export const Route = createFileRoute("/_authenticated/visao-geral")({
  head: () => ({
    meta: [
      { title: "Visão geral — Dashboard Metrics for QA" },
      { name: "description", content: "Automação de API e UI de todos os projetos integrados." },
      { property: "og:title", content: "Visão geral — Dashboard Metrics for QA" },
      { property: "og:description", content: "Automação de API e UI de todos os projetos integrados." },
    ],
  }),
  component: () => (
    <>
      <PageTitle title="Visão geral" subtitle="Todas as automações de todos os projetos integrados" />
      <Dashboard projectId={null} slug={null} />
    </>
  ),
});
