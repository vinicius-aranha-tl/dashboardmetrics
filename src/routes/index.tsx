import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quality Hub" },
      { name: "description", content: "Métricas de automação de testes API e UI de todos os projetos." },
      { property: "og:title", content: "Quality Hub" },
      { property: "og:description", content: "Métricas de automação de testes API e UI por projeto." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/visao-geral" });
  },
});
