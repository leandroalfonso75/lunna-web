# lunna-web

Front do **Lunna — Painel de Anúncios do Mercado Livre** (Nuxt 4 + TypeScript, SSR).
Consome a [lunna-api](../lunna-api) e **não calcula nada**: métricas, alertas, Curva ABC, filtros,
ordenação e paginação vêm prontos da API; aqui ficam layout, formatação (BRL, números pt-BR, datas),
cores a partir de estados (`ok`/`warn`/`bad`) e o envio dos filtros como query params.

- Base e convenções copiadas do timeia: clients puros em `app/lib/*Client.ts` + composables finos,
  plugin `$api` com Bearer (cookie `lunna_token`), guard global de auth, store Pinia `session`,
  tokens CSS claro/escuro em `app/assets/css/tokens.css`, testes Vitest ao lado do código.
- Contrato da API: `lunna-api/docs/SPEC.md` (seção 10) e `lunna-api/docs/DECISOES.md` (seção 7).

## Rodar localmente

Node 22 (`.nvmrc`). A API precisa estar no ar em `http://localhost:3100` (ver README da lunna-api).

```bash
npm install
npm run dev          # http://localhost:3101
```

`NUXT_PUBLIC_API_URL` troca o endereço da API (padrão `http://localhost:3100`); é lida em runtime,
então a mesma imagem serve qualquer ambiente.

Build de produção como no container:

```bash
npm run build
PORT=3101 NUXT_PUBLIC_API_URL=http://localhost:3100 node .output/server/index.mjs
```

## Testes e checagens

```bash
npm run typecheck
npm run lint
npm run test
```

## Deploy

Imagem `vinnialfonso/lunna-web` (Dockerfile na raiz, usuário 1001, health em `/api/saude`) e manifests em
`cd/prod/`. Produção em https://gestao.lunnashop.com.br; o deploy dos dois repos é feito pelo
`cd/prod/deploy.sh` do lunna-api (detalhes em `lunna-api/cd/prod/README.md`).
