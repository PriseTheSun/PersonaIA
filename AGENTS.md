# AGENTS.md — PersonaIA

Estas orientações valem para todo o repositório. Instruções do usuário e do sistema têm precedência.

## Fontes canônicas

Antes de alterar uma área, consulte somente as referências relevantes listadas em [`docs/README.md`](./docs/README.md):

- produto e regras de negócio: [`docs/PRODUCT.md`](./docs/PRODUCT.md);
- interface e padrões visuais: [`docs/DESIGN.md`](./docs/DESIGN.md);
- segurança e modelo de ameaças: [`docs/SECURITY.md`](./docs/SECURITY.md) e [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md);
- qualidade e aceite: [`docs/qa/TEST_PLAN.md`](./docs/qa/TEST_PLAN.md) e [`docs/qa/SPEC_ACCEPTANCE_MATRIX.md`](./docs/qa/SPEC_ACCEPTANCE_MATRIX.md).

## Organização multiagente

Quando a tarefa pedir atuação multiagente, a coordenação deve dividir apenas trabalhos independentes, explicitar os contratos compartilhados e integrar as entregas antes de considerá-las concluídas.

### Front-End

- Priorizar alta componentização, composição e reutilização; evitar duplicar controles, estados e estilos.
- Usar React, TypeScript, Zod, Tailwind e os componentes Shadcn/Radix já adotados.
- Usar apenas ícones Lucide e manter light/dark mode, i18n e acessibilidade consistentes.
- Usar a skill Impeccable quando disponível e quando o trabalho envolver criação, melhoria ou revisão de interface.
- Usar as skills de Product Design quando disponíveis e quando a solicitação pedir exploração, auditoria, crítica ou implementação fiel de referência visual.

### Back-End

- Priorizar otimização e performance sem enfraquecer os limites de segurança.
- Evitar N+1, consultas sem escopo, payloads ilimitados e transações maiores que o necessário; revisar paginação, índices e planos de consulta quando aplicável.
- Preservar contratos tipados, validação de entrada, operações atômicas e isolamento entre organizações em todas as camadas.
- Mudanças de schema exigem migration reproduzível e validação em PostgreSQL real.

### UX/UI

- Preservar consistência de componentes, hierarquia, linguagem, estados e interações conforme `docs/DESIGN.md`.
- Toda jornada deve funcionar por teclado, com zoom, leitor de tela e `prefers-reduced-motion` quando aplicável.
- O sistema deve permanecer utilizável e sem overflow horizontal a partir de 320×480 CSS px, referência do iPhone 4, além de desktop.
- Validar loading, vazio, erro, sucesso, disabled, permissões insuficientes e conteúdo longo nos três idiomas.

### Cyber Segurança

- Aplicar segurança por padrão e autorização deny-by-default; nenhum identificador enviado pelo cliente é evidência de escopo ou permissão.
- Revisar autenticação, sessão, CSRF, XSS, injeção, mass assignment, upload, rate limit, logs, segredos, supply chain e especialmente BOLA/IDOR e acesso cruzado entre organizações.
- Seguir os gates de `docs/SECURITY.md`, o modelo em `docs/THREAT_MODEL.md`, OWASP ASVS e OWASP API Security Top 10 nas versões adotadas pelo projeto.
- “Get-done” significa corrigir a causa raiz dentro do escopo, adicionar regressão automatizada e verificar o resultado. Risco residual não pode ser ocultado: deve ser documentado com impacto e ação pendente.

### Q.A

- Testar a feature completa, incluindo caminhos felizes, falhas, limites, permissões, isolamento multi-tenant e regressões relacionadas.
- Verificar frontend, API e PostgreSQL na camada proporcional ao risco; mocks não comprovam constraints, concorrência ou isolamento.
- Tratar `console.error`, `console.warn`, erros de rede inesperados, stack traces e erros de terminal como falhas a investigar e corrigir na causa.
- Validar responsividade em 320×480, acessibilidade WCAG 2.2 AA, teclado, light/dark mode e pt-BR/es/en quando a interface for alterada.

## Documentação

- Toda nova documentação deve ser salva em `docs/`. Não criar documentação normativa em `qa/`, `apps/` ou na raiz; `README.md` e este `AGENTS.md` são apenas pontos de entrada.
- Scripts, fixtures, configurações e artefatos executáveis de teste permanecem em `qa/`, mas seus contratos, planos e resultados documentados ficam em `docs/qa/`.
- Quando um padrão, regra ou correção se repetir em duas ou mais features, atualizar a referência canônica correspondente na mesma tarefa.
- A documentação deve refletir o código entregue. Funcionalidades futuras, limitações e riscos residuais devem estar marcados explicitamente, nunca descritos como concluídos.

## Definição de pronto

Uma entrega só está pronta quando, na proporção do risco:

- implementação, migrations e contratos estão integrados;
- lint, TypeScript, build e testes relevantes passam;
- console do navegador e terminais não apresentam erros ou warnings causados pela aplicação;
- isolamento, autorização e cenários negativos foram verificados;
- interface funciona a partir de 320×480 e nos idiomas afetados;
- documentação canônica e testes de regressão foram atualizados.
