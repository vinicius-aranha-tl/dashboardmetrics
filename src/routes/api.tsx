import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/dash/pages";

export const Route = createFileRoute("/api")({
  head: () => ({
    meta: [
      { title: "Testes API — Automação Recomenda" },
      { name: "description", content: "Taxa de sucesso, resultados diários e evolução de cobertura dos testes API." },
      { property: "og:title", content: "Testes API — Automação Recomenda" },
      { property: "og:description", content: "Indicadores da automação de testes API do Recomenda." },
    ],
  }),
  component: () => <ProductPage product="api" />,
});
