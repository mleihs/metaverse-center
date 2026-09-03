/**
 * Die Geometrie einer aufgefächerten Kartenhand.
 *
 * Zwei Ansichten legen dieselbe Hand aus: das Entsende-Modal
 * (`epoch/DeployOperativeModal.ts`) und die Aufstellung
 * (`epoch/DraftRosterPanel.ts`). Beide trugen diese Rechnung seit März 2026
 * wörtlich gleich als private Methode — zwei Fächer, die auseinanderlaufen,
 * sobald jemand an einem den Winkel nachzieht. Die Hand ist EINE Geste, also
 * steht sie an einer Stelle.
 *
 * Warum hier und nicht in `utils/epoch.ts`: dort steht Domänenlogik einer
 * Epoche (Zyklen, Phasen). Das hier ist Darstellung und weiß von Epochen
 * nichts — es rechnet aus Position und Anzahl einen Winkel und eine Höhe.
 */

/** Der Fächer öffnet sich höchstens so weit, egal wie voll die Hand ist. */
const MAX_SPREAD_DEG = 30;

/** Zuwachs pro Karte, bis `MAX_SPREAD_DEG` die Obergrenze zieht. */
const SPREAD_PER_CARD_DEG = 5;

/**
 * Wie weit die äußerste Karte gegenüber der mittleren absinkt (px pro Rang).
 * Der Bogen entsteht erst dadurch: ohne ihn ist der Fächer nur gedreht.
 */
const ARC_DROP_PX = 8;

/** Drehung in Grad und Absenkung in Pixeln für EINE Karte der Hand. */
export interface FanGeometry {
  rot: number;
  y: number;
}

/**
 * Lage einer Karte im Fächer.
 *
 * @param index Position der Karte, von 0.
 * @param total Anzahl der Karten in der Hand.
 *
 * Eine einzelne Karte liegt gerade — ein Fächer aus einem Blatt ist keiner.
 */
export function fanGeometry(index: number, total: number): FanGeometry {
  if (total <= 1) return { rot: 0, y: 0 };
  const center = (total - 1) / 2;
  const maxRot = Math.min(MAX_SPREAD_DEG, total * SPREAD_PER_CARD_DEG);
  const rot = (index - center) * (maxRot / total);
  const y = Math.abs(index - center) * ARC_DROP_PX;
  return { rot, y };
}
