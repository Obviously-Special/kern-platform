# KERN Platform

**KERN** — The Intelligent Website Layer. A managed AI layer for complex, customer-facing websites that understands what a visitor is trying to accomplish, helps or acts in the moment, and turns interactions into actionable friction and revenue intelligence.

> Ground-up build. AlpenChat is intentionally out of scope.

## Strategy documents

- `C:\KERN\AI_Customer_Journey_Intelligence_Blueprint.docx` — business strategy & GTM
- `C:\KERN\AI_Customer_Journey_Intelligence_Design_Document.docx` — product & brand design
- `C:\KERN\AI_Customer_Journey_Platform_Modular_Architecture_Onboarding.docx` — architecture & onboarding
- `C:\KERN\KERN_Master_Timeline.md` — **the single sequencing reference**: phases, exit criteria, milestones, decisions log

## Repository layout

```
apps/
  demo-site/     # Stand-in customer: complex booking site with deliberate friction (Next.js)
  api/           # KERN backend: chat orchestrator, knowledge layer, model gateway, event pipeline (Fastify)
packages/
  contracts/     # Shared event schema v1 + zod validation + page classifier — the event-first moat
  sdk/           # Browser SDK: page context capture + chat widget with citations (script tag)
```

## Knowledge layer (v1)

The assistant knows the site two ways:

1. **Crawler** — indexes the site's public content (headings, sections, FAQ pairs, tables) at boot and on `POST /admin/knowledge/sync`
2. **Page map** (`apps/api/src/knowledge/page-map.ts`) — curated business facts not extractable from HTML (prices behind flows, business rules). Per real customer this becomes tenant configuration, never code.

A deterministic retriever selects relevant excerpts per question + page and injects them into the prompt with provenance; answers carry citations (shown in the widget). Upgrade path: embeddings/hybrid retrieval when content volume justifies it.

## Guiding principles

- Never fork the core per customer — customization lives in configuration, connectors, adapters, policies, page maps.
- The LLM proposes; a deterministic policy layer decides.
- Event-first: every feature reads from the same event taxonomy.
- First build target: **one customer, one high-value journey, one measurable outcome.**

## Getting started

```bash
npm install
npm run dev:demo-site   # demo site on :3000
npm run dev:api         # API on :8787
```

Set `ANTHROPIC_API_KEY` in `apps/api/.env` to enable real model calls; without it the API runs in mock mode.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev:demo-site` | Run the demo site locally |
| `npm run dev:api` | Run the API locally |
| `npm run dev:sdk` | Watch-build the SDK |
| `npm run build` / `typecheck` / `test` / `lint` | Run across all workspaces (CI does this) |
