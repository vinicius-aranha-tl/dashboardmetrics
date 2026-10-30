# Conectar os projetos ao formato real do GitHub (squaredup/*.json)

Os arquivos enviados descrevem como as automações publicam os dados de verdade: um repositório de API e um de UI, branch `automation-metrics`, pasta `squaredup/` com arquivos fixos. Hoje cada projeto pede 4 links soltos; o plano troca isso pelo formato real.

## O que muda para você
- **Cadastro do projeto (aba Fontes):** em vez de 4 links, você informa por produto (API e UI): dono/organização, nome do repositório e branch (padrão `automation-metrics`). Ex.: `api-automation-recomenda-test` e `ui-automation-recomenda-test`.
- **Lista de arquivos por produto:** a tela mostra cada arquivo esperado (latest, history, test-history, test-stability-30d, execution-trend-30d, period-comparison, failure-reasons-30d, failure-lifecycle e, só na API, swagger-coverage-current/history e automation-evolution) com status: Demonstração / Conectado (nº de registros) / Erro (mensagem clara).
- **Botão "Testar conexão"** por produto e **"Atualizar dados"** no topo, com **"Última atualização"** visível nos painéis.
- **Modo Demo x Real** visível por projeto: sem repositório configurado → demonstração identificada; configurado e falhando → erro, nunca mock escondido.
- Cache de 5 minutos no servidor; o botão Atualizar força nova leitura.

## Pendência para ficar 100% assertivo
Não tenho o conteúdo de exemplo de cada JSON. Vou montar leitores tolerantes para os campos descritos e, enquanto o formato não for confirmado, cada arquivo mostra "formato não reconhecido" com o campo que falhou. Quando você mandar um exemplo de cada arquivo (pode ser com dados fictícios), ajusto os leitores.

## Ainda depende de você
- Token do GitHub (fine-grained, Contents: Read-only só nos 2 repositórios). Abro o campo seguro na implementação. Não será reutilizado o `RECOMENDA_SOURCE_READ_TOKEN`.

## Também incluído
- README (arquitetura, como rodar, como configurar GitHub, como adicionar nova fonte) e CONTRIBUTING (commits em português minúsculos, branches feat/ fix/ chore/ docs/).
- Versão 0.5.0.

## Detalhes técnicos
- Migração aditiva em `projects`: `api_repo_owner`, `api_repo_name`, `api_branch`, `ui_repo_owner`, `ui_repo_name`, `ui_branch`, `last_synced_at`, `last_sync_error`; colunas de URL antigas marcadas DEPRECATED.
- `sources.functions.ts`: leitura via `GET api.github.com/repos/{owner}/{repo}/contents/squaredup/{file}?ref={branch}`, decodifica Base64, zod por arquivo, normaliza para os tipos de `metrics.ts` (`Execution`, `EvolutionPoint`, flaky, falhas, ciclo de vida, cobertura). Arquivos pré-agregados (stability, failure-reasons, lifecycle) passam a alimentar os widgets diretamente quando presentes.
- Cache em memória por isolate com TTL 5 min + `force` no Atualizar; registra `last_synced_at`/erro sem logar token.
- Normalizadores puros em `src/lib/normalize.ts` com testes vitest.
- Preparado (não ativo) para refresh periódico e webhook em `/api/public/github-webhook`.
