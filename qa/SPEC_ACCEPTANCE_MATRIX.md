# Matriz de aceite — Gestão multicliente, workspaces e ativos

Fonte funcional: `ESPEC FUNCIONAL - gestao clientes, projetos, clientes 1.md`,
versão 1.0 (agosto/2026).

Esta matriz é o contrato de release. Um item só pode ser marcado como **PASS** quando
há evidência automatizada no PostgreSQL real/API e, quando aplicável, evidência de
interface. Teste unitário com mock não comprova isolamento, transação ou constraint.

## Convenções

- `A` e `B` são clientes distintos.
- `WA1`, `WA2` e `WB1` são workspaces de A, A e B.
- `PA1` e `PB1` são projetos de WA1 e WB1.
- `UA` e `UB` são usuários vinculados exclusivamente a A e B.
- `UM` é uma única identidade global vinculada a A e B.
- `persona-A` e `questionnaire-A` pertencem a A; sufixo B indica cliente B.
- Tentativa cross-tenant deve responder `404` quando revelar a existência do recurso
  geraria enumeração. `403` só é aceitável se o contrato expõe legitimamente o
  recurso e a decisão estiver documentada.
- Toda mutação valida o efeito persistido, não somente o status HTTP.
- `P0`: vazamento ou alteração cross-tenant; `P1`: bypass de autorização, perda ou
  corrupção de dados; `P2`: regra funcional central incorreta.

## 1. Critérios de aceite

| ID | Cenário executável | Evidência obrigatória | Regras | Prioridade |
|---|---|---|---|---|
| CA-01 | SUPER_ADMIN cria A informando CLIENT_ADMIN | A, workspace padrão e membership `CLIENT_ADMIN/ACTIVE` nascem na mesma transação; o admin é `WORKSPACE_ADMIN` efetivo no workspace inicial; falha intermediária não deixa órfãos | RN-01, RN-02, RN-13, RN-14 | P1 |
| CA-02 | CLIENT_ADMIN de A cria WA2 e delega WORKSPACE_ADMIN | novo workspace pertence somente a A; UA precisa estar vinculado a A; auditoria registra ator/ação/escopo/tempo | RN-02, RN-03, RN-10, RN-14 | P1 |
| CA-03 | UA recebe defaults por feature em WA1 | os defaults se aplicam a PA1 e a todo projeto criado depois no mesmo workspace; não alcançam WA2/PB1 | RN-03, RN-04, RN-05 | P1 |
| CA-04 | PA1 recebe override para UA | override substitui o nível do workspace apenas em PA1; outro projeto continua herdando; `DENY` vence inclusive `ADMIN` herdado | RN-04, RN-05, RN-12 | P1 |
| CA-05 | `persona-A` é associada a WA1 e WA2 e editada | há um único ID/registro no cliente; leitura nos dois workspaces retorna a edição; associação não cria cópia | RN-06, RN-07, RN-10, RN-PORT-01 | P1 |
| CA-06 | `questionnaire-A` é associado a WA1 e WA2 e editado | mesmas garantias de CA-05 | RN-06, RN-07, RN-10, RN-PORT-01 | P1 |
| CA-07 | ativo A é desassociado apenas de WA1 | registro do cliente persiste, WA2 mantém referência e PA1 conserva snapshot histórico quando já houve uso | RN-08, RN-14, RN-PORT-02, RN-PORT-04, RN-PORT-06 | P1 |
| CA-08 | CLIENT_ADMIN tenta excluir ativo usado por projeto ativo | resposta de conflito, ativo/referências/snapshots intactos; após remover/inativar dependência conforme contrato, exclusão atômica é possível | RN-09, RN-13, RN-14, RN-PORT-03 | P1 |
| CA-09 | tentativa de mover PA1 para WA2 ou adicionar segundo workspace | schema/API rejeita `workspaceId` no PATCH; banco impede dupla pertença; PA1 permanece em WA1 | RN-11 | P1 |
| CA-10 | duas requisições simultâneas removem/suspendem os últimos admins | no máximo uma operação pode deixar de existir; cliente conserva CLIENT_ADMIN ativo e workspace conserva WORKSPACE_ADMIN efetivo; sem estado intermediário inválido | RN-01, RN-02, RN-13 | P1 |
| CA-11 | membro READ tenta WRITE; membro WRITE tenta ADMIN | READ não cria/edita; WRITE cria/edita mas não configura permissões; respostas não persistem efeito e geram auditoria de segurança conforme política | RN-04, RN-05 | P1 |
| CA-12 | SUPER_ADMIN vincula UM a A e B | uma identidade/e-mail global, duas memberships independentes; trocar estado/papel/permissão em A não altera B nem exige novo login para fazer efeito | RN-03, RN-05, RN-10, RN-14 | P0 |

### Dívida de modelagem aceita nesta versão

A matriz funcional original autoriza `WORKSPACE_MEMBER` com `PERSONA WRITE` a criar
projeto. O comportamento será testado literalmente. Criar projeto **não** pode
conceder implicitamente `WORKSPACE_ADMIN`, `ADMIN` em nenhuma feature, nem permissão
para editar/excluir projetos além da matriz. Recomenda-se criar uma feature
`PROJECT` em versão futura para retirar o acoplamento semântico.

## 2. Regras críticas RN-01…RN-14

| Regra | Testes positivos | Testes negativos/adversariais | Camada mínima |
|---|---|---|---|
| RN-01 | troca atômica de CLIENT_ADMIN | remover, suspender ou mover o último admin; corrida de duas remoções; membership `INVITED/PENDING_APPROVAL` não conta como ativo | integração PostgreSQL + API concorrente |
| RN-02 | delegar novo WORKSPACE_ADMIN | remover/suspender último admin direto; remover último CLIENT_ADMIN quando ele é o admin efetivo; corrida entre mudanças de papéis | integração PostgreSQL + API concorrente |
| RN-03 | usuário vinculado a A acessa WA1/PA1 | trocar `tenantId`, `workspaceId`, `projectId` em path, query e body; usuário só de B em A; membership suspensa/removida | API e constraint/FK |
| RN-04 | cada endpoint protegido aceita o menor nível correto | anônimo, role errada, feature errada, nível insuficiente, endpoint novo sem policy, mass assignment `role/status/tenantId` | teste parametrizado controller/e2e |
| RN-05 | grant/revoke tem efeito na requisição seguinte | JWT ainda válido após remover membership; refresh/access token antigo; cache de permissão; revogar em A não revoga B | API com mesmo JWT, sem relogin |
| RN-06 | um ativo referenciado por N workspaces | tentativa de criar cópia por associação; IDs diferentes para a mesma associação; duplicar associação | integração DB + API |
| RN-07 | edição central visível em todas as referências | cache/resposta de workspace permanece obsoleta; edição em A altera B | API simétrica A/B |
| RN-08 | desassociação preserva ativo e outras referências | DELETE de associação apaga registro do tenant ou outras associações | integração + API |
| RN-09 | exclusão livre quando sem uso ativo | projeto ativo dependente, uso simultâneo durante DELETE, associação existente sem uso, snapshot histórico | integração concorrente |
| RN-10 | associação dentro do mesmo cliente | asset A → WB1, asset B → WA1, IDs em path/body trocados, asset ID inexistente versus estrangeiro | API + FK composta/constraint |
| RN-11 | projeto nasce e permanece em um workspace | PATCH com `workspaceId`, mass assignment, SQL de segundo vínculo/movimentação, workspace A + tenant B | schema + integração DB |
| RN-12 | override ALLOW e DENY são calculados corretamente | `DENY READ` contra `ADMIN` herdado; DENY feature específica não contamina outra; override de PA1 não chega a PA2 | resolver unitário + API |
| RN-13 | operações críticas commitam tudo | falha injetada/constraint no meio de troca de admin ou exclusão; dois writers concorrentes; verificar rollback e invariantes | PostgreSQL real |
| RN-14 | auditoria imutável e completa | sem ator, ação, escopo ou timestamp; audit do tenant errado; UPDATE/DELETE por runtime role; segredo/PII indevida em metadata | DB + API + role runtime |

## 3. Portabilidade RN-PORT-01…06

| Regra | Assert principal | Assert de isolamento/histórico |
|---|---|---|
| RN-PORT-01 | editar registro central muda a visão de todos os workspaces associados | `id`, `tenantId` e contagem de registros permanecem estáveis |
| RN-PORT-02 | remover associação WA1 não remove ativo nem associação WA2 | WA1 perde acesso em nova requisição; projeto conserva snapshot |
| RN-PORT-03 | ativo em projeto `ACTIVE` não pode ser excluído | checagem e DELETE pertencem à mesma transação para evitar TOCTOU |
| RN-PORT-04 | snapshot contém dados usados, não ponteiro mutável | editar/excluir/desassociar ativo não muda snapshot anterior |
| RN-PORT-05 | associação A→B é impossível | rejeitar IDs cruzados na API e no PostgreSQL |
| RN-PORT-06 | histórico guarda associação e desassociação | eventos têm ator, workspace, ativo, ação e timestamps; não são sobrescritos |

## 4. Matriz Cyber obrigatória

Executar cada ataque com SUPER_ADMIN, CLIENT_ADMIN A, WORKSPACE_ADMIN A,
WORKSPACE_MEMBER A, usuário B e anônimo. Um poder global legítimo do SUPER_ADMIN
não dispensa tenant/workspace explícito nem permite associação cross-tenant.

| ID | Ataque | Resultado esperado |
|---|---|---|
| CY-01 | usar JWT ainda válido após revogar membership | requisição seguinte falha; nenhuma dependência exclusiva do claim antigo |
| CY-02 | trocar tenant/workspace/project em path | 404/403 seguro, nenhuma alteração e nenhum metadado estrangeiro |
| CY-03 | trocar IDs no body, nested JSON, query ou duplicar parâmetros | schema rejeita campos desconhecidos/ambíguos; scope não muda |
| CY-04 | associar persona/questionário A a workspace B | rejeição antes de persistir; nenhuma linha cross-tenant |
| CY-05 | enviar `tenantId`, `role`, `status`, `isSuperAdmin`, `workspaceId` não permitido | 400; nenhuma propriedade é aplicada |
| CY-06 | `DENY` no projeto contra `ADMIN` herdado do workspace | acesso à feature negado no projeto; outro projeto continua herdando |
| CY-07 | SUPER_ADMIN omite/forja escopo em endpoint local | deny-by-default; não usa primeiro tenant, tenant do token ou fallback implícito |
| CY-08 | CLIENT_ADMIN tenta operar B ou conceder SUPER_ADMIN | 404/403; nenhuma escalada e evento de auditoria |
| CY-09 | `PENDING_APPROVAL`, `INVITED`, `SUSPENDED` ou `REMOVED` tenta login/acesso | sem sessão/acesso; resposta não enumera conta |
| CY-10 | mesma identidade UM alterna A/B | listas, counts, cache, permissões e auditoria são independentes e consistentes |
| CY-11 | duas remoções/suspensões simultâneas dos últimos admins | invariant preservado no commit; pelo menos uma falha controlada |
| CY-12 | membro com PERSONA WRITE cria projeto | sucesso sem escalada implícita; não pode administrar membros/permissões |
| CY-13 | associação ou grant é revogado durante requisições concorrentes | após commit, nenhuma nova requisição mantém acesso; sem cache cross-request |
| CY-14 | erro de FK/constraint com ID estrangeiro | erro público estável sem SQL, tabela, stack ou confirmação de existência |
| CY-15 | autocadastro usa e-mail global existente + senha errada para novo cliente | não cria membership, não troca senha e responde sem enumerar a identidade; senha correta pode criar vínculo `PENDING_APPROVAL` independente |
| CY-16 | SUPER_ADMIN usa identidade global `SUSPENDED` como admin inicial de novo cliente | criação falha atomicamente e a identidade continua suspensa; reativação exige ação explícita separada |
| CY-17 | CLIENT_ADMIN A cria workspace com outro CLIENT_ADMIN A já autenticado | ambos veem o workspace na próxima chamada `/auth/me`; o segundo atua como WORKSPACE_ADMIN implícito sem relogin |
| CY-18 | mesma identidade solicita cadastro em A e B | notificações não colidem; aprovar A resolve apenas A e B permanece `PENDING_APPROVAL`/não resolvida |
| CY-19 | CLIENT_ADMIN tenta adicionar identidade global `SUSPENDED` com membership `ACTIVE` | operação falha; estado global permanece suspenso e nenhum vínculo ativo é criado |
| CY-20 | identidade ACTIVE ganha/revoga membership em B com JWT emitido no contexto A | mesmo JWT reflete grant e revoke na requisição seguinte; mudanças scoped não retornam 401 nem revogam a sessão |
| CY-21 | membro ativo no workspace, sem `PERSONA`/`RESEARCH READ` (ou com `DENY`), chama diretamente listagem, detalhe e snapshots | API nega ou filtra integralmente ativos/snapshots; membership isolada não concede leitura funcional |
| CY-22 | ativo tenant-wide está associado aos workspaces A1 e A2, mas o membro só lê A1 | resposta não inclui ID de A2 e a contagem de uso considera apenas projetos autorizados |
| CY-23 | CLIENT_ADMIN é demovido para CLIENT_MEMBER com sessão vigente | requisição seguinte perde administração herdada de todos os workspaces e nenhuma rota legada aceita `role/tenantId` global stale |
| CY-24 | CLIENT_ADMIN A troca `tenantId`/`workspaceId` da visão geral para B | dashboard rejeita o escopo estrangeiro; nunca ignora o seletor e devolve métricas do contexto global stale |
| CY-25 | CLIENT_ADMIN (inclusive `User.role` stale) chama `/user-access` | listagem e edição global negadas; promoção a SUPER_ADMIN só ocorre na rota global SUPER-only |
| CY-26 | dois SUPER_ADMIN tentam demover um ao outro simultaneamente | exatamente uma demissão pode confirmar; pelo menos um SUPER_ADMIN global permanece ativo sob lock/transação |
| CY-27 | vínculo é rejeitado/removido | sai do acesso efetivo, mas permanece histórico e listável ao administrador com status `REMOVED` |

## 5. Interface: acessibilidade, responsividade e i18n

Jornadas mínimas: criar cliente, criar workspace, delegar admin, adicionar membro,
configurar defaults e override/DENY, associar/desassociar ativo, tratar exclusão
bloqueada, alternar contexto A/B e consultar snapshots.

### WCAG 2.2 AA

- teclado completo, ordem e foco visível; foco retorna ao gatilho após dialog;
- `Dialog` possui nome, descrição, trap de foco e fecha com `Escape` quando seguro;
- feedback assíncrono via região `aria-live`; erro ligado ao campo por
  `aria-describedby`; não depender somente de cor;
- tabelas têm cabeçalhos/escopo e alternativa utilizável em telas estreitas;
- botões de ícone Lucide têm nome acessível; tooltips não são a única fonte do nome;
- contraste AA em claro/escuro; zoom 200%/400%; `prefers-reduced-motion` respeitado;
- `DENY`, herdado e override aparecem com rótulos textuais inequívocos.

### Responsividade

Validar em `320×480`, `360×640`, `390×844`, `768×1024`, `1024×768` e
`1440×900`. Em 320 px não pode haver scroll horizontal da página, CTA inacessível,
dialog maior que viewport ou ação dependente de hover. Sidebar deve usar o
comportamento mobile do componente e não cobrir dialogs/toasts.

### i18n

- todas as novas chaves existem em `pt-BR`, `es` e `en`; CI falha com chave ausente;
- nomes e descrições inseridos pelo usuário nunca são traduzidos automaticamente;
- mensagens da API usam código estável traduzido pelo cliente;
- plural, datas e números usam `Intl`; fallback regional é determinístico;
- pseudo-localização com expansão de 30% não quebra 320 px;
- trocar idioma preserva formulário, contexto do cliente e permissões em edição.

## 6. Gate de release e evidência

- CA-01…CA-12: 100% PASS.
- RN-01…RN-14 e RN-PORT-01…06: 100% PASS em testes negativos e positivos.
- Nenhum P0/P1 aberto; nenhuma violação axe crítica/séria nas jornadas.
- Backend: unit, integração PostgreSQL real, e2e e black-box sem retry.
- Frontend: component, navegador, teclado, 320 px e três locales.
- Evidência registra commit/build, seed, requestId, horário UTC e resultado sem
  tokens/cookies. Para concorrência, anexar respostas e estado final consultado.
