# Implantação do protótipo

O site usa Netlify para o frontend e as funções TanStack Start. O serviço HTTP .NET roda separadamente no Render, e o MongoDB Atlas armazena as métricas, projetos, usuários e chaves de sessão criptografadas. O proxy do site encaminha somente as rotas do backend configurado; a URL do backend nunca deve conter credenciais.

## Backend no Render

- Criar um Web Service usando o repositório desta aplicação e Dockerfile `backend/Dockerfile`, com raiz de build no diretório do repositório.
- Definir, nos segredos do serviço: `MongoDbOptions__ConnectionString`, `MongoDbOptions__DatabaseName`, `AdminAuth__Email`, `AdminAuth__PasswordHash` e `DataProtection__EncryptionKey`.
- `DataProtection__EncryptionKey` é uma chave aleatória de 32 bytes codificada em Base64; ela deve ser armazenada com segurança e preservada entre reinícios. Alterá-la sem migração torna as chaves de sessão antigas ilegíveis.
- Definir `AllowedHosts` e `Security__AllowedOrigins__0` conforme o hostname do backend e a origem HTTPS do site; não incluir uma barra no fim da origem. O backend usa `PORT` fornecida pelo Render.
- O usuário administrador principal é configurado por e-mail e hash de senha, nunca pela senha em texto no repositório. A senha pode ser redefinida por ferramenta local, gerando um novo hash para a configuração do servidor.
- Antes de ativar o serviço, liberar no Atlas as faixas de saída específicas do serviço Render, observando que as faixas regionais são compartilhadas. Validar a política da organização e não liberar acesso irrestrito automaticamente.

## Frontend na Netlify

- Usar o preset Nitro `netlify`, comando `bun run build` e diretório de publicação `dist`.
- Configurar, no ambiente de execução da Netlify, `BACKEND_URL` com a URL HTTPS base do serviço e `GITHUB_TOKEN` com leitura dos repositórios de automação. Nunca colocar esses valores no frontend nem no Git.
- O site envia login e demais requisições para `/backend`, encaminhados pelo servidor Netlify ao backend. As funções que sincronizam JSONs do GitHub usam `BACKEND_URL` diretamente e gravam as capturas pelo backend.
- Confirmar que a plataforma está executando funções SSR; uma publicação apenas estática não é suficiente.

## Verificação após configurar

1. Confirmar que o backend inicia e que `/health/mongodb` responde a partir do ambiente de hospedagem.
2. Acessar o site, entrar sem compartilhar senha e conferir leitura de projetos e painéis.
3. Testar sincronização de API e UI e verificar que os dados são gravados no MongoDB.
4. Testar sessão, permissões de administrador e visualizador, atualizações e disponibilidade depois de reinício.

O plano gratuito do Render pode suspender o serviço por inatividade. A retomada pode ser mais lenta que o tempo limite da Netlify; isso precisa ser testado no ambiente real antes de depender do serviço para uma apresentação.
