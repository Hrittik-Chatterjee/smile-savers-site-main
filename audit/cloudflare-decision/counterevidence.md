# Counterevidence — arguments against WORKERS, and whether each survived

Re-run this pass with additional live-fetched Cloudflare evidence (CF-A3, CF-A9, CF-A10) beyond the first pass.

## Counterargument A — "Stay on Pages because Smile Savers is mostly static"

**Did not survive, and the case against it is now stronger than the first pass found.** Static-request economics are not actually equivalent between the two architectures for this specific repo: Workers Static Assets serves static files free/unlimited with zero configuration (CF-A1), while Pages requires an explicit `_routes.json` exclude rule to get the same result once Functions exist (CF-A9) — and this repo has no `_routes.json` at all (REPO-B4). A live Pages deployment of this exact codebase, as currently configured, would invoke a Pages Function (consuming Workers-request quota) on every single static asset request, not just the two real API routes. "Mostly static" is actually an argument *for* Workers here, not for Pages.

## Counterargument B — "Workers is unnecessary complexity"

**Partially survives, in a way the first pass understated.** The first pass's claim that "no compilation step exists or is needed" was wrong — Cloudflare's official Pages→Workers path requires `wrangler pages functions build` (CF-A10). What Smile Savers actually has is a hand-rolled bypass (`src/entrypoint.js` manually importing and routing to `functions/api/*.js`) that works only because the API surface is trivially small (2 flat endpoints, no nesting). This is real, if modest, complexity: it's custom code that must be manually kept in sync with anything `functions/` gains (e.g. `_middleware.js`'s logic, which it currently is NOT in sync with — the confirmed live security-header gap). This lowers Workers' "operational simplicity" score somewhat versus a first-pass reading that treated the hand-rolled approach as free.

## Counterargument C — "Workers Free will hit the 100k/day request limit"

**Does not survive.** CF-A3 confirms the 100k/day figure applies only to Worker/Function invocations, not static assets, on either architecture (with the Pages caveat above). Even at 100,000 dynamic (API) requests/day — a scale far beyond anything plausible for a single Woodside, NY dental practice — Workers Paid costs only ~$5-8/month (COST-MODEL.json `dynamicRequestScenarios`). At any realistic scale (dozens to low hundreds of contact/chat submissions/day), the site stays entirely on Workers Free.

## Counterargument D — "Workers AI free tier is too small"

**Does not survive, but the margin is tighter than "AI suitability" scored it in the first pass.** `ai-stress-test.json` (this pass's full 3-profile × 8-tier table) shows the free 10,000-neuron/day allocation is exhausted between 750–1,000 chat requests/day depending on conversation length (typical profile: exhausted at ~983/day, exactly matching the user-supplied research packet's own correction). That's a real ceiling reachable by a busier practice, not a hypothetical one — but even past it, overage cost is trivial: $0.06/month at 1,000 typical requests/day, ~$30/month even at a (very unlikely for this practice) 10,000/day. The counterargument doesn't survive as a reason to prefer Pages (since Pages Functions would hit the exact same Workers AI neuron ceiling — Workers AI bindings are identical under both architectures, CF-A2), but it DOES survive as a reason to prioritize the token-efficiency work already scoped as Phase 6 in the original spec (out of scope for this pass) if chat volume grows.

## Net effect on the decision

Three of four counterarguments still fail to reverse the Workers recommendation. Counterargument B's partial survival and the corrected compilation-step evidence lower confidence from what a naive first pass might claim, but do not change the direction — see `decision.md`'s updated matrix and `CLOUDFLARE-DECISION.md`'s confidence figure (80%, unchanged from the first pass, since the new evidence both strengthens some categories — Architecture fit, Economics via the `_routes.json` finding — and weakens one — Operational simplicity via the compilation-step correction — leaving the net confidence about where it was).
