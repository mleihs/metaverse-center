-- Migration 188: Bot decision log — relax phase constraint for full-cycle logging.
--
-- H4 FIX: The phase column was always set to 'deployment' regardless of what
-- actions the bot actually took. Adding 'full_cycle' phase to represent the
-- complete bot execution cycle (fortifications + deployments + alliances +
-- proposal votes) in a single log entry with per-action outcome tracking.

ALTER TABLE bot_decision_log
    DROP CONSTRAINT IF EXISTS bot_decision_log_phase_check;

ALTER TABLE bot_decision_log
    ADD CONSTRAINT bot_decision_log_phase_check
    CHECK (phase IN ('analysis', 'allocation', 'deployment', 'alliance', 'chat', 'full_cycle'));

-- Add a comment documenting the JSONB decision structure for full_cycle phase
COMMENT ON COLUMN bot_decision_log.decision IS
'JSONB decision payload. For phase=full_cycle (introduced migration 188):
{
  "reasoning": "<personality reasoning string>",
  "planned_deployments": [{"type": "spy", "target": "<sim_id>", "cost": 3}],
  "deployment_outcomes": [{"type": "spy", "target": "<sim_id>", "cost": 3, "success": true, "mission_id": "<id>"}],
  "deployment_success_count": 1,
  "planned_fortifications": [{"zone_id": "<id>", "cost": 2}],
  "fortification_outcomes": [{"zone_id": "<id>", "cost": 2, "success": true}],
  "fortification_success_count": 1,
  "alliance_actions": [{"action": "form", "target": null}],
  "alliance_outcomes": [{"action": "form", "team_id": "<id>"}],
  "proposal_votes": [{"proposal_id": "<id>", "vote": "yes"}],
  "proposal_vote_outcomes": [{"proposal_id": "<id>", "vote": "yes", "success": true}],
  "rp_spent": 8
}';
