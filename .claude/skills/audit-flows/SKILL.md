---
name: audit-flows
description: Run a no-refactor QA audit of the Urano FAF app — typecheck/build/lint plus a live walkthrough of the dashboard, template gallery, art generation, and Supabase-backed cadastro pages, checking the browser console for real errors. Use this whenever the user asks to "audit the app", "check nothing broke", "verificar se quebrou algo", wants a health check after a change, or asks to test/validate flows like templates, escudos/assets, or cadastros. Do NOT use it for one-off unit-level debugging of a single known bug — this is for broad, repeatable verification sweeps.
---

# Audit Flows

A repeatable QA pass for this specific app (Urano FAF / faf-mkt-ops): a 99%-complete
internal tool used daily by real people, with a real Supabase backend behind it. The
point of this skill is to catch regressions and real runtime bugs without touching
anything that already works — see "Ground rules" before fixing anything you find.

## Ground rules

- **No refactors.** Don't restructure, rename, "clean up," or modernize anything while
  auditing. If something works, leave it alone.
- **Smallest fix for a proven bug only.** Only touch code/files when you have concrete
  evidence of a defect (a console error, a broken image, a failed build). Never fix
  something you merely suspect might be an issue.
- **You don't have Supabase credentials.** Never attempt to run SQL against the
  database yourself. When a Supabase permission error surfaces, report the exact
  `GRANT`/`CREATE POLICY` statement (the error's own `hint` field usually has it) and
  ask the user to run it in their SQL editor — then re-verify once they say it's done.
- **Don't fabricate assets.** If an image is genuinely missing (not just misnamed),
  ask the user for the real file. Don't substitute a similar-looking crest/logo.

## Step 1 — Static checks

Run these three and report any errors (warnings are pre-existing and fine — this repo
has ~14 stable ones from `eslint`, e.g. fast-refresh and unused-var warnings):

```bash
npm run typecheck
npm run build
npm run lint
```

If any of these fail, stop and fix the root cause before moving to the live walkthrough
— a broken build makes browser testing meaningless.

## Step 2 — Start the app

Use the Browser tool's `preview_start` with `name: "faf-mkt-ops-dev"` (defined in
`.claude/launch.json`, port 5173). Don't start it via Bash — the preview tool manages
the dev server tab for you.

## Step 3 — Log in

This app requires a real Supabase Auth login. **Ask the user for test credentials each
time** — never hardcode, store, or reuse credentials across sessions. Fill the email/
password fields and submit.

## Step 4 — Walk the flows, watch the console

**Console gotcha:** `read_console_messages` accumulates across reloads in the same tab.
After applying any fix, open a **fresh tab** with `tabs_create` before re-checking
errors — otherwise you'll see the old pre-fix errors and wrongly conclude the fix
didn't work (this happened during the first run of this audit).

Walk these in order:

1. **Dashboard home** (`/`) — loads, no console errors, shows the day's stats.
2. **Template gallery** (`/artes`) — all templates listed: Jogos do Dia, Resultados do
   Dia, Thumbnail FAFTV, Classificação.
3. **Jogos do Dia generation** — open it, click "Selecionar todas", confirm a preview
   renders (check `document.querySelectorAll('svg').length > 0` and that the page text
   does NOT contain "Sem preview disponível").
4. **Broken images check** — after selecting matches, run:
   ```js
   [...document.images].filter(i => !i.complete || i.naturalWidth === 0)
   ```
   For each broken `src`, figure out which case it is before touching anything:
   - **Filename typo**: a similarly-named file already exists in
     `public/assets/escudos/` (e.g. request is `sporting_fc.png`, disk has
     `sporting.png`). Safe to `cp` it to the requested name — this is a static asset,
     not data, so no Supabase access needed.
   - **Genuinely missing**: no candidate file exists. Confirm by fetching the URL
     directly — Vite's SPA fallback returns HTTP 200 for missing static files (it
     serves `index.html`), so check `content-type` too, not just status:
     ```js
     const r = await fetch(url); r.headers.get('content-type') // 'text/html' = missing, 'image/png' = real
     ```
     If missing, ask the user for the real image. Don't copy some other club's crest
     as a stand-in.
5. **Cadastro pages backed by Supabase** — `/cadastros/estadios` and
   `/cadastros/oficiais-dco` are the ones known to need extra grants beyond the base
   schema. Watch for `permission denied for table X` (Postgres code `42501`, HTTP 401).
   That means a missing `GRANT`/RLS policy — not a code bug. Report the fix like this:
   ```sql
   GRANT SELECT ON public.<table> TO anon, authenticated;
   CREATE POLICY "allow read <table>" ON public.<table> FOR SELECT USING (true);
   ```
   Mention that Supabase sometimes needs a schema cache reload after a `GRANT`:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
6. **CSV/XLSX import and PNG export** — these depend on native OS file
   pickers/downloads that the browser tool can't drive. Report them as **untestable**,
   not as pass/fail.

## Step 5 — Report

Use this shape, don't pad it with prose:

| Fluxo | Resultado |
|---|---|
| ... | ✅ / ❌ / ⚠️ untestable |

Then a short bug list — one line each: file, root cause, fix (already applied / needs
user's Supabase SQL / needs user's asset file). Say plainly what you fixed yourself vs.
what's blocked on the user.
