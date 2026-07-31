# Game Design: Next Feature Proposals

**Date**: 2026-04-16
**Status**: Initial brainstorm — Proposals 1 & 2 selected for detailed spec

## Context

Analysis of three core game loops (Dungeons, Epochs, Simulations) revealed:
- Three powerful but **weakly coupled** systems
- **One-directional** data flow (dungeon → epoch, but not reverse)
- **No daily engagement hook** — all engagement is event-driven or self-directed
- **Thin player identity** — no persistent progression, no inventory, no reputation
- **Cosmetic-only achievements** — full infrastructure, zero mechanical feedback
- **Orphaned Forge** — no integration with playable systems
- **Incomplete loot application** — dungeon loot declares effects but RPC chain incomplete

## Proposal 1: "Resonance Journal" — The Missing Spine (Glue System)

Cross-system persistent progression artifact. Accumulates meaning from all game loops.
Feeds from dungeons (Imprints), epochs (Signatures), simulations (Resonance Patterns).
Feeds back: dungeon modifiers, epoch bonuses, simulation unlocks, achievement weight.
**Selected for detailed spec.**

## Proposal 2: "Agent Bonds" — The Tamagotchi Layer (Simulation Deepening)

Player-to-agent emotional relationships. Whisper feed, requests, memory, performance impact.
Daily engagement hook via heartbeat-driven whispers.
**Selected for detailed spec.**

## Proposal 3: "Threshold Events" — The Meta-Narrative Engine (New System)

Collective player behavior triggers platform-wide narrative events.
Convergence, Fracture, Awakening, Silence patterns.
**Deferred** — builds naturally on top of Proposals 1 & 2.

## Implementation Priority

1. Agent Bonds (fastest path to daily engagement, emotional anchor)
2. Resonance Journal (glue layer, natural extension of bonds)
3. Threshold Events (meta-narrative, requires critical mass of players)
