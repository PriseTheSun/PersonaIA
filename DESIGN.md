---
name: PersonaIA
description: Administração segura e clara de personas, projetos e equipes.
colors:
  primary: "oklch(0.5558 0.2141 269.02)"
  primary-hover: "oklch(0.4990 0.2028 268.71)"
  secondary: "oklch(0.2049 0.0313 251.40)"
  background: "oklch(0.9675 0.0054 274.97)"
  surface: "oklch(1 0 0)"
  ink: "oklch(0.2795 0.0368 260.03)"
  muted: "oklch(0.5103 0.0322 258.37)"
  border: "oklch(0.9288 0.0126 255.51)"
  accent: "oklch(0.9600 0.0190 276.35)"
  danger: "oklch(0.2049 0.0313 251.40)"
  success: "oklch(0.2049 0.0313 251.40)"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 550
    lineHeight: 1.35
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
---

# Design System: PersonaIA

## 1. Overview

**Creative North Star: "Clareza Operacional"**

PersonaIA parece um ambiente de trabalho preciso sob luz natural: superfícies brancas, camadas discretas, azul-escuro estruturando apoio e azul elétrico reservado ao que requer ação ou atenção. O sistema deriva do Shadcn, preservando affordances familiares e refinando densidade, hierarquia e responsividade para administração recorrente.

A interface rejeita dashboards genéricos cheios de cards, excesso de animações ou gradientes, baixa densidade informacional, fluxos dependentes de muitos modais, glassmorphism decorativo e qualquer escolha que sacrifique clareza por aparência.

**Key Characteristics:**

- Hierarquia silenciosa e previsível.
- Ações primárias raras e inequívocas.
- Tabelas e listas antes de grades decorativas.
- Componentes, foco e estados consistentes.
- Composição estrutural responsiva desde 320 px.

## 2. Colors

A estratégia segue a proporção 60/30/10: cinzas claros e branco dominam a composição, azul-escuro estrutura os elementos de apoio e azul elétrico sinaliza ações, seleção e foco.

### Primary

- **Azul Elétrico** (`#4361EE` / `oklch(0.5558 0.2141 269.02)`): ações primárias, seleção atual, foco e links relevantes.
- **Azul Elétrico Profundo** (`#3651D4` / `oklch(0.4990 0.2028 268.71)`): estado hover/active da cor primária.
- **Azul de Link no Escuro** (`#667DF5` / `oklch(0.6322 0.1800 272.13)`): variante exclusiva para texto pequeno no dark mode, preservando contraste AA.

### Secondary

- **Azul Escuro** (`#0C1825` / `oklch(0.2049 0.0313 251.40)`): botões secundários, superfícies de marca e estados ativos de apoio.
- **Azul de Seleção** (`#EEF1FF` / `oklch(0.9600 0.0190 276.35)`): fundo sutil para itens selecionados e hover contextual.

### Neutral

- **Branco Puro** (`#FFFFFF` / `oklch(1 0 0)`): cards, inputs e elementos elevados de UI.
- **Cinza Claro** (`#F3F4F8` / `oklch(0.9675 0.0054 274.97)`): fundo geral e separação de seções.
- **Cinza Escuro** (`#1E293B` / `oklch(0.2795 0.0368 260.03)`): texto principal de alto contraste.
- **Texto Secundário** (`#5B6779` / `oklch(0.5103 0.0322 258.37)`): explicações e metadados com contraste AA.
- **Cinza Neutro** (`#E2E8F0` / `oklch(0.9288 0.0126 255.51)`): separadores, campos e bordas estruturais.

### Named Rules

**Regra de Uma Voz.** A cor primária ocupa no máximo 10% da tela e comunica ação, seleção ou foco — nunca decoração.

## 3. Typography

**Display Font:** Inter (com `ui-sans-serif`, `system-ui`, `sans-serif`)
**Body Font:** Inter (com `ui-sans-serif`, `system-ui`, `sans-serif`)

**Character:** Uma única família tipográfica reduz ruído e mantém a experiência administrativa familiar. Peso, tamanho e espaçamento — não fontes decorativas — constroem a hierarquia.

### Hierarchy

- **Headline** (650, 24 px, 1.25): títulos de página.
- **Title** (600, 16 px, 1.4): seções, tabelas e painéis.
- **Body** (400, 14 px, 1.5): conteúdo e controles; prosa limitada a 70 caracteres por linha.
- **Label** (550, 13 px, 1.35): rótulos, botões e cabeçalhos densos, sem caixa alta obrigatória.

### Named Rules

**Regra de Escala Fixa.** A interface usa uma escala tipográfica compacta e fixa; responsividade muda a estrutura, não o significado hierárquico do texto.

## 4. Elevation

O sistema é plano por padrão. Profundidade vem de camadas tonais e divisores; sombra aparece apenas em elementos temporários elevados, como menus e popovers, com `0 4px 8px oklch(0.2049 0.0313 251.40 / 0.12)`.

### Shadow Vocabulary

- **Overlay discreto** (`0 4px 8px oklch(0.2049 0.0313 251.40 / 0.12)`): menus, comboboxes e popovers.

### Named Rules

**Regra Plano por Padrão.** Cards e controles em repouso não recebem sombra decorativa.

## 5. Components

### Buttons

- **Shape:** raio moderado (8 px), altura mínima visual de 36 px e alvo de toque de 44 px quando isolado em mobile.
- **Primary:** Azul Elétrico com texto branco, padding horizontal de 16 px.
- **Hover / Focus:** Azul Elétrico Profundo; foco com anel externo azul de 2 px, sempre visível por teclado.
- **Secondary / Ghost:** Azul Escuro ou superfícies neutras com borda discreta; não disputam hierarquia com a ação primária.

### Chips

- **Style:** fundos pálidos e texto escuro; usados para status ou permissões, nunca como substitutos ambíguos de botões.
- **State:** seleção usa cor, texto e ícone para não depender apenas da cor.

### Cards / Containers

- **Corner Style:** 12 px no máximo.
- **Background:** Branco Puro sobre o fundo Cinza Claro.
- **Shadow Strategy:** sem sombra em repouso.
- **Border:** apenas quando necessária para separar uma unidade interativa.
- **Internal Padding:** 16–24 px.

### Inputs / Fields

- **Style:** fundo Branco Puro, borda Cinza Neutro, raio de 8 px e altura de 36–40 px.
- **Focus:** anel Azul Elétrico de 2 px com offset; labels permanecem visíveis.
- **Error / Disabled:** erro combina cor, ícone e mensagem; disabled preserva contraste e explica indisponibilidade quando necessário.

### Navigation

Sidebar branca no tema claro e Azul Escuro no tema escuro; navegação compacta e acionável por drawer em larguras pequenas. O estado ativo combina Azul de Seleção, peso e foco elétrico. O contexto atual de tenant e projeto permanece identificável.

## 6. Do's and Don'ts

### Do:

- **Do** usar tabelas ou listas responsivas para dados administrativos e transformar cada linha em bloco legível abaixo de 640 px.
- **Do** manter ações frequentes acessíveis em até poucos cliques e foco visível em todos os controles.
- **Do** usar raio de 6–12 px, espaçamento em múltiplos de 4 px e transições de estado de 150–200 ms.
- **Do** mostrar loading, vazio, erro e sucesso com instruções acionáveis.

### Don't:

- **Don't** criar dashboards genéricos cheios de cards.
- **Don't** usar excesso de animações ou gradientes.
- **Don't** reduzir a densidade informacional com espaços ou containers sem função.
- **Don't** tornar fluxos dependentes de muitos modais.
- **Don't** usar glassmorphism decorativo.
- **Don't** sacrificar clareza por aparência ou usar cor como único indicador de estado.
