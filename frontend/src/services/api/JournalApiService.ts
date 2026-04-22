/**
 * Resonance Journal API service.
 *
 * The journal is user-global (AD-5): fragments carry an optional
 * simulation_id for narrative grounding, but the default list is the
 * user's full history across all simulations. Unlike most of the API
 * layer, the journal has no `mode: 'public' | 'member'` parameter —
 * its endpoints are authenticated-only by design (the journal exists
 * above simulations, not within them).
 */

import type { ApiResponse, PaginatedResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export type FragmentType = 'imprint' | 'signature' | 'echo' | 'impression' | 'mark' | 'tremor';

export type FragmentSourceType =
  | 'dungeon'
  | 'epoch'
  | 'simulation'
  | 'bond'
  | 'achievement'
  | 'bleed';

export type FragmentRarity = 'common' | 'uncommon' | 'rare' | 'singular';

export interface Fragment {
  id: string;
  user_id: string;
  simulation_id: string | null;
  fragment_type: FragmentType;
  source_type: FragmentSourceType;
  source_id: string | null;
  content_de: string;
  content_en: string;
  thematic_tags: string[];
  rarity: FragmentRarity;
  created_at: string;
}

export interface FragmentFilters {
  simulation_id?: string;
  source_type?: FragmentSourceType;
  fragment_type?: FragmentType;
  rarity?: FragmentRarity;
  limit?: number;
  offset?: number;
}

// ── Constellation (P2) ───────────────────────────────────────────────────

export type ConstellationStatus = 'drafting' | 'crystallized' | 'archived';

export type ResonanceType = 'archetype' | 'emotional' | 'temporal' | 'contradiction';

export interface ConstellationFragmentPlacement {
  fragment_id: string;
  position_x: number;
  position_y: number;
  placed_at: string | null;
}

/**
 * A pair-level resonance match emitted by the backend detector (P3).
 *
 * Each unordered pair of fragments that triggered a rule produces one
 * entry so the canvas can draw a connection line between the two
 * fragments with a type-specific label. Empty when the constellation
 * has < 2 fragments or no pair matches any rule.
 */
export interface ResonancePair {
  fragment_a_id: string;
  fragment_b_id: string;
  resonance_type: ResonanceType;
  evidence_tags: string[];
}

export interface Constellation {
  id: string;
  user_id: string;
  name_de: string | null;
  name_en: string | null;
  status: ConstellationStatus;
  insight_de: string | null;
  insight_en: string | null;
  resonance_type: ResonanceType | null;
  attunement_id: string | null;
  created_at: string;
  crystallized_at: string | null;
  archived_at: string | null;
  updated_at: string;
  fragments: ConstellationFragmentPlacement[];
  pair_matches: ResonancePair[];
}

// ── Attunement (P3) ──────────────────────────────────────────────────────

export type AttunementSystemHook = 'dungeon_option' | 'epoch_option' | 'simulation_option';

/**
 * Attunement catalog entry (server base shape, P3).
 *
 * Backing row in journal_attunements. Three starter attunements seeded
 * in migration 232: Hesitation (emotional → dungeon), Mercy (archetype
 * → epoch), Tremor (temporal → simulation).
 */
export interface Attunement {
  id: string;
  slug: string;
  name_de: string;
  name_en: string;
  description_de: string;
  description_en: string;
  system_hook: AttunementSystemHook;
  effect: Record<string, unknown>;
  /**
   * Reserved for future profile-threshold unlocks (plan §2 AD-9). The
   * 3 starter attunements seed this as ``{}``; optional on the client
   * so existing consumers do not break when the column is populated.
   */
  required_resonance?: Record<string, unknown>;
  required_resonance_type: ResonanceType | null;
  enabled: boolean;
}

/**
 * Attunement enriched with the caller's per-user unlock status.
 *
 * Returned by GET /journal/attunements as a single round trip — no
 * second fetch needed to render locked/unlocked state on the panel.
 */
export interface AttunementCatalogEntry extends Attunement {
  unlocked: boolean;
  unlocked_at: string | null;
  constellation_id: string | null;
}

/**
 * Return shape for POST /journal/constellations/{id}/crystallize (P3).
 *
 * ``newly_unlocked_attunement`` is populated ONLY on first unlock so
 * the frontend can fire the ceremony once; re-crystallizing the same
 * resonance type leaves it null (the user already holds the
 * attunement and the constellation.attunement_id FK still records
 * the fact).
 */
export interface CrystallizeResult {
  constellation: Constellation;
  newly_unlocked_attunement: Attunement | null;
}

export class JournalApiService extends BaseApiService {
  private readonly base = '/journal';

  // ── Fragments ─────────────────────────────────────────────────────────

  /** List fragments for the authenticated user with optional filters. */
  listFragments(filters: FragmentFilters = {}): Promise<PaginatedResponse<Fragment>> {
    const params: Record<string, string> = {};
    if (filters.simulation_id) params.simulation_id = filters.simulation_id;
    if (filters.source_type) params.source_type = filters.source_type;
    if (filters.fragment_type) params.fragment_type = filters.fragment_type;
    if (filters.rarity) params.rarity = filters.rarity;
    if (filters.limit !== undefined) params.limit = String(filters.limit);
    if (filters.offset !== undefined) params.offset = String(filters.offset);
    return this.get(`${this.base}/fragments`, params) as Promise<PaginatedResponse<Fragment>>;
  }

  /** Get a single fragment by id. 404 if not owned by the caller. */
  getFragment(fragmentId: string): Promise<ApiResponse<Fragment>> {
    return this.get(`${this.base}/fragments/${fragmentId}`);
  }

  // ── Constellations (P2) ───────────────────────────────────────────────

  /** List constellations for the user, newest-first, optionally filtered by status. */
  listConstellations(status?: ConstellationStatus): Promise<ApiResponse<Constellation[]>> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    return this.get(`${this.base}/constellations`, params);
  }

  /** Get a single constellation with its fragment placements. */
  getConstellation(constellationId: string): Promise<ApiResponse<Constellation>> {
    return this.get(`${this.base}/constellations/${constellationId}`);
  }

  /** Create a new drafting constellation. Names are optional. */
  createConstellation(body: {
    name_de?: string | null;
    name_en?: string | null;
  }): Promise<ApiResponse<Constellation>> {
    return this.post(`${this.base}/constellations`, body);
  }

  /** Rename a constellation (updates either / both locale names). */
  renameConstellation(
    constellationId: string,
    body: { name_de?: string | null; name_en?: string | null },
  ): Promise<ApiResponse<Constellation>> {
    return this.patch(`${this.base}/constellations/${constellationId}`, body);
  }

  /** Archive a constellation (works on any status). */
  archiveConstellation(constellationId: string): Promise<ApiResponse<Constellation>> {
    return this.post(`${this.base}/constellations/${constellationId}/archive`);
  }

  /** Add or move a fragment on the canvas. Idempotent via composite PK. */
  placeFragment(
    constellationId: string,
    body: { fragment_id: string; position_x: number; position_y: number },
  ): Promise<ApiResponse<Constellation>> {
    return this.post(`${this.base}/constellations/${constellationId}/place`, body);
  }

  /** Remove a fragment from the canvas. Only permitted on drafts. */
  removeFragment(constellationId: string, fragmentId: string): Promise<ApiResponse<Constellation>> {
    return this.delete(`${this.base}/constellations/${constellationId}/fragments/${fragmentId}`);
  }

  /**
   * Crystallize a drafting constellation. Server runs the rule-based
   * detector + research-tier LLM for the Insight text, then evaluates
   * + idempotently unlocks an attunement if the resonance type
   * matches one. Errors surface via the standard ApiResponse envelope
   * — 429 for credit / budget block, 502 for transient LLM failure,
   * 409 for too-few fragments or no-rule-match, 500 for unparseable
   * output. Contradiction-type constellations return
   * ``newly_unlocked_attunement: null`` by design (no starter
   * attunement for contradiction).
   */
  crystallizeConstellation(constellationId: string): Promise<ApiResponse<CrystallizeResult>> {
    return this.post(`${this.base}/constellations/${constellationId}/crystallize`);
  }

  // ── Attunements (P3) ──────────────────────────────────────────────────

  /**
   * Return the attunement catalog enriched with this user's unlock
   * state. Entries are in seeded-order regardless of lock state — the
   * caller sorts unlocked-first for display (Principle 9 "no progress
   * bars" keeps locked entries visible as invitations, not chores).
   */
  listAttunements(): Promise<ApiResponse<AttunementCatalogEntry[]>> {
    return this.get(`${this.base}/attunements`);
  }
}

export const journalApi = new JournalApiService();
