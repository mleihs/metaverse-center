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

export class JournalApiService extends BaseApiService {
  private readonly base = '/journal';

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
}

export const journalApi = new JournalApiService();
