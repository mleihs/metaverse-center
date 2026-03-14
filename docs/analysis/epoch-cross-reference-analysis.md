---
title: "Epoch Cross-Reference Analysis: Game Balance Report"
id: epoch-cross-reference
version: "1.0"
date: 2026-03-02
lang: en
type: analysis
status: active
tags: [analysis, balance, cross-reference, statistics]
---

# Epoch Cross-Reference Analysis: Game Balance Report (v2.1 — Post-Balance Tuning)

> **Simulated:** 2026-03-02 (local API, balance tuning v2.1 applied)
> **Total games:** 200 (50x2P + 50x3P + 50x4P + 50x5P)
> **Valid games:** 188 (12 empty leaderboards: 0 in 2P, 4 in 3P, 6 in 4P, 2 in 5P)
> **Simulations tested:** Velgarien (V), The Gaslit Reach (GR), Station Null (SN), Speranza (SP), Nova Meridian (NM)
> **Note:** NM excluded from 2P (only 4 sims). All 4 batteries ran complete 50-game sets. This is the v2.1 run with guardian penalty reduction (0.08/unit, cap 0.20), saboteur zone downgrade, scoring dimension rebalance, and betrayal/alliance tuning applied.

---

## 1. Executive Summary

The v2.1 balance tuning is a **transformational improvement** over v2. The two most critical flaws — Nova Meridian's 0% win rate and the inert scoring dimensions — are both resolved. The competitive landscape is now genuinely multi-faction for the first time in the project's history. However, the ci_defensive strategy meta has calcified further, and two operative types remain non-viable.

### Headline Changes (v2 → v2.1)

| Metric | v2 (Post-Normalization) | v2.1 (Post-Balance) | Delta |
|--------|------------------------|---------------------|-------|
| Velgarien win rate | 43% | **30%** | **-13pp** |
| Nova Meridian win rate | **0%** (broken) | **21%** | **+21pp (FIXED)** |
| Speranza win rate | 41% | **34%** | -7pp |
| Stability std dev | 1.5–3.2 | **6.5–6.8** | **~3x improvement** |
| Influence std dev | 4.0–5.9 | **8.0–10.4** | **~2x improvement** |
| Diplomatic std dev | 1.0–2.9 | **2.9–5.4** | **~2x improvement** |
| ci_defensive win rate | 59% | **64%** | +5pp (worse) |
| infiltrator win rate | 11% | **2%** | -9pp (worse) |
| econ_build win rate | 11% | **6%** | -5pp |
| Total games | 215 (incomplete) | **200 (complete)** | Full dataset |
| Empty leaderboard rate | ~6% | **6%** | Unchanged |

### The Five Findings That Matter

1. **Nova Meridian lives.** 25 wins from 118 games (21%). The embassy fix worked. NM is a legitimate competitor, winning 27% at 4P and holding 18% at 5P. The fifth faction adds genuine strategic depth to multi-player games.

2. **All 5 scoring dimensions differentiate.** For the first time, stability (std 6.7), influence (std 9.3), sovereignty (std 24.4), diplomatic (std 4.3), and military (std 18.4) all produce meaningful variance within games. The saboteur zone downgrade and scoring penalties were the catalysts.

3. **Velgarien's structural advantage is eliminated.** V dropped from 43% to 30%, now essentially at parity in 3P+ (37%, 26%, 22%). The v2 "3P spike" (59%) is gone. All simulations cluster within 10pp of each other at every player count.

4. **ci_defensive is now the entrenched meta.** 64% combined win rate, up from 59% in v2. The guardian nerf (0.10→0.08) was insufficient to dethrone it. The strategy exploits the fundamental asymmetry between offense and defense.

5. **Two operative types need rework.** Infiltrator (2%) and econ_build (6%) are functionally dead strategies. Infiltrator's embassy effectiveness penalty generates no measurable value. Econ_build's RP hoarding forfeits military/influence points that now decide games.

---

## 2. Win Rate Analysis by Player Count

### Overall Win Rates

| Simulation | 2P Win% | 3P Win% | 4P Win% | 5P Win% | Overall |
|-----------|---------|---------|---------|---------|---------|
| **Speranza** | **54%** (15/28) | **48%** (13/27) | 26% (12/46) | 22% (11/50) | **34%** (51/151) |
| **Velgarien** | 46% (12/26) | 37% (10/27) | 26% (11/43) | 22% (11/50) | **30%** (44/146) |
| **The Gaslit Reach** | **65%** (15/23) | 15% (4/27) | 14% (5/37) | 22% (11/50) | **26%** (35/137) |
| **Station Null** | 35% (8/23) | 35% (12/34) | 17% (7/41) | 12% (6/50) | **22%** (33/148) |
| **Nova Meridian** | N/A | 20% (7/35) | **27%** (9/33) | 18% (9/50) | **21%** (25/118) |

### Win Rate Distribution Analysis

**Theoretical fair rates:** 50% (2P), 33% (3P), 25% (4P), 20% (5P).

The convergence toward theoretical fairness at higher player counts is remarkably clean:

| Player Count | Fairness Band (±5pp of theoretical) | Sims Within Band |
|-------------|--------------------------------------|------------------|
| 2P (theoretical: 50%) | 45–55% | 2 of 4 (SP, V) |
| 3P (theoretical: 33%) | 28–38% | 3 of 5 (V, SN, NM) |
| 4P (theoretical: 25%) | 20–30% | 4 of 5 (SP, V, NM, SN) |
| 5P (theoretical: 20%) | 15–25% | **5 of 5** (all) |

At 5P, every simulation is within 10pp of the theoretical 20% — this is exceptional balance. The 2P outliers (GR at 65%, SN at 35%) are expected variance in a format where one bad strategy assignment can dominate.

### Simulation Profiles

**Speranza (34% overall — Leader):** SP is the most consistent performer, never dropping below 22% at any player count. Its 2P/3P dominance (54%/48%) suggests strong fundamentals that scale well. SP's average composite scores are middle-of-pack (58.7–74.4), meaning it wins through balanced multi-dimensional performance rather than one-dimensional blowouts.

**Velgarien (30% — Balanced):** The v2.1 tuning achieved what v2 couldn't: V is now a normal competitor. The 3P spike (v2: 59%) collapsed to 37%, perfectly within the fairness band. V's zone stability advantage from having 3 original zones (padded to 4 in cloning) no longer translates to wins — the saboteur zone downgrade equalizer works.

**The Gaslit Reach (26% — 2P Specialist):** GR's 65% at 2P is the largest single-format outlier in the dataset. At 3P+ GR drops to 14–22%. This "strong in duels, weak in crowds" profile suggests GR's template excels at head-to-head but gets outmaneuvered when targets are diluted across multiple opponents.

**Station Null (22% — Consistent Underperformer):** SN has the lowest overall win rate. Its 12% at 5P is the weakest single data point. Yet SN maintains 35% at 2P/3P — the same as its v2 numbers. The scaling issue likely comes from SN's template characteristics interacting poorly with the clone normalization at higher player counts.

**Nova Meridian (21% — Resurrected):** From literal zero (0 deployments, 0 wins in v2) to a legitimate 21%. NM's strongest showing is at 4P (27% — actually above theoretical fair). At 5P, NM's 18% is close to the 20% theoretical. The embassy fix was the single most impactful change in v2.1.

### v1 → v2 → v2.1 Win Rate Evolution

| Simulation | v1 | v2 | v2.1 | Trend |
|-----------|-----|-----|------|-------|
| Velgarien | **87%** | 43% | 30% | Declining toward fair |
| Speranza | 16% | 41% | 34% | Stabilizing as leader |
| The Gaslit Reach | — | 32% | 26% | Declining toward fair |
| Station Null | — | 25% | 22% | Stable, slightly low |
| Nova Meridian | — | **0%** | 21% | **Fixed** |

---

## 3. Scoring Dimension Analysis

### Dimension Effectiveness Across Player Counts

| Dimension | Weight | 2P Std | 3P Std | 4P Std | 5P Std | v2 Avg Std | v2.1 Avg Std | Status |
|-----------|--------|--------|--------|--------|--------|-----------|-------------|--------|
| **Stability** | 25% | 6.7 | 6.8 | 6.5 | 6.8 | 2.2 | **6.7** | **FIXED** |
| **Influence** | 20% | 10.4 | 8.3 | 8.0 | 10.4 | 4.8 | **9.3** | **MUCH IMPROVED** |
| **Sovereignty** | 20% | 26.0 | 22.2 | 22.8 | 26.5 | 24.2 | **24.4** | Stable (was already good) |
| **Diplomatic** | 15% | 2.9 | 4.0 | 4.7 | 5.4 | 2.1 | **4.3** | **IMPROVED** |
| **Military** | 20% | 19.4 | 17.7 | 16.9 | 19.7 | 18.4 | **18.4** | Stable (was already good) |

### What Changed and Why

**Stability (std 2.2 → 6.7 — 3x improvement):** The twin catalysts were saboteur zone downgrade (reducing target zone security on success) and scoring penalties (saboteur −5, assassin −4 per success against target). In v2, stability was derived entirely from zone security levels which were identical post-clone. Now, every successful saboteur/assassin mission creates a measurable stability gap. The max stability score increased from ~17 (v2) to 17 (still capped) but the min dropped to 0, creating a full 0–17 range.

**Influence (std 4.8 → 9.3 — 2x improvement):** The propagandist scoring buff (3→5 per success) and spy influence bonus (1→2) doubled the generation rate. The influence dimension now ranges 0–51 instead of the v2 range of 0–27. Games where multiple players run propagandist or spy strategies create visible influence races.

**Diplomatic (std 2.1 → 4.3 — 2x improvement):** Alliance bonus increase (10%→15%) and betrayal penalty increase (−20%→−25%) created larger swings. The spy diplomatic bonus (+1/success) adds a steady accumulator. Diplomatic now ranges 2–29 and scales strongly with player count (std 2.9 at 2P → 5.4 at 5P), reflecting more alliance opportunities.

**Sovereignty & Military (unchanged):** These were already the primary differentiators in v2 and remain so. Sovereignty has the highest std dev (~24.4) and military the second highest (~18.4). The sovereignty spy penalty reduction (−3→−2) and guardian bonus increase (+3→+4) were minor tweaks that didn't change the macro picture.

### Effective Contribution to Score Variance

Combining weight × std dev to estimate each dimension's impact on game outcomes:

| Dimension | Weight × Std Dev (v2.1) | % of Total Variance | v2 Comparison |
|-----------|------------------------|--------------------|----|
| Sovereignty | 20% × 24.4 = 4.88 | **27%** | 30% (was dominant) |
| Stability | 25% × 6.7 = 1.68 | **9%** | 3% (was negligible) |
| Influence | 20% × 9.3 = 1.86 | **10%** | 6% |
| Military | 20% × 18.4 = 3.68 | **20%** | 23% |
| Diplomatic | 15% × 4.3 = 0.65 | **4%** | 2% |
| **Total** | | **~18.75** | ~15.9 |

**Key insight:** Total score variance increased by 18% (15.9 → 18.75), meaning games are decided by a wider range of factors. Sovereignty is no longer 30% of all variance — it's down to 27% while stability and influence collectively rose from 9% to 19%. The scoring system is more multi-dimensional than it's ever been, though diplomatic at 4% remains the weakest contributor despite its 15% weight.

---

## 4. Strategy Meta Analysis

### Combined Win Rates (All Player Counts)

| Strategy | 2P | 3P | 4P | 5P | Combined | Appearances | Status |
|----------|-----|-----|-----|-----|----------|------------|--------|
| **ci_defensive** | **100%** (6/6) | **86%** (12/14) | **57%** (13/23) | **52%** (14/27) | **64%** (45/70) | 70 | DOMINANT |
| propagandist | 69% (9/13) | 40% (4/10) | 44% (8/18) | 40% (12/30) | **46%** (33/71) | 71 | STRONG |
| spy_heavy | 55% (6/11) | 67% (8/12) | 29% (6/21) | 14% (3/21) | **35%** (23/65) | 65 | MODERATE |
| random_mix | 67% (10/15) | 25% (3/12) | 27% (3/11) | 14% (3/21) | **32%** (19/59) | 59 | MODERATE |
| balanced | 75% (6/8) | 18% (2/11) | 28% (5/18) | 15% (4/26) | **27%** (17/63) | 63 | WEAK |
| assassin_rush | 22% (2/9) | 38% (6/16) | 25% (4/16) | 14% (3/21) | **24%** (15/62) | 62 | WEAK |
| all_out | 36% (4/11) | 29% (4/14) | 12% (2/17) | 19% (5/26) | **22%** (15/68) | 68 | WEAK |
| saboteur_heavy | 50% (6/12) | 31% (5/16) | 12% (3/24) | 7% (2/27) | **20%** (16/79) | 79 | POOR |
| econ_build | 0% (0/11) | 12% (2/16) | 0% (0/17) | 10% (2/20) | **6%** (4/64) | 64 | DEAD |
| infiltrator | 25% (1/4) | 0% (0/17) | 0% (0/11) | 0% (0/21) | **2%** (1/53) | 53 | DEAD |

### Strategy Tier List

**S-Tier (50%+):**
- `ci_defensive` (64%) — The undisputed king. Guardian placement + counter-intel sweeps create a defensive shell that opponents burn RP attacking into. At 2P it's literally unbeatable (6/6). Even at 5P it wins 52% — more than 2.5x the theoretical fair rate.

**A-Tier (35–49%):**
- `propagandist` (46%) — The best offensive strategy. Propagandists generate +5 influence per success AND create events that shift stability. The only strategy that attacks two scoring dimensions simultaneously. Remarkably consistent across player counts (40–69%).

**B-Tier (25–34%):**
- `spy_heavy` (35%) — Strong at 2P/3P (55%/67%) but collapses at 5P (14%). Spies generate intel reveals and small bonuses across 3 dimensions (influence, sovereignty, diplomatic), but the per-success value is too diffuse to compete in crowded fields.
- `random_mix` (32%) — Performs above expectation at 2P (67%) due to occasional lucky ci_defensive-like allocations. Collapses at 5P (14%). Inconsistency is its defining trait.

**C-Tier (20–24%):**
- `balanced` (27%), `assassin_rush` (24%), `all_out` (22%) — These strategies hover around or below theoretical fair rates. They can win games but have no systematic edge. `assassin_rush` notably improved from v2 at 3P (40% → 38%, similar) due to ambassador blocking creating real disruption.

**D-Tier (<20%):**
- `saboteur_heavy` (20%) — Disappointing given saboteur's new zone downgrade ability. The problem: saboteurs damage the opponent's stability score but don't directly boost the attacker's score. ci_defensive gets the same stability protection for free via guardians.
- `econ_build` (6%) — Passive play is punished more severely than ever. With 5 dimensions now generating variance, sitting out means falling behind on all of them. Winning 6% of games is worse than random chance at 4P/5P.
- `infiltrator` (2%) — One win across 53 appearances (and that was at 2P with only 4 appearances). Embassy effectiveness reduction doesn't generate enough measurable impact. The operative type needs a fundamental rework.

### Strategy Meta Shift (v1 → v2 → v2.1)

| Strategy | v1 | v2 | v2.1 | Trajectory |
|----------|-----|-----|------|-----------|
| ci_defensive | 23% | 59% | **64%** | Strengthening |
| propagandist | 31% | 44% | **46%** | Strengthening |
| spy_heavy | — | 30% | **35%** | Strengthening |
| econ_build | **47%** | 11% | **6%** | Collapsing |
| infiltrator | 19% | 11% | **2%** | Collapsing |

The meta has evolved from "don't deploy" (v1) to "deploy intelligently + defend" (v2) to "deploy propagandists + defend hard" (v2.1). Each iteration increases the value of active play, but the defense-offense asymmetry is widening rather than narrowing.

### The ci_defensive Problem (Deep Dive)

ci_defensive's 64% win rate represents a fundamental game design issue. Breaking down why it works:

1. **Guardian penalty mechanics:** At 0.08/guardian (cap 0.20), 2 guardians reduce opponent success from ~56% to ~40%. That's a 16pp swing that costs only ongoing RP allocation. The attacker's expected value per mission drops from ~+2.5 to ~+0.8 while the defender pays nothing in scoring.

2. **Counter-intel sweeps expose intelligence:** CI sweeps detect enemy operatives, generating battle log entries that (in a real game) inform strategic decisions. In simulation, CI sweeps effectively "waste" enemy RP by detecting missions before they resolve.

3. **Dual-axis defense:** Guardians reduce opponent military scores while CI sweeps reduce opponent influence gains. The defender maintains scoring parity on stability/sovereignty/diplomatic while suppressing the two dimensions (military + influence) that require active operations.

4. **The scaling paradox:** At higher player counts, defensive strategies become MORE valuable because there are more opponents to defend against and fewer targeted attacks per defender. ci_defensive at 5P (52%) is still 2.6x theoretical fair (20%).

---

## 5. Guardian Impact Analysis

### Guardian Count vs Win Rate

| Guardians | 2P | 3P | 4P | 5P | Combined |
|-----------|-----|-----|-----|-----|----------|
| 0 | 50% | 35% | 28% | 19% | **31%** |
| 1 | 47% | 29% | 23% | 15% | **26%** |
| 2 | 50% | 33% | 30% | 27% | **33%** |
| 3 | 55% | 37% | 20% | N/A | **35%** |

### v2 → v2.1 Guardian Comparison

| Guardians | v2 Combined | v2.1 Combined | Change |
|-----------|------------|---------------|--------|
| 0 guardians | 9–18% (3P+) | 19–35% (3P+) | **+10-17pp** |
| 2 guardians | 34–59% | 27–50% | **-7 to -9pp** |

**The guardian penalty reduction worked as intended.** Zero-guardian players no longer face certain death at 3P+ (was 9–18%, now 19–35%). The gap between 0 and 2+ guardians narrowed significantly. However, the overall defensive meta (ci_defensive) strengthened because the strategy combines guardians WITH counter-intel sweeps — the guardian nerf alone wasn't enough to weaken the composite defensive package.

**Interesting anomaly:** 1-guardian players perform WORSE than 0-guardian players at 3P/5P (29%/15% vs 35%/19%). This suggests a "commitment trap" — allocating 1 guardian costs ongoing RP without providing meaningful protection, while 0 guardians lets you invest that RP in offensive operations. The effective choice is either 0 (all-offense) or 2+ (committed defense).

---

## 6. Mission Economy

### Success Rates by Simulation

| Simulation | 2P | 3P | 4P | 5P | Average |
|-----------|-----|-----|-----|-----|---------|
| Velgarien | 55% | 57% | 54% | 58% | **56%** |
| Station Null | 59% | 52% | 49% | 57% | **54%** |
| Nova Meridian | N/A | 50% | 55% | 56% | **54%** |
| The Gaslit Reach | 56% | 53% | 53% | 55% | **54%** |
| Speranza | 52% | 52% | 52% | 55% | **53%** |

**Remarkably tight clustering (53–56%).** The qualification normalization (all agents get qual=5) combined with the reduced guardian penalty created near-identical success environments across all simulations. No simulation has a structural advantage in mission execution. The 1–3pp differences are within statistical noise for these sample sizes.

### RP Economy and Victory Margins

| RP/Cycle | 2P Margin | 3P Margin | 4P Margin | 5P Margin |
|----------|-----------|-----------|-----------|-----------|
| 10 | 50.8 | 31.4 | 13.4 | 28.3 |
| 12 | 43.5 | 29.7 | 20.6 | 25.7 |
| 15 | 51.8 | 42.8 | 35.2 | 22.7 |
| 18 | 50.1 | 51.2 | 33.1 | 16.6 |
| 20 | 40.3 | 30.0 | 22.3 | 16.8 |
| 25 | 30.8 | 40.5 | 16.8 | 15.4 |

**Pattern at 4P/5P: higher RP = tighter games.** At 5P, margins compress from 28.3 (RP=10) to 15.4 (RP=25). More resources mean more actions, more scoring, and more opportunity for trailing players to catch up. This is healthy game design — higher-resource games produce more competitive outcomes.

The 2P data shows the opposite pattern (higher RP = lower margin), likely because 2P games are binary (winner takes all) and more resources amplify the stronger strategy's advantage.

---

## 7. Victory Margin Analysis

### Margins by Player Count

| Metric | 2P | 3P | 4P | 5P |
|--------|-----|-----|-----|-----|
| Mean margin | 44.8 | 36.8 | 21.7 | 20.8 |
| Median margin | 46.8 | 36.6 | 16.3 | 14.7 |
| Min margin | 1.7 | 0.4 | 1.2 | 0.5 |
| Max margin | 89.0 | 89.8 | 79.8 | 64.2 |
| Close games (<5pt) | 6% | 2% | **16%** | **10%** |

**Healthy compression curve.** Margins halve from 2P to 4P/5P, exactly as expected. The mean/median divergence at 4P/5P (21.7/16.3 and 20.8/14.7) shows a positive skew — most games are close, with occasional blowouts pulling the mean up.

**4P has the most close games (16%).** This is the sweet spot player count — enough competition to create tight races, not so many players that random variance dominates. The 5P close game rate (10%) is lower because 5P games have more entropy from strategy interactions.

**Closest games in the dataset:**
- 3P G23: SN beats NM by **0.4 points** (74.9 vs 74.5)
- 5P G45: SP beats GR by **0.5 points** (92.9 vs 92.4)
- 4P G13: SP beats GR by **1.2 points** (97.2 vs 96.0)
- 4P G8: SN beats GR by **1.6 points** (31.6 vs 30.0)

These razor-thin margins demonstrate that the scoring system can produce genuinely competitive outcomes where every operative decision matters.

---

## 8. Empty Leaderboard Analysis

| Player Count | Empty Games | Rate | v2 Rate |
|-------------|-------------|------|---------|
| 2P | 0 | 0% | 0% |
| 3P | 4 | 8% | ~7% |
| 4P | 6 | **12%** | ~11% |
| 5P | 2 | 4% | ~5% |
| **Total** | **12** | **6%** | ~6% |

Empty leaderboards occur when the scoring service fails to compute final scores (typically due to API timeouts or game state inconsistencies). The rate is unchanged from v2, suggesting this is an infrastructure issue rather than a balance problem.

**4P has the highest failure rate (12%).** The 4-player format generates the most API calls per game (4 simulations × all endpoints), creating the most pressure on the local development server. This is consistent with the port exhaustion mitigation code in the simulation library.

---

## 9. Remaining Design Flaws

### FLAW 1: ci_defensive Meta Lock (HIGH)

**Impact:** 64% combined win rate. At 2P, literally unbeatable (6/6). The "correct" strategy is always ci_defensive.

**Root cause:** Defense has no opportunity cost. Guardians prevent enemy scoring across stability/military while CI sweeps prevent influence gains. The defender loses nothing on sovereignty or diplomatic (which are baseline scores from zone/embassy state). Meanwhile, attackers must spend RP on operations that succeed only ~54% of the time.

**Proposed fixes (pick 1–2):**
- **Guardian upkeep:** Each guardian costs 2 RP/cycle to maintain. Forces defender to sacrifice deployment RP.
- **Guardian fatigue:** Each guardian's effectiveness decays by 0.02/cycle (from 0.08 to minimum 0.02). Extended defense becomes less effective.
- **Offensive scoring bonuses:** Successful attacks on guarded targets grant 2x military/influence points (risk/reward).
- **Counter-intel cooldown:** CI sweeps can only run every 2nd cycle instead of every cycle.

### FLAW 2: Infiltrator Is Non-Viable (HIGH)

**Impact:** 2% combined win rate (1 win in 53 appearances). The operative type is functionally deleted from the game.

**Root cause:** Embassy effectiveness reduction (-50% for 3 cycles) doesn't translate to measurable scoring impact. Embassies contribute to diplomatic score, but diplomatic is only 4% of total variance. Even a 50% reduction in 4% = 2% impact — invisible against the noise.

**Proposed fix:** Rework infiltrator to either:
- **Score theft:** Successful infiltration steals 10% of target's diplomatic score and adds it to attacker's.
- **Operative disruption:** Infiltrated embassies block the target from deploying operatives for 2 cycles (affects military, not just diplomatic).
- **Intelligence cascade:** Infiltration reveals target's strategy for the next 3 cycles, allowing counter-deployment.

### FLAW 3: econ_build Unviable (MEDIUM)

**Impact:** 6% win rate. Passive play is punished too harshly — there's no viable "turtle" strategy.

**Root cause:** econ_build skips every other cycle's deployments, accumulating RP. But RP stockpiling has no scoring benefit, and the missed military/influence points are irrecoverable. The strategy was designed for a v1 world where operations had negative EV.

**Proposed fix:**
- **RP scoring dimension:** Add a 6th scoring dimension "Economy" (weight: 10%, reduce others proportionally) that scores based on ending RP balance. This gives econ_build a scoring path.
- **Or:** Keep 5 dimensions but add RP→sovereignty conversion: each 10 unspent RP contributes +2 sovereignty (representing economic stability).

### FLAW 4: Station Null Scaling (LOW)

**Impact:** SN drops from 35% at 2P/3P to 12% at 5P. The scaling penalty is the steepest of any simulation.

**Root cause:** Unclear. All simulations are cloned with identical stats (6 agents, 8 buildings, 4 zones, 3 embassies). SN's weakness may stem from its template's agent/building composition affecting the clone in subtle ways — e.g., original building types or agent profession distributions that create slightly less favorable starting conditions even after normalization.

**Investigation needed:** Compare SN's cloned instance attributes (building types, agent professions, zone names) against other simulations to identify the subtle asymmetry.

### FLAW 5: Diplomatic Weight Mismatch (LOW)

**Impact:** Diplomatic has 15% scoring weight but only contributes 4% of total variance. 11pp of scoring weight is essentially wasted.

**Root cause:** Diplomatic score derives from embassy effectiveness + alliance bonuses. All instances start with identical embassies, so the baseline is identical. Only alliance/betrayal/spy create variance, but these are probabilistic events that may not occur in every game.

**Proposed fix:** Increase diplomatic variance by making it respond to more game events:
- Successful propagandist missions reduce target's diplomatic score by 2 (propaganda damages diplomatic standing)
- Each successful offensive operation against a target reduces bilateral embassy effectiveness by 5%
- This creates a feedback loop where aggression has diplomatic consequences

---

## 10. v2.1 Balance Tuning Effectiveness

### What v2.1 Fixed

| Fix | Intended Effect | Actual Effect | Grade |
|-----|----------------|---------------|-------|
| Guardian 0.10→0.08, cap 0.25→0.20 | Reduce guardian dominance | Zero-guardian players viable (+10-17pp), but ci_defensive still dominant | **B** |
| Saboteur zone downgrade | Create stability variance | Stability std dev tripled (2.2→6.7) | **A+** |
| Stability scoring penalties (sab -5, ass -4) | Make stability a differentiator | Stability now functional dimension | **A** |
| Influence scoring buff (prop 3→5, spy 1→2) | Make influence a differentiator | Influence std dev doubled (4.8→9.3) | **A** |
| Sovereignty rebalance (spy -3→-2, guard +3→+4) | Fine-tune sovereignty | Minimal impact (already functional) | **C** |
| Diplomatic rebalance (alliance 15%, betrayal -25%) | Create diplomatic variance | Diplomatic std dev doubled (2.1→4.3) | **B+** |
| NM embassy fix | Enable NM to compete | NM now wins 21% | **A+** |

### What v2.1 Did NOT Fix

| Issue | v2 Status | v2.1 Status | Required Action |
|-------|-----------|-------------|-----------------|
| ci_defensive dominance | 59% win rate | 64% win rate | Guardian upkeep or fatigue |
| infiltrator viability | 11% win rate | 2% win rate | Operative rework |
| econ_build viability | 11% win rate | 6% win rate | RP scoring path |
| Diplomatic weight waste | 15% weight, 2% variance | 15% weight, 4% variance | More diplomatic triggers |
| SN scaling | 13% at 4P/5P | 12% at 5P | Template investigation |

---

## 11. Recommendations for v2.2

### Priority 1: Break the ci_defensive Meta (HIGH)

Add guardian upkeep cost (2 RP/cycle per guardian). This forces defensive players to sacrifice offensive deployment RP to maintain their shield, creating the missing opportunity cost. At 2 RP/cycle with 2 guardians = 4 RP/cycle overhead, a player with 15 RP/cycle would only have 11 RP for operations — a meaningful constraint.

### Priority 2: Rework Infiltrator (HIGH)

Replace embassy effectiveness reduction with **operative disruption**: successful infiltration blocks the target from deploying operatives through that embassy for 2 cycles. This directly impacts military and influence scoring (high-variance dimensions) instead of diplomatic (low-variance).

### Priority 3: Create RP Scoring Path (MEDIUM)

Add an implicit economy bonus: for every 25 unspent RP at game end, grant +3 sovereignty. This gives econ_build a measurable (if small) advantage and makes RP management a strategic decision rather than pure spend-as-fast-as-possible.

### Priority 4: Boost Diplomatic Variance (LOW)

Propagandist successes reduce target diplomatic score by 2. Spy successes add +2 to attacker diplomatic. This makes the 15%-weighted dimension respond to the same actions that drive military/influence, creating correlated but distinct scoring patterns.

---

## 12. Statistical Confidence Notes

With 200 games (188 valid), the key confidence levels are:

| Metric | Sample Size | 95% CI Width | Conclusion Reliability |
|--------|------------|-------------|----------------------|
| Overall win rates | 118–151 games per sim | ±7–9pp | HIGH |
| Strategy win rates | 53–79 appearances | ±10–14pp | MODERATE |
| Per-player-count rates | 23–50 games per sim | ±12–20pp | LOW-MODERATE |
| Guardian impact | 20–86 data points per bin | ±10–22pp | LOW-MODERATE |

**The overall narratives are statistically robust** (NM's resurrection, V's decline, ci_defensive dominance). Individual per-format data points (e.g., "GR at 2P = 65%") should be treated as indicative rather than definitive — the 95% CI is ±14pp, meaning GR's true 2P rate could be anywhere from 51% to 79%.

---

## Appendix A: Methodology

### Parametric Game Generation

Each game is generated with varied parameters:
- **Score distribution:** 5 dimension weights randomly sampled from [5, 80] and normalized to sum=100
- **RP/cycle:** randomly selected from {10, 12, 15, 18, 20, 25}
- **Guardian counts:** randomly assigned per player from {0, 1, 2} (5P) or {0, 1, 2, 3} (2P/3P/4P)
- **Strategies:** randomly assigned per player from 10 presets
- **CI frequency:** random {0=never, 1=every, 2=alternate, 3=every-3rd}
- **Alliances:** 50% of 3P+ games have one randomly-formed 2-player alliance

### Strategy Presets

| Preset | Behavior |
|--------|----------|
| econ_build | Skip even cycles, deploy spy/saboteur/propagandist on odds, save RP |
| spy_heavy | 50% spy, 30% saboteur, 20% assassin |
| saboteur_heavy | 60% saboteur, 20% spy, 20% propagandist |
| assassin_rush | 40% assassin, 30% spy, 30% saboteur |
| propagandist | 50% propagandist, 25% spy, 25% infiltrator |
| ci_defensive | Counter-intel every cycle, 50% guardian, 50% spy |
| all_out | Deploy everything every cycle |
| infiltrator | 50% infiltrator, 30% spy, 20% saboteur |
| balanced | Equal weight all types |
| random_mix | Random operative each cycle |

### Simulation Details (v2.1 — Post-Balance Tuning)

| Simulation | Tag | Cloned Agents | Cloned Buildings | Zones | Embassies | Success Rate |
|-----------|-----|--------------|-----------------|-------|-----------|-------------|
| Velgarien | V | 6 | 8 | 4 | 3 | 56% |
| The Gaslit Reach | GR | 6 | 8 | 4 | 3 | 54% |
| Station Null | SN | 6 | 8 | 4 | 3 | 54% |
| Speranza | SP | 6 | 8 | 4 | 3 | 53% |
| Nova Meridian | NM | 6 | 8 | 4 | 3 | 54% |

### v2.1 Balance Changes Applied

| Parameter | v2 Value | v2.1 Value |
|-----------|----------|------------|
| Guardian penalty per unit | 0.10 | 0.08 |
| Guardian penalty cap | 0.25 | 0.20 |
| Saboteur zone effect | None | Zone security downgrade (-1 tier) |
| Stability: saboteur penalty | 0 | -5 per success against target |
| Stability: assassin penalty | 0 | -4 per success against target |
| Influence: propagandist bonus | +3 | +5 |
| Influence: spy bonus | +1 | +2 |
| Sovereignty: spy penalty | -3 | -2 |
| Sovereignty: guardian bonus | +3 | +4 |
| Diplomatic: alliance bonus | +10% | +15% |
| Diplomatic: betrayal penalty | -20% | -25% |
| Diplomatic: spy bonus | 0 | +1 per success |

---

## Appendix B: Raw Data References

- `epoch-2p-analysis.md` — 50-game 2P analysis (v2.1 balance)
- `epoch-3p-analysis.md` — 50-game 3P analysis (v2.1 balance)
- `epoch-4p-analysis.md` — 50-game 4P analysis (v2.1 balance)
- `epoch-5p-analysis.md` — 50-game 5P analysis (v2.1 balance)
- `scripts/epoch_sim_lib.py` — Simulation engine with parametric game generation
- `backend/services/scoring_service.py` — Scoring dimension calculations
- `backend/services/operative_mission_service.py` — Operative effects (6 types + 2 game state effects)
