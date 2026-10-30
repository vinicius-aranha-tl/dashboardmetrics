import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard Metrics for QA" },
      { name: "description", content: "Métricas de automação de testes API e UI de todos os projetos." },
      { property: "og:title", content: "Dashboard Metrics for QA" },
      { property: "og:description", content: "Métricas de automação de testes API e UI por projeto." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/visao-geral" });
  },
});
