-- Migration 131: Heartbeat Tuning Settings
-- Externalizes all hardcoded game constants into platform_settings
-- so they are admin-configurable without code changes.

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('heartbeat_event_aging_rules', '{"active_to_escalating":4,"escalating_to_resolving":6,"resolving_to_resolved":3,"resolved_to_archived":8}',
   'Ticks per event status transition (JSON map)'),
  ('heartbeat_bureau_contain_multiplier', '0.30',
   'Bureau contain response effectiveness multiplier'),
  ('heartbeat_bureau_remediate_multiplier', '0.60',
   'Bureau remediate response effectiveness multiplier'),
  ('heartbeat_bureau_adapt_multiplier', '0.50',
   'Bureau adapt response scar tissue reduction multiplier'),
  ('heartbeat_bureau_max_agents', '5',
   'Maximum agents assignable per bureau response'),
  ('heartbeat_positive_event_probability', '0.20',
   'Per-tick probability of positive event when attunement at threshold'),
  ('heartbeat_max_attunements', '2',
   'Maximum resonance signature attunements per simulation'),
  ('heartbeat_switching_cooldown_ticks', '3',
   'Ticks of cooldown when switching attunements'),
  ('heartbeat_anchor_protection_cap', '0.70',
   'Maximum anchor protection factor (0.0-1.0)')
ON CONFLICT (setting_key) DO NOTHING;
