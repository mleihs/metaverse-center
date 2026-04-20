/**
 * Content Packs API service (admin-only, read-only, A1.7 Phase 3 Option B).
 *
 * Exposes the on-disk content-pack catalog + per-resource reads so the
 * admin UI can populate a cascading pack→resource selector and pre-load
 * the current YAML state as base_content / working_content when creating
 * a new draft.
 *
 * No write routes on this surface — mutations flow exclusively through
 * ContentDraftsApiService (draft CRUD) and the publish endpoint.
 *
 * Shapes mirror `backend/models/content_packs.py`.
 */

import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export interface PackResourceManifest {
  pack_slug: string;
  resource_path: string;
  /** Number of entries in the collection; -1 signals a manifest-time YAML parse error. */
  entry_count: number;
  /** Display-only path relative to the repo root (e.g. "content/dungeon/archetypes/shadow/banter.yaml"). */
  file_path: string;
}

export interface PackResourceContent {
  pack_slug: string;
  resource_path: string;
  /** Top-level YAML mapping (always includes `schema_version`; rest varies per pack kind). */
  content: Record<string, unknown>;
}

export class ContentPacksApiService extends BaseApiService {
  private readonly base = '/admin/content-packs';

  /** Full manifest of archetype YAML resources (one row per file). */
  listManifest(): Promise<ApiResponse<PackResourceManifest[]>> {
    return this.get(this.base);
  }

  /**
   * Read one resource's current on-disk state. Used to seed
   * `base_content` + `working_content` when materializing a draft from
   * an existing resource instead of an empty collection.
   */
  getResource(packSlug: string, resourcePath: string): Promise<ApiResponse<PackResourceContent>> {
    return this.get(
      `${this.base}/${encodeURIComponent(packSlug)}/${encodeURIComponent(resourcePath)}`,
    );
  }
}

export const contentPacksApi = new ContentPacksApiService();
