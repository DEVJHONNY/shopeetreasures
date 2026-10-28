# Design e acessibilidade

## Direção

Achados úteis, comparação tranquila e retorno voluntário. A vitrine usa fundo claro, verde profundo e laranja para manter relação visual com a marca existente. A página VIP usa a mesma família de cores em fundo escuro. Sem cronômetro artificial, depoimentos ou contagem de membros sem comprovação.

## Fonte de verdade

- `public/storefront.css`: tokens e ajustes responsivos da vitrine.
- `public/vip.html`: estilos e ferramenta de comparação da página do grupo.
- `public/campaign.js`: favoritos locais e teclado no detalhe de produto.
- `public/admin-campaign.js`: apresentação das métricas reais.

O CSS adicional preserva a estrutura e os fluxos existentes. Em futura limpeza, consolidar as regras antigas somente após conferir as telas; não trocar o framework para realizar uma alteração visual.

## Interações e revisão

Busca e ordenação têm nomes acessíveis; botões têm foco visível. Há atalho para o catálogo. Diálogo de favoritos usa `dialog`; o detalhe de produto fecha com Escape e limita Tab aos seus controles. Movimento reduzido é respeitado. Erros do catálogo oferecem nova tentativa.

No celular, a vitrine prioriza texto, busca e ofertas, com duas colunas de produtos; o cartão lateral explicativo aparece em telas maiores. A faixa de categorias rola dentro de si. Favoritos ficam acima da navegação inferior.

Revisão manual em navegador: vitrine, favoritos, reabertura de produto, login com senha fictícia e aviso de prévia. Página VIP revisada em tela pequena e comparador conferido com valores de exemplo. Auditoria completa de leitor de tela e de todos os controles administrativos ainda não realizada.

## Referências aplicadas

Adoção proporcional do Vibe Coding Toolkit: preservar a stack, documentar produto e critérios, reutilizar componentes e comprovar mudanças. Referências: `templates/project-docs/design.md.template` e catálogo de revisão de UI da cópia local fornecida pelo proprietário. [Diretrizes de interface da Vercel](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) consultadas para foco, nomes acessíveis, movimento e estados de erro.
