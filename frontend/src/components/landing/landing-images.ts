/**
 * Die abgeleitete Bildstrecke der Frontseite, als `srcset` statt als Handarbeit.
 *
 * Die 68 Dateien unter `platform/landing/2026-08/` folgen einem einzigen
 * Namensschema: `{stamm}-{rolle}-{breite}.{format}`. Das ist der Grund, warum es
 * hier KEINE Liste von 68 URLs gibt, sondern einen Erzeuger: eine Liste waere
 * dieselbe Wahrheit an einem zweiten Ort, und der zweite Ort veraltet.
 *
 * Die Breiten stehen hier noch einmal, weil das Markup sie fuer `srcset`
 * braucht - aber sie sind an EINER Stelle gemessen worden
 * (`scripts/derive_landing_images.py`), und ein Ableitungslauf, der andere
 * Breiten schreibt, macht `landing-images.spec` rot statt die Seite still
 * kaputt.
 *
 * WARUM DER PFAD EIN DATUM TRAEGT
 * Unter `platform/landing/` liegen noch neun Dateien der alten Frontseite. Der
 * datierte Vorsatz haelt die Generationen auseinander und macht jede URL
 * endgueltig - eine neue Ableitung bekommt einen neuen Vorsatz, nie eine
 * ueberschriebene URL.
 *
 * ZUM ZWISCHENSPEICHER, GEMESSEN 31.08.2026
 * `/storage/v1/object/public/...` liefert `cache-control: no-cache`, was immer
 * beim Ablegen gesendet wird. Das ist weniger schlimm als es klingt: `no-cache`
 * heisst "neu pruefen", nicht "nicht speichern", und der Ursprung setzt einen
 * ETag - eine bedingte Anfrage kommt mit 304 und null Bytes zurueck. Ein
 * wiederholter Besuch kostet also einen Rundlauf je Bild, keine Nutzlast.
 * Deshalb steht auf allem ausser dem Helden `loading="lazy"`.
 */

const BASE =
  'https://bffjoupddfjaljqrwqck.supabase.co/storage/v1/object/public/simulation.assets/platform/landing/2026-08';

/** Die drei Verwendungen im Entwurf, mit den Breiten, die abgeleitet wurden. */
export const LANDING_IMAGE_WIDTHS = {
  /** Volle Seitenbreite. Referenz 1440 px, uebliche Schirme bis 1920. */
  hero: [640, 960, 1440, 1920],
  /** 640 CSS-px im Entwurf; 1280 deckt doppelte Pixeldichte. */
  panel: [640, 960, 1280],
  /** Sechs Stueck in 640 px mit 10 px Abstand, je rund 96 CSS-px. */
  thumb: [192, 288],
  /*
   * Die Hochkant-Tafel der Atlas-Frontseite (`aspect-ratio: 3 / 4`).
   *
   * Eigene Rolle und nicht `hero`, weil das etwas anderes ist: `hero` ist die
   * VOLLE Seitenbreite der alten Frontseite und quer. Diese Tafel steht in der
   * 4fr-Spalte eines `8fr 4fr`-Rasters — gemessen 438 CSS-px bei 1728 px
   * Fenster, also rund 25 vw. 1440 deckt das bei doppelter Pixeldichte auf
   * einem 2560er Schirm; 1920 waere Ablage fuer einen Fall, den es nicht gibt.
   */
  heroPortrait: [640, 960, 1440],
} as const;

export type LandingImageRole = keyof typeof LANDING_IMAGE_WIDTHS;

/** Die Staemme, wie `derive_landing_images.py` sie schreibt. */
export const LANDING_HERO_STEM = 'hero-bureau';

/**
 * Der Held der Atlas-Frontseite: der Anmeldesaal.
 *
 * Ein EIGENER Stamm, nicht `hero-bureau`. Beide Frontseiten teilten sich bis
 * hierher denselben, und das ging nur gut, solange beide quer waren. Der
 * Atlas-Rahmen ist 3:4 mit `object-fit: cover` — ein Querformat wird darin auf
 * einen schmalen Mittelstreifen beschnitten. Das Bild hier ist 1792 x 2400
 * (0,747), also genau der Zuschnitt des Rahmens.
 */
export const ATLAS_HERO_STEM = 'hero-intake-hall';

export const LANDING_SYSTEM_STEMS = [
  'system-01-forge',
  'system-02-epochs',
  'system-03-dungeons',
  'system-04-drift',
  'system-05-substrate',
  'system-06-terminal',
] as const;

export type LandingSystemStem = (typeof LANDING_SYSTEM_STEMS)[number];

/** Eine einzelne Datei-URL. */
export function landingImageUrl(
  stem: string,
  role: LandingImageRole,
  width: number,
  format: 'avif' | 'webp',
): string {
  return `${BASE}/${stem}-${role}-${width}.${format}`;
}

/** Der `srcset`-Wert fuer eine Rolle und ein Format. */
export function landingSrcset(
  stem: string,
  role: LandingImageRole,
  format: 'avif' | 'webp',
): string {
  return LANDING_IMAGE_WIDTHS[role]
    .map((width) => `${landingImageUrl(stem, role, width, format)} ${width}w`)
    .join(', ');
}

/**
 * Die Rueckfall-URL fuer das `<img>`-Element: WebP in der groessten Breite.
 *
 * WebP und nicht JPEG, weil es keinen JPEG-Satz gibt - begruendet in
 * `derive_landing_images.py`: ein dritter Satz griffe nur in einem Browser
 * ohne WebP, und ohne WebP startet diese Anwendung gar nicht (Lit 3,
 * ES-Module, `color-mix()`).
 */
export function landingFallbackUrl(stem: string, role: LandingImageRole): string {
  const widths = LANDING_IMAGE_WIDTHS[role];
  return landingImageUrl(stem, role, widths[widths.length - 1], 'webp');
}

/** Das `sizes`-Attribut je Rolle - was die Seite an dieser Stelle wirklich anzeigt. */
export const LANDING_IMAGE_SIZES: Record<LandingImageRole, string> = {
  hero: '100vw',
  // Der Systemabschnitt stapelt unter 1024 px; dann ist die Tafel so breit
  // wie der Inhalt, darueber steht sie fest bei 640 px.
  panel: '(max-width: 1024px) 100vw, 640px',
  thumb: '(max-width: 1024px) 16vw, 100px',
  /*
   * Unter 1024 px klappt das Raster auf eine Spalte, die Tafel wird so breit
   * wie der Inhalt. Darueber steht sie in der 4fr-Spalte: gemessen 438 CSS-px
   * bei 1728 px Fenster, also 25,3 vw.
   *
   * Hier steht 26 und nicht 30, und das ist keine Kosmetik. Mit 30 vw waehlt
   * ein 1728er Schirm bei doppelter Dichte die 1440er Stufe (364 KB) statt der
   * 960er (155 KB) — fuer eine Tafel, die 438 px breit dasteht. Ein `sizes`,
   * das grosszuegig schaetzt, kostet echte Bytes an der einzigen Stelle, an
   * der die Seite ein Bild ueber der Falz laedt.
   */
  heroPortrait: '(max-width: 1023px) 100vw, 26vw',
};
