# Product

## Register

product

## Users

O sistema atende equipes que criam e administram personas genéricas para responder pesquisas. O Super Admin opera a plataforma, cria organizações (tenants) e seus Administradores da Organização (`CLIENT_ADMIN`). Cada Administrador da Organização pode atuar apenas nas organizações às quais possui vínculo, administra vários projetos e gerencia usuários e permissões específicas por projeto, sem qualquer acesso cruzado entre organizações.

## Product Purpose

Centralizar a criação e a organização de personas para pesquisas em um SaaS multi-tenant seguro. O produto deve permitir que tarefas administrativas recorrentes — criar uma organização, organizar projetos, mover usuários e ajustar permissões — sejam concluídas em poucos cliques, com isolamento de dados verificável e uma base preparada para a futura definição da matriz completa de acessos.

## Capacidades administrativas globais

- Somente o `SUPER_ADMIN` consulta a auditoria global da plataforma.
- A auditoria reúne todos os eventos persistidos no registro append-only, com ator,
  organização, ação, recurso, escopo, horário UTC e metadados seguros disponíveis.
- Busca, filtros por organização/evento/recurso/período e paginação são processados
  no servidor. Abrir ou filtrar a auditoria também gera um evento auditável.

## Central de notificações

- Toda conta autenticada pode abrir `/notifications` pelo rodapé do sino para
  consultar as notificações destinadas à própria identidade.
- A central oferece filtros por todas, não lidas e lidas, paginação no servidor,
  leitura individual e a ação de marcar todas como lidas.
- A listagem e o total do sino sempre respeitam a autoridade atual do usuário.
  Perder um vínculo administrativo remove imediatamente do feed as notificações
  daquele escopo, inclusive quando a sessão ainda possui um token anterior.
- Notificações que representam uma ação conhecida direcionam ao contexto correto
  do controle de acessos; atividades sem destino permanecem consultáveis no
  histórico sem criar um link enganoso.

## Brand Personality

Clean, elegante e minimalista. A voz é clara, serena e precisa: transmite confiança sem parecer burocrática e facilita decisões sem chamar atenção para a própria interface.

## Anti-references

Dashboards genéricos cheios de cards, excesso de animações ou gradientes, baixa densidade informacional, fluxos dependentes de muitos modais, glassmorphism decorativo e interfaces que sacrificam clareza por aparência.

## Design Principles

- **Clareza operacional:** cada tela deixa evidente o próximo passo e reduz tarefas frequentes a poucos cliques.
- **Segurança visível e verificável:** contexto de tenant, projeto e permissão nunca fica implícito em ações sensíveis.
- **Familiaridade consistente:** padrões do Shadcn são o marco inicial e o mesmo vocabulário de componentes se repete em toda a aplicação.
- **Densidade com propósito:** dados administrativos usam listas e tabelas legíveis; cards aparecem somente quando agrupam algo que realmente funciona como unidade.
- **Inclusão por padrão:** navegação por teclado, contraste, leitores de tela, movimento reduzido e uso em telas de 320 px fazem parte da definição de pronto.

## Accessibility & Inclusion

Conformidade alvo WCAG 2.2 nível AA. A interface deve funcionar por teclado e leitor de tela, respeitar `prefers-reduced-motion`, não depender apenas de cor para comunicar estados e permanecer utilizável a partir de 320 px de largura. Textos e formatos são normalizados por presets de idioma em português do Brasil, espanhol e inglês.
