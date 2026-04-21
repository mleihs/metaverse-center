/**
 * Content Drafts API service (admin-only, A1.7).
 *
 * Drafts are platform-level edits to YAML packs under `content/`. The admin
 * UI opens a draft, edits working_content, then batches N drafts into a
 * single GitHub PR via the publish endpoint.
 *
 * All endpoints gate on `require_platform_admin()` server-side. There is
 * no public read surface — every method sends the Authorization header via
 * BaseApiService.
 *
 * Response shapes mirror `backend/models/content_drafts.py`. Field names are
 * snake_case to match backend JSON (consistent with existing API services).
 */

import type { ApiResponse, PaginatedResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export type ContentDraftStatus = 'draft' | 'conflict' | 'published' | 'merged' | 'abandoned';

export interface ContentDraftSummary {
  id: string;
  author_id: string;
  /** Resolved via `get_user_emails_batch` on the drafts-list endpoint only;
   *  null for sibling endpoints (e.g. open-for-resource warning) and for
   *  deleted users whose email no longer resolves. */
  author_email: string | null;
  pack_slug: string;
  resource_path: string;
  status: ContentDraftStatus;
  version: number;
  pr_number: number | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  merged_at: string | null;
}

export interface ContentDraft extends ContentDraftSummary {
  base_sha: string | null;
  base_content: Record<string, unknown>;
  working_content: Record<string, unknown>;
  expected_head_oid: string | null;
  commit_sha: string | null;
}

export interface ContentDraftCreateBody {
  pack_slug: string;
  resource_path: string;
  base_content: Record<string, unknown>;
  working_content: Record<string, unknown>;
  base_sha?: string | null;
}

export interface ContentDraftUpdateBody {
  working_content: Record<string, unknown>;
  version: number;
}

export interface BatchPublishBody {
  draft_ids: string[];
  commit_message?: string;
}

export interface BatchPublishResult {
  commit_sha: string;
  pr_number: number;
  pr_url: string;
  branch_name: string;
  draft_count: number;
  drafts: ContentDraftSummary[];
}

/** Taxonomy of admin-gated merge conflicts (mirrors backend ConflictKind). */
export type ConflictKind =
  | 'modify_modify'
  | 'modify_delete'
  | 'delete_modify'
  | 'add_add_different';

export interface EntryConflict {
  path: string;
  kind: ConflictKind;
  base: unknown | null;
  ours: unknown | null;
  theirs: unknown | null;
}

export interface ConflictPreview {
  draft_id: string;
  version: number;
  base: Record<string, unknown>;
  ours: Record<string, unknown>;
  theirs: Record<string, unknown>;
  merged: Record<string, unknown>;
  conflicts: EntryConflict[];
  auto_resolved_count: number;
  main_base_sha: string | null;
}

export interface ResolveConflictBody {
  merged_working_content: Record<string, unknown>;
  version: number;
  acknowledged_conflict_paths?: string[];
}

export interface ListDraftsParams {
  status?: ContentDraftStatus[];
  author_id?: string;
  limit?: number;
  offset?: number;
}

// ── Orphan-branch sweeper (Phase 7) ───────────────────────────────────────

export interface SweepOrphansRequest {
  /** When True (default), classify only; no branches are deleted. */
  dry_run?: boolean;
  /** Minimum commit age (days) before a PR-less branch is eligible for deletion. Default 7. */
  min_age_days?: number;
}

export type OrphanBranchStatus = 'keep' | 'delete';
export type OrphanPrState = 'open' | 'closed' | 'merged' | null;

export interface OrphanBranchClassification {
  name: string;
  sha: string;
  age_days: number;
  pr_number: number | null;
  pr_state: OrphanPrState;
  status: OrphanBranchStatus;
  reason: string;
  deleted: boolean;
  error: string | null;
}

export interface SweepOrphansResult {
  dry_run: boolean;
  total_found: number;
  kept_count: number;
  deleted_count: number;
  error_count: number;
  branches: OrphanBranchClassification[];
}

export class ContentDraftsApiService extends BaseApiService {
  private readonly base = '/admin/content-drafts';

  /** Paginated drafts list. Backend uses limit/offset (not page/per_page). */
  async listDrafts(params: ListDraftsParams = {}): Promise<PaginatedResponse<ContentDraftSummary>> {
    const query: Record<string, string> = {};
    if (params.author_id) query.author_id = params.author_id;
    if (typeof params.limit === 'number') query.limit = String(params.limit);
    if (typeof params.offset === 'number') query.offset = String(params.offset);
    const search = new URLSearchParams(query);
    if (params.status) {
      for (const s of params.status) {
        search.append('status', s);
      }
    }
    const qs = search.toString();
    const path = qs ? `${this.base}?${qs}` : this.base;
    const res = await this.get<ContentDraftSummary[]>(path);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    return {
      success: true,
      data: res.data,
      meta: {
        count: res.meta?.count ?? res.data.length,
        total: res.meta?.total ?? res.data.length,
        limit: res.meta?.limit ?? 50,
        offset: res.meta?.offset ?? 0,
      },
    };
  }

  /** All drafts attached to a given PR (for visual grouping in the list). */
  listByPr(prNumber: number): Promise<ApiResponse<ContentDraft[]>> {
    return this.get(`${this.base}/by-pr/${prNumber}`);
  }

  /** Open drafts (draft|conflict) on this resource — for same-resource race warning. */
  listOpenForResource(
    packSlug: string,
    resourcePath: string,
  ): Promise<ApiResponse<ContentDraftSummary[]>> {
    return this.get(`${this.base}/open-for-resource`, {
      pack_slug: packSlug,
      resource_path: resourcePath,
    });
  }

  /** Full draft by id, including both JSONB blobs. */
  getDraft(draftId: string): Promise<ApiResponse<ContentDraft>> {
    return this.get(`${this.base}/${encodeURIComponent(draftId)}`);
  }

  /** Open a new draft. working_content typically starts as a deep copy of base_content. */
  createDraft(body: ContentDraftCreateBody): Promise<ApiResponse<ContentDraft>> {
    return this.post(this.base, body);
  }

  /**
   * Save working_content with optimistic-concurrency guard.
   *
   * Pass the current version seen by the UI; the backend raises 409 if the
   * DB advanced past it. UI must refetch on 409.
   *
   * Validation piggybacks on this call: Pydantic errors on working_content
   * surface as 422 (the editor maps them to an inline banner).
   */
  updateWorking(draftId: string, body: ContentDraftUpdateBody): Promise<ApiResponse<ContentDraft>> {
    return this.patch(`${this.base}/${encodeURIComponent(draftId)}`, body);
  }

  /**
   * Abandon a draft (state-gated: draft|conflict → abandoned).
   *
   * Returns 409 for published/merged/abandoned — the admin UI should surface
   * the message text from the error payload.
   */
  abandonDraft(draftId: string): Promise<ApiResponse<{ deleted: boolean; id: string }>> {
    return this.delete(`${this.base}/${encodeURIComponent(draftId)}`);
  }

  /** Batch-publish N drafts as a single PR. 1..25 drafts per batch. */
  publishBatch(body: BatchPublishBody): Promise<ApiResponse<BatchPublishResult>> {
    return this.post(`${this.base}/publish`, body);
  }

  /**
   * Server-computed 3-way merge preview for a conflict-status draft.
   *
   * Fetches main-branch content and runs the semantic merge. Result is
   * rendered by `VelgContentDraftConflictView` as a 3-column diff (base /
   * ours / theirs) plus a pre-merged `merged` tree with admin-gated
   * conflicts enumerated for per-entry flip.
   *
   * Only valid when the draft is in 'conflict' status (409 otherwise).
   */
  getConflictPreview(draftId: string): Promise<ApiResponse<ConflictPreview>> {
    return this.get(`${this.base}/${encodeURIComponent(draftId)}/conflict-preview`);
  }

  /**
   * Accept admin-approved merged content; transitions conflict → draft.
   *
   * `version` must match the DB row's current version (captured at preview
   * time). Mismatch returns 409, admin refreshes the preview and retries.
   * After success, the draft is back in normal edit mode and re-publishable.
   */
  resolveConflict(draftId: string, body: ResolveConflictBody): Promise<ApiResponse<ContentDraft>> {
    return this.post(`${this.base}/${encodeURIComponent(draftId)}/resolve`, body);
  }

  /**
   * Garbage-collect abandoned `content/drafts-batch-*` branches on the repo.
   *
   * Always runs dry-run by default (body.dry_run defaults to True server-side,
   * but we mirror the shape here explicitly). Admins see a full classification
   * table before committing to actual deletions.
   *
   * Per-branch errors during deletion are surfaced in the response's
   * `branches[].error` — one failure never aborts the sweep.
   */
  sweepOrphans(body: SweepOrphansRequest = {}): Promise<ApiResponse<SweepOrphansResult>> {
    return this.post(`${this.base}/sweep-orphans`, body);
  }
}

export const contentDraftsApi = new ContentDraftsApiService();
