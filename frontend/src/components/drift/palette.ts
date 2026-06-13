import * as THREE from 'three';

/**
 * Frequency palette is sourced from CSS custom properties — the token bridge
 * the concept's appendix 23/C calls for (canvas reads its palette from the
 * design system, not from duplicated constants).
 * THREE.Color.set() interprets CSS strings as sRGB and converts to the linear
 * working space (ColorManagement is on by default since r152).
 */
export function readFreqPalette(): THREE.Color[] {
  const style = getComputedStyle(document.documentElement);
  const colors: THREE.Color[] = [];
  for (let i = 0; i < 7; i++) {
    const raw = style.getPropertyValue(`--drift-freq-${i}`).trim();
    colors.push(new THREE.Color(raw || '#8899bb'));
  }
  return colors;
}

export function freqCssVar(i: number): string {
  return `var(--drift-freq-${i})`;
}
