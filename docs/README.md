# Documentação do PersonaIA

Este diretório contém toda a documentação normativa e de apoio do projeto. Scripts, fixtures e artefatos executáveis de teste permanecem em `qa/`; seus contratos e resultados documentados ficam aqui.

## Referências canônicas

- [Produto](./PRODUCT.md): propósito, público, papéis e princípios do produto.
- [Design system](./DESIGN.md): tokens, componentes, acessibilidade e responsividade.
- [Segurança](./SECURITY.md): requisitos, controles e gates de segurança.
- [Modelo de ameaças](./THREAT_MODEL.md): riscos, abuso e mitigações.
- [QA de design](./design-qa.md): verificações visuais e de experiência.
- [Plano de QA](./qa/TEST_PLAN.md): estratégia e cenários de teste.
- [Matriz de aceite](./qa/SPEC_ACCEPTANCE_MATRIX.md): rastreabilidade das regras funcionais.
- [Auditoria do frontend](./qa/FRONTEND_AUDIT.md): evidências e pendências da interface.

## Regra de manutenção

Quando uma regra, decisão ou padrão se repetir em duas ou mais features, a documentação canônica correspondente deve ser atualizada na mesma entrega. Documentos descrevem o comportamento realmente implementado; itens planejados ou riscos residuais precisam estar explicitamente identificados como pendentes.
