# Plano de QA — SaaS multi-tenant

Versão inicial: 2026-08-15  
Objetivo: impedir regressões funcionais, de isolamento, segurança, acessibilidade,
responsividade e localização antes do release.

## 1. Estratégia e gates

Camadas mínimas:

1. unitários para regras puras, schemas e permission checks;
2. integração com PostgreSQL real para constraints, transações, RLS e repositories;
3. API/e2e com ao menos dois tenants e todos os papéis;
4. frontend component tests e fluxos e2e em navegador;
5. testes black-box de isolamento e configuração;
6. SAST, SCA, secret scan, imagem Docker e DAST em homologação.

### Dados canônicos de teste

| Identidade | Tenant | Projeto | Uso |
|---|---|---|---|
| `super-1` | nenhum | nenhum | administração global |
| `admin-a` | A | A1, A2 | Client Admin do tenant A |
| `admin-b` | B | B1 | Client Admin do tenant B |
| `user-a1` | A | A1 | membro com permissão mínima |
| `user-a2` | A | A2 | teste de movimentação |
| `user-b1` | B | B1 | marcador de vazamento |

Use nomes/IDs marcadores únicos (`LEAK_SENTINEL_TENANT_B`) para detectar vazamento
em resposta, cache, exportação e busca. Cada teste restaura seu estado e não depende
da ordem de execução.

### Gates

- P0/P1 abertos bloqueiam release.
- Suite crítica (`@critical`, `@tenant-isolation`, `@authz`) deve passar 100%.
- Unitários/integrados/e2e não podem ter retry para mascarar flakiness.
- Cobertura percentual não substitui cenários; código de autorização e tenant scope
  exige branch coverage e mutation/negative testing quando viável.
- Zero violações axe de impacto crítico/sério nas jornadas principais.
- Nenhum overflow, conteúdo inacessível ou ação inviável em 320×480 CSS px.

## 2. Casos críticos de autenticação

| ID | Cenário | Resultado esperado |
|---|---|---|
| AUTH-001 | rota protegida sem credencial | 401; sem dado; erro estável |
| AUTH-002 | token/cookie malformado | 401; sem stack trace |
| AUTH-003 | sessão expirada | 401 e frontend conduz a login sem loop |
| AUTH-004 | JWT `alg=none`/algoritmo incorreto | rejeitado |
| AUTH-005 | `iss`, `aud`, assinatura, `nbf` ou `exp` inválido | rejeitado |
| AUTH-006 | sessão de usuário desativado | rejeitada imediatamente/SLA definido |
| AUTH-007 | papel alterado durante sessão | permissões antigas deixam de valer |
| AUTH-008 | refresh token usado duas vezes | família revogada e evento emitido |
| AUTH-009 | logout seguido de replay | replay rejeitado |
| AUTH-010 | login inválido para e-mail existente/inexistente | resposta e tempo equivalentes |
| AUTH-011 | força bruta por IP e conta | rate limit sem revelar conta |
| AUTH-012 | convite expirado/usado/revogado | rejeitado sem criar sessão |
| AUTH-013 | troca de senha/MFA | sessões definidas pela política são revogadas |
| AUTH-014 | cookie de sessão | Secure, HttpOnly, SameSite e Path/Domain mínimos |
| AUTH-015 | mutação por cookie sem token CSRF/com Origin inválida | rejeitada sem efeito |
| AUTH-016 | ação sensível sem reautenticação recente | desafio adicional conforme política |
| AUTH-017 | cadastro sem código de projeto | identidade global fica pendente, sem organização ou projeto implícitos; somente Super Admins são notificados |
| AUTH-018 | cadastro com código atual de 12 caracteres | projeto solicitado fica pendente e só é vinculado após aprovação |
| AUTH-019 | código inválido ou expirado | 400 estável; nenhum vínculo/identidade é criado ou alterado |
| AUTH-020 | código consultado antes/depois do limite de 10 minutos | estável na janela; muda no limite; somente administradores do projeto visualizam |
| AUTH-021 | login ativo sem projeto repetido/concorrente | login permitido; orientação visível; um alerta aberto por destinatário/organização |
| AUTH-022 | projeto vinculado após alerta sem projeto | alerta é resolvido e o acesso passa a valer sem escalada de permissão |
| AUTH-023 | Super Admin aprova cadastro sem código e escolhe organização | cria vínculo `CLIENT_MEMBER` ativo na organização escolhida, sem inferência por e-mail |

## 3. Matriz de isolamento e IDOR/BOLA

Executar para `GET`, list/search, `POST`, `PATCH/PUT`, `DELETE`, batch, export e ações
específicas. Repetir usando ID em path, query, body, nested object e header.

| ID | Tentativa de `admin-a` | Resultado esperado |
|---|---|---|
| TEN-001 | ler projeto B1 por ID | 404 idêntico a ID inexistente |
| TEN-002 | alterar/excluir projeto B1 | 404; B1 inalterado |
| TEN-003 | criar recurso enviando `tenantId=B` | 400; campo não persiste e nunca cria em B |
| TEN-004 | acessar `/tenants/B/...` | 404; tenant da rota não amplia acesso |
| TEN-005 | listar/buscar/ordenar/paginar projetos | somente A1/A2; totais não incluem B |
| TEN-006 | obter/alterar/excluir `user-b1` | 404; usuário inalterado |
| TEN-007 | adicionar `user-b1` a A1 | 404/422 seguro; nenhum vínculo órfão |
| TEN-008 | adicionar `user-a1` a B1 | 404; nenhum vínculo cross-tenant |
| TEN-009 | exportar/relatório/count/agregação | nenhum marcador/contagem do tenant B |
| TEN-010 | endpoint batch com IDs A1+B1 | operação inteira negada ou semântica parcial documentada, nunca toca B |
| TEN-011 | ID codificado, case variant, duplicado ou parâmetro poluído | parser canônico; não contorna scope |
| TEN-012 | trocar método/Content-Type/override | não contorna guard ou validação |
| TEN-013 | mover `user-a1` A1→A2 | transação correta e permissões conforme política |
| TEN-014 | mover `user-a1` A1→B1 | rejeitado; vínculo original preservado |
| TEN-015 | corrida de duas movimentações simultâneas | estado consistente, sem vínculo duplicado |
| TEN-016 | FK direta/migration tenta relação cross-tenant | PostgreSQL rejeita |
| TEN-017 | cache aquece com B1 e A consulta mesmo resource ID/chave | nenhum hit cross-tenant |
| TEN-018 | pool reutiliza conexão B→A com RLS | contexto não vaza entre requests/transações |

Também execute a matriz simétrica (`admin-b` contra A) e com usuário de projeto. Um
Client Admin nunca pode criar/atribuir `SUPER_ADMIN`.

## 4. Autorização por função e propriedade

As permissões funcionais são `PERSONA`, `RESEARCH`, `SIMULATION` e `DASHBOARD`,
com níveis `READ`, `WRITE`, `ADMIN` e efeitos `ALLOW`/`DENY`. Defaults do workspace
são herdados pelos projetos, override de projeto substitui a herança e negação
explícita vence. A rastreabilidade executável completa fica em
[`SPEC_ACCEPTANCE_MATRIX.md`](./SPEC_ACCEPTANCE_MATRIX.md).

| ID | Cenário | Resultado esperado |
|---|---|---|
| AUTZ-001 | Client Admin chama criar/listar todos os tenants | 403/404 sem metadados globais |
| AUTZ-002 | Client Admin cria outro Client Admin fora de política | negado e auditado |
| AUTZ-003 | usuário de projeto chama rota de Client Admin | 403 |
| AUTZ-004 | usuário anônimo chama qualquer mutação | 401 |
| AUTZ-005 | Super Admin usa rota global autorizada | sucesso e auditoria completa |
| AUTZ-006 | payload inclui `role`, `isSuperAdmin`, `tenantId`, `ownerId` | 400; nenhum campo é persistido |
| AUTZ-007 | payload/response contém propriedades proibidas | não persistidas/não serializadas |
| AUTZ-008 | remover permissão e repetir ação com sessão antiga | negado conforme SLA de revogação |
| AUTZ-009 | ação não mapeada na tabela de permissões | negada |
| AUTZ-010 | permissão de projeto A1 usada em A2 | negada |
| AUTZ-011 | edição concorrente de permissões | sem lost update; versão/conflito tratado |
| AUTZ-012 | `DENY` no projeto contra `ADMIN` herdado | acesso negado no projeto; herança permanece nos demais |
| AUTZ-013 | JWT após membership revogada | requisição seguinte negada sem exigir relogin |
| AUTZ-014 | membro PERSONA WRITE cria projeto | cria sem receber ADMIN ou papel administrativo implicitamente |

Manter uma tabela versionada `papel × recurso × ação × escopo` e gerar testes
parametrizados a partir dela. Endpoint protegido sem policy é falha de release.

## 5. Funcional e consistência

| Área | Casos mínimos |
|---|---|
| Tenant | criar, duplicidade, suspender, reativar, paginação, estado inválido, auditoria |
| Client membership | convite, aceite, expiração, reenvio, suspensão/remoção, múltiplos clientes independentes e último CLIENT_ADMIN |
| Projeto | CRUD, validação de nome/limites, duplicidade definida, soft/hard delete, código rotativo e vínculo solicitado |
| Usuário | adicionar existente/novo, duplicado, remover, desativado, último admin |
| Movimentação | origem=destino, origem ausente, destino ausente, concorrência, rollback |
| Permissão | grant/revoke, idempotência, herança (se houver), revogação imediata |
| Lista/busca | vazio, limites, acentos, paginação estável, filtros combinados, sort allowlist |
| Erro/rede | offline, timeout, 409, 422/400, 429, 500; retry apenas quando seguro |
| Auditoria | ator/alvo/tenant/requestId/resultado corretos; sem segredo/PII indevida |

Regras de banco críticas devem ser testadas com SQL/integration test direto, sem
passar apenas pelo controller.

### Auditoria global

| ID | Cenário | Resultado esperado |
|---|---|---|
| AUD-001 | anônimo, CLIENT_ADMIN e SUPER_ADMIN consultam `/audit-logs` | `401`, `403` e sucesso, respectivamente; nenhum dado é retornado aos dois primeiros |
| AUD-002 | paginação ausente, inválida e acima do máximo | defaults `1/25`; valores inválidos ou `pageSize > 100` são rejeitados |
| AUD-003 | filtros combinados de busca, organização, evento, recurso e período | resultado e total correspondem aos filtros; datas incluem o dia final em UTC |
| AUD-004 | metadata histórica contém chave de senha/token/cookie/sessão/segredo | valor retorna como `[REDACTED]`; resposta não contém o segredo original |
| AUD-005 | SUPER_ADMIN abre ou filtra a auditoria | nova entrada `AUDIT_LOGS_VIEWED` registra ator, página e presença dos filtros, sem duplicar o texto buscado |
| AUD-006 | tela em 320×480, claro/escuro e pt-BR/es/en | lista mobile não cria overflow; filtros e detalhes funcionam por teclado; console permanece limpo |

## 6. Input, dados e robustez

| ID | Teste | Resultado esperado |
|---|---|---|
| INP-001 | SQLi em busca/filtro/sort/IDs | nenhum efeito; sort/coluna em allowlist |
| INP-002 | XSS refletido/armazenado em nomes/conteúdo | exibido como texto/sanitizado conforme contrato |
| INP-003 | prototype pollution (`__proto__`, `constructor`) | rejeitado e sem efeito global |
| INP-004 | JSON profundo, circular simulado, duplicidade de chaves | limite/rejeição previsível |
| INP-005 | Unicode invisível, confusables, NUL, RTL, emoji | normalização definida; sem bypass/perda |
| INP-006 | body e string acima do limite | 413/400 antes de consumo excessivo |
| INP-007 | paginação negativa, enorme, NaN, duplicada | schema rejeita/limita |
| INP-008 | URL interna/metadata em qualquer import/avatar/webhook futuro | SSRF bloqueado |
| DATA-001 | entidade serializada | sem hash, sessão, segredo e colunas internas |
| DATA-002 | erro de constraint/DB | sem SQL, schema, stack ou PII |
| DATA-003 | export | tenant correto, autorização e formula injection mitigada |
| DATA-004 | soft-deleted | invisível ou acessível apenas conforme política |
| DATA-005 | backup/restore | dados íntegros e acesso protegido |
| DATA-006 | logs/APM | redaction de Authorization, Cookie, senha e tokens |

## 7. Disponibilidade e concorrência

| ID | Cenário | Resultado esperado |
|---|---|---|
| DOS-001 | rajada de login/reset/convite | 429 e recuperação controlada |
| DOS-002 | `limit` máximo e além do máximo | limite aplicado/rejeitado |
| DOS-003 | batch no limite e acima | custo limitado; transação consistente |
| DOS-004 | conexões lentas/body lento | timeouts no proxy/API |
| DOS-005 | PostgreSQL indisponível | 503/erro seguro; sem loop agressivo |
| DOS-006 | requests concorrentes conflitantes | 409/serialização definida; sem corrupção |
| DOS-007 | shutdown/redeploy | readiness cai; requests em voo drenados |

Teste de carga deve reportar p50/p95/p99, erro, pool DB, CPU/memória e saturação. O
SLO será definido pelo produto; até lá não inventar um número de aceite.

## 8. Matriz de frontend, acessibilidade e responsividade

### Viewports obrigatórios

| CSS px | Referência | Cobertura |
|---:|---|---|
| 320×480 | iPhone 4 e mínimo contratado | todos os fluxos críticos |
| 360×640 | Android pequeno | todos os fluxos críticos |
| 375×667 | iPhone compacto | smoke visual |
| 390×844 | iPhone moderno | todos os fluxos críticos |
| 768×1024 | tablet portrait | navegação e tabelas/formulários |
| 1024×768 | tablet landscape/notebook | regressão de layout |
| 1440×900 | desktop | regressão visual principal |

Em 320 px:

- nenhum scroll horizontal da página; tabelas usam alternativa acessível (cards,
  colunas prioritárias ou scroll contido com indicação);
- ações primárias permanecem visíveis e alcançáveis sem depender de hover;
- modais não excedem viewport, têm scroll interno correto e foco não escapa;
- alvos interativos atendem WCAG 2.2 AA, salvo exceções permitidas;
- teclado virtual não esconde campo/erro/CTA; orientação e zoom não são bloqueados;
- textos longos em espanhol/português não truncam informação essencial.

### WCAG 2.2 AA

Testar teclado completo, ordem de foco, foco visível/não oculto, skip link, landmarks,
headings, nomes acessíveis, labels/erros, contraste, reflow 320 CSS px, zoom 200% e
400%, reduced motion, status via live region, autenticação acessível e timeout.
Automação axe é obrigatória, mas validação manual com teclado e leitor de tela cobre
as jornadas de login, troca de idioma, projeto, usuário e permissões.

### Estados por componente

Cada componente/fluxo deve cobrir: default, hover quando aplicável, focus-visible,
active, disabled, loading, empty, success, warning, erro de validação, erro de rede,
sem permissão, conteúdo longo e skeleton sem layout shift relevante.

## 9. i18n e normalização

Locales suportados: `pt-BR`, `es` e `en`. Dicionários usam as mesmas chaves tipadas;
nenhum texto de interface deve ficar hardcoded fora da camada de i18n.

| ID | Cenário | Resultado esperado |
|---|---|---|
| I18N-001 | primeira visita com locale suportado do navegador | preset normalizado correto |
| I18N-002 | locale regional (`es-MX`, `en-US`) | resolve para preset suportado definido |
| I18N-003 | locale desconhecido | fallback consistente, proposto `pt-BR` |
| I18N-004 | preferência salva vs navegador | ordem de precedência documentada e estável |
| I18N-005 | troca em runtime | UI inteira atualiza sem reload/perda de formulário |
| I18N-006 | chave ausente | detectada no CI; sem chave crua em produção |
| I18N-007 | interpolação/plural zero/um/muitos | gramática correta por locale |
| I18N-008 | data/hora/número | `Intl`, timezone explícito, sem parsing ambíguo |
| I18N-009 | acentos/combining characters | busca/validação conforme regra normalizada |
| I18N-010 | resposta de erro da API | código estável traduzido no cliente; sem depender do texto |
| I18N-011 | espanhol/português com expansão | sem overlap/truncamento em 320 px |
| I18N-012 | idioma persistido | isolado por usuário, sem vazamento entre sessões |

Executar pseudo-localização com expansão de ~30% e caracteres acentuados. O conteúdo
gerado de personas deve carregar metadado de idioma; não traduzir automaticamente
dados do usuário ao alternar a UI.

## 10. Configuração e observabilidade

| ID | Verificação |
|---|---|
| CONFIG-001 | API/DB não publicam porta desnecessária e DB não é público em produção |
| CONFIG-002 | container non-root, sem privileged/socket/capabilities excessivas |
| CONFIG-003 | debug/stack/Swagger de produção desativado ou protegido |
| CONFIG-004 | CORS allowlist, CSP e headers de segurança corretos |
| CONFIG-005 | nenhum segredo em Git, imagem, sourcemap, `VITE_*` ou logs |
| CONFIG-006 | migrations usam credencial separada; app DB role é least privilege |
| CONFIG-007 | dependency/container scan e SBOM gerados no CI |
| OBS-001 | todos os requests possuem requestId correlacionável |
| OBS-002 | ações sensíveis geram auditoria com ator/tenant/alvo/resultado |
| OBS-003 | tentativa cross-tenant repetida dispara sinal/alerta |
| OBS-004 | relógio UTC e integridade/imutabilidade de auditoria verificadas |
| OBS-005 | acesso a logs/auditoria é restrito e também auditado |
| OBS-006 | erros 5xx preservam diagnóstico interno sem expor detalhes ao cliente |

## 11. Execução black-box

O script `qa/blackbox-multitenancy.sh` não conhece a implementação interna. Ele usa
variáveis de ambiente para adaptar os paths e executa checks não destrutivos por
padrão. Exemplo:

```bash
BASE_URL=https://staging.example.test \
TENANT_A_TOKEN='token-a' TENANT_B_TOKEN='token-b' \
TENANT_A_ID='uuid-a' TENANT_B_ID='uuid-b' \
PROJECT_A_ID='uuid-a1' PROJECT_B_ID='uuid-b1' \
bash qa/blackbox-multitenancy.sh
```

Nunca executar testes mutáveis em produção. Para habilitá-los apenas em ambiente
descartável, defina `RUN_MUTATING=1` e revise paths/payloads primeiro.

A suíte específica da regra nova autentica usuários reais e cobre IDs cruzados,
mass assignment, estado pendente, identidade multicliente e revogação imediata:

```bash
# O nome do banco precisa terminar em _qa. A URL nunca pode apontar ao banco dev/prod.
export QA_DATABASE_URL='postgresql://.../personaia_spec_qa?schema=public'
DATABASE_URL="$QA_DATABASE_URL" npm run prisma:migrate -w @personaia/api

# O seed recusa outro nome/schema e exige confirmação explícita. Ele reseta somente
# as tabelas de aplicação desse banco isolado e gera config local mode 0600.
PERSONAIA_QA_RESET=I_UNDERSTAND_THIS_ISOLATED_QA \
QA_DATABASE_URL="$QA_DATABASE_URL" \
node qa/seed-spec-fixtures.mjs

# Inicie uma API separada apontando para QA_DATABASE_URL (o config usa porta 3101).
SPEC_QA_CONFIG=qa/.tmp/spec-blackbox.config.json \
node --test qa/spec-blackbox.test.mjs

# Mutações são opt-in e nunca devem apontar para produção.
RUN_MUTATING=1 SPEC_QA_CONFIG=qa/.tmp/spec-blackbox.config.json \
node --test qa/spec-blackbox.test.mjs
```

`qa/seed-spec-fixtures.mjs` cria tenants, workspaces, projetos, ativos, snapshots,
identidades multicliente, grants/denies e fixtures de corrida determinísticas. O
arquivo real de configuração fica sob `qa/.tmp/` ignorado pelo Git; não deve ser
anexado à evidência. Rode o seed novamente antes de cada execução integral para
restaurar o estado canônico.

O runner serializa logins e, por padrão, aguarda `12.500 ms` entre tentativas para
respeitar o rate limit real de 5/minuto. Em ambiente de QA cujo limitador tenha sido
explicitamente isolado/configurado, `QA_LOGIN_INTERVAL_MS` pode ajustar esse tempo;
não contorne o rate limit em produção.

As constraints, triggers append-only, FK compostas e sobrevivência do snapshot são
validadas diretamente no PostgreSQL real dentro de uma transação revertida:

```bash
psql "$DATABASE_URL" -f qa/postgres-invariants.sql
```

Use credencial de teste/migration em banco descartável; a role de runtime também deve
ser testada separadamente para comprovar least privilege.

A paridade de chaves e placeholders entre `pt-BR`, `es` e `en` é executável sem
dependência externa:

```bash
node --test qa/i18n-parity.test.mjs
```

## 12. Template de evidência e defeito

Evidência: build/commit, ambiente, seed, caso, requestId, horário UTC, resultado,
screenshot/trace sanitizado e link do log. Nunca anexar token/cookie real.

Defeito: ID, severidade, tenant/papel, pré-condição, passos mínimos, atual, esperado,
impacto, evidência, frequência e regressão. Para segurança, restringir visibilidade
e não publicar exploit funcional contra produção.

Severidade:

- P0: vazamento/alteração cross-tenant, takeover global, RCE, segredo produtivo;
- P1: bypass de permissão relevante, injection/XSS armazenado, indisponibilidade
  ampla, perda de dados;
- P2: função principal incorreta sem workaround simples, acessibilidade AA séria;
- P3: impacto limitado, cosmético ou workaround seguro.
