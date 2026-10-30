import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { EvolutionPoint, Execution, Product } from "@/lib/metrics";
import { buildMockDataset } from "./mock";

export interface Dataset {
  executions: Execution[];
  evolution: Record<Product, EvolutionPoint[]>;
  mode: "mock" | "remote" | "mixed";
}

/** Source URLs come from env (VITE_* are public URLs, never tokens). */
export const SOURCE_CONFIG = {
  api: {
    executions: import.meta.env.VITE_API_EXECUTIONS_URL as string | undefined,
    evolution: import.meta.env.VITE_API_EVOLUTION_URL as string | undefined,
  },
  ui: {
    executions: import.meta.env.VITE_UI_EXECUTIONS_URL as string | undefined,
    evolution: import.meta.env.VITE_UI_EVOLUTION_URL as string | undefined,
  },
};

const ALLOWED_HOSTS = ["raw.githubusercontent.com", "api.github.com", "objects.githubusercontent.com"];

/** Server-side proxy: reads GITHUB_TOKEN from server env so the token never reaches the browser. */
export const fetchGithubJson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const u = new URL(data.url);
    if (!ALLOWED_HOSTS.includes(u.hostname)) throw new Error(`Host não permitido: ${u.hostname}`);
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch(u, {
      headers: {
        Accept: u.hostname === "api.github.com" ? "application/vnd.github.raw+json" : "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`Falha ao buscar ${u.pathname} [${res.status}]: ${await res.text()}`);
    return JSON.stringify(await res.json());
  });

async function load<T>(url: string | undefined): Promise<T | null> {
  if (!url) return null;
  return JSON.parse(await fetchGithubJson({ data: { url } })) as T;
}

/** Adapter: remote JSON when configured, otherwise mock. Daily-result JSON is not enough for
 *  deduplication, so remote execution sources must provide Execution[] records. */
export async function loadDataset(): Promise<Dataset> {
  const mock = buildMockDataset();
  const [ae, av, ue, uv] = await Promise.all([
    load<Execution[]>(SOURCE_CONFIG.api.executions),
    load<EvolutionPoint[]>(SOURCE_CONFIG.api.evolution),
    load<Execution[]>(SOURCE_CONFIG.ui.executions),
    load<EvolutionPoint[]>(SOURCE_CONFIG.ui.evolution),
  ]);
  const remoteCount = [ae, av, ue, uv].filter(Boolean).length;
  return {
    executions: [
      ...(ae ?? mock.executions.filter((e) => e.product === "api")),
      ...(ue ?? mock.executions.filter((e) => e.product === "ui")),
    ],
    evolution: { api: av ?? mock.evolution.api, ui: uv ?? mock.evolution.ui },
    mode: remoteCount === 0 ? "mock" : remoteCount === 4 ? "remote" : "mixed",
  };
}
