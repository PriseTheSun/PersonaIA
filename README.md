# PersonaIA

Plataforma multi-tenant para administrar organizações, workspaces, projetos, identidades, permissões funcionais, personas e questionários destinados a pesquisas.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, componentes Shadcn/Radix, Zod e i18next.
- Backend: NestJS, TypeScript, Prisma e PostgreSQL.
- Ambiente: Docker Compose, imagens multi-stage e Nginx.
- Qualidade: Jest, Vitest, testes black-box e plano de QA para isolamento, acessibilidade, responsividade e i18n.

## Modelo de acesso

- `SUPER_ADMIN`: autoridade global da plataforma.
- `CLIENT_ADMIN`: papel no vínculo entre uma identidade e uma organização.
- `WORKSPACE_ADMIN` e `WORKSPACE_MEMBER`: papéis independentes em cada workspace.
- `PERSONA`, `RESEARCH`, `SIMULATION` e `DASHBOARD`: funcionalidades controladas por `READ`, `WRITE` ou `ADMIN`.
- Permissões padrão do workspace são herdadas pelos projetos; override de projeto substitui a herança e `DENY` explícito sempre prevalece.

Uma identidade pode estar vinculada a várias organizações e workspaces sem duplicação. A organização/workspace informada pelo navegador é somente um seletor: o backend recarrega vínculos e permissões ativos em cada requisição. FKs compostas no PostgreSQL impedem associações cross-tenant; projetos não podem mudar de organização; auditoria, histórico de associações e snapshots são append-only.

Cada projeto possui um código de cadastro de 12 caracteres que é renovado automaticamente a cada 10 minutos. O código é opcional e identifica simultaneamente o projeto e sua organização, sem exigir um segundo código no formulário. Com código, a conta e o vínculo continuam pendentes até a aprovação. Sem código, a identidade fica na fila global para o Super Admin definir a organização; depois disso, ela também pode ser vinculada manualmente a um projeto. Quando alguém entra sem projeto, a interface orienta a espera e os administradores responsáveis recebem uma notificação deduplicada.

Personas e questionários existem uma vez na organização e são associados a vários workspaces por referência. Projetos que utilizam esses ativos preservam um snapshot histórico independente.

## Convites por e-mail

A API já reserva convites de organização por `POST /api/v1/tenants/:tenantId/invitations`, com o corpo `{ "email", "role", "projectId?" }`. A rota exige Super Admin ou administrador ativo da organização, aplica rate limit, valida o projeto dentro do mesmo tenant, registra auditoria e armazena apenas o hash do token com validade padrão de sete dias.

Enquanto não houver um provedor de e-mail configurado, o convite é persistido como `PENDING_DELIVERY` e nenhum e-mail é simulado ou exposto em logs/respostas. A integração futura deve substituir o provider `INVITATION_EMAIL_DELIVERY`; quando ele confirmar o envio, o mesmo contrato passa a responder o convite como `SENT`.

## Executar com Docker

Pré-requisitos: Docker com Compose v2+.

```bash
cp .env.example .env
```

Antes de subir, substitua todos os valores `REPLACE_*` em `.env`. Gere segredos independentes, por exemplo:

```bash
openssl rand -base64 48
```

Depois:

```bash
docker compose up --build
```

- Aplicação: `http://localhost:8080`
- API via proxy: `http://localhost:8080/api/v1`
- Healthcheck interno: `/api/v1/health`

O PostgreSQL não publica porta no host. Para encerrar:

```bash
docker compose down
```

Para remover também o volume local de dados, use `docker compose down --volumes` somente quando tiver certeza de que os dados podem ser descartados.

## Desenvolvimento local

```bash
npm ci
npm run dev
```

O comando prepara automaticamente o PostgreSQL de desenvolvimento pelo Docker, aplica migrations/seed e inicia:

- frontend com hot reload: `http://localhost:5173`;
- API NestJS: `http://localhost:3001/api/v1`;
- PostgreSQL restrito a `127.0.0.1:5433`.

Use `Ctrl+C` para encerrar API e frontend. O banco continua no Docker para preservar os dados; `docker compose stop postgres` o encerra. A porta local do banco pode ser alterada com `POSTGRES_DEV_PORT` no `.env`.

Se API e frontend já estiverem saudáveis, executar `npm run dev` novamente apenas confirma os dois endereços e encerra com sucesso. Se somente uma porta estiver ocupada ou algum serviço não responder, o comando informa o conflito para evitar iniciar uma instância parcialmente quebrada.

## Verificação

```bash
npm run build
npm test
npm run lint
npm audit --omit=dev
node --test qa/spec-blackbox.test.mjs
```

O roteiro completo está em [docs/qa/TEST_PLAN.md](./docs/qa/TEST_PLAN.md), e a rastreabilidade dos 12 critérios de aceite em [docs/qa/SPEC_ACCEPTANCE_MATRIX.md](./docs/qa/SPEC_ACCEPTANCE_MATRIX.md). Os requisitos e gates de segurança ficam em [docs/SECURITY.md](./docs/SECURITY.md), e a análise STRIDE em [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md). O índice da documentação está em [docs/README.md](./docs/README.md).

## Segurança antes de produção

Esta entrega é uma baseline segura, não uma promessa de “zero vulnerabilidades”. O Compose já separa a credencial de migration da role restrita de runtime. Antes do go-live ainda são obrigatórios: TLS real com `COOKIE_SECURE=true`, segredos em secret manager, MFA/reauth para Super Admin, RLS/FORCE RLS validada com o pool real, rate limit distribuído, backup/restauração testados, scans SAST/SCA/container, observabilidade e pentest independente.

Nunca use os valores de exemplo, a senha seed ou `COOKIE_SECURE=false` em produção.
