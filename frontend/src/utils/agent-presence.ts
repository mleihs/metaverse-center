/**
 * Where an agent is, said in the world's voice.
 *
 * The handoff sketches a live status in the chat window head — „Erreichbar /
 * Im Amt / Unterwegs / Zählt". The prototype does NOT derive those: each
 * sample agent carries a hand-written `status` matching their profession
 * (`Simulation Chat.dc.html:337-340`). A registrar is „Im Amt", a heretic
 * beekeeper is „Unterwegs", a census drone „Zählt". It is labelling in the
 * character's tone, not a state machine — which is why the handoff never says
 * what it hangs on. It hung on nothing.
 *
 * There IS a real derivation, and it meets that language almost word for word.
 * Measured on prod across 258 agents:
 *
 *     current_building_id set   ->  „Im Amt"       206 of 258
 *     only current_zone_id      ->  „Unterwegs"     52 of 258
 *     neither                   ->  „Erreichbar"     0 today
 *     is_ambassador             ->  „Im Auftrag"    14 (migration 322)
 *
 * „Zählt" is deliberately absent. It was one drone's joke and has no
 * structural referent — a fifth label with nothing behind it is a door that
 * only opens for those already inside.
 *
 * ⚠ THE GREEN DOT IS THE HARDER HALF. Everywhere else on the web it means „is
 * online right now". An AI agent always is, so the dot is either always green —
 * saying nothing — or it claims something. It is therefore tied to the SAME
 * derivation as the label and goes quiet for the states that are not a post:
 * a signal that never changes is decoration with the look of a measurement.
 */

export type AgentPresence = 'in_office' | 'travelling' | 'on_mission' | 'reachable';

export interface PresenceInput {
  current_building_id?: string | null;
  current_zone_id?: string | null;
  is_ambassador?: boolean | null;
}

/**
 * @returns the presence, or `null` when the payload carries none of the three
 *          fields — which is not „reachable", it is „nobody said". The chat
 *          conversation endpoint sends `AgentBrief` (id, name, portrait) and
 *          nothing else, so today this returns `null` there and the window head
 *          shows no status line at all. That is the honest result: an invented
 *          „Erreichbar" on every agent would look like a reading and be a
 *          decoration.
 */
export function agentPresence(agent: PresenceInput | null | undefined): AgentPresence | null {
  if (!agent) return null;
  const known =
    agent.current_building_id !== undefined ||
    agent.current_zone_id !== undefined ||
    agent.is_ambassador !== undefined;
  if (!known) return null;

  if (agent.is_ambassador) return 'on_mission';
  if (agent.current_building_id) return 'in_office';
  if (agent.current_zone_id) return 'travelling';
  return 'reachable';
}

/** Whether the dot beside the label should be lit. Only a post is a post. */
export function presenceIsPosted(presence: AgentPresence): boolean {
  return presence === 'in_office' || presence === 'on_mission';
}
