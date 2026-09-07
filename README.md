# KERN

**KERN is an AI layer for complex websites that observes the live state of the interface, grounds its responses in site knowledge and the elements actually on the page, and can guide or safely execute actions behind a deterministic policy layer.**

Instead of answering questions in a vacuum, KERN builds a compact, structured model of the page the visitor is looking at — where they are in a multi-step flow, which fields and errors are visible, what they seem to be trying to do — and uses that to answer, point, fill, or book. Everything the model does beyond talking is proposed by the model and *decided* by deterministic code: registered tools, validated arguments, a permission policy, and a visitor confirmation card. Every interaction becomes a structured event feeding friction analytics that show the business where visitors get stuck, with evidence.

## What KERN does today

| Capability | What it means in practice |
|---|---|
| **Live page awareness** | The browser SDK captures URL, page type, visible headings and text, interactive elements (with accessible names), visible validation errors, entities, and the current step of a multi-step journey (via `aria-current`, stepper heuristics, or URL patterns) |
| **Grounded answers** | A knowledge layer (site crawler + a curated per-site facts map) retrieves relevant excerpts with a deterministic, explainable scorer, and answers carry citations |
| **Guide mode** | The assistant can point at the exact element the answer refers to — the widget pulses it and scrolls to it — targeting by element id or a synthetic `kern-el-N` reference, so sites without ids still work |
| **Safe actions** | The assistant can fill fields (React-compatibly), select options, click elements, and book through an API connector — but only after the action broker validates the tool call against registered schemas, the policy engine permits the permission level, and the visitor confirms an on-screen card |
| **Session memory** | Short-lived session facts so visitors don't repeat themselves |
| **Friction analytics** | An event warehouse (page views, intents, journey steps, questions, actions, outcomes) feeds a friction engine that clusters repeat questions, dead ends, help-before-exit, and journey abandonment, ranked by `volume × severity × journey value × failure probability`, each cluster linking to the evidence sessions |
| **Admin console** | A dashboard that answers three questions in under 30 seconds: what happened, why it matters, what to do next |

The included demo site (`apps/demo-site`, a mountain-experience booking flow with deliberately realistic friction) is both the development target and a working sales demo. An AI user simulator generates realistic synthetic traffic (labelled as simulated) so the friction engine and the console have data to show before real visitors exist.

## Architecture

```
Browser SDK (script tag / npm)
   │  observes URL, DOM/ARIA, journey state, errors
   ▼
Structured page context (compact JSON — never the raw DOM)
   ▼
API / orchestrator (Fastify)
   │  intent classification · knowledge retrieval · session memory
   ▼
Model gateway (OpenAI / Anthropic / mock)
   │  constrained structured output: reply + guide target + proposed actions + memories
   ▼
Action broker — validation & deterministic policy
   │  tool registry · schema validation · ref/argument checks · permission levels
   ▼
Visitor confirmation card → approved browser action or API call
   ▼
Event stream → warehouse → friction engine → console
```

**The core principle: *the LLM proposes; deterministic code decides.***

Model output does not itself authorize anything. A proposed action must survive every one of these checks before it executes:

1. The tool must exist in the registered tool registry, with a declared permission level, reversibility, and side effects.
2. Arguments are validated against the tool's schema (e.g. ISO dates, integer guest counts).
3. For browser tools, the target must be an element the model was actually shown in the page context — it can never act on elements it never saw.
4. The policy engine decides: read/guide are always allowed; reversible and transactional levels run only under the site's policy; sensitive levels are never automatic; a kill switch freezes all autonomous actions while read-only assistance stays up.
5. The visitor confirms on-screen before anything runs, and every proposal, decision, execution, and result lands in a server-authoritative audit ledger.

### How page context works

The SDK never sends raw DOM. It reduces the page to a compact, versioned schema (`packages/contracts`): url, route, page type (a generic URL-pattern classifier), visible text (title, headings, description, definition-pair breakdowns), relevant interactive elements with accessible names and synthetic refs, visible validation errors, detected entities, and journey state (current step of a multi-step flow, with detection source and confidence). SPA route changes are observed via patched `history` calls and a debounced `MutationObserver` — no polling.

### Knowledge & retrieval

Two complementary layers feed the prompt with provenance:

- A **site crawler** extracts structured content (headings, sections, FAQ pairs, table rows) from the configured routes.
- A **page map** — per-site configuration, never core code — carries curated business facts the crawler can't see (prices behind steps, business rules) plus journey declarations, detection hints, and the experience/alias catalog used for canonical name mapping.

Retrieval is deterministic and explainable: term matches decide contention, heading hits weigh more, page proximity is only a tiebreaker, and matched chunks pull their sibling sections along. The upgrade path (embeddings / hybrid retrieval) exists when content volume justifies it.

### Evaluation

The repository includes a golden evaluation suite (`apps/api/eval/`, run with `npm run eval -w @kern/api`):

- **40 representative scenarios** across six categories: page awareness, knowledge grounding, navigation, friction/objections, cross-page retrieval, and adversarial (never invent facts).
- Each scenario drives the **real application path** — real auth, retrieval, prompt assembly, and a live model call via the gateway — not just mocked unit tests.
- Checks are **deterministic** (required terms, forbidden terms, citation presence, expected guide targets, expected action tools) — deliberately not LLM-judged, so results are explainable.
- The suite has a configured pass threshold (80%) and exits non-zero below it.

Treat a green run as the current regression suite, not a proof of production readiness: the scenarios exercise a demo site with structured page contexts, and real-world sites add the variation no suite fully models. Running the eval consumes model API tokens; CI runs it as a manually triggered workflow.

### Repository structure

```
apps/
  demo-site/     # Demo customer: a booking site with deliberate friction (Next.js)
  api/           # Orchestrator, model gateway, action broker, policy, warehouse, friction (Fastify)
  console/       # Admin console: metrics, friction with evidence, conversations, audit (Next.js)
packages/
  contracts/     # Shared event schema + page schema + structured output contract (zod) — the single source of truth
  sdk/           # Browser SDK: context capture, widget, guide pulse, controlled actions (script tag or npm)
```

### Running locally

```bash
npm install
npm run dev:api          # API on :8787
npm run dev:demo-site    # demo site on :3000
npm run dev:console      # console on :3001
```

Copy `apps/api/.env.example` to `apps/api/.env` and set `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) to use a real model; without either, the API runs in mock mode.

Then: open the demo site, walk the booking flow, and ask the assistant questions — including asking it to fill a field or book (the confirmation card gates every action). To populate the console, run `POST /admin/simulator/run` (or press *Run simulation* in the console).

### Authentication & security model (development status)

- The SDK authenticates requests with a **site key** (`x-kern-site-key`). This key identifies the site and routes the request to its tenant — **because the browser holds it, it is not a confidential credential**. A production deployment would additionally need origin controls, rate limiting, and stronger session boundaries.
- **Tenant IDs are never trusted from the client.** They are stamped server-side from the authenticated site record, so cross-tenant events are structurally impossible.
- `/admin/*` endpoints are **development-only and unauthenticated** — the backend is a local development implementation, not a hardened internet-facing deployment. Production would require authenticated admin access and authorization controls.
- A fixed development key (`kern-demo-site-key-v0`) is seeded at boot for the demo site; real sites get random keys via the admin endpoints.

### Current limitations

- In-memory stores (warehouse, tenants, knowledge, audit) — no persistence yet.
- The knowledge layer is lexical, not vector-based.
- One-shot multi-step booking synthesis from natural language is partially covered by a deterministic fallback; the model layer itself is inconsistent there (see `apps/api/eval/scenarios.ts` for the documented case).
- No hosted demo; the demo site is designed to run locally.
- See [BUGS.md](BUGS.md) for known issues.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev:api` / `dev:demo-site` / `dev:console` | Run each app in dev mode |
| `npm run build` | Build all workspaces (SDK bundles, contracts, both Next apps) |
| `npm run typecheck` | Type-check all workspaces |
| `npm test` | Run unit tests across all workspaces |
| `npm run eval -w @kern/api` | Run the golden evaluation suite against the live pipeline (costs model tokens) |
