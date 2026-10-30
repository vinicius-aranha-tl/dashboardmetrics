import type { EvolutionPoint, Execution, Product, TestResult, Trigger } from "@/lib/metrics";
import { daysAgoISO } from "@/lib/metrics";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Behavior {
  title: string;
  fail?: { p: number; error: string; detail: string; cause: string; olderThan?: number };
  flaky?: number;
}

const API_ROUTES = ["/recommendations", "/recommendations/home", "/products/{id}/similar", "/users/{id}/history", "/recommendations/feedback", "/catalog", "/campaigns", "/segments", "/health", "/cache", "/banners"];
const METHODS = ["GET", "POST", "PUT", "DELETE"];

function apiTitles(): string[] {
  const out: string[] = [];
  for (const r of API_ROUTES) for (const m of METHODS) for (const s of [200, 400]) out.push(`${m} ${r} → ${s}`);
  return out.slice(0, 88);
}

const API_BEHAVIOR: Behavior[] = [
  { title: "POST /recommendations/feedback → 200", fail: { p: 0.35, error: "AssertionError: expected status 200 but got 500", detail: "Internal Server Error ao persistir feedback (FeedbackRepository.save)", cause: "Erro de servidor" } },
  { title: "GET /products/{id}/similar → 200", fail: { p: 0.22, error: "TimeoutError: request exceeded 10000ms", detail: "Serviço de similaridade não respondeu dentro do SLA", cause: "Timeout" } },
  { title: "GET /users/{id}/history → 200", fail: { p: 0.18, error: "SchemaError: /items/0/score must be number", detail: "Campo score retornado como string no payload", cause: "Contrato divergente" } },
  { title: "DELETE /cache → 200", fail: { p: 0.4, error: "AssertionError: expected status 200 but got 404", detail: "Rota removida no deploy, contrato ainda a documenta", cause: "Contrato divergente", olderThan: 40 } },
  { title: "GET /recommendations/home → 200", flaky: 0.1 },
  { title: "GET /campaigns → 200", flaky: 0.04 },
];

const UI_TITLES = [
  "Login SSO redireciona para vitrine", "Vitrine carrega banners", "Carrossel de recomendações exibe itens", "Filtro por categoria", "Busca retorna produtos",
  "Detalhe do produto mostra similares", "Adicionar ao carrinho a partir da recomendação", "Checkout exibe carrossel de cross-sell", "Feedback positivo em recomendação", "Feedback negativo em recomendação",
  "Histórico do usuário lista itens", "Paginação de vitrine", "Troca de idioma", "Logout limpa sessão", "Painel admin lista campanhas",
  "Criar campanha", "Editar campanha", "Excluir campanha", "Criar segmento", "Editar segmento",
  "Preview de recomendação", "Exportar relatório", "Acessibilidade da vitrine", "Modo mobile da vitrine", "Erro 404 amigável",
  "Banner promocional clicável", "Lista de favoritos", "Remover favorito", "Notificações de recomendação", "Configurações do perfil",
  "Upload de catálogo", "Validação de catálogo inválido", "Dashboard de métricas", "Permissões por perfil",
];

const UI_BEHAVIOR: Behavior[] = [
  { title: "Checkout exibe carrossel de cross-sell", flaky: 0.15 },
  { title: "Login SSO redireciona para vitrine", flaky: 0.05 },
  { title: "Vitrine carrega banners", fail: { p: 0.3, error: "TimeoutError: locator('[data-testid=banner]') not found", detail: "Seletor alterado após refatoração do componente de banner", cause: "Seletor não encontrado", olderThan: 45 } },
];

const DATA_SOURCE: Record<Product, string> = {
  api: "recomenda-api-tests · GitHub Actions",
  ui: "recomenda-ui-tests · GitHub Actions",
};

function genProduct(product: Product, titles: string[], behaviors: Behavior[], now: Date, seed: number): Execution[] {
  const rand = rng(seed);
  const byTitle = new Map(behaviors.map((b) => [b.title, b]));
  const out: Execution[] = [];
  const DAYS = 120;
  for (let d = DAYS - 1; d >= 0; d--) {
    const date = daysAgoISO(now, d);
    const triggers: Trigger[] = ["scheduled"];
    if (rand() < 0.55) triggers.push("post-merge");
    if (rand() < 0.15) triggers.push("manual");
    triggers.forEach((trigger, ti) => {
      const results: TestResult[] = titles.map((title) => {
        const b = byTitle.get(title);
        if (b?.fail && (b.fail.olderThan == null || d > b.fail.olderThan) && rand() < b.fail.p) {
          return { title, status: "failed", error: b.fail.error, detail: b.fail.detail, cause: b.fail.cause };
        }
        if (b?.flaky && rand() < b.flaky) return { title, status: "flaky" };
        return { title, status: "passed" };
      });
      const triggerId = `${product}-${date}-${trigger}-${ti}`;
      const base = { product, triggerId, trigger, date, dataSource: DATA_SOURCE[product] };
      out.push({ ...base, id: `${triggerId}-a1`, runAttempt: 1, results });
      // Simulate a manual rerun of the same Action when it failed: must be ignored by metrics.
      if (results.some((r) => r.status === "failed") && rand() < 0.6) {
        out.push({ ...base, id: `${triggerId}-a2`, runAttempt: 2, results: results.map((r) => ({ title: r.title, status: "passed" })) });
      }
    });
  }
  return out;
}

function lastFriday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = (d.getUTCDay() - 5 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function genEvolution(now: Date, product: number[], automated: number[]): EvolutionPoint[] {
  const end = new Date(lastFriday(now) + "T00:00:00Z");
  const n = product.length;
  return product.map((p, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i) * 7);
    return { week: d.toISOString().slice(0, 10), productConditions: p, automatedConditions: automated[i] ?? 0, projectedAutomatedConditions: null };
  });
}

export function buildMockDataset(now = new Date()) {
  const executions = [
    ...genProduct("api", apiTitles(), API_BEHAVIOR, now, 42),
    ...genProduct("ui", UI_TITLES, UI_BEHAVIOR, now, 7),
  ];
  return {
    executions,
    evolution: {
      api: genEvolution(now, [631, 634, 638, 640, 643, 646, 648, 651, 653, 656, 657, 659], [0, 0, 0, 2, 4, 7, 11, 14, 18, 21, 25, 29]),
      ui: genEvolution(now, [138, 139, 141, 142, 144, 145, 147, 148, 149, 150, 151, 152], [52, 58, 63, 69, 75, 80, 86, 92, 98, 104, 110, 116]),
    } as Record<Product, EvolutionPoint[]>,
  };
}
