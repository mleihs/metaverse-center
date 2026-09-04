// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../src/types/index.js';

vi.mock('../src/services/supabase/client.js', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({}) } },
}));

const { lockFailureFrom } = await import('../src/components/chat/ChatLockModal.js');

/**
 * Warum es diese Zuordnung gibt.
 *
 * Der Verschluss eines Gespraechs verlangt das Kontopasswort. Bis 2026-09-05
 * fuehrte die Oberflaeche dazu ein `rejected: boolean`, und JEDER Fehlschlag
 * las sich als „Password not recognised. The lock stays."
 *
 * Auf Produktion gemessen: `/api/v1/auth/reauth` ist auf 5 Aufrufe je Minute
 * gedrosselt. Sechs Aufrufe hintereinander mit dem RICHTIGEN Passwort ergaben
 * fuenfmal HTTP 200 und dann HTTP 429 — die Oberflaeche schrieb das dem
 * Passwort zu. Wer daraufhin dasselbe richtige Passwort noch einmal eingab,
 * bekam dieselbe Meldung.
 *
 * Zwei Dinge muessen darum stimmen, und beide stehen hier:
 * die Zahl entscheidet (nicht der Text, den es bei einer Drossel gar nicht
 * gibt), und nur 401 heisst „das Passwort war falsch".
 */
describe('lockFailureFrom', () => {
  const err = (status: number, code = `HTTP_${status}`): ApiError => ({
    code,
    message: '',
    status,
  });

  it('nennt nur 401 ein falsches Passwort', () => {
    expect(lockFailureFrom(err(401))).toBe('password');
  });

  it('erkennt die Drossel als Drossel', () => {
    // Der Rumpf ist {"error": "Rate limit exceeded: 5 per 1 minute"} — ohne
    // `message` und ohne `detail`. Ein Vergleich auf Text traefe hier nichts.
    expect(lockFailureFrom(err(429))).toBe('throttled');
  });

  it('trennt „nicht deins" von „falsches Passwort"', () => {
    expect(lockFailureFrom(err(403))).toBe('denied');
    expect(lockFailureFrom(err(404))).toBe('denied');
  });

  it('nennt jeden Serverfehler unerreichbar, weil das Passwort nie geprueft wurde', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(lockFailureFrom(err(status))).toBe('unreachable');
    }
  });

  it('nennt einen Netzfehler unerreichbar', () => {
    // Der Fall, den ein nicht laufendes Backend hinter dem Dev-Proxy erzeugt.
    expect(lockFailureFrom({ code: 'NETWORK_ERROR', message: 'failed to fetch' })).toBe(
      'unreachable',
    );
  });

  it('faellt auf einen allgemeinen Fehler zurueck, statt das Passwort zu beschuldigen', () => {
    expect(lockFailureFrom(err(400))).toBe('error');
    expect(lockFailureFrom(undefined)).toBe('error');
    // Ohne Statuszahl ist „falsches Passwort" eine Behauptung, keine Messung.
    expect(lockFailureFrom({ code: 'WEIRD', message: '' })).toBe('error');
  });
});

/**
 * Die zweite Haelfte desselben Fehlers: eine 401 von diesen beiden Endpunkten
 * meldete den Nutzer aus der ganzen Anwendung ab. `BaseApiService` ruft bei
 * jeder 401 `supabase.auth.signOut()` auf — richtig fuer ein abgelaufenes
 * Token, falsch fuer „dieses Passwort stimmt nicht". Ein Tippfehler im
 * Passwortfeld zerstoerte die Sitzung, und jeder weitere Versuch scheiterte
 * danach ohne Token erneut mit 401.
 */
describe('Passwortpfade melden nicht ab', () => {
  it('reauth und setConversationLock gehen ueber die 401-duldenden Methoden', async () => {
    const [fs, path] = await Promise.all([import('node:fs'), import('node:path')]);
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/api/ChatApiService.ts'),
      'utf8',
    );
    expect(source).toContain("postExpecting401('/auth/reauth'");
    expect(source).toContain('patchExpecting401(');
    // Kein Rueckfall auf die abmeldenden Varianten an diesen beiden Stellen.
    expect(source).not.toContain("this.post('/auth/reauth'");
  });
});
