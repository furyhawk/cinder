# Sektori as a Competitive Reference
### Design teardown and player-sentiment analysis for our own arcade/shooter development

**Prepared:** 14 November 2026 · **Audience:** internal design + production · **Status:** external-market reference, not a competitor threat assessment

---

## 1. Scope and method

### 1.1 What this report covers

Sektori is a solo-developed arcade twin-stick shooter by Kimmo Lahtinen (Kimmo Factor Oy, Tampere, Finland), released on Steam, PS5 and Xbox Series X|S on 18 November 2025, with a Nintendo Switch 2 version following on 14 May 2026 [citation:Sektori review — Nintendo World Report](http://www.nintendoworldreport.com/review/75480/sektori-switch-2-review). The developer is an ex-Housemarque programmer (Resogun, Outland, Dead Nation), and Sektori is an iteration on his earlier Trigonarium.

Because the stated purpose is **design reference for our own game**, this report deliberately excludes commercial modelling. It answers two questions only:

1. **How is it built?** Core loop, progression, enemy/boss systems, feel and juice, content volume and pacing.
2. **How is it received, and why?** Review themes, praise/complaint patterns, and what players say about difficulty and retention.

### 1.2 What this report does *not* cover

| Excluded | Reason |
|---|---|
| Unit sales, revenue, wishlist conversion | No public figure exists; would require Gamalytic/VGI-style estimation. **No sales estimate is offered anywhere in this document.** |
| Marketing/positioning strategy, store-page funnel | Out of scope for design reference; would need store-traffic data |
| Technical post-mortem (engine, netcode, renderer) | Not publicly documented at the depth needed |
| Post-launch roadmap | No public roadmap or patch-note archive located |
| Switch 2 performance benchmarks | Sources conflict (see §2 limitations) |

### 1.3 Source tiers

Consistent with how we handle research elsewhere, sources are graded rather than listed flat.

| Tier | Definition | Sources used here |
|---|---|---|
| **T1 — Primary / first-party** | Developer or publisher statements, platform storefronts, official sites | Steam store page and review aggregate; Metacritic aggregates; Lost in Cult (physical edition publisher); official site |
| **T2 — Specialist press with direct play** | Reviews and hands-on coverage from outlets that completed the content | Nintendo World Report, Gaming Nexus, GamingTrend, Rogueliker, digitalchumps, Metro, Hardcore Gamer, GameGrin, Nindie Spotlight, PS4Blog.net, CDKeyPrices |
| **T3 — Aggregated / indirect** | Video reviews summarised from transcripts, forum threads, key-reseller price trackers | GamingByte video review, Steam Community discussions, CDKeyPrices |

Sentiment claims are anchored to T1 aggregates; *thematic* claims (why players praise or complain) come from T2/T3 and are labelled as interpretation.

### 1.4 A note on collection constraints

Page-level fetching was unreliable during collection, so several findings rest on search-result excerpts rather than full-text reads. Where that is true it is flagged. Numeric claims (review counts, percentages) come from aggregate pages and should be treated as **a snapshot dated 14 Nov 2026**, not a live feed.

---

## 2. Assumptions and limitations

These are stated explicitly so the report can be used without re-deriving them.

1. **"Five worlds" is treated as correct.** The official site, Games Press and Gaming Nexus all describe five levels per campaign run. One video review (GamingByte) says "six-stage campaign." We treat that as an error or as counting an intro/tutorial segment separately, and note it rather than averaging it in.
2. **The critic/user split is real but the user sample is small.** Metacritic shows 10 critic reviews at 93 and 92 user ratings at 6.0. Ninety-two ratings is a thin base and can be moved by a few dozen motivated voters; the Steam sample (928 reviews, 96% positive) is roughly ten times larger and points the other way. We treat **Steam as the better read of the engaged audience** and Metacritic user score as a signal about a *specific kind* of dissatisfied buyer, not about the population.
3. **No evidence of organised review bombing was found.** The negative user scores cluster on the same complaints that appear in critical reviews (difficulty, onboarding, port quality), which is more consistent with genuine dissatisfaction than with a campaign. This remains an inference.
4. **Official USD MSRP is unconfirmed.** The Brazilian store price is R$ 64,99. A third-party key tracker lists ~$9.80 (down from $11.53) for PS5/Xbox keys — a reseller street price, **not** an official list price. Any price-value reasoning in this report uses the R$ figure and treats the dollar figure as directional only.
5. **No award nominations were identified** for The Game Awards 2025 or the Indie Game Awards 2025. Absence of evidence, not evidence of absence — nomination lists were checked, not every regional award body.
6. **No patch/update history was located**, so we cannot separate "launch-state problems" from "still-unfixed problems." Complaints are reported as observed, undated relative to fixes.
7. **Switch 2 image-quality claims conflict.** Some coverage describes DLSS-assisted 4K output; other coverage describes a soft image in docked mode. Both are recorded in §5.3 rather than resolved.
8. **Run-length figures vary by skill and difficulty.** Reported values range from ~30 minutes to "the better part of an hour." We present the range and the conditions attached to each.

---

## 3. Key findings

**1. The design thesis is "one verb, maximally exploited."** Sektori gives the player exactly two actions — shoot directionally, and a short invincible dash (`Strike`) that ends in a small explosion — and then builds an entire 20+ hour game out of the interaction between them [citation:Sektori Review — Nintendo World Report](http://www.nintendoworldreport.com/review/75480/sektori-switch-2-review). There are no weapon pickups, no reload, no grenade, no secondary fire button to learn.

**2. Progression is drip-fed currency into a fixed upgrade tree, not build-crafting.** Kills drop experience tokens; tokens spawn upgrade pickups; the player banks them into one of a small set of axes (speed, shields, missiles, blaster/primary fire, strike effectiveness) [citation:Sektori review — GamingTrend](https://gamingtrend.com/reviews/sektori-review), [citation:Sektori Review — digitalchumps](https://digitalchumps.com/sektori-review). This is closer to *Resogun*-style incremental empowerment than to a roguelike deckbuilder.

**3. Card decks add run-to-run variance on top of that tree.** Eight decks exist, customisable as the player unlocks more; a rare yellow pickup mid-run offers three randomised decks to open, granting effects like defensive drones or backwards fire [citation:The NEW Geometry Wars — Sektori Switch 2 Review](https://www.youtube.com/watch?v=QJKoHwZ_vIU). Cards are the *seasoning*; the upgrade tree is the *meal*.

**4. Bosses, not levels, are the content.** Five bosses exist, drawn in randomised order, each with multiple modules and several bullet-hell patterns, and each with "generations" that scale with difficulty and how deep into the run they appear [citation:Sektori Review — Rogueliker](https://rogueliker.com/sektori-review). This single decision buys enormous replay value per art asset — the same five bosses yield a different campaign each run.

**5. The arena is a combatant.** The play space mutates continuously — segments shaved off, carved away, grown — with shape changes roughly every 30 seconds, which destroys the circle-strafe reflex that twin-stick players bring from Geometry Wars [citation:Sektori Review — Rogueliker](https://rogueliker.com/sektori-review), [citation:Sektori Review — digitalchumps](https://digitalchumps.com/sektori-review).

**6. Critical reception is exceptional; the engaged audience agrees; a vocal minority does not.** Metacritic 93 from 10 critics; Steam 96% positive from 928 reviews; Metacritic *user* score 6.0 from 92 ratings, with the Switch 2 user split slightly worse (5.9) [citation:Metacritic — Sektori](https://www.metacritic.com/game/sektori/). The divergence is the single most useful data point in this report (see §5).

**7. The most repeated criticism is not difficulty — it is unexplained systems.** Critics who loved the game still flagged that the mechanics "could do a better job at explaining" themselves [citation:The NEW Geometry Wars — Sektori Switch 2 Review](https://www.youtube.com/watch?v=QJKoHwZ_vIU), and Steam threads from self-identified new players show the same gap: advice threads recommend "try the lower difficulty... focus on upgrading speed then missiles" as if this were non-obvious [citation:Steam Community — "IT'S TOO HARD!!!"](https://steamcommunity.com/app/2105620/discussions/0/833872523488766468).

**8. Difficulty is a retention mechanism *and* a filter.** One reviewer needed seven or eight runs to kill a first boss and never finished the campaign [citation:Sektori Review — Gaming Nexus](https://www.gamingnexus.com/Article/16293/Sektori); another cleared mid difficulty after "many tries" in a ~30-minute run [citation:Sektori Review In 3 Minutes — GamingByte](https://www.youtube.com/watch?v=14FsfES_FRA). Players who bounce describe the same wall; players who stay describe "one more run" compulsion.

---

## 4. Design teardown

### 4.1 Core loop and control economy

| Layer | Implementation | Design consequence |
|---|---|---|
| Moment-to-moment | Move (left stick), aim/fire (right stick), `Strike` dash (invincible, ends in a small explosion, can chain and detonate bomb tokens) | Two verbs. All mastery is spacing and timing, not input complexity |
| Encounter | Arena spawns waves; arena geometry mutates ~every 30s; wave → boss at end of world | Removes positional memorisation; forces re-reading the space |
| Run | Five worlds, each ending in a boss; boss order randomised; death is permanent within the run | ~30–60 min commitment per attempt |
| Meta | Ship unlocks (2nd and 3rd after beating the 3rd and 5th boss in a single run), card/deck unlocks, per-run card selection | Long-horizon goals gated behind *demonstrated* skill, not time served |

The `Strike` deserves emphasis: making the dash **invincible** and **damaging** collapses the usual twin-stick split between "defensive movement" and "offensive commitment." It means the safest action and the highest-scoring action are frequently the same action. That is the mechanical heart of the game and the thing most worth stealing conceptually.

### 4.2 Progression systems

| System | Shape | Player agency | Pacing role |
|---|---|---|---|
| **Upgrade tree** | Fixed axes (speed, shields, missiles, blaster, strike), fed by XP tokens that spawn pickups | Medium — you choose *which* axis to bank into, when | Continuous, intra-run power curve |
| **Upgrade cards** | 8 decks; pre-run deck selection; mid-run rare pickup offers 3 randomised decks | High — deck loadout is the pre-run strategic decision | Variance and build identity |
| **Letter/word collection** | Collect letters to complete words; boosts abilities and multiplies score | Timing-based — a letter already collected can be "wasted" | Score-chase texture, optional depth |
| **Ship unlocks** | 3 ships, each with a unique quirk but the same upgrade axes | Cosmetic-to-moderate; changes feel, not rules | Long-term retention goal |

The important structural observation: **there are three separate progression currencies** (tokens, cards, letters) surfacing in the same arena, all competing for the player's attention during bullet-hell combat. That is a lot of cognitive load for a game whose control scheme is deliberately minimal. It is also, per reviews, exactly where the "explain your systems" criticism lands.

### 4.3 Enemy and boss systems

- **Trash enemies** are described as conventional cannon fodder — their job is pressure and token supply, not novelty [citation:Sektori Review — Rogueliker](https://rogueliker.com/sektori-review).
- **Bosses** are modular: multiple weak-point modules, several selectable patterns, and generation scaling by difficulty and run depth [citation:Sektori Review — Rogueliker](https://rogueliker.com/sektori-review).
- **Randomised order** means the same boss can appear as world 1 or world 5, so encounter difficulty is a function of *when* it appears, not just *what* it is [citation:Sektori Review — digitalchumps](https://digitalchumps.com/sektori-review).
- **Readability risk is explicit in the criticism**: "there are times where the bosses seem to move or rotate entirely in opposition to the player. Perhaps it's the snake that never slithers on the side players need to shoot" [citation:Sektori Review — digitalchumps](https://digitalchumps.com/sektori-review). This is a fairness-perception problem, not a damage problem.

### 4.4 Feel and juice

| Element | What Sektori does | Cost to replicate |
|---|---|---|
| Palette | Saturated neon on near-black; heavy bloom and particle bloom on every kill | Low engineering, high art-direction discipline |
| Audio | Licensed-feeling electronic score by Tommy Baynen, tightly coupled to on-screen intensity; soundtrack sold separately in the physical edition | Moderate (composer + implementation) |
| Feedback | Screen shake, chromatic bursts, hit-stop on strikes, score popups | Low |
| Frame rate | 60fps target, described as "rock solid" on Switch 2 | Platform-dependent |
| Failure | Death is fast, legible and immediately restarted | Low, but requires short load/restart |

The aesthetic is doing real design work: it makes a mechanically austere game feel expensive. It also creates the readability problem — the same particle density that sells impact obscures projectiles. Several reviews praise the spectacle and, in the same breath, note that misreading the arena kills you instantly [citation:Sektori Review In 3 Minutes — GamingByte](https://www.youtube.com/watch?v=14FsfES_FRA).

### 4.5 Content volume and pacing

| Content | Volume | Notes |
|---|---|---|
| Campaign | 5 worlds per run, 5 bosses in randomised order | Boss "generations" multiply effective encounters |
| Difficulty tiers | 3 ("experience" settings) | Lowest tier still described as "satisfyingly tough" |
| Ships | 3 | Unlock gates at 3rd and 5th boss |
| Card decks | 8, customisable | Deck count is the meta-progression spine |
| Additional modes | Present ("extra game modes"), used by the community as training tools for `Strike` chaining | Not fully enumerated in accessible sources |
| Run length | ~30 min (mid difficulty, successful) to "better part of an hour" | Skill- and difficulty-dependent |
| Narrative | None | Deliberate; arcade purity |

Pacing verdict from the sources: the game is **short per attempt, long per session**. Reviews consistently describe intended 30-minute sessions turning into multi-hour ones [citation:Sektori Review — Nintendo World Report](http://www.nintendoworldreport.com/review/75480/sektori-switch-2-review). That is a loop-quality signal, and it is the outcome our own designs should be measured against.

---

## 5. Player sentiment

### 5.1 Scoreboard

| Source | Metric | Value | Sample | Read |
|---|---|---|---|---|
| Metacritic | Critic score | **93** (universal acclaim, 100% positive) | 10 reviews | Exceptional |
| Metacritic | User score | **6.0** | 92 ratings (51% positive / 21% mixed / 28% negative) | Polarised, small n |
| Metacritic (Switch 2) | Critic / User | **93 / 5.9** | 7–8 critic reviews; users 49% positive / 21% mixed / 31% negative | Port amplifies dissatisfaction |
| Steam | All reviews | **96% positive**, "Overwhelmingly Positive" | 928 reviews | Strong, large sample |
| Steam | Recent | 94% positive | 18 reviews (last 30 days) | Stable, thin |
| Individual critics | Range | 8/10 to 10/10 (Nindie Spotlight 98, NWR 10/10, Metro 9/10, GameGrin 9/10, Hardcore Gamer 4.5/5, PS4Blog.net 8/10) | — | No critical dissent found |

![Share of positive ratings by source](/mnt/user-data/outputs/sektori_reception_split.png)

![Metacritic user sentiment split](/mnt/user-data/outputs/sektori_user_sentiment.png)

**How to read the divergence.** The gap between 93 and 6.0 is not a measurement error; it is two different populations. Critics played to completion on a deadline and rewarded craft. The Metacritic user base is self-selected, small, and — judging by the complaint themes below — contains a meaningful share of players who bought an arcade shooter expecting either more onboarding or a less punishing curve. The Steam sample, which is larger and tied to verified purchase, sits with the critics. **Design lesson: a hard game can score 93 with critics and still generate a 28% negative user bloc if the first 20 minutes are illegible.**

### 5.2 Praise themes (what to protect)

| Theme | Frequency in sources | Representative framing |
|---|---|---|
| **Feel / "juice"** | Dominant, near-universal | "as addictive a video game as any I've ever played"; "the closest thing to time travel" |
| **Boss design** | Very high | "Sektori's biggest draw is the difficult multi-phase boss fights" |
| **Run-to-run variance** | High | "each new attempt feels unique is a key incentive to make just one more run" |
| **Soundtrack** | High | "thumping soundtrack"; score sold as a physical-edition extra |
| **Value for price** | Moderate | Consistently framed as a lot of game for an arcade price |
| **One-more-run compulsion** | High | "you'll finish up and swear you just want to do one more run" |

### 5.3 Complaint themes (what to fix if we borrow)

| Theme | Evidence | Design root cause | Severity for us |
|---|---|---|---|
| **Systems are under-explained** | "the game could do a better job at explaining them" (video review); Steam advice threads teaching basics | Three simultaneous currencies (tokens, cards, letters) with no explicit teaching moment | **High** — cheap to fix, directly costs retention |
| **Early difficulty wall** | 7–8 runs to first boss; 3 hours to clear world 1 (reported); "IT'S TOO HARD!!!" thread with 37 replies | Boss generations scale by run depth, so an unlucky early draw can spike; skill floor assumed from genre literacy | **High** — but note the community defends it as intentional |
| **Boss fairness/readability** | "the snake that never slithers on the side players need to shoot" | Rotating modular bosses can present their only weak point away from the player's firing arc | **Medium** — solvable with tells, not damage nerfs |
| **Visual readability in chaos** | "If you misread the arena shift, you die instantly" | Particle density + arena mutation + projectile colour overlap | **Medium** — art/UX discipline |
| **Card-unlock visibility** | Deck unlocks exist but the payoff is opaque in-session | Meta-progression not surfaced where decisions are made | **Low–medium** — UI fix |
| **Switch 2 docked image softness** | Conflicting reports (DLSS/4K vs. soft docked output) | Port-side rendering tradeoffs | **Low** — platform-specific |
| **Difficulty framing / expectation-setting** | Forum conflict between "it's meant to be hard" and "this needs an easy mode" | Store page and onboarding do not set expectations about the curve | **Medium** — messaging, not mechanics |

The complaint list is short, and none of it is about the core loop. That is the strongest possible signal that the loop is correct and the *surround* — teaching, framing, readability — is where the risk sits.

---

## 6. Actionable insights for our development

### 6.1 Prioritised recommendations

| # | Recommendation | Rationale from Sektori | Effort | Confidence |
|---|---|---|---|---|
| 1 | **Protect a two-verb core; add depth through consequence, not inputs** | Sektori's invincible, damaging dash makes defence and offence the same decision. Reviews credit this for the "one more run" pull | Design discipline (low cost, high constraint) | High |
| 2 | **Invest in a first-20-minutes teaching pass** | The single most repeated criticism, present even in 9/10 and 10/10 reviews | Low–medium | High |
| 3 | **Randomise boss *order*, not boss *identity*** | Five bosses × generation scaling × random order yields campaign-level variety from five assets | Low engineering, high content leverage | High |
| 4 | **Mutate the arena, but telegraph the mutation** | Arena shifts kill the circle-strafe reflex and create novelty; Sektori's version kills players who misread it | Medium | Medium–high |
| 5 | **Separate "hard" from "unreadable"** | Critic 93 / user 6.0 split; fairness complaints centre on weak-point exposure, not damage | Medium | High |
| 6 | **Gate meta-unlocks on demonstrated skill, not playtime** | Ships unlock at boss 3 and boss 5 in a single run — a clear, communicable goal | Low | Medium |
| 7 | **Budget for audio as a first-class system** | Soundtrack is cited as a top-three strength and is monetised separately in the physical edition | Medium (composer + implementation) | Medium–high |
| 8 | **Do not build three parallel currencies without a teaching plan** | Sektori's tokens + cards + letters is where its legibility criticism concentrates | Design decision | High |

### 6.2 What to copy, adapt, and avoid

**Copy outright.** The invincible-damaging dash. The boss-generation system (same boss, harder variant, deeper in the run). Randomised boss order. Short restart loop. Neon-on-black palette with restrained *projectile* colour coding.

**Adapt with care.** The arena-mutation cadence — Sektori's ~30-second shape changes are tuned for an audience that already plays twin-stick shooters. For a broader audience, longer stable windows plus explicit pre-shift telegraphing would preserve novelty and remove the "died to a shape change I couldn't see" complaint.

**Avoid.** Three simultaneous progression currencies with no explicit tutorialisation. Meta-progression that is invisible at the moment of decision. Any boss whose only weak point can rotate out of the player's firing arc without a tell.

### 6.3 The one strategic conclusion

Sektori demonstrates that **critical acclaim and a polarised user score are compatible outcomes of the same design decision** — specifically, refusing to soften a skill floor while also refusing to explain your systems. For our purposes the useful reading is not "make it easier." It is: *the loop quality is not the risk; the on-ramp is.* A 93-rated game can absorb a 28% negative user bloc and still be a reference title, but a smaller studio with less critic goodwill cannot. Spending design budget on the first 20 minutes, on boss-fairness tells, and on projectile readability buys the same loop with a much narrower tail of unhappy players.

---

## 7. Open questions worth resolving before we commit

1. **What is the actual churn point?** We have anecdotal "7–8 runs to first boss," not a funnel. If we could obtain achievement-completion percentages (world 1/3/5 clear rates), we could locate the drop-off precisely. This is the single highest-value missing dataset.
2. **Is the Metacritic user bloc a Switch 2 port artefact or a design reaction?** Switch 2 users score slightly worse (5.9) and the same complaints appear on both platforms, which argues design — but a port-quality contribution can't be ruled out without patch history.
3. **How much of the "one more run" effect is the score system versus the boss randomness?** These are separable in our own playtests and should be tested separately.
4. **Does the physical/EDITIONS release (Lost in Cult, 1,500 Switch 2 copies, soundtrack CD) indicate a collector market we should plan for?** Relevant to SKU planning, not to design.

---

## 8. Sources

### Primary
- [Metacritic — Sektori](https://www.metacritic.com/game/sektori/) — critic 93 / user 6.0 aggregates, platform splits
- [Steam — Sektori store page and review aggregate](https://store.steampowered.com/app/2105620/Sektori/) — 928 reviews, 96% positive; recent 94%
- [Lost in Cult — Sektori physical edition](https://www.lostincult.co.uk/) — EDITIONS line, PS5/Switch 2, 1,500-copy Switch 2 cap, soundtrack CD
- [CDKeyPrices — Sektori price tracker](https://www.cdkeyprices.com/) — third-party key pricing (directional only)

### Specialist press (T2)
- [Nintendo World Report — Sektori review (10/10)](http://www.nintendoworldreport.com/review/75480/sektori-switch-2-review) — two-verb control scheme, difficulty tiers, session-length effect
- [Gaming Nexus — Sektori review](https://www.gamingnexus.com/Article/16293/Sektori) — Nex Machina structure comparison, five levels, 7–8 runs to first boss
- [GamingTrend — Sektori review](https://gamingtrend.com/reviews/sektori-review) — upgrade token economy, five worlds per run, run length
- [Rogueliker — Sektori review](https://rogueliker.com/sektori-review) — five bosses, randomised order, generation scaling, arena mutation cadence
- [digitalchumps — Sektori review](https://digitalchumps.com/sektori-review) — three ships and unlock gates, upgrade axes, boss fairness criticism
- [Metro — Sektori review (9/10)](https://metro.co.uk/) — ranked #3 in its 2025 top 20
- [Hardcore Gamer — Sektori review (4.5/5)](https://hardcoregamer.com/) — design-craft praise
- [Nindie Spotlight — Sektori review (98)](https://www.nindiespotlight.com/) — highest recorded critic score
- [GameGrin — Sektori review (9/10)](https://www.gamegrin.com/) — arcade-feel praise
- [PS4Blog.net — Sektori review (8/10)](https://www.ps4blog.net/) — lowest recorded critic score

### Indirect (T3)
- [GamingByte — Sektori Review In 3 Minutes](https://www.youtube.com/watch?v=14FsfES_FRA) — ~30-minute mid-difficulty clear; "six-stage" claim (treated as outlier)
- [The NEW Geometry Wars — Sektori Switch 2 Review](https://www.youtube.com/watch?v=QJKoHwZ_vIU) — eight card decks, three-deck mid-run pickups, "could do a better job at explaining them"
- [Steam Community — "IT'S TOO HARD!!!"](https://steamcommunity.com/app/2105620/discussions/0/833872523488766468) — new-player difficulty discourse, community advice patterns

*Figures are a snapshot as of 14 November 2026. Third-party key prices are reseller street prices, not official MSRP. No sales estimate is included because none is publicly verifiable.*
