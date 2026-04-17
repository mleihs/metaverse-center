/**
 * Unit tests for terminal-formatters.ts — pure formatter functions.
 *
 * These functions take data as input and return TerminalLine[] output.
 * No API calls, no side effects — ideal for unit testing.
 */

import { describe, expect, it } from 'vitest';
import type { TerminalLine, TerminalCommand } from '../src/types/terminal.js';
import type { Zone, ZoneStability } from '../src/types/index.js';
import {
  systemLine,
  errorLine,
  responseLine,
  hintLine,
  commandLine,
  formatWhere,
  formatHelp,
  formatHelpCommand,
  formatFortify,
  formatQuarantine,
  formatAssign,
  formatUnassign,
  formatTalkEnter,
  formatTalkExit,
  formatUnknownCommand,
  formatInsufficientClearance,
  formatInsufficientPoints,
  formatAmbiguousTarget,
  formatDirectionNotAvailable,
  formatNoTarget,
  formatClearanceUpgrade,
  formatSitrep,
  formatInsufficientRP,
  formatBootSequence,
  formatOnboardingHint,
} from '../src/utils/terminal-formatters.js';

// ── Helper assertion ─────────────────────────────────────────────────────────

function assertTerminalLines(lines: TerminalLine[], minLength = 1): void {
  expect(lines.length).toBeGreaterThanOrEqual(minLength);
  for (const line of lines) {
    expect(line.id).toBeTruthy();
    expect(line.type).toBeTruthy();
    expect(line.timestamp).toBeInstanceOf(Date);
  }
}

// ── Line factory functions ───────────────────────────────────────────────────

describe('line factory functions', () => {
  it('systemLine creates a system line', () => {
    const line = systemLine('Boot complete');
    expect(line.type).toBe('system');
    expect(line.content).toBe('Boot complete');
    expect(line.id).toBeTruthy();
    expect(line.timestamp).toBeInstanceOf(Date);
  });

  it('errorLine creates an error line', () => {
    const line = errorLine('Command failed');
    expect(line.type).toBe('error');
    expect(line.content).toBe('Command failed');
  });

  it('responseLine creates a response line', () => {
    const line = responseLine('Agent status: OK');
    expect(line.type).toBe('response');
    expect(line.content).toBe('Agent status: OK');
  });

  it('hintLine creates a hint line', () => {
    const line = hintLine('Try typing "look"');
    expect(line.type).toBe('hint');
  });

  it('commandLine creates a command line', () => {
    const line = commandLine('look north');
    expect(line.type).toBe('command');
    expect(line.content).toContain('look north');
  });

  it('each line gets a unique id', () => {
    const a = systemLine('A');
    const b = systemLine('B');
    expect(a.id).not.toBe(b.id);
  });
});

// ── formatWhere ──────────────────────────────────────────────────────────────

describe('formatWhere', () => {
  it('renders zone name in uppercase', () => {
    const zone = { name: 'Port District', id: '1', description: 'A busy harbor' } as Zone;
    const lines = formatWhere(zone);
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('PORT DISTRICT');
  });

  it('includes description when present', () => {
    const zone = { name: 'North Quarter', id: '2', description: 'Quiet streets' } as Zone;
    const lines = formatWhere(zone);
    expect(lines[0].content).toContain('Quiet streets');
  });

  it('works without description', () => {
    const zone = { name: 'Central', id: '3' } as Zone;
    const lines = formatWhere(zone);
    assertTerminalLines(lines);
    expect(lines[0].content).not.toContain('undefined');
  });
});

// ── formatHelp ───────────────────────────────────────────────────────────────

describe('formatHelp', () => {
  const commands: TerminalCommand[] = [
    { verb: 'look', synonyms: ['l'], tier: 1, syntax: 'look', description: 'Look around', requiresTarget: false, handler: async () => [] },
    { verb: 'scan', synonyms: [], tier: 3, syntax: 'scan', description: 'Radar sweep', requiresTarget: false, handler: async () => [] },
  ];

  it('filters commands by clearance level', () => {
    const lines = formatHelp(commands, 1);
    assertTerminalLines(lines, 3);
    // Only the look command should appear in the command listing lines
    // (scan may appear as substring in the OPS/INT explanation text)
    const cmdLines = lines.filter((l) => l.content.includes('look') || l.content.trimStart().startsWith('scan'));
    expect(cmdLines.some((l) => l.content.includes('look'))).toBe(true);
    expect(cmdLines.some((l) => l.content.trimStart().startsWith('scan'))).toBe(false);
  });

  it('shows all commands at higher clearance', () => {
    const lines = formatHelp(commands, 3);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('look');
    expect(content).toContain('scan');
  });
});

// ── formatHelpCommand ────────────────────────────────────────────────────────

describe('formatHelpCommand', () => {
  it('shows verb, syntax, description', () => {
    const cmd: TerminalCommand = {
      verb: 'examine', synonyms: ['x', 'inspect'], tier: 1,
      syntax: 'examine {target}', description: 'Examine entity details',
      requiresTarget: true, handler: async () => [],
    };
    const lines = formatHelpCommand(cmd);
    assertTerminalLines(lines, 2);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('EXAMINE');
    expect(content).toContain('examine {target}');
    expect(content).toContain('x, inspect');
  });

  it('omits aliases line when no synonyms', () => {
    const cmd: TerminalCommand = {
      verb: 'quit', synonyms: [], tier: 1,
      syntax: 'quit', description: 'Exit terminal',
      requiresTarget: false, handler: async () => [],
    };
    const lines = formatHelpCommand(cmd);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).not.toContain('Aliases');
  });
});

// ── Action formatters ────────────────────────────────────────────────────────

describe('formatFortify', () => {
  it('shows zone name and remaining ops', () => {
    const lines = formatFortify('North Sector', 2);
    assertTerminalLines(lines);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('North Sector');
    expect(content).toContain('2');
  });
});

describe('formatQuarantine', () => {
  it('shows zone name and remaining ops', () => {
    const lines = formatQuarantine('Harbor', 1);
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('Harbor');
  });
});

describe('formatAssign', () => {
  it('shows agent and building names', () => {
    const lines = formatAssign('Elena Voss', 'City Hall');
    assertTerminalLines(lines);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('Elena Voss');
    expect(content).toContain('City Hall');
  });
});

describe('formatUnassign', () => {
  it('shows agent name', () => {
    const lines = formatUnassign('Marcus Chen');
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('Marcus Chen');
  });
});

// ── Conversation formatters ──────────────────────────────────────────────────

describe('formatTalkEnter', () => {
  it('shows agent name', () => {
    const lines = formatTalkEnter('Aria Novak');
    assertTerminalLines(lines);
    expect(lines.some((l) => l.content.includes('Aria Novak'))).toBe(true);
  });
});

describe('formatTalkExit', () => {
  it('returns exit message', () => {
    const lines = formatTalkExit();
    assertTerminalLines(lines);
  });
});

// ── Error formatters ─────────────────────────────────────────────────────────

describe('formatUnknownCommand', () => {
  it('shows the unknown input', () => {
    const lines = formatUnknownCommand('foo');
    assertTerminalLines(lines);
    expect(lines[0].type).toBe('error');
    expect(lines[0].content).toContain('foo');
  });

  it('includes suggestion when provided', () => {
    const lines = formatUnknownCommand('lok', 'look');
    expect(lines.length).toBe(2);
    expect(lines[1].type).toBe('hint');
    expect(lines[1].content).toContain('look');
  });

  it('omits suggestion when not provided', () => {
    const lines = formatUnknownCommand('xyz');
    expect(lines.length).toBe(1);
  });
});

describe('formatInsufficientClearance', () => {
  it('shows verb and required tier', () => {
    const lines = formatInsufficientClearance('scan', 3);
    assertTerminalLines(lines);
    expect(lines[0].type).toBe('error');
    expect(lines[0].content).toContain('scan');
    expect(lines[0].content).toContain('3');
  });
});

describe('formatInsufficientPoints', () => {
  it('shows pool name and have/need', () => {
    const lines = formatInsufficientPoints('OPS', 0, 1);
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('OPS');
    expect(lines[0].content).toContain('0/1');
  });
});

describe('formatAmbiguousTarget', () => {
  it('lists all matching names', () => {
    const lines = formatAmbiguousTarget([{ name: 'Elena Voss' }, { name: 'Elena Red' }]);
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('Elena Voss');
    expect(lines[0].content).toContain('Elena Red');
  });
});

describe('formatDirectionNotAvailable', () => {
  it('returns a helpful error', () => {
    const lines = formatDirectionNotAvailable();
    assertTerminalLines(lines);
    expect(lines[0].type).toBe('error');
  });
});

describe('formatNoTarget', () => {
  it('shows the verb and example', () => {
    const lines = formatNoTarget('examine');
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('examine');
  });
});

// ── Clearance + onboarding ───────────────────────────────────────────────────

describe('formatClearanceUpgrade', () => {
  it('shows new level and unlocked commands', () => {
    const lines = formatClearanceUpgrade(2, ['go', 'examine']);
    assertTerminalLines(lines, 2);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('2');
    expect(content).toContain('go');
    expect(content).toContain('examine');
  });
});

describe('formatOnboardingHint', () => {
  it('returns a hint for step 0', () => {
    const line = formatOnboardingHint(0);
    expect(line).not.toBeNull();
    expect(line!.type).toBe('hint');
  });

  it('returns null for unknown step', () => {
    const line = formatOnboardingHint(999);
    expect(line).toBeNull();
  });
});

// ── Boot sequence ────────────────────────────────────────────────────────────

describe('formatBootSequence', () => {
  it('emits only system and art line types', () => {
    const lines = formatBootSequence('Speranza', 'dystopian');
    assertTerminalLines(lines, 5);
    expect(lines.every((l) => l.type === 'system' || l.type === 'art')).toBe(true);
  });

  it('includes simulation name', () => {
    const lines = formatBootSequence('Test Sim');
    const content = lines.map((l) => l.content).join('\n');
    expect(content.toUpperCase()).toContain('TEST SIM');
  });

  it('handles custom art', () => {
    const customArt = '####\n====\n----';
    const lines = formatBootSequence('Sim', undefined, customArt);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('####');
  });
});

// ── Epoch formatters ─────────────────────────────────────────────────────────

describe('formatSitrep', () => {
  it('shows narrative, cycle, and status', () => {
    const lines = formatSitrep('All quiet on the front.', 3, 'competition');
    assertTerminalLines(lines, 2);
    const content = lines.map((l) => l.content).join('\n');
    expect(content).toContain('All quiet');
    expect(content).toContain('3');
  });
});

describe('formatInsufficientRP', () => {
  it('shows have/need values', () => {
    const lines = formatInsufficientRP(1, 3);
    assertTerminalLines(lines);
    expect(lines[0].content).toContain('1');
    expect(lines[0].content).toContain('3');
  });
});
