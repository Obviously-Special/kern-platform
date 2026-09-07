# Bug Tracker

Known issues that need fixing. One entry per bug, kept updated with what
we've verified so the next session can pick up without archaeology.

## How to report a bug

1. What you did (page, question/action, in order)
2. What you expected
3. What happened instead
4. Browser + console: press F12 → Console → paste anything red, plus the
   `[kern] sdk …` line (tells us which SDK version the page is running)

---

## BUG-001 — Review-page price breakdown not visible in live browser

- **Status:** OPEN — needs clean-browser reproduction
- **Severity:** medium (feature gap, not a crash; workaround: the Confirm
  button label carries the total)
- **Reported:** 2026-09-03, user walkthrough

**Symptom:** on booking step 6 (Review), asking "what's my total?" or
"break down the prices" → the assistant says the page context does not
provide a breakdown. The `<dl>` price pairs (Base price, Weekend
surcharge, Equipment, Insurance, Total) should be in the captured
`visible_text.description` but the model never sees them.

**What we verified:**
- The review breakdown is `<dl><dt>label</dt><dd>value</dd></dl>` — the
  SDK's description capture now reads definition pairs + list items
  (commit `535f257`)
- jsdom unit test passes (`sdk/test/context.test.ts` — dl capture)
- Eval scenarios pass with hand-crafted contexts (`review-price-total`,
  `review-surcharge-explanation` — eval 36/36)
- SDK now logs `[kern] sdk 1.1.0 mounted` at boot (commit `1444c1b`)

**Prime suspect:** stale SDK bundle in the tester's browser (demo site
loaded before the fix; Next dev dynamic-import chunk cached).

**Next debugging steps:**
1. User: hard refresh (Ctrl+Shift+R) or incognito window; confirm the
   console shows `[kern] sdk 1.1.0 mounted on demo-bergblick`
2. If still broken on a fresh bundle: add a temporary debug log in
   `capturePageContext` printing `description.length` and whether
   `document.querySelectorAll('main dl')` found elements — reproduce,
   read the console, remove the log
3. Possible live-only cause to check: React re-renders the `<dl>` after
   capture, or the wizard unmounts/mounts content on step change such
   that capture runs before the dl is in the DOM (capture happens at
   message-send — user has the review visible, so unlikely, but verify
   with the debug log)
