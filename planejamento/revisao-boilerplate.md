# Revisão da arquitetura

O guia interno descreve .NET 8, camadas de domínio, aplicação, infraestrutura, DTO e API, além de casos de uso, validação e documentação OpenAPI. O protótipo já usa .NET 8, MongoDB e contratos de repositório de projetos, widgets e capturas de métricas separados das implementações MongoDB.

A persistência de métricas foi extraída do arquivo principal da API; os endpoints preservam as mesmas rotas, regras de autorização e estrutura de dados. O teste de integração local cobre leitura, gravação, idempotência e filtro de execuções agendadas.

## Pontos ainda pendentes para aderência ao boilerplate

- Mover as operações HTTP restantes e o acesso a usuários para casos de uso e repositórios dedicados; atualmente parte da lógica continua em `Program.cs`.
- Adicionar camada de DTOs, validadores e tratamento consistente de erros, sem alterar os contratos existentes sem migração coordenada.
- Estruturar testes de API, incluindo autorização e comportamento das falhas de sincronização; adicionar OpenAPI e observabilidade de acordo com as necessidades da implantação.
- Preparar autenticação e infraestrutura interna na fase de migração. O login local e MongoDB continuam sendo os escolhidos para o protótipo; Keycloak, mensageria e outros componentes não foram introduzidos sem necessidade atual.

O frontend mantém as regras de métricas em funções puras e a leitura de fontes no servidor. O `eslint` ainda aponta problemas antigos de formatação em diversos arquivos; a revisão pontual não reformata o projeto inteiro para evitar uma alteração grande sobre trabalho existente.
