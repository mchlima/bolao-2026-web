# bolao-2026-web

Frontend do **Bolão 2026** ("Amigos do Bolão"). **Nuxt 3** + TypeScript. Deploy na **Vercel** em
`bolao2026.kratinho.com.br`. Consome a API em `https://api-bolao2026.kratinho.com.br`.

> Identidade visual **"Estádio 26"** — seguir o protótipo Claude Design como referência canônica:
> <https://api.anthropic.com/v1/design/h/uH_LKnJREAkR8Mw4s0jG9g?open_file=Amigos+do+Bol%C3%A3o.dc.html>
>
> UI em **pt-BR**; identificadores no código em **inglês**.

## Setup local

```bash
pnpm install
cp .env.example .env
pnpm dev            # http://localhost:3001
```

> A API local sobe em `:3000`; o front em `:3001` (configurado no script `dev`).

## Stack / decisões

- **Nuxt 3** (briefing). Tooling atual já default p/ Nuxt 4 — ver pendência #10 no docs/DECISIONS.
- **Tema** dark/light/**system** via `@nuxtjs/color-mode` (toggle no menu do avatar, persistido).
- **Estado** via Pinia (`@pinia/nuxt`).
- **Bandeiras de seleções:** `country-flag-icons` (SVG inline, tree-shaking).
  **Escudos de clubes:** `logoUrl` do admin. **Fallback:** avatar com iniciais.
- **API:** composable `useApi()` (`$fetch` com baseURL + bearer token).
- **LIVE:** polling/refetch nas telas ao vivo (sem WebSocket) — intervalo no docs/contracts.

## Pontos de atenção (produto)

- Modais de CRUD **não** podem fechar/perder estado em interações internas (propagação p/ backdrop).
- Listagens admin: tabela (desktop) / cards (mobile), paginação avançada, busca, filtros.
- Toasts em toda ação de admin com efeito colateral.

## Estrutura

```
nuxt.config.ts      # modules (color-mode, pinia), runtimeConfig.public.apiBase, head lang pt-BR
app.vue
pages/              # rotas
composables/        # useApi() etc.
assets/css/         # tokens "Estádio 26" (placeholder)
```

## Deploy (Vercel)

Importar o repo; env `NUXT_PUBLIC_API_BASE=https://api-bolao2026.kratinho.com.br`; domínio
`bolao2026.kratinho.com.br` (CNAME no Cloudflare).
