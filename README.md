# PersonaIA

Base multi-tenant para administrar clientes, projetos, usuários e presets iniciais de permissão para uma plataforma de criação de personas genéricas destinadas a pesquisas.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, componentes Shadcn/Radix, Zod e i18next.
- Backend: NestJS, TypeScript, Prisma e PostgreSQL.
- Ambiente: Docker Compose, imagens multi-stage e Nginx.
- Qualidade: Jest, Vitest, testes black-box e plano de QA para isolamento, acessibilidade, responsividade e i18n.

## Modelo de acesso inicial

- `SUPER_ADMIN`: global, sem tenant; cria tenants e Client Admins.
- `CLIENT_ADMIN`: pertence a exatamente um tenant; administra projetos, usuários e vínculos apenas desse tenant.
- `PROJECT_USER`: usuário não administrativo associado a um ou mais projetos do próprio tenant.
- `VIEWER`, `CONTRIBUTOR`, `MANAGER` e `OWNER`: presets temporários por vínculo de projeto. A matriz fina de permissões será definida na próxima etapa.

O `tenantId` efetivo vem exclusivamente da identidade autenticada. IDs ou campos enviados pelo navegador nunca ampliam o escopo. Vínculos entre projeto e usuário também são protegidos por chaves estrangeiras compostas no PostgreSQL.

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

## Verificação

```bash
npm run build
npm test
npm run lint
npm audit --omit=dev
```

O roteiro completo está em [qa/TEST_PLAN.md](./qa/TEST_PLAN.md). Os requisitos e gates de segurança ficam em [docs/SECURITY.md](./docs/SECURITY.md), e a análise STRIDE em [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md).

## Segurança antes de produção

Esta entrega é uma baseline segura, não uma promessa de “zero vulnerabilidades”. O Compose já separa a credencial de migration da role restrita de runtime. Antes do go-live ainda são obrigatórios: TLS real com `COOKIE_SECURE=true`, segredos em secret manager, MFA/reauth para Super Admin, RLS/FORCE RLS validada com o pool real, rate limit distribuído, backup/restauração testados, scans SAST/SCA/container, observabilidade e pentest independente.

Nunca use os valores de exemplo, a senha seed ou `COOKIE_SECURE=false` em produção.
