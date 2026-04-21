/**
 * BureauOpsApiService — typed client for /api/v1/admin/ops/* (P1).
 *
 * Mirrors backend/routers/admin_ops.py. Every call requires a platform
 * admin JWT; BaseApiService forwards the Authorization header.
 *
 * Types intentionally live in this file (not types/index.ts) so the
 * release-cut of Bureau Ops is a single-file remove.
 */

import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

// ── Scope / period enums (mirror migration 228 CHECKs) ──────────────────

export type BudgetScope = 'global' | 'purpose' | 'simulation' | 'user';
export type BudgetPeriod = 'hour' | 'day' | 'month';
export type CircuitScope = 'provider' | 'model' | 'purpose' | 'global';
export type CircuitState = 'closed' | 'half_open' | 'open' | 'killed';

// ── Ledger + firehose ──────────────────────────────────────────────────

export interface LedgerMetric {
  calls: number;
  tokens: number;
  cost_usd: number;
}

export interface LedgerBreakdownRow {
  key: string;
  calls: number;
  tokens: number;
  cost_usd: number;
}

export interface LedgerSnapshot {
  today: LedgerMetric;
  month: LedgerMetric;
  last_hour: LedgerMetric;
  hourly_trend: LedgerMetric[];
  by_purpose: LedgerBreakdownRow[];
  by_model: LedgerBreakdownRow[];
  by_provider: LedgerBreakdownRow[];
  generated_at: string;
}

export interface FirehoseEntry {
  id: string;
  created_at: string;
  provider: string;
  model: string;
  purpose: string;
  total_tokens: number;
  estimated_cost_usd: number;
  duration_ms: number;
  simulation_id: string | null;
  user_id: string | null;
  key_source: string;
  status: string;
}

// ── Circuit matrix ─────────────────────────────────────────────────────

export interface CircuitEntry {
  scope: CircuitScope;
  scope_key: string;
  state: CircuitState;
  failures_in_window: number;
  opens_until_s: number;
  consecutive_opens: number;
  killed_reason?: string | null;
  killed_revert_at?: string | null;
  killed_by_id?: string | null;
}

export interface CircuitMatrix {
  entries: CircuitEntry[];
  generated_at: string;
}

// ── Heatmap (P2.6) ─────────────────────────────────────────────────────

export type HeatmapDimension = 'purpose' | 'model' | 'provider';

export interface HeatmapCell {
  hour: string;
  key: string;
  calls: number;
  tokens: number;
  cost_usd: number;
}

// ── Sentry rules (P2.3) ────────────────────────────────────────────────

export type SentryRuleKind = 'ignore' | 'fingerprint' | 'downgrade';
export type SentryDowngradeTo = 'warning' | 'info';

export interface SentryRule {
  id: string;
  kind: SentryRuleKind;
  match_exception_type: string | null;
  match_message_regex: string | null;
  match_logger: string | null;
  fingerprint_template: string | null;
  downgrade_to: SentryDowngradeTo | null;
  enabled: boolean;
  note: string;
  silenced_count_24h: number;
  updated_by_id: string | null;
  updated_at: string;
  created_at: string;
}

export interface SentryRuleUpsertBody {
  kind: SentryRuleKind;
  match_exception_type?: string | null;
  match_message_regex?: string | null;
  match_logger?: string | null;
  fingerprint_template?: string | null;
  downgrade_to?: SentryDowngradeTo | null;
  enabled?: boolean;
  note: string;
  /** Why this mutation happened (audit log). Falls back to `note` on backend if omitted. */
  audit_reason?: string | null;
}

// ── Audit log ──────────────────────────────────────────────────────────

export interface OpsAuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_scope: string | null;
  target_key: string | null;
  reason: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// ── Budget ─────────────────────────────────────────────────────────────

export interface BudgetCap {
  id: string;
  scope: BudgetScope;
  scope_key: string;
  period: BudgetPeriod;
  max_usd: number;
  max_calls: number | null;
  soft_warn_pct: number;
  hard_block_pct: number;
  enabled: boolean;
  updated_by_id: string | null;
  updated_at: string;
  created_at: string;
  current_usd: number;
  current_calls: number;
}

export interface BudgetUpsertBody {
  scope: BudgetScope;
  scope_key: string;
  period: BudgetPeriod;
  max_usd: number;
  max_calls?: number | null;
  soft_warn_pct?: number;
  hard_block_pct?: number;
  enabled?: boolean;
  reason: string;
}

// ── Kill / revert ──────────────────────────────────────────────────────

export interface TripKillBody {
  scope: CircuitScope;
  scope_key: string;
  reason: string;
  revert_after_minutes: number;
}

export interface RevertKillBody {
  scope: CircuitScope;
  scope_key: string;
  reason: string;
}

export interface ResetCircuitBody {
  scope: CircuitScope;
  scope_key: string;
  reason: string;
}

export interface CutAllAIBody {
  reason: string;
  revert_after_minutes: number;
}

export interface KillActionResponse {
  scope: CircuitScope;
  scope_key: string;
  state: CircuitState;
  revert_at: string | null;
  reason: string;
}

// ── Service ────────────────────────────────────────────────────────────

export class BureauOpsApiService extends BaseApiService {
  async getLedger(): Promise<ApiResponse<LedgerSnapshot>> {
    return this.get('/admin/ops/ledger');
  }

  async getFirehose(limit = 50): Promise<ApiResponse<FirehoseEntry[]>> {
    return this.get('/admin/ops/firehose', { limit: String(limit) });
  }

  async getCircuit(): Promise<ApiResponse<CircuitMatrix>> {
    return this.get('/admin/ops/circuit');
  }

  async getAuditLog(days = 7, limit = 50): Promise<ApiResponse<OpsAuditEntry[]>> {
    return this.get('/admin/ops/audit', { days: String(days), limit: String(limit) });
  }

  async listBudgets(): Promise<ApiResponse<BudgetCap[]>> {
    return this.get('/admin/ops/budgets');
  }

  async createBudget(body: BudgetUpsertBody): Promise<ApiResponse<BudgetCap>> {
    return this.post('/admin/ops/budget', body);
  }

  async updateBudget(id: string, body: BudgetUpsertBody): Promise<ApiResponse<BudgetCap>> {
    return this.put(`/admin/ops/budget/${id}`, body);
  }

  async deleteBudget(id: string, reason: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.delete(`/admin/ops/budget/${id}`, { reason });
  }

  async tripKill(body: TripKillBody): Promise<ApiResponse<KillActionResponse>> {
    return this.post('/admin/ops/kill', body);
  }

  async revertKill(body: RevertKillBody): Promise<ApiResponse<KillActionResponse>> {
    return this.post('/admin/ops/revert', body);
  }

  async cutAllAI(body: CutAllAIBody): Promise<ApiResponse<KillActionResponse>> {
    return this.post('/admin/ops/kill/cut-all-ai', body);
  }

  async resetCircuit(body: ResetCircuitBody): Promise<ApiResponse<KillActionResponse>> {
    return this.post('/admin/ops/circuit/reset', body);
  }

  async getHeatmap(
    days = 7,
    dimension: HeatmapDimension = 'purpose',
  ): Promise<ApiResponse<HeatmapCell[]>> {
    return this.get('/admin/ops/heatmap', { days: String(days), dimension });
  }

  async listSentryRules(): Promise<ApiResponse<SentryRule[]>> {
    return this.get('/admin/ops/sentry/rules');
  }

  async createSentryRule(body: SentryRuleUpsertBody): Promise<ApiResponse<SentryRule>> {
    return this.post('/admin/ops/sentry/rules', body);
  }

  async updateSentryRule(
    id: string,
    body: SentryRuleUpsertBody,
  ): Promise<ApiResponse<SentryRule>> {
    return this.put(`/admin/ops/sentry/rules/${id}`, body);
  }

  async deleteSentryRule(
    id: string,
    reason: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.delete(`/admin/ops/sentry/rules/${id}`, { reason });
  }
}

export const bureauOpsApi = new BureauOpsApiService();
