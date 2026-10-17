# Lunna Web (Nuxt 4 + Tailwind + Pinia)

Front-end do Lunna, painel para vendedores do Mercado Livre. A API fica em `lunna-api`.

## Leia antes de mexer
- A documentação por seção do menu está em `lunna-api/docs/secoes/` (o que cada tela faz, dados, regras, arquivos).
  Ao mudar uma tela, atualize o documento dela.
- Regras de negócio: `lunna-api/docs/DECISOES.md`.

## Mapa de pastas (`app/`)
- `pages/`: uma página por item do menu (`index` = Visão geral, `produtos`, `anuncios`, `curva-abc`, `radar-ml`,
  `configuracoes/`).
- `components/`: por seção (`painel/`, `produtos/`, `abc/`, `settings/`).
- `composables/`: estado e chamadas de cada tela (`usePainel`, `useItemsTable`, `useOlistProducts`, `useAbc`…).
- `lib/`: clientes da API (`*Client.ts`), formatação (`format.ts`) e lógica pura (`radar.ts`, `itemsQuery.ts`).
- `layouts/default.vue`: menu lateral. `stores/`, `middleware/`, `plugins/`, `types/`.
- `public/radar/`: base estática do Radar (provisória).
- Testes ficam ao lado do código (`*.test.ts`), com Vitest.

## Regras de ouro
1. O front só exibe, formata e envia filtros. Cálculo e regra de negócio ficam na API.
2. Falar com a API só pelos clientes em `lib/`, nunca com `fetch` solto nos componentes.
3. Dinheiro e porcentagem são formatados por `lib/format.ts` (pt-BR).
4. Sem barra de rolagem horizontal nas tabelas; telas pequenas escondem colunas secundárias.
5. Segredos nunca entram no front nem no git.

## Comandos
- Instalar: `npm install`. Rodar: `npm run dev` (porta 3000; a API local em `http://127.0.0.1:3100`).
- Testes: `npm test`. Lint: `npm run lint`. Tipos: `npx nuxi typecheck`.

## Fluxo de trabalho
- Uma branch por assunto (`feature/...`), commits pequenos em português, testes junto com o código.
- Não fazer push, PR, merge nem deploy sem o dono pedir.
- Um teste de tema (claro/escuro) é intermitente; rode de novo antes de investigar.
