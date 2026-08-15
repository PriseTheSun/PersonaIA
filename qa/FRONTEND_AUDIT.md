# Auditoria técnica do frontend — gestão multicliente

Data: 2026-08-15  
Escopo: `/register`, app shell e código das rotas `/workspaces`, `/projects`,
`/users`, `/permissions`, `/personas` e `/questionnaires`.

## Health score

| Dimensão | Nota | Evidência principal |
|---|---:|---|
| Acessibilidade | 3/4 | formulário público com labels/nomes corretos, foco global visível e HTML semântico; falta rodada axe/leitor de tela autenticada |
| Performance | 3/4 | rotas lazy, consultas abortáveis e listas simples; associações múltiplas disparam mutações paralelas sem coordenação |
| Responsividade | 4/4 | 320×480 real sem overflow; estruturas viram coluna e listas substituem tabelas rígidas |
| Theming | 4/4 | tokens OKLCH consistentes, claro/escuro e reduced motion global |
| Anti-patterns | 3/4 | produto visualmente contido e consistente; entrada manual de UUID reinventa seleção de usuário |
| **Total** | **17/20** | **Bom — corrigir bloqueio de jornada antes do release** |

## Verificações executadas

- `320×480`: viewport 320, largura do documento 305, zero elementos fora dos
  limites; formulário possui scroll vertical natural.
- Campos e CTA principal medem 44 px de altura; botões de idioma/tema medem 40 px,
  acima do mínimo WCAG 2.2 de 24×24 px.
- DOM do cadastro expõe `main`, região nomeada, `h1`, labels, nomes acessíveis nos
  botões de senha, links e status do Sonner.
- `prefers-reduced-motion` reduz animações e transições globalmente.
- i18n automatizado: 4/4 PASS para paridade de chaves, placeholders e vocabulário
  crítico em `pt-BR`, `es` e `en`.
- Frontend reportado pelo agente FRONT: 29/29 testes, lint sem warning e build OK.

## Achados

### [P1] Inclusão de usuário exige UUID digitado manualmente

- Local: `features/users/users-page.tsx`, `MembershipForm`.
- Impacto: o administrador não vê nem conhece o UUID global, portanto o UC-03 não
  é concluível em poucos cliques e pode induzir erro de pessoa.
- Recomendação: ao adicionar a workspace, listar os vínculos ativos do cliente com
  nome/e-mail e enviar o ID selecionado. Ao adicionar ao cliente, oferecer busca
  exata por e-mail autorizada, sem endpoint de enumeração global para CLIENT_ADMIN.
- Comando sugerido: `$impeccable harden`.

### [P2] Exclusão do workspace padrão é oferecida embora sempre falhe

- Local: `features/workspaces/workspaces-page.tsx`.
- Impacto: o usuário abre confirmação e recebe conflito previsível do backend.
- Recomendação: desabilitar/ocultar `Excluir` quando `isDefault`, com explicação
  textual acessível no menu.
- Comando sugerido: `$impeccable clarify`.

### [P2] Associação múltipla pode terminar parcialmente aplicada

- Local: `features/assets/assets-page.tsx`, `AssociationEditor.save`.
- Impacto: `Promise.all` dispara associações e desassociações independentes; uma
  falha pode deixar parte aplicada enquanto a UI exibe apenas erro genérico.
- Recomendação: preferir endpoint batch atômico; enquanto não existir, executar em
  ordem definida, recarregar o estado autoritativo após falha e informar quais
  mudanças foram aplicadas.
- Comando sugerido: `$impeccable harden`.

### [P2] Gate WCAG autenticado ainda não tem evidência automatizada

- Local: suíte e2e.
- Impacto: dialogs, dropdowns, foco após confirmação e matrizes de permissão não
  foram comprovados com axe/leitor de tela em sessão autenticada.
- Recomendação: criar fixture sem segredo produtivo e executar axe + teclado nas
  jornadas críticas em 320×480 e desktop.
- Comando sugerido: `$impeccable audit`.

## Pontos positivos

- Listas responsivas evitam tabelas ilegíveis no iPhone 4.
- `DENY`, herança e override usam texto, não dependem apenas de cor.
- Seletores de escopo têm labels persistentes e nomes previsíveis.
- Ícones Lucide decorativos são ocultados de leitores; botões de ícone recebem
  nomes acessíveis.
- Loading, empty, error, confirmação e toast seguem componentes compartilhados.
- Não foram encontrados gradient text, glassmorphism, card grids decorativos,
  raios excessivos ou motion ornamental nas rotas administrativas.

## Gate

O frontend visual está apto para integração, mas o P1 de seleção de usuário bloqueia
o aceite de facilidade operacional. Após a correção, rodar `$impeccable polish` e
repetir esta auditoria com sessão autenticada.
