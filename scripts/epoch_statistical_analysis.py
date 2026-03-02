"""
Epoch Statistical Analysis — Deep Dive
=======================================
Parses the 4 per-player-count analysis markdown files, runs statistical
tests, computes Elo ratings, PCA, logistic regression, strategy Nash
equilibrium, and generates publication-quality visualizations.

Run: scripts/.analysis-venv/bin/python scripts/epoch_statistical_analysis.py
Output: /tmp/epoch-analysis/ (charts + statistical-supplement.md)
"""

import os
import re
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt
import nashpy as nash
import numpy as np
import pandas as pd
import seaborn as sns
from scipy import stats
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

# ── Output Directory ──
OUT = Path("/tmp/epoch-analysis")
OUT.mkdir(exist_ok=True)

# ── Simulation metadata ──
SIM_TAGS = {"V": "Velgarien", "CK": "Capybara Kingdom", "SN": "Station Null",
            "SP": "Speranza", "NM": "Nova Meridian"}
SIM_COLORS = {"Velgarien": "#c0392b", "Capybara Kingdom": "#27ae60",
              "Station Null": "#8e44ad", "Speranza": "#d4a017", "Nova Meridian": "#2980b9"}

# ── Style ──
plt.rcParams.update({
    "figure.facecolor": "#0d1117",
    "axes.facecolor": "#161b22",
    "axes.edgecolor": "#30363d",
    "axes.labelcolor": "#c9d1d9",
    "text.color": "#c9d1d9",
    "xtick.color": "#8b949e",
    "ytick.color": "#8b949e",
    "grid.color": "#21262d",
    "figure.dpi": 150,
    "font.family": "monospace",
    "font.size": 10,
})


# ═══════════════════════════════════════════════════════════════════════
# 1. PARSE MARKDOWN DATA
# ═══════════════════════════════════════════════════════════════════════

def parse_analysis_file(filepath, player_count):
    """Parse an epoch analysis markdown file into structured game data."""
    text = Path(filepath).read_text()
    games = []

    # Parse summary table rows — only valid games (skip empty leaderboards)
    # | 1 | G1: SP+V s5i7v75d8m5 | Speranza | 93.0 | Velgarien | 55.3 | 37.7 |
    pattern = r"\|\s*(\d+)\s*\|\s*G\d+:\s*([\w+]+)\s+s(\d+)i(\d+)v(\d+)d(\d+)m(\d+)\s*\|\s*([\w ]+?)\s*\|\s*([\d.]+)\s*\|\s*([\w ]+?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|"
    for m in re.finditer(pattern, text):
        players_str = m.group(2)
        players = players_str.split("+")
        player_names = [SIM_TAGS.get(p, p) for p in players]
        games.append({
            "game_num": int(m.group(1)),
            "player_count": player_count,
            "players": player_names,
            "player_tags": players,
            "w_stability": int(m.group(3)),
            "w_influence": int(m.group(4)),
            "w_sovereignty": int(m.group(5)),
            "w_diplomatic": int(m.group(6)),
            "w_military": int(m.group(7)),
            "winner": m.group(8).strip(),
            "winner_score": float(m.group(9)),
            "runner_up": m.group(10).strip(),
            "runner_up_score": float(m.group(11)),
            "margin": float(m.group(12)),
        })

    # Parse strategy effectiveness table
    # | balanced | 8 | 6 | 75% |
    strategies = {}
    strat_pattern = r"\|\s*(\w[\w_]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)%\s*\|"
    in_strategy_section = False
    for line in text.split("\n"):
        if "Strategy Effectiveness" in line:
            in_strategy_section = True
        if in_strategy_section:
            sm = re.match(strat_pattern, line)
            if sm:
                strategies[sm.group(1)] = {
                    "appearances": int(sm.group(2)),
                    "wins": int(sm.group(3)),
                    "win_rate": int(sm.group(4)) / 100,
                }

    # Parse guardian impact table
    guardians = {}
    guard_pattern = r"\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)%\s*\|\s*(\d+)%\s*\|"
    in_guardian_section = False
    for line in text.split("\n"):
        if "Guardian Impact" in line:
            in_guardian_section = True
        if in_guardian_section:
            gm = re.match(guard_pattern, line)
            if gm:
                guardians[int(gm.group(1))] = {
                    "games": int(gm.group(2)),
                    "wins": int(gm.group(3)),
                    "win_rate": int(gm.group(4)) / 100,
                    "ops_success_rate": int(gm.group(5)) / 100,
                }

    # Parse score dimension analysis
    # | stability | 6.1 | 6.7 | 0 | 17 | no |
    dimensions = {}
    dim_pattern = r"\|\s*(stability|influence|sovereignty|diplomatic|military)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|"
    for line in text.split("\n"):
        dm = re.match(dim_pattern, line)
        if dm:
            dimensions[dm.group(1)] = {
                "mean": float(dm.group(2)),
                "std": float(dm.group(3)),
                "min": int(dm.group(4)),
                "max": int(dm.group(5)),
            }

    # Parse average scores by simulation
    # | Capybara Kingdom | 82.0 | 9 | 13 | 79 | 9 | 22 |
    avg_scores = {}
    avg_pattern = r"\|\s*(Velgarien|Capybara Kingdom|Station Null|Speranza|Nova Meridian)\s*\|\s*([\d.]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|"
    for line in text.split("\n"):
        am = re.match(avg_pattern, line)
        if am:
            avg_scores[am.group(1)] = {
                "composite": float(am.group(2)),
                "stability": int(am.group(3)),
                "influence": int(am.group(4)),
                "sovereignty": int(am.group(5)),
                "diplomatic": int(am.group(6)),
                "military": int(am.group(7)),
            }

    return {
        "games": games,
        "strategies": strategies,
        "guardians": guardians,
        "dimensions": dimensions,
        "avg_scores": avg_scores,
        "player_count": player_count,
    }


def load_all_data():
    base = Path("/Users/mleihs/Dev/velgarien-rebuild")
    data = {}
    for pc, fname in [(2, "epoch-2p-analysis.md"), (3, "epoch-3p-analysis.md"),
                       (4, "epoch-4p-analysis.md"), (5, "epoch-5p-analysis.md")]:
        data[pc] = parse_analysis_file(base / fname, pc)
    return data


# ═══════════════════════════════════════════════════════════════════════
# 2. ELO RATINGS
# ═══════════════════════════════════════════════════════════════════════

def compute_elo(all_data, k=32, initial=1500):
    """Compute Elo ratings from all game outcomes.

    For N-player games, we treat each game as (N-1) pairwise matchups:
    winner beats each loser. This gives proper credit for winning against
    multiple opponents.
    """
    elo = {name: initial for name in SIM_TAGS.values()}
    history = {name: [initial] for name in SIM_TAGS.values()}
    game_labels = []

    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            winner = game["winner"]
            losers = [p for p in game["players"] if p != winner]

            for loser in losers:
                # Expected scores
                e_w = 1 / (1 + 10 ** ((elo[loser] - elo[winner]) / 400))
                e_l = 1 - e_w

                # Update (scale K by 1/num_losers to avoid inflation in multi-player)
                k_scaled = k / len(losers)
                elo[winner] += k_scaled * (1 - e_w)
                elo[loser] += k_scaled * (0 - e_l)

            for name in SIM_TAGS.values():
                history[name].append(elo[name])
            game_labels.append(f"{pc}P-G{game['game_num']}")

    return elo, history, game_labels


def plot_elo(elo, history, game_labels):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6), gridspec_kw={"width_ratios": [3, 1]})

    # Elo progression
    for name, ratings in history.items():
        ax1.plot(ratings, label=name, color=SIM_COLORS[name], linewidth=1.2, alpha=0.85)

    # Add vertical lines for player count boundaries
    game_idx = 0
    for pc in [2, 3, 4]:
        game_idx += len([g for g in range(50)])  # 50 games per player count
        ax1.axvline(x=game_idx, color="#30363d", linestyle="--", alpha=0.5)
        ax1.text(game_idx - 25, ax1.get_ylim()[0] + 10, f"{pc}P", color="#8b949e",
                 ha="center", fontsize=8)
    ax1.text(game_idx + 25, ax1.get_ylim()[0] + 10, "5P", color="#8b949e",
             ha="center", fontsize=8)

    ax1.set_xlabel("Games Played (chronological)")
    ax1.set_ylabel("Elo Rating")
    ax1.set_title("ELO RATING PROGRESSION", fontweight="bold", fontsize=12)
    ax1.legend(loc="upper left", fontsize=8, framealpha=0.3)
    ax1.grid(True, alpha=0.3)

    # Final Elo bar chart
    sorted_elo = sorted(elo.items(), key=lambda x: x[1], reverse=True)
    names = [s[0] for s in sorted_elo]
    ratings = [s[1] for s in sorted_elo]
    colors = [SIM_COLORS[n] for n in names]
    bars = ax2.barh(range(len(names)), ratings, color=colors, alpha=0.85)
    ax2.set_yticks(range(len(names)))
    ax2.set_yticklabels(names, fontsize=9)
    ax2.set_xlabel("Final Elo")
    ax2.set_title("FINAL RATINGS", fontweight="bold", fontsize=12)
    ax2.axvline(x=1500, color="#8b949e", linestyle="--", alpha=0.5, label="Starting (1500)")
    for bar, rating in zip(bars, ratings):
        ax2.text(bar.get_width() + 5, bar.get_y() + bar.get_height() / 2,
                 f"{rating:.0f}", va="center", fontsize=9, color="#c9d1d9")
    ax2.invert_yaxis()
    ax2.grid(True, alpha=0.3, axis="x")

    plt.tight_layout()
    plt.savefig(OUT / "01_elo_ratings.png", bbox_inches="tight")
    plt.close()
    return sorted_elo


# ═══════════════════════════════════════════════════════════════════════
# 3. CHI-SQUARED TESTS
# ═══════════════════════════════════════════════════════════════════════

def chi_squared_tests(all_data):
    """Test whether win rate differences are statistically significant."""
    results = []

    # Overall win counts
    wins = defaultdict(int)
    games = defaultdict(int)
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            for p in game["players"]:
                games[p] += 1
            wins[game["winner"]] += 1

    sims = sorted(wins.keys())
    observed_wins = np.array([wins[s] for s in sims])
    total_games_per_sim = np.array([games[s] for s in sims])
    expected_wins = total_games_per_sim * (observed_wins.sum() / total_games_per_sim.sum())

    chi2, p_value = stats.chisquare(observed_wins, expected_wins)
    results.append(("Overall win distribution (all sims equal?)", chi2, p_value,
                     len(sims) - 1, p_value < 0.05))

    # Pairwise Fisher's exact tests (2x2: sim A vs rest)
    pairwise = []
    for sim in sims:
        w = wins[sim]
        g = games[sim]
        other_w = sum(wins[s] for s in sims if s != sim)
        other_g = sum(games[s] for s in sims if s != sim)
        table = np.array([[w, g - w], [other_w, other_g - other_w]])
        _, p = stats.fisher_exact(table)
        pairwise.append((sim, w, g, w / g * 100, p, p < 0.05))

    # Per-player-count chi-squared
    per_pc = []
    for pc in [2, 3, 4, 5]:
        pc_wins = defaultdict(int)
        pc_games = defaultdict(int)
        for game in all_data[pc]["games"]:
            for p in game["players"]:
                pc_games[p] += 1
            pc_wins[game["winner"]] += 1
        pc_sims = sorted(pc_wins.keys())
        obs = np.array([pc_wins[s] for s in pc_sims])
        tot = np.array([pc_games[s] for s in pc_sims])
        # Expected if all sims equal: proportional to appearances
        exp = tot * (obs.sum() / tot.sum())
        if len(pc_sims) > 1:
            c2, pv = stats.chisquare(obs, exp)
            per_pc.append((pc, c2, pv, len(pc_sims) - 1, pv < 0.05))

    return results, pairwise, per_pc


# ═══════════════════════════════════════════════════════════════════════
# 4. PCA ON SCORE WEIGHTS → WIN PREDICTION
# ═══════════════════════════════════════════════════════════════════════

def pca_analysis(all_data):
    """PCA on score weight configurations, colored by winner."""
    rows = []
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            rows.append({
                "stability": game["w_stability"],
                "influence": game["w_influence"],
                "sovereignty": game["w_sovereignty"],
                "diplomatic": game["w_diplomatic"],
                "military": game["w_military"],
                "winner": game["winner"],
                "player_count": pc,
                "margin": game["margin"],
            })

    df = pd.DataFrame(rows)
    features = ["stability", "influence", "sovereignty", "diplomatic", "military"]
    X = df[features].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)

    # Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    # PCA scatter colored by winner
    for sim, color in SIM_COLORS.items():
        mask = df["winner"] == sim
        ax1.scatter(X_pca[mask, 0], X_pca[mask, 1], c=color, label=sim,
                    alpha=0.65, s=40, edgecolors="#0d1117", linewidth=0.5)

    ax1.set_xlabel(f"PC1 ({pca.explained_variance_ratio_[0]:.1%} variance)")
    ax1.set_ylabel(f"PC2 ({pca.explained_variance_ratio_[1]:.1%} variance)")
    ax1.set_title("PCA OF SCORE WEIGHTS — COLORED BY WINNER", fontweight="bold")
    ax1.legend(fontsize=8, framealpha=0.3)
    ax1.grid(True, alpha=0.3)

    # Loading vectors
    loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
    for i, feat in enumerate(features):
        ax2.arrow(0, 0, loadings[i, 0], loadings[i, 1],
                  head_width=0.05, head_length=0.03, fc="#e6db74", ec="#e6db74", alpha=0.8)
        ax2.text(loadings[i, 0] * 1.15, loadings[i, 1] * 1.15, feat.upper(),
                 fontsize=9, ha="center", color="#e6db74", fontweight="bold")

    circle = plt.Circle((0, 0), 1, fill=False, color="#8b949e", linestyle="--", alpha=0.5)
    ax2.add_patch(circle)
    ax2.set_xlim(-1.5, 1.5)
    ax2.set_ylim(-1.5, 1.5)
    ax2.set_aspect("equal")
    ax2.set_xlabel("PC1")
    ax2.set_ylabel("PC2")
    ax2.set_title("PCA LOADING VECTORS", fontweight="bold")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(OUT / "02_pca_score_weights.png", bbox_inches="tight")
    plt.close()

    return pca, scaler, df


# ═══════════════════════════════════════════════════════════════════════
# 5. LOGISTIC REGRESSION — WIN PREDICTION
# ═══════════════════════════════════════════════════════════════════════

def logistic_regression_analysis(all_data):
    """Predict whether a sim wins based on score weights, player count, and sim identity."""
    rows = []
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            for player in game["players"]:
                rows.append({
                    "sim": player,
                    "w_stability": game["w_stability"],
                    "w_influence": game["w_influence"],
                    "w_sovereignty": game["w_sovereignty"],
                    "w_diplomatic": game["w_diplomatic"],
                    "w_military": game["w_military"],
                    "player_count": pc,
                    "won": 1 if player == game["winner"] else 0,
                })

    df = pd.DataFrame(rows)

    # One-hot encode sim (drop first to avoid multicollinearity)
    df_encoded = pd.get_dummies(df, columns=["sim"], drop_first=True, dtype=int)

    feature_cols = [c for c in df_encoded.columns if c != "won"]
    X = df_encoded[feature_cols].values
    y = df_encoded["won"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = LogisticRegression(max_iter=1000, C=1.0)
    model.fit(X_scaled, y)

    # Coefficients
    coef_df = pd.DataFrame({
        "feature": feature_cols,
        "coefficient": model.coef_[0],
        "abs_coefficient": np.abs(model.coef_[0]),
    }).sort_values("abs_coefficient", ascending=False)

    # Plot
    fig, ax = plt.subplots(figsize=(10, 6))
    top_n = min(12, len(coef_df))
    top = coef_df.head(top_n)
    colors = ["#27ae60" if c > 0 else "#c0392b" for c in top["coefficient"]]
    bars = ax.barh(range(top_n), top["coefficient"], color=colors, alpha=0.8)
    ax.set_yticks(range(top_n))
    ax.set_yticklabels(top["feature"].values, fontsize=9)
    ax.set_xlabel("Logistic Regression Coefficient")
    ax.set_title(f"WIN PREDICTION COEFFICIENTS (accuracy: {model.score(X_scaled, y):.1%})",
                 fontweight="bold")
    ax.axvline(x=0, color="#8b949e", linestyle="-", alpha=0.5)
    ax.invert_yaxis()
    ax.grid(True, alpha=0.3, axis="x")

    plt.tight_layout()
    plt.savefig(OUT / "03_logistic_regression.png", bbox_inches="tight")
    plt.close()

    return model, coef_df


# ═══════════════════════════════════════════════════════════════════════
# 6. SCORE DIMENSION CORRELATIONS
# ═══════════════════════════════════════════════════════════════════════

def correlation_analysis(all_data):
    """Correlation between score weight configurations and winning."""
    rows = []
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            for player in game["players"]:
                rows.append({
                    "w_stability": game["w_stability"],
                    "w_influence": game["w_influence"],
                    "w_sovereignty": game["w_sovereignty"],
                    "w_diplomatic": game["w_diplomatic"],
                    "w_military": game["w_military"],
                    "margin": game["margin"],
                    "winner_score": game["winner_score"],
                    "won": 1 if player == game["winner"] else 0,
                    "player_count": pc,
                })

    df = pd.DataFrame(rows)

    # Score weight correlation matrix
    weight_cols = ["w_stability", "w_influence", "w_sovereignty", "w_diplomatic", "w_military"]
    corr_with_win = df[weight_cols + ["won"]].corr()

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    # Full correlation heatmap
    mask = np.triu(np.ones_like(corr_with_win, dtype=bool), k=1)
    sns.heatmap(corr_with_win, mask=mask, annot=True, fmt=".2f", cmap="RdYlGn",
                center=0, vmin=-0.3, vmax=0.3, ax=ax1,
                xticklabels=[c.replace("w_", "").upper() for c in corr_with_win.columns],
                yticklabels=[c.replace("w_", "").upper() for c in corr_with_win.columns])
    ax1.set_title("WEIGHT CORRELATION MATRIX", fontweight="bold")

    # Weight vs Win point-biserial correlation per player count
    corr_by_pc = {}
    for pc in [2, 3, 4, 5]:
        pc_df = df[df["player_count"] == pc]
        corrs = {}
        for col in weight_cols:
            r, p = stats.pointbiserialr(pc_df["won"], pc_df[col])
            corrs[col.replace("w_", "")] = r
        corr_by_pc[f"{pc}P"] = corrs

    corr_df = pd.DataFrame(corr_by_pc).T
    sns.heatmap(corr_df, annot=True, fmt=".3f", cmap="RdYlGn", center=0,
                vmin=-0.15, vmax=0.15, ax=ax2,
                xticklabels=[c.upper() for c in corr_df.columns])
    ax2.set_title("WEIGHT↔WIN CORRELATION BY PLAYER COUNT", fontweight="bold")
    ax2.set_ylabel("Player Count")

    plt.tight_layout()
    plt.savefig(OUT / "04_correlations.png", bbox_inches="tight")
    plt.close()

    return corr_with_win, corr_by_pc


# ═══════════════════════════════════════════════════════════════════════
# 7. STRATEGY EFFECTIVENESS HEATMAP + NASH EQUILIBRIUM
# ═══════════════════════════════════════════════════════════════════════

STRATEGY_ORDER = ["ci_defensive", "propagandist", "spy_heavy", "random_mix",
                  "balanced", "assassin_rush", "all_out", "saboteur_heavy",
                  "econ_build", "infiltrator"]


def strategy_analysis(all_data):
    """Build strategy effectiveness matrix and compute Nash equilibrium."""
    # Aggregate strategy data across player counts
    strat_data = defaultdict(lambda: {"appearances": 0, "wins": 0})
    strat_by_pc = {}

    for pc in [2, 3, 4, 5]:
        strat_by_pc[pc] = {}
        for strat, data in all_data[pc]["strategies"].items():
            strat_data[strat]["appearances"] += data["appearances"]
            strat_data[strat]["wins"] += data["wins"]
            strat_by_pc[pc][strat] = data

    # Strategy win rate heatmap
    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(20, 7),
                                         gridspec_kw={"width_ratios": [2, 1.5, 1.5]})

    # Heatmap: strategy × player_count → win rate
    heat_data = []
    for strat in STRATEGY_ORDER:
        row = {}
        for pc in [2, 3, 4, 5]:
            if strat in strat_by_pc[pc]:
                row[f"{pc}P"] = strat_by_pc[pc][strat]["win_rate"] * 100
            else:
                row[f"{pc}P"] = np.nan
        # Combined
        if strat in strat_data and strat_data[strat]["appearances"] > 0:
            row["ALL"] = strat_data[strat]["wins"] / strat_data[strat]["appearances"] * 100
        else:
            row["ALL"] = np.nan
        heat_data.append(row)

    heat_df = pd.DataFrame(heat_data, index=STRATEGY_ORDER)
    sns.heatmap(heat_df, annot=True, fmt=".0f", cmap="RdYlGn", center=25,
                vmin=0, vmax=100, ax=ax1, linewidths=0.5, linecolor="#30363d")
    ax1.set_title("STRATEGY WIN RATE (%) BY PLAYER COUNT", fontweight="bold")
    ax1.set_ylabel("")

    # Bar chart: combined win rates with confidence intervals
    combined = []
    for strat in STRATEGY_ORDER:
        if strat in strat_data:
            n = strat_data[strat]["appearances"]
            w = strat_data[strat]["wins"]
            p = w / n if n > 0 else 0
            # Wilson score interval
            z = 1.96
            denom = 1 + z**2 / n
            center = (p + z**2 / (2 * n)) / denom
            margin = z * np.sqrt((p * (1 - p) + z**2 / (4 * n)) / n) / denom
            combined.append({
                "strategy": strat,
                "win_rate": p * 100,
                "ci_low": max(0, (center - margin) * 100),
                "ci_high": min(100, (center + margin) * 100),
                "n": n,
            })

    comb_df = pd.DataFrame(combined)
    colors = ["#27ae60" if r > 30 else "#d4a017" if r > 15 else "#c0392b"
              for r in comb_df["win_rate"]]
    bars = ax2.barh(range(len(comb_df)), comb_df["win_rate"], color=colors, alpha=0.8)
    ax2.errorbar(comb_df["win_rate"], range(len(comb_df)),
                 xerr=[comb_df["win_rate"] - comb_df["ci_low"],
                       comb_df["ci_high"] - comb_df["win_rate"]],
                 fmt="none", ecolor="#8b949e", capsize=3, alpha=0.6)
    ax2.set_yticks(range(len(comb_df)))
    ax2.set_yticklabels(comb_df["strategy"], fontsize=9)
    ax2.set_xlabel("Win Rate (%)")
    ax2.set_title("COMBINED WIN RATE + 95% CI", fontweight="bold")
    ax2.axvline(x=25, color="#8b949e", linestyle="--", alpha=0.5, label="Fair (4P)")
    ax2.invert_yaxis()
    ax2.grid(True, alpha=0.3, axis="x")

    # Nash equilibrium on approximate payoff matrix
    # Construct a symmetric 2-player zero-sum game from strategy win rates.
    # Payoff of strategy i vs strategy j = (win_rate_i - win_rate_j) / 2 + 0.5
    # This is an approximation since we don't have true pairwise matchup data.
    n_strats = len(STRATEGY_ORDER)
    payoff = np.zeros((n_strats, n_strats))
    win_rates = {}
    for strat in STRATEGY_ORDER:
        if strat in strat_data and strat_data[strat]["appearances"] > 0:
            win_rates[strat] = strat_data[strat]["wins"] / strat_data[strat]["appearances"]
        else:
            win_rates[strat] = 0

    for i, si in enumerate(STRATEGY_ORDER):
        for j, sj in enumerate(STRATEGY_ORDER):
            if i == j:
                payoff[i, j] = 0.5  # mirror match
            else:
                # Higher win rate → higher expected payoff
                payoff[i, j] = 0.5 + (win_rates[si] - win_rates[sj]) / 2

    game = nash.Game(payoff, 1 - payoff)
    try:
        equilibria = list(game.support_enumeration())
        if equilibria:
            eq = equilibria[0]
            eq_probs = eq[0]  # Player 1's mixed strategy
        else:
            eq_probs = np.ones(n_strats) / n_strats
    except Exception:
        eq_probs = np.ones(n_strats) / n_strats

    # Plot Nash equilibrium
    nonzero = [(STRATEGY_ORDER[i], eq_probs[i]) for i in range(n_strats) if eq_probs[i] > 0.01]
    nonzero.sort(key=lambda x: x[1], reverse=True)
    if nonzero:
        names_eq = [x[0] for x in nonzero]
        probs_eq = [x[1] for x in nonzero]
        bars = ax3.barh(range(len(names_eq)), [p * 100 for p in probs_eq],
                        color="#2980b9", alpha=0.8)
        ax3.set_yticks(range(len(names_eq)))
        ax3.set_yticklabels(names_eq, fontsize=9)
        ax3.set_xlabel("Equilibrium Probability (%)")
        ax3.set_title("NASH EQUILIBRIUM\n(approximate)", fontweight="bold")
        ax3.invert_yaxis()
        ax3.grid(True, alpha=0.3, axis="x")
        for bar, prob in zip(bars, probs_eq):
            ax3.text(bar.get_width() + 1, bar.get_y() + bar.get_height() / 2,
                     f"{prob:.1%}", va="center", fontsize=9, color="#c9d1d9")

    plt.tight_layout()
    plt.savefig(OUT / "05_strategy_analysis.png", bbox_inches="tight")
    plt.close()

    return strat_data, eq_probs, combined


# ═══════════════════════════════════════════════════════════════════════
# 8. SCORE DISTRIBUTION VIOLIN PLOTS
# ═══════════════════════════════════════════════════════════════════════

def score_distributions(all_data):
    """Violin plots of winner/runner-up scores and margins."""
    rows = []
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            rows.append({
                "player_count": pc,
                "winner_score": game["winner_score"],
                "runner_up_score": game["runner_up_score"],
                "margin": game["margin"],
                "winner": game["winner"],
            })
    df = pd.DataFrame(rows)

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Winner score distributions by player count
    for pc, color in zip([2, 3, 4, 5], ["#c0392b", "#27ae60", "#d4a017", "#2980b9"]):
        data = df[df["player_count"] == pc]["winner_score"]
        parts = axes[0, 0].violinplot([data.values], positions=[pc], showmeans=True,
                                       showmedians=True, widths=0.7)
        for pc_part in parts["bodies"]:
            pc_part.set_facecolor(color)
            pc_part.set_alpha(0.6)
        for key in ["cmeans", "cmedians", "cbars", "cmins", "cmaxes"]:
            if key in parts:
                parts[key].set_color(color)

    axes[0, 0].set_xlabel("Player Count")
    axes[0, 0].set_ylabel("Winner Score")
    axes[0, 0].set_title("WINNER SCORE DISTRIBUTION", fontweight="bold")
    axes[0, 0].set_xticks([2, 3, 4, 5])
    axes[0, 0].grid(True, alpha=0.3)

    # Margin distributions by player count
    for pc, color in zip([2, 3, 4, 5], ["#c0392b", "#27ae60", "#d4a017", "#2980b9"]):
        data = df[df["player_count"] == pc]["margin"]
        parts = axes[0, 1].violinplot([data.values], positions=[pc], showmeans=True,
                                       showmedians=True, widths=0.7)
        for pc_part in parts["bodies"]:
            pc_part.set_facecolor(color)
            pc_part.set_alpha(0.6)
        for key in ["cmeans", "cmedians", "cbars", "cmins", "cmaxes"]:
            if key in parts:
                parts[key].set_color(color)

    axes[0, 1].set_xlabel("Player Count")
    axes[0, 1].set_ylabel("Victory Margin")
    axes[0, 1].set_title("MARGIN DISTRIBUTION (tighter = more competitive)", fontweight="bold")
    axes[0, 1].set_xticks([2, 3, 4, 5])
    axes[0, 1].grid(True, alpha=0.3)

    # Per-simulation score boxplot (all player counts)
    sim_scores = defaultdict(list)
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            sim_scores[game["winner"]].append(game["winner_score"])

    sim_names = sorted(sim_scores.keys())
    box_data = [sim_scores[s] for s in sim_names]
    box_colors = [SIM_COLORS[s] for s in sim_names]
    bp = axes[1, 0].boxplot(box_data, labels=[s.split()[0] for s in sim_names],
                             patch_artist=True, widths=0.6)
    for patch, color in zip(bp["boxes"], box_colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)
    axes[1, 0].set_ylabel("Winner's Score")
    axes[1, 0].set_title("WINNING SCORES BY SIMULATION", fontweight="bold")
    axes[1, 0].grid(True, alpha=0.3)

    # Score weight radar chart for each sim's average winning configuration
    # What weight configs does each sim tend to win under?
    dims = ["stability", "influence", "sovereignty", "diplomatic", "military"]
    sim_avg_weights = {}
    for sim in SIM_TAGS.values():
        weights = {"stability": [], "influence": [], "sovereignty": [],
                   "diplomatic": [], "military": []}
        for pc in [2, 3, 4, 5]:
            for game in all_data[pc]["games"]:
                if game["winner"] == sim:
                    weights["stability"].append(game["w_stability"])
                    weights["influence"].append(game["w_influence"])
                    weights["sovereignty"].append(game["w_sovereignty"])
                    weights["diplomatic"].append(game["w_diplomatic"])
                    weights["military"].append(game["w_military"])
        if weights["stability"]:
            sim_avg_weights[sim] = {d: np.mean(weights[d]) for d in dims}

    # Radar chart
    angles = np.linspace(0, 2 * np.pi, len(dims), endpoint=False).tolist()
    angles += angles[:1]  # close the polygon

    ax_radar = axes[1, 1]
    ax_radar.remove()
    ax_radar = fig.add_subplot(2, 2, 4, polar=True)
    ax_radar.set_facecolor("#161b22")

    for sim, avg_w in sim_avg_weights.items():
        values = [avg_w[d] for d in dims]
        values += values[:1]
        ax_radar.plot(angles, values, "o-", linewidth=1.5, label=sim.split()[0],
                      color=SIM_COLORS[sim], alpha=0.7)
        ax_radar.fill(angles, values, alpha=0.1, color=SIM_COLORS[sim])

    ax_radar.set_xticks(angles[:-1])
    ax_radar.set_xticklabels([d.upper()[:4] for d in dims], fontsize=8, color="#c9d1d9")
    ax_radar.set_title("AVG WEIGHT CONFIG WHEN WINNING", fontweight="bold", pad=20)
    ax_radar.legend(fontsize=7, loc="upper right", bbox_to_anchor=(1.3, 1.1), framealpha=0.3)
    ax_radar.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(OUT / "06_score_distributions.png", bbox_inches="tight")
    plt.close()


# ═══════════════════════════════════════════════════════════════════════
# 9. SIMULATION HEAD-TO-HEAD MATRIX (2P data)
# ═══════════════════════════════════════════════════════════════════════

def head_to_head(all_data):
    """Build head-to-head matrix from 2P games."""
    sims_2p = sorted(set(s for g in all_data[2]["games"] for s in g["players"]))
    h2h = defaultdict(lambda: defaultdict(lambda: {"wins": 0, "games": 0}))

    for game in all_data[2]["games"]:
        a, b = game["players"]
        h2h[a][b]["games"] += 1
        h2h[b][a]["games"] += 1
        winner = game["winner"]
        loser = a if winner == b else b
        h2h[winner][loser]["wins"] += 1

    # Build matrix
    matrix = pd.DataFrame(index=sims_2p, columns=sims_2p, dtype=float)
    for a in sims_2p:
        for b in sims_2p:
            if a == b:
                matrix.loc[a, b] = np.nan
            elif h2h[a][b]["games"] > 0:
                matrix.loc[a, b] = h2h[a][b]["wins"] / h2h[a][b]["games"] * 100
            else:
                matrix.loc[a, b] = np.nan

    fig, ax = plt.subplots(figsize=(8, 6))
    short_names = [s.split()[0] for s in sims_2p]
    sns.heatmap(matrix.astype(float), annot=True, fmt=".0f", cmap="RdYlGn", center=50,
                vmin=0, vmax=100, ax=ax, linewidths=1, linecolor="#30363d",
                xticklabels=short_names, yticklabels=short_names,
                cbar_kws={"label": "Win Rate (%)"})
    ax.set_title("HEAD-TO-HEAD WIN RATE (%) — 2P GAMES\n(Row beats Column)", fontweight="bold")

    # Add game counts as secondary annotation
    for i, a in enumerate(sims_2p):
        for j, b in enumerate(sims_2p):
            if a != b and h2h[a][b]["games"] > 0:
                ax.text(j + 0.5, i + 0.75, f"n={h2h[a][b]['games']}",
                        ha="center", va="center", fontsize=7, color="#8b949e")

    plt.tight_layout()
    plt.savefig(OUT / "07_head_to_head.png", bbox_inches="tight")
    plt.close()

    return matrix


# ═══════════════════════════════════════════════════════════════════════
# 10. DIMENSION IMPACT ANALYSIS
# ═══════════════════════════════════════════════════════════════════════

def dimension_impact(all_data):
    """Which score weight dimensions correlate most strongly with winning?"""
    fig, axes = plt.subplots(2, 3, figsize=(16, 10))
    dims = ["stability", "influence", "sovereignty", "diplomatic", "military"]

    for idx, dim in enumerate(dims):
        ax = axes[idx // 3, idx % 3]
        for pc in [2, 3, 4, 5]:
            weights_win = []
            weights_lose = []
            for game in all_data[pc]["games"]:
                w = game[f"w_{dim}"]
                for p in game["players"]:
                    if p == game["winner"]:
                        weights_win.append(w)
                    else:
                        weights_lose.append(w)

            # KDE for winners vs losers at this player count
            if weights_win and weights_lose:
                ax.hist(weights_win, bins=15, alpha=0.4, color="#27ae60",
                        density=True, label=f"Win" if pc == 2 else "")
                ax.hist(weights_lose, bins=15, alpha=0.4, color="#c0392b",
                        density=True, label=f"Lose" if pc == 2 else "")

        # Mann-Whitney U test: do winners have different weight distributions?
        all_win_weights = []
        all_lose_weights = []
        for pc in [2, 3, 4, 5]:
            for game in all_data[pc]["games"]:
                w = game[f"w_{dim}"]
                for p in game["players"]:
                    if p == game["winner"]:
                        all_win_weights.append(w)
                    else:
                        all_lose_weights.append(w)

        if all_win_weights and all_lose_weights:
            u_stat, p_val = stats.mannwhitneyu(all_win_weights, all_lose_weights,
                                                alternative="two-sided")
            sig = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns"
            ax.set_title(f"{dim.upper()}\nMann-Whitney p={p_val:.4f} {sig}", fontweight="bold")
        else:
            ax.set_title(f"{dim.upper()}", fontweight="bold")

        ax.set_xlabel(f"Weight ({dim})")
        ax.set_ylabel("Density")
        if idx == 0:
            ax.legend(fontsize=8)
        ax.grid(True, alpha=0.3)

    # Hide unused subplot
    axes[1, 2].set_visible(False)

    plt.suptitle("SCORE WEIGHT DISTRIBUTION: WINNERS vs LOSERS", fontweight="bold",
                 fontsize=14, y=1.02)
    plt.tight_layout()
    plt.savefig(OUT / "08_dimension_impact.png", bbox_inches="tight")
    plt.close()


# ═══════════════════════════════════════════════════════════════════════
# 11. BOOTSTRAP CONFIDENCE INTERVALS
# ═══════════════════════════════════════════════════════════════════════

def bootstrap_ci(all_data, n_bootstrap=10000):
    """Bootstrap 95% confidence intervals for simulation win rates."""
    # Build outcome array: for each sim, list of 1 (win) / 0 (loss) per game
    outcomes = defaultdict(list)
    for pc in [2, 3, 4, 5]:
        for game in all_data[pc]["games"]:
            for p in game["players"]:
                outcomes[p].append(1 if p == game["winner"] else 0)

    cis = {}
    for sim, results in sorted(outcomes.items()):
        results = np.array(results)
        boot_means = np.array([
            np.mean(np.random.choice(results, size=len(results), replace=True))
            for _ in range(n_bootstrap)
        ])
        ci_low, ci_high = np.percentile(boot_means, [2.5, 97.5])
        cis[sim] = {
            "mean": np.mean(results),
            "ci_low": ci_low,
            "ci_high": ci_high,
            "n": len(results),
        }

    # Plot
    fig, ax = plt.subplots(figsize=(10, 5))
    sims = sorted(cis.keys(), key=lambda s: cis[s]["mean"], reverse=True)
    y_pos = range(len(sims))
    means = [cis[s]["mean"] * 100 for s in sims]
    lows = [cis[s]["ci_low"] * 100 for s in sims]
    highs = [cis[s]["ci_high"] * 100 for s in sims]
    colors = [SIM_COLORS[s] for s in sims]

    ax.barh(y_pos, means, color=colors, alpha=0.7)
    ax.errorbar(means, y_pos,
                xerr=[[m - l for m, l in zip(means, lows)],
                      [h - m for m, h in zip(means, highs)]],
                fmt="none", ecolor="white", capsize=4, linewidth=2)
    ax.set_yticks(y_pos)
    ax.set_yticklabels([f"{s}\n(n={cis[s]['n']})" for s in sims], fontsize=9)
    ax.set_xlabel("Win Rate (%)")
    ax.set_title("BOOTSTRAP 95% CONFIDENCE INTERVALS (10,000 iterations)", fontweight="bold")
    ax.invert_yaxis()
    ax.grid(True, alpha=0.3, axis="x")

    # Add CI text
    for i, sim in enumerate(sims):
        ax.text(highs[i] + 1, i, f"[{lows[i]:.1f}%, {highs[i]:.1f}%]",
                va="center", fontsize=8, color="#8b949e")

    plt.tight_layout()
    plt.savefig(OUT / "09_bootstrap_ci.png", bbox_inches="tight")
    plt.close()

    return cis


# ═══════════════════════════════════════════════════════════════════════
# 12. WIN RATE EVOLUTION ACROSS PLAYER COUNTS
# ═══════════════════════════════════════════════════════════════════════

def win_rate_evolution(all_data):
    """Line chart showing how each sim's win rate changes with player count."""
    fig, ax = plt.subplots(figsize=(10, 6))

    for sim in SIM_TAGS.values():
        rates = []
        pcs = []
        for pc in [2, 3, 4, 5]:
            wins = sum(1 for g in all_data[pc]["games"] if g["winner"] == sim)
            games = sum(1 for g in all_data[pc]["games"] if sim in g["players"])
            if games > 0:
                rates.append(wins / games * 100)
                pcs.append(pc)

        if rates:
            ax.plot(pcs, rates, "o-", label=sim, color=SIM_COLORS[sim],
                    linewidth=2, markersize=8, alpha=0.85)

    # Theoretical fair rate
    theoretical = [50, 100/3, 25, 20]
    ax.plot([2, 3, 4, 5], theoretical, "--", color="#8b949e", linewidth=1.5,
            alpha=0.6, label="Theoretical Fair")

    ax.set_xlabel("Player Count")
    ax.set_ylabel("Win Rate (%)")
    ax.set_title("WIN RATE EVOLUTION BY PLAYER COUNT", fontweight="bold")
    ax.set_xticks([2, 3, 4, 5])
    ax.legend(fontsize=8, loc="upper right", framealpha=0.3)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(0, 75)

    plt.tight_layout()
    plt.savefig(OUT / "10_win_rate_evolution.png", bbox_inches="tight")
    plt.close()


# ═══════════════════════════════════════════════════════════════════════
# 13. GENERATE STATISTICAL SUPPLEMENT MARKDOWN
# ═══════════════════════════════════════════════════════════════════════

def generate_supplement(elo_results, chi_results, pairwise, per_pc_chi,
                         coef_df, corr_by_pc, bootstrap_cis, nash_eq, strat_combined):
    """Write a markdown file with all statistical findings."""
    lines = []
    lines.append("# Epoch Statistical Supplement")
    lines.append("")
    lines.append("> Auto-generated by `scripts/epoch_statistical_analysis.py`")
    lines.append(f"> Charts saved to `{OUT}/`")
    lines.append("")

    # Elo
    lines.append("## 1. Elo Ratings")
    lines.append("")
    lines.append("Elo calculated from all 188 valid games. Multi-player games decomposed into")
    lines.append("pairwise matchups (winner beats each loser). K-factor scaled by 1/num_losers.")
    lines.append("")
    lines.append("| Simulation | Final Elo | Δ from Start |")
    lines.append("|-----------|----------|-------------|")
    for name, rating in elo_results:
        delta = rating - 1500
        sign = "+" if delta > 0 else ""
        lines.append(f"| {name} | {rating:.0f} | {sign}{delta:.0f} |")
    lines.append("")
    lines.append("![Elo Ratings](01_elo_ratings.png)")
    lines.append("")

    # Chi-squared
    lines.append("## 2. Statistical Significance Tests")
    lines.append("")
    lines.append("### Overall Chi-Squared")
    lines.append("")
    for label, chi2, p, df, sig in chi_results:
        lines.append(f"**{label}**")
        lines.append(f"- χ² = {chi2:.2f}, df = {df}, p = {p:.4f}")
        lines.append(f"- {'SIGNIFICANT (p < 0.05)' if sig else 'Not significant'}")
        lines.append("")

    lines.append("### Pairwise Fisher's Exact Tests (sim vs rest)")
    lines.append("")
    lines.append("| Simulation | Wins | Games | Win Rate | p-value | Significant? |")
    lines.append("|-----------|------|-------|----------|---------|-------------|")
    for sim, w, g, rate, p, sig in pairwise:
        lines.append(f"| {sim} | {w} | {g} | {rate:.1f}% | {p:.4f} | {'YES' if sig else 'no'} |")
    lines.append("")

    lines.append("### Per-Player-Count Chi-Squared")
    lines.append("")
    lines.append("| Format | χ² | df | p-value | Significant? |")
    lines.append("|--------|-----|-----|---------|-------------|")
    for pc, c2, pv, df, sig in per_pc_chi:
        lines.append(f"| {pc}P | {c2:.2f} | {df} | {pv:.4f} | {'YES' if sig else 'no'} |")
    lines.append("")

    # Logistic regression
    lines.append("## 3. Logistic Regression — Win Prediction")
    lines.append("")
    lines.append("Predicts win probability from score weights, player count, and sim identity.")
    lines.append("")
    lines.append("| Feature | Coefficient | Interpretation |")
    lines.append("|---------|------------|----------------|")
    for _, row in coef_df.head(12).iterrows():
        interp = "↑ win prob" if row["coefficient"] > 0 else "↓ win prob"
        lines.append(f"| {row['feature']} | {row['coefficient']:+.4f} | {interp} |")
    lines.append("")
    lines.append("![Logistic Regression](03_logistic_regression.png)")
    lines.append("")

    # Correlations
    lines.append("## 4. Score Weight ↔ Win Correlations")
    lines.append("")
    lines.append("Point-biserial correlation between each score weight and winning.")
    lines.append("Values near 0 = dimension doesn't predict winning.")
    lines.append("")
    lines.append("| Dimension | 2P | 3P | 4P | 5P |")
    lines.append("|-----------|-----|-----|-----|-----|")
    for dim in ["stability", "influence", "sovereignty", "diplomatic", "military"]:
        vals = [f"{corr_by_pc[f'{pc}P'][dim]:+.3f}" for pc in [2, 3, 4, 5]]
        lines.append(f"| {dim} | {' | '.join(vals)} |")
    lines.append("")
    lines.append("![Correlations](04_correlations.png)")
    lines.append("")

    # Bootstrap CIs
    lines.append("## 5. Bootstrap Confidence Intervals")
    lines.append("")
    lines.append("10,000 bootstrap iterations for 95% CI on true win rates.")
    lines.append("")
    lines.append("| Simulation | Mean Win Rate | 95% CI | n |")
    lines.append("|-----------|--------------|--------|---|")
    for sim in sorted(bootstrap_cis.keys(), key=lambda s: bootstrap_cis[s]["mean"], reverse=True):
        ci = bootstrap_cis[sim]
        lines.append(f"| {sim} | {ci['mean']:.1%} | [{ci['ci_low']:.1%}, {ci['ci_high']:.1%}] | {ci['n']} |")
    lines.append("")
    lines.append("![Bootstrap CIs](09_bootstrap_ci.png)")
    lines.append("")

    # Nash equilibrium
    lines.append("## 6. Nash Equilibrium (Approximate)")
    lines.append("")
    lines.append("Mixed strategy Nash equilibrium computed from strategy win rates.")
    lines.append("This approximates the game-theoretically optimal strategy mix.")
    lines.append("")
    lines.append("| Strategy | Equilibrium Probability |")
    lines.append("|----------|----------------------|")
    for i, strat in enumerate(STRATEGY_ORDER):
        if nash_eq[i] > 0.01:
            lines.append(f"| {strat} | {nash_eq[i]:.1%} |")
    lines.append("")
    lines.append("![Strategy Analysis](05_strategy_analysis.png)")
    lines.append("")

    # Strategy CIs
    lines.append("## 7. Strategy Win Rate Confidence Intervals")
    lines.append("")
    lines.append("Wilson score intervals (95%) for each strategy's true win rate.")
    lines.append("")
    lines.append("| Strategy | Win Rate | 95% CI | n |")
    lines.append("|----------|---------|--------|---|")
    for s in strat_combined:
        lines.append(f"| {s['strategy']} | {s['win_rate']:.1f}% | [{s['ci_low']:.1f}%, {s['ci_high']:.1f}%] | {s['n']} |")
    lines.append("")

    # Charts index
    lines.append("## 8. Chart Index")
    lines.append("")
    charts = [
        ("01_elo_ratings.png", "Elo rating progression + final rankings"),
        ("02_pca_score_weights.png", "PCA of score weight configurations, colored by winner"),
        ("03_logistic_regression.png", "Logistic regression feature importance"),
        ("04_correlations.png", "Score weight correlation matrix + win correlation by player count"),
        ("05_strategy_analysis.png", "Strategy heatmap + combined win rates + Nash equilibrium"),
        ("06_score_distributions.png", "Score violins + boxplots + radar charts"),
        ("07_head_to_head.png", "Head-to-head win rates from 2P games"),
        ("08_dimension_impact.png", "Winner vs loser weight distributions per dimension"),
        ("09_bootstrap_ci.png", "Bootstrap confidence intervals for win rates"),
        ("10_win_rate_evolution.png", "Win rate by player count with theoretical fair line"),
    ]
    for fname, desc in charts:
        lines.append(f"- `{fname}` — {desc}")
    lines.append("")

    (OUT / "statistical-supplement.md").write_text("\n".join(lines))
    print(f"  Written: {OUT / 'statistical-supplement.md'}")


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("EPOCH STATISTICAL ANALYSIS — v2.1 (200 games)")
    print("=" * 60)

    print("\n1. Loading data...")
    all_data = load_all_data()
    total_games = sum(len(d["games"]) for d in all_data.values())
    print(f"   Parsed {total_games} valid games from 4 analysis files")

    print("\n2. Computing Elo ratings...")
    elo, history, labels = compute_elo(all_data)
    sorted_elo = plot_elo(elo, history, labels)
    for name, rating in sorted_elo:
        print(f"   {name}: {rating:.0f}")

    print("\n3. Chi-squared significance tests...")
    chi_results, pairwise, per_pc_chi = chi_squared_tests(all_data)
    for label, chi2, p, df, sig in chi_results:
        print(f"   {label}: χ²={chi2:.2f}, p={p:.4f} {'***' if sig else '(ns)'}")
    for sim, w, g, rate, p, sig in pairwise:
        print(f"   {sim}: {rate:.1f}% (p={p:.4f}) {'*' if sig else ''}")

    print("\n4. PCA on score weights...")
    pca_model, scaler, df = pca_analysis(all_data)
    print(f"   PC1 explains {pca_model.explained_variance_ratio_[0]:.1%}, "
          f"PC2 explains {pca_model.explained_variance_ratio_[1]:.1%}")

    print("\n5. Logistic regression...")
    model, coef_df = logistic_regression_analysis(all_data)
    print(f"   Top features:")
    for _, row in coef_df.head(5).iterrows():
        print(f"     {row['feature']}: {row['coefficient']:+.4f}")

    print("\n6. Correlation analysis...")
    corr_matrix, corr_by_pc = correlation_analysis(all_data)

    print("\n7. Strategy analysis + Nash equilibrium...")
    strat_data, nash_eq, strat_combined = strategy_analysis(all_data)
    print("   Nash equilibrium (non-zero):")
    for i, strat in enumerate(STRATEGY_ORDER):
        if nash_eq[i] > 0.01:
            print(f"     {strat}: {nash_eq[i]:.1%}")

    print("\n8. Score distributions...")
    score_distributions(all_data)

    print("\n9. Head-to-head matrix...")
    h2h_matrix = head_to_head(all_data)

    print("\n10. Dimension impact analysis...")
    dimension_impact(all_data)

    print("\n11. Bootstrap confidence intervals...")
    bootstrap_cis = bootstrap_ci(all_data)
    for sim in sorted(bootstrap_cis.keys(), key=lambda s: bootstrap_cis[s]["mean"], reverse=True):
        ci = bootstrap_cis[sim]
        print(f"   {sim}: {ci['mean']:.1%} [{ci['ci_low']:.1%}, {ci['ci_high']:.1%}]")

    print("\n12. Win rate evolution chart...")
    win_rate_evolution(all_data)

    print("\n13. Generating statistical supplement...")
    generate_supplement(sorted_elo, chi_results, pairwise, per_pc_chi,
                        coef_df, corr_by_pc, bootstrap_cis, nash_eq, strat_combined)

    print(f"\n{'=' * 60}")
    print(f"COMPLETE — {len(list(OUT.glob('*.png')))} charts + 1 supplement written to {OUT}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
