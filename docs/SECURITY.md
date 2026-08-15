# Política e arquitetura de segurança

Status: baseline obrigatório para desenvolvimento e homologação  
Escopo: frontend React, API NestJS, PostgreSQL e containers Docker  
Baseline de verificação: OWASP ASVS 5.0.0 nível 2 e OWASP API Security Top 10 2023

> Este documento define requisitos e gates. Ele não representa, isoladamente, uma
> certificação de segurança. Nenhum sistema pode ser declarado “sem brechas”; a
> meta é reduzir a superfície, testar continuamente e responder rapidamente a
> vulnerabilidades.

## 1. Fronteiras de confiança

- `SUPER_ADMIN` é global e não pertence a tenant.
- `CLIENT_ADMIN` pertence a exatamente um tenant ativo.
- Um projeto pertence a exatamente um tenant.
- Usuários de projeto e suas permissões sempre são vinculados ao par
  `(tenant_id, project_id)`.
- O tenant efetivo vem exclusivamente da identidade autenticada e resolvida no
  servidor. `tenantId` recebido em rota, query, header ou body nunca concede ou
  amplia acesso.
- Ausência de regra explícita implica negação.
- Rotas e serviços globais de Super Admin ficam separados dos serviços de tenant;
  não existe parâmetro genérico como `bypassTenant=true`.

### Comportamento de autorização

| Situação | Resposta esperada |
|---|---:|
| Sem autenticação, sessão inválida ou expirada | `401` |
| Objeto do próprio tenant, mas ação não permitida | `403` |
| Objeto de outro tenant ou ID inexistente | `404` |
| Input sintaticamente inválido | `400` |
| Conflito de unicidade/estado, sem detalhe interno | `409` |

Retornar `404` para recursos de outro tenant reduz enumeração. Tempos, mensagens e
formato da resposta devem ser equivalentes ao caso de um ID inexistente.

## 2. Invariantes do banco

Estas regras devem existir no PostgreSQL, além das validações da API:

1. Toda tabela tenant-scoped possui `tenant_id NOT NULL`.
2. `projects` possui chave/índice único `(tenant_id, id)`.
3. Vínculos de projeto possuem FKs compostas:
   `(tenant_id, project_id) -> projects(tenant_id, id)` e
   `(tenant_id, user_id) -> tenant_memberships(tenant_id, user_id)`.
4. A associação de `CLIENT_ADMIN` impede mais de um tenant ativo por identidade.
5. O estado global/tenant de administradores é protegido por `CHECK`, por exemplo:
   Super Admin sem `tenant_id`; Client Admin com `tenant_id` obrigatório.
6. Troca de usuário entre projetos é uma transação atômica e preserva o mesmo
   `tenant_id` em origem e destino.
7. Permissões são enumerações/relacionamentos permitidos pelo servidor. Não aceitar
   nomes arbitrários nem flags elevadas pelo cliente.
8. Exclusões usam estratégia explicitamente definida. Se houver soft delete, todos
   os índices de unicidade, queries e RLS consideram `deleted_at` de forma uniforme.

IDs UUID/ULID reduzem enumeração, mas não são um controle de autorização.

### Defesa em profundidade recomendada

- Ativar PostgreSQL Row Level Security e `FORCE ROW LEVEL SECURITY` nas tabelas de
  tenant, usando contexto transacional (`SET LOCAL`) e testes de conexão reutilizada.
- O usuário da aplicação não pode ser owner das tabelas, `SUPERUSER` ou possuir
  `BYPASSRLS`.
- Acesso global deve usar uma superfície mínima, separada e auditável. Não conceder
  bypass geral ao pool usado pelas rotas tenant-scoped.
- Todas as queries tenant-scoped incluem `tenant_id` no predicado, mesmo com RLS.
- Migrations executam com credencial própria, indisponível para o container da API
  em runtime.

## 3. Autenticação e sessão

- Senhas: Argon2id com parâmetros calibrados no ambiente de produção; nunca logar,
  criptografar de forma reversível ou comparar senha em texto puro.
- Aplicar MFA resistente a phishing ao Super Admin antes da produção; oferecer e
  incentivar MFA ao Client Admin.
- Convites: token aleatório de alta entropia, uso único, TTL curto, armazenado como
  hash e invalidado após uso, substituição ou revogação do usuário.
- Evitar tokens persistentes em `localStorage`/`sessionStorage`. Preferir cookie
  `Secure`, `HttpOnly`, `SameSite` com escopo mínimo. Se cookies autenticarem ações,
  proteção CSRF é obrigatória.
- Access token curto; refresh token com rotação, detecção de reutilização e
  revogação por família. Logout e troca de senha revogam sessões relevantes.
- JWT: algoritmo em allowlist, validação de `iss`, `aud`, `exp`, `nbf` e chave;
  rejeitar `alg=none`, confusão de algoritmo e `kid` não confiável.
- Mensagens de login/recuperação não revelam se uma conta existe.
- Rate limit distribuído por conta, IP e fluxo; atraso progressivo sem possibilitar
  bloqueio permanente provocado por terceiros.
- Reautenticação para ações sensíveis: criar/desativar tenant, criar Client Admin,
  alterar e-mail/MFA/permissões elevadas e exportar dados.

## 4. Autorização tenant-safe no NestJS

- Um guard global autentica e normaliza o principal. Metadados de rota só reduzem,
  nunca ampliam, os requisitos.
- O contexto imutável contém `subjectId`, `globalRole`, `tenantId` e sessão; a API
  ignora campos equivalentes enviados pelo cliente.
- Controllers não consultam repositórios diretamente. Serviços tenant-scoped
  recebem o contexto e usam métodos como `findByIdForTenant(id, tenantId)`.
- DTOs/schemas fazem allowlist de propriedades e rejeitam campos desconhecidos
  sensíveis (`role`, `tenantId`, `ownerId`, `isSuperAdmin`, permissões internas).
- Listagens, busca, contagens, exportações, jobs e WebSockets aplicam o mesmo escopo
  de tenant. Não limitar o controle a endpoints `/:id`.
- Operações batch autorizam cada objeto e são atômicas quando necessário.
- Cache inclui `tenant_id` e versão de permissão na chave; nenhum cache global por
  simples `resource_id`.
- Alterações de permissão invalidam sessão/cache imediatamente ou dentro de um SLA
  documentado e testado.

## 5. Validação, API e navegador

- O servidor revalida todo input, independentemente do Zod do frontend.
- Aceitar apenas `application/json` onde aplicável; limitar profundidade, tamanho do
  body, número de itens batch, paginação e complexidade de filtros.
- Queries SQL parametrizadas. Proibir concatenação de coluna/ordem sem allowlist.
- Serialização por DTO de saída; nunca retornar entidades ORM, hash de senha,
  tokens, metadados internos ou campos de outro tenant.
- Erros de produção usam códigos estáveis e `requestId`; não expõem stack trace,
  SQL, caminho interno, segredo ou existência de objeto estrangeiro.
- CORS com allowlist exata por ambiente. Nunca refletir `Origin`; nunca combinar
  credenciais com `Access-Control-Allow-Origin: *`.
- Headers: CSP restritiva, `frame-ancestors`, `nosniff`, Referrer-Policy,
  Permissions-Policy e HSTS quando toda a origem estiver em HTTPS.
- Sanitizar conteúdo rico; React escaping não protege `dangerouslySetInnerHTML`,
  URLs perigosas ou conteúdo renderizado por bibliotecas.
- Swagger/OpenAPI de produção deve ser desativado ou autenticado e sem exemplos com
  segredos/dados reais.

## 6. Logs, auditoria e privacidade

Auditar de forma append-only, com horário UTC, `requestId`, ator, tenant alvo,
ação, tipo/ID do recurso, resultado e origem técnica:

- login, falha, logout, MFA e revogação;
- criação, suspensão e reativação de tenant;
- criação/desativação de Client Admin;
- criação/remoção/movimentação de usuário entre projetos;
- mudanças de permissão, exportações e exclusões;
- negações repetidas e tentativas cross-tenant.

Não registrar senha, token, cookie, segredo, respostas de pesquisa completas ou PII
desnecessária. Redigir headers e campos sensíveis no logger e no APM. Proteger os
logs contra alteração, controlar acesso e definir retenção alinhada à LGPD.

Alertas mínimos: brute force, reutilização de refresh token, volume anormal de
`401/403/404`, tentativa de acesso a múltiplos tenants e ação global fora do padrão.

## 7. Docker, PostgreSQL e supply chain

- Imagens fixadas por digest ou versão imutável; builds multi-stage e base mínima.
- Containers rodam como usuário sem root, filesystem read-only quando possível,
  sem `privileged`, sem Docker socket, com capabilities removidas e limites de
  CPU/memória/processos.
- Somente o proxy/API necessário publica porta. PostgreSQL fica em rede interna e
  não expõe `5432` em produção.
- Segredos vêm de secret manager/arquivo montado, nunca de imagem, Git, log, argumento
  de build ou variável `VITE_*`.
- TLS externo obrigatório; TLS API–DB quando a topologia sair do mesmo host/rede
  confiável. Validar certificado.
- `pg_hba.conf` restritivo, menor privilégio, backup cifrado e teste periódico de
  restauração. PITR conforme RPO/RTO do produto.
- Lockfiles versionados. CI executa SAST, secret scan, dependency/container scan,
  geração de SBOM e bloqueio por vulnerabilidade explorável crítica/alta.
- Patches críticos com SLA definido; exceções precisam de owner, prazo e mitigação.

## 8. Gates de release

Release é bloqueado quando houver:

- qualquer acesso cross-tenant de leitura ou escrita;
- elevação para Super Admin ou mudança de permissão não autorizada;
- segredo conhecido no repositório/imagem/log;
- SQL injection, command injection, SSRF explorável ou XSS armazenado;
- falha crítica/alta explorável sem mitigação e aceite formal com validade;
- restore de backup nunca testado para a versão produtiva;
- teste obrigatório da seção crítica de `qa/TEST_PLAN.md` falhando.

## 9. Resposta a incidente

1. Preservar evidências e abrir incidente com severidade/owner.
2. Conter: revogar sessões/chaves, bloquear vetor e isolar workload afetado.
3. Avaliar tenants, dados, janela temporal e obrigações legais/contratuais.
4. Corrigir e validar com teste de regressão e revisão independente.
5. Comunicar partes afetadas conforme plano jurídico e SLA.
6. Produzir postmortem sem culpa, atualizar ameaça, teste e controle preventivo.

Canal de reporte e SLA de triagem devem ser publicados antes do go-live.

## 10. Referências versionadas

- [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0_release/5.0/en)
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x03-introduction/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)

