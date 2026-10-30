# Dashboard Metrics for QA

Plataforma interna que centraliza as métricas de automação de testes (API e UI) de vários projetos.

## Arquitetura
- TanStack Start (React + TypeScript), Recharts, Tailwind.
- Backend Lovable Cloud: autenticação (somente convite), tabelas `projects`, `dashboard_widgets`, `user_roles`.
- `src/lib/metrics.ts` — regras de negócio puras (taxa de sucesso, dedup de reruns, flaky, cobertura, projeção).
- `src/lib/normalize.ts` — leitura e normalização dos arquivos `squaredup/*.json`.
- `src/lib/sources.functions.ts` — leitura do GitHub no servidor (cache de 5 min). O token nunca vai ao navegador.

## Variáveis de ambiente (servidor)
- `GITHUB_TOKEN` — Fine-grained token, permissão Contents: Read-only somente nos repositórios de automação.

## Rodar localmente
```
bun install
bun run dev
```
Testes: `bunx vitest run`.

## Configurar o GitHub
1. Crie o token de leitura e salve como `GITHUB_TOKEN` nos segredos do projeto.
2. Em Projetos → projeto → Fontes do GitHub, informe organização, repositório e branch (padrão `automation-metrics`) de API e UI.
3. Use "Testar conexão" para ver o status de cada arquivo em `squaredup/`.

Sem repositório configurado, o painel mostra dados de demonstração identificados.

## Adicionar uma nova fonte de métricas
1. Adicione o arquivo em `SQUAREDUP_FILES` (`src/lib/normalize.ts`).
2. Crie um normalizador puro com teste em `normalize.test.ts`.
3. Use-o em `loadDashboardData` e exponha o dado nos widgets.
