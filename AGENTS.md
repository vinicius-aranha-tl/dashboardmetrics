<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Business rules for metrics (success rate, rerun dedup, failure grouping, coverage, projection, cross-project aggregation) live as pure functions in `src/lib/metrics.ts` with tests in `metrics.test.ts` — keeps rules verifiable without UI.
- Projects (with API/UI repo owner+name+branch; legacy URL columns are deprecated fallbacks) and dashboard widgets live in the database; widget rows with `project_id` null belong to the overview. No rows = code defaults, materialized on first edit.
- Failure/flaky panels read test-stability-30d, failure-reasons-30d and failure-lifecycle as primary sources (API+UI grouped, `buildSpecial` in useDashboard); history.json only as labeled per-product fallback.
- GitHub JSON (`squaredup/*.json` via Contents API) is fetched only in `src/lib/sources.functions.ts` (authenticated server fn, `GITHUB_TOKEN` server secret, host allowlist, 5-min in-memory cache); file parsing/normalization lives in pure `src/lib/normalize.ts` with tests. Missing config → labeled demo data; failure → error state, never silent mock.
- Access is invite-only: public signup disabled; admins create users via `src/lib/admin.functions.ts`; roles in `user_roles` (admin/viewer); all app pages live under `src/routes/_authenticated/`.
- Global period/origin filters live in `FiltersProvider` (`src/data/useDashboard.tsx`).
- App version constant is `APP_VERSION` in `src/components/dash/AppShell.tsx`; bump it on meaningful changes.
