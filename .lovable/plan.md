# Visão Geral da Automação — Recomenda

Plataforma interna (tema escuro, desktop-first) com indicadores de automação API e UI, dados mockados via camada desacoplada pronta para JSONs do GitHub.

## Páginas (rotas separadas)
- `/` Visão geral — 2 gauges (API ~99%, UI 100%; verde ≥90, amarelo 80–89,99, vermelho <80) + 4 cards (total API, total UI, falhas definitivas, flaky).
- `/api` e `/ui` — gauge, cards, gráfico diário de resultados (passed/failed/unstable) e resumo de evolução do respectivo produto.
- `/falhas` — tabela Flaky + card total; tabela Detalhamento + donut por causa; tabela Histórico (ciclo de vida, ordenada por ocorrências).
- `/cobertura` — dois gráficos de linha (Produto azul, Automação laranja, Projeção rosa tracejada), tooltip com semana/produto/automação/diferença/%; destaque de semana de paridade, semanas restantes e diferença atual; estados "Histórico insuficiente para calcular a projeção" e "Na velocidade atual, não há previsão de paridade."
- `/configuracoes` — mostra fontes configuradas (API/UI), modo (mock/GitHub), e explicação de proxy para repositórios privados.

## Layout global
Barra lateral de navegação + cabeçalho com período selecionado, filtros globais (Produto, Período 7/30/90/todo, Origem: agendada/pós-merge/manual) e botão "Atualizar dados". Filtros em search params da URL.

## Regras de negócio (funções puras + testes)
- Sucesso = aprovados (inclui recuperados por retry); flaky não reduz sucesso; falha = definitiva.
- Deduplicação: ignora reruns da mesma Action, só primeira tentativa por gatilho, falha contada uma vez por execução, retries não somam.
- Cobertura API: condição = rota+método+status+contrato; múltiplos testes na mesma condição contam 1.
- Projeção: regressão linear das últimas semanas; só desenha se velocidade da automação > velocidade do produto; requer ≥3 pontos.
- Tooltips "ⓘ" explicando cada fórmula.

## Tabelas
Componente reutilizável com busca e ordenação por coluna.

## Detalhes técnicos
- Recharts (gauge via RadialBar/Pie, donut, LineChart com `strokeDasharray`).
- `src/data/`: tipos, mocks completos, adaptadores `mockAdapter` e `githubAdapter` (fetch de JSON público ou via server function proxy `createServerFn` que lê token do `process.env` — nunca no navegador).
- Fontes via `VITE_API_RESULTS_URL`, `VITE_API_EVOLUTION_URL`, `VITE_UI_*` etc.; ausência → mock.
- TanStack Query para carregamento; "Atualizar" invalida queries.
- Tokens semânticos em `styles.css` (success, warning, danger, product, automation, projection); fonte distinta (ex.: Sora + Manrope).
- Testes vitest para taxa de sucesso, faixas de cor, deduplicação, cobertura e projeção/paridade.
- head() por rota; AGENTS.md atualizado; versão inicial 0.1.0.
