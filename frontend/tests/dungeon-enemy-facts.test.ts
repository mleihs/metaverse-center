/**
 * describeEnemy — what a creature is, said once for every surface.
 *
 * Before this, the graphical enemy band was `aria-hidden` decoration and the
 * terminal's enemy panel carried every fact. Making the band interactive
 * (remediation plan C-6) risks exactly what the plan warned about: two enemy
 * lists that drift. One description, rendered twice.
 */

import { describe, expect, it } from 'vitest';

import type { EnemyCombatStateClient } from '../src/types/dungeon.js';
import { describeEnemy } from '../src/utils/dungeon-formatters.js';

function enemy(overrides: Partial<EnemyCombatStateClient> = {}): EnemyCombatStateClient {
  return {
    instance_id: 'e1',
    name_en: 'Rust Phantom',
    name_de: 'Rostphantom',
    threat_level: 'elite',
    condition_display: 'wounded',
    is_alive: true,
    telegraphed_action: null,
    image_path: null,
    ...overrides,
  } as EnemyCombatStateClient;
}

describe('describeEnemy', () => {
  it('names the tier and the condition', () => {
    const facts = describeEnemy(enemy(), 'Rust Phantom A');
    expect(facts.spoken).toContain('Rust Phantom A');
    expect(facts.spoken).toContain('ELITE');
    expect(facts.line).toContain('ELITE');
  });

  it('carries the telegraphed blow AND its target', () => {
    // The target was the one fact the band could not show: its intent chip has
    // room for the verb only. It must not be lost when the panel goes away.
    const facts = describeEnemy(
      enemy({
        telegraphed_action: {
          enemy_name: 'Rust Phantom A',
          intent: 'Winds up',
          target: 'Aranea',
          threat_level: 'high',
        },
      }),
      'Rust Phantom A',
    );
    expect(facts.line).toContain('Winds up');
    expect(facts.line).toContain('Aranea');
  });

  it('omits the intent when there is none', () => {
    const facts = describeEnemy(enemy({ telegraphed_action: null }), 'Rust Phantom A');
    expect(facts.line.split('·')).toHaveLength(2);
  });

  it('reports a defeated creature as defeated and drops its intent', () => {
    const facts = describeEnemy(
      enemy({
        is_alive: false,
        telegraphed_action: {
          enemy_name: 'Rust Phantom A',
          intent: 'Winds up',
          target: 'Aranea',
          threat_level: 'high',
        },
      }),
      'Rust Phantom A',
    );
    expect(facts.line).not.toContain('Winds up');
    expect(facts.line.toLowerCase()).toContain('defeated');
  });

  it('uses the passed display name, so a duplicate pair stays distinguishable', () => {
    // buildEnemyDisplayNames turns two identical creatures into "Wisp A" /
    // "Wisp B"; both surfaces must speak that name, not the template name.
    const a = describeEnemy(enemy({ name_en: 'Wisp' }), 'Wisp A');
    const b = describeEnemy(enemy({ name_en: 'Wisp' }), 'Wisp B');
    expect(a.spoken).not.toBe(b.spoken);
    expect(a.spoken).toContain('Wisp A');
  });
});
