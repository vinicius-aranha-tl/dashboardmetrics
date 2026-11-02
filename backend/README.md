# Backend .NET e MongoDB

O backend fornece autenticação local e persiste usuários adicionais, projetos e configurações dos painéis no MongoDB. O administrador principal é configurado no servidor e pode criar administradores ou usuários com perfil de visualização; somente administradores podem editar ou gerenciar usuários. Contas antigas de editor passam a ter apenas leitura. As métricas continuam sendo lidas dos JSONs no GitHub pelo servidor da aplicação. Na primeira entrada, se não houver projetos, é criado o projeto Recomenda com os repositórios de API e UI conhecidos. Dados anteriores não são importados.

O projeto usa separação em domínio, infraestrutura e API. Os contratos de repositório ficam no domínio e as implementações MongoDB na infraestrutura; a API valida as requisições e usa esses contratos para persistir capturas de métricas. Essa organização aproxima o projeto do guia interno, mas a adequação ao boilerplate ainda não está completa: os demais endpoints e regras de usuários ainda precisam ser movidos para casos de uso e repositórios próprios, com DTOs, validação e testes de API. A autenticação local continua em uso até a migração interna.

Para desenvolvimento, configure `MongoDbOptions:ConnectionString` e `MongoDbOptions:DatabaseName` por configuração .NET ou variáveis de ambiente. Os valores em `appsettings.json` apontam apenas para um MongoDB local de desenvolvimento. Não coloque credenciais de produção nesse arquivo.

Com o SDK .NET 8 instalado e uma conexão MongoDB configurada, execute na raiz para criar o administrador uma única vez. A senha é digitada sem exibição e somente o hash é guardado em `backend/src/DashboardMetrics.Api/admin.local.json`, ignorado pelo Git. O comando não sobrescreve um administrador já configurado:

```powershell
cmd.exe /c configurar-admin.cmd
```

Para iniciar o backend em desenvolvimento:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project backend/src/DashboardMetrics.Api/DashboardMetrics.Api.csproj --urls http://127.0.0.1:5080
```

A rota `http://127.0.0.1:5080/health/mongodb` verifica a conexão. Não exponha esta configuração de desenvolvimento na rede ou na internet.

Para implantação é necessário um servidor para o backend .NET, uma configuração de proxy para encaminhar `/backend` a ele, HTTPS, gestão segura de segredos, persistência das chaves de proteção de sessão e a configuração de origens autorizadas. A configuração atual do proxy se aplica apenas ao desenvolvimento local; não significa que a implantação esteja pronta.

Teste local dos repositórios MongoDB: `dotnet run --project backend/tests/DashboardMetrics.MongoSmoke/DashboardMetrics.MongoSmoke.csproj -c Release`. Usa exclusivamente um banco de testes local e remove apenas os documentos de teste que cria.
