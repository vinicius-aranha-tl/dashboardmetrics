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
- Business rules for metrics (success rate, rerun dedup, failure grouping, coverage, projection) live as pure functions in `src/lib/metrics.ts` with tests in `metrics.test.ts` — keeps rules verifiable without UI.
- Data access goes through `src/data/sources.ts` (env-configured JSON sources, mock fallback); remote JSON is fetched only via the server function proxy so GitHub tokens never reach the browser.
- Global filters live in `FiltersProvider` (`src/data/useDashboard.tsx`); pages derive views from the deduped dataset there.
- App version constant is `APP_VERSION` in `src/components/dash/AppShell.tsx`; bump it on meaningful changes.
