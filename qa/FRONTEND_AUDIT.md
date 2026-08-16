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
| Anti-patterns | 4/4 | produto contido e consistente; inclusão usa pessoas elegíveis ou e-mail exato sem enumerar identidades globais |
| **Total** | **18/20** | **Bom — jornada principal desbloqueada; fechar riscos P2 antes do release** |

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
- Frontend validado após a correção: 31/31 testes, lint sem warning, build OK e
  paridade i18n 4/4.

## Achados

### [Resolvido] Inclusão de usuário não exige UUID digitado

- Local: `features/users/users-page.tsx`, `MembershipForm`.
- Evidência: workspace oferece select apenas de memberships `ACTIVE` do cliente,
  com nome/e-mail; inclusão no cliente usa e-mail exato; permissões iniciais são
  definidas no mesmo fluxo.
- Resultado: UC-03 passa a ser concluível sem conhecer identificadores internos.

### [Resolvido] Workspace é uma pasta opcional

- Local: `features/workspaces/workspaces-page.tsx`.
- Resultado: qualquer workspace pode ser excluído; seus projetos são apenas
  desagrupados e continuam disponíveis diretamente na organização.

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

O frontend visual está apto para integração e o bloqueio de seleção foi resolvido.
Os P2 de atomicidade da associação, ação impossível no workspace padrão e evidência
WCAG autenticada permanecem no gate de acabamento.
