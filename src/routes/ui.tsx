import { createFileRoute } from "@tanstack/react-router";
import { ProductPage } from "@/components/dash/pages";

export const Route = createFileRoute("/ui")({
  head: () => ({
    meta: [
      { title: "Testes UI — Automação Recomenda" },
      { name: "description", content: "Taxa de sucesso, resultados diários e evolução de cobertura dos testes UI." },
      { property: "og:title", content: "Testes UI — Automação Recomenda" },
      { property: "og:description", content: "Indicadores da automação de testes UI do Recomenda." },
    ],
  }),
  component: () => <ProductPage product="ui" />,
});
