# KERN Platform

**KERN** — The Intelligent Website Layer. A managed AI layer for complex, customer-facing websites that understands what a visitor is trying to accomplish, helps or acts in the moment, and turns interactions into actionable friction and revenue intelligence.

> Ground-up build. AlpenChat is intentionally out of scope.

## Strategy documents

- `C:\KERN\AI_Customer_Journey_Intelligence_Blueprint.docx` — business strategy & GTM
- `C:\KERN\AI_Customer_Journey_Intelligence_Design_Document.docx` — product & brand design
- `C:\KERN\AI_Customer_Journey_Platform_Modular_Architecture_Onboarding.docx` — architecture & onboarding
- `C:\KERN\KERN_Master_Timeline.md` — **the single sequencing reference**: phases, exit criteria, milestones, decisions log

## Known issues

See [BUGS.md](BUGS.md) — one entry per bug with verification state and next steps.

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

## M1 eval suite

The formal quality gate (doc 3 §14): 29 golden scenarios across six categories (page awareness, knowledge, navigation, friction, adversarial, cross-page), each with deterministic checks. It drives the real app with the real model.

```bash
npm run eval -w @kern/api   # needs the demo site running + a provider key
```

Exits non-zero below the 80% pass threshold. CI runs it as a manual workflow (`.github/workflows/eval.yml` — requires the `OPENAI_API_KEY` repository secret). Not part of `npm test`: it costs tokens.

## Guide mode (v1)

The assistant can point, not just answer: the model may end a reply with `<<GUIDE:element-id>>`; the API validates the target against the page context it sent (never guides to unknown elements) and strips the directive from the visible reply. The widget highlights the target with the signal-green outline, scrolls it into view, and emits `guide_started`/`guide_completed` events. Replies render a safe markdown subset (HTML escaped first).

## Journey-step detection

The SDK detects which step of a multi-step flow the visitor is on — generic signals in priority order (`aria-current="step"` → page-map stepper hints → URL patterns), each result carrying its detection source and confidence. Journeys are declared in the site's page map and served to the SDK via `GET /site-config` (site-key authenticated). Step state travels in `PageContext.journey` and `journey_step` events — the foundation for friction analytics ("attempts stop at insurance") and guide mode.

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

Set `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) in `apps/api/.env` to enable real model calls; without either the API runs in mock mode.

## Platform basics (Phase 0)

- **Auth:** every SDK request carries the site's key (`x-kern-site-key`). The API seeds a demo site with the fixed dev key `kern-demo-site-key-v0`; real sites get random keys via `POST /admin/sites`. Admin endpoints are dev-only (no auth yet).
- **Tenant isolation:** event tenant IDs are stamped server-side from the authenticated site — clients can never self-report their tenant.
- **Policy engine:** deterministic L0–L4 action decisions with a kill switch; the LLM proposes, this layer decides.
- **Observability:** one structured log line per request (latency) and per gateway call (tokens).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev:demo-site` | Run the demo site locally |
| `npm run dev:api` | Run the API locally |
| `npm run dev:sdk` | Watch-build the SDK |
| `npm run build` / `typecheck` / `test` / `lint` | Run across all workspaces (CI does this) |
