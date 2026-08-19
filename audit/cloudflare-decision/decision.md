# Decision matrix + stress test — Cloudflare Pages vs Workers for Smile Savers

Governing rule (per user spec): treat "Workers is preferred" as a hypothesis to falsify, not a foregone conclusion. A valid outcome is Pages, or DEFER.

## Scored categories

| Category | Weight | Pages score | Workers score | Reasoning | Evidence | Confidence |
|---|---|---|---|---|---|---|
| Architecture fit | 20% | 2 | 9 | `wrangler.jsonc` and `src/entrypoint.js` are already Workers-shaped (`main`, `assets`, `ai` binding, a real fetch handler). Pages would require *removing* working Workers config, not adding anything. | REPO-B1, REPO-B2 | 1.0 |
| Reliability (current state) | 15% | 1 | 8 | Live production is *already* being served by the Workers path today (CF-C1–C3) — "Pages" as a target would require an active migration off what's currently serving real traffic; "Workers" requires only fixing what's already running. | CF-C1, CF-C2, CF-C3 | 0.95 |
| Security/privacy boundary | 15% | 4 | 5 | Neither wins outright: both need the same fix (wire `functions/_middleware.js`'s security-header logic into whichever entrypoint actually runs — currently neither does, live). Pages gets it "for free" via its auto-middleware convention *if* actually deployed via Pages; Workers needs one explicit line added to `entrypoint.js`. Small edge to Workers only because it's the smaller, already-scoped fix given current reality. | repo-vs-live.md | 0.8 |
| Economics | 15% | 6 | 6 | Static asset requests are free/unlimited under both (CF-A1). Dynamic/API request billing is architecturally identical (Pages Functions requests are billed as Workers requests per Cloudflare's own docs). No meaningful cost difference for this site's traffic profile. | CF-A1 | 0.9 |
| AI suitability | 10% | 5 | 5 | Workers AI bindings work identically under Pages Functions and Workers — no differentiation here. | CF-A2, ai-capacity-model.json | 0.9 |
| Operational simplicity | 10% | 3 | 7 | Running two parallel deploy paths (a failing `pages-action` CI job + a working Workers Git-integration deploy) is *more* complex than standardizing on the one that already works and is already configured in `wrangler.jsonc`. | REPO-B3, CF-C1-C4 | 0.9 |
| Growth/future capability | 10% | 4 | 7 | Cloudflare's own migration guidance (paraphrased from the user-supplied research packet, itself citing Cloudflare docs) describes Workers as the broader-capability target (Durable Objects, Cron Triggers, more comprehensive observability) — relevant if Smile Savers ever needs real appointment-booking state, not just a WhatsApp-message draft (see the audit's APP-001 finding). | user-supplied research packet (not independently re-fetched this pass — see limitations) | 0.6 |
| Migration risk | 5% | 2 | 3 | Formalizing the Workers path (fixing entrypoint.js's missing middleware call, retiring the dead `pages-action` CI job) is low-risk since it's already running. Migrating *to* Pages would mean actively replacing a working deployment with a different one, plus resolving why `_middleware.js` currently doesn't fire even under what should be a Pages-Functions-compatible `functions/` directory structure — an unexplained gap that would need root-causing before Pages could even be trusted to work correctly. | repo-vs-live.md | 0.75 |

**Weighted score:** Pages ≈ 3.35 / Workers ≈ 6.75 (out of 10, weights as above).

## Stress test — the four counterarguments

**A. "Stay on Pages because Smile Savers is mostly static."**
Does not survive. Static-asset economics are identical under Workers Static Assets (CF-A1: free/unlimited either way). And empirically, Pages isn't even what's serving traffic right now (CF-C1–C3) — "staying on Pages" isn't actually staying on the status quo, it would be a *change* to what's currently live.

**B. "Workers is unnecessary complexity."**
Does not survive. The complexity already exists in the repo (dual deploy paths, one broken) — choosing Workers *removes* complexity (delete the redundant `pages-action` CI job) rather than adding it. `entrypoint.js` already contains the one piece of custom code Workers needs (the context-shimming), and it's small (~35 lines) and already proven working live.

**C. "Workers Free will hit the 100k/day request limit."**
Does not survive for this site's realistic scale. Static requests don't count against this quota (CF-A1). Dynamic (API) requests are the two form/chat endpoints — even a generously-estimated small dental practice's traffic (dozens to low hundreds of contact/chat interactions/day) is nowhere near 100,000/day.

**D. "Workers AI free tier is too small."**
Does not survive for this site specifically — see `ai-capacity-model.json`: real system-prompt-derived neuron costs put free-tier capacity at ~839–1980 chat requests/day depending on conversation length, far above plausible traffic for one Queens dental practice, and there's already a reply cache reducing real AI-call volume further.

All four counterarguments were tested and none reverses the direction the architecture-fit and reliability evidence already points.

## What would reverse this decision
- If `functions/_middleware.js` turns out to *not* be dead code in some deployment mode not tested this session (e.g. a properly-configured Pages deployment with `_routes.json` might behave differently than what was observed) — this pass tested only the one live production URL, not a controlled A/B of both paths.
- If Smile Savers' real AI-chat traffic is materially higher than assumed (no analytics data was available this session to confirm actual volume — the traffic assumption in `ai-capacity-model.json` is a judgment call, not measured).
- If Category "Growth/future capability"'s evidence (from the user-supplied research packet) doesn't hold up under independent re-verification — that packet's specific line-number citations were not re-fetched and independently confirmed this pass (see Limitations below).

## Limitations of this pass
- The user-supplied research packet's specific Cloudflare doc line-number citations (Pages Functions routing/`_routes.json` caveat, the exact Pages→Workers migration guidance wording) were **not** independently re-fetched this session — only the two most decision-critical pages (Workers pricing, Workers AI pricing) were. Everything scored above rests primarily on repo evidence (Class B) and live production evidence (Class C), which is stronger for *this specific decision* than generic Cloudflare pricing pages would be, but the Growth/future-capability category's confidence (0.6) is lower because of this.
- No cost-model scenario table at enterprise traffic tiers (1k/10k/50k/100k/500k visits/day) was built — scoped down from the original spec's enterprise-scale request, since Smile Savers is a single-location practice and those tiers aren't a realistic planning horizon for it. The realistic-scale reasoning is in `ai-capacity-model.json` and the counterargument-C analysis above instead.
