/**
 * Die abgeleitete Bildstrecke der Frontseite, als `srcset` statt als Handarbeit.
 *
 * Die Dateien unter `platform/landing/2026-08/` folgen einem einzigen
 * Namensschema: `{stamm}-{rolle}-{breite}.{format}`. Das ist der Grund, warum es
 * hier KEINE Liste von URLs gibt, sondern einen Erzeuger: eine Liste waere
 * dieselbe Wahrheit an einem zweiten Ort, und der zweite Ort veraltet.
 *
 * Wie viele Dateien es sind, steht hier absichtlich nicht mehr. Es stand einmal
 * „68" da und waren dann 82, weil eine achte Quelle und zwei Rollen dazukamen —
 * eine Zahl in Prosa ist genau die Art zweiter Ort, die dieses Modul vermeiden
 * soll. Die Zahl ergibt sich aus `LANDING_IMAGE_SETS` mal `LANDING_IMAGE_WIDTHS`
 * mal zwei Formate, und `landing-images.test.ts` rechnet sie gegen die
 * Python-Tabelle nach.
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

/** Die Verwendungen im Entwurf, mit den Breiten, die abgeleitet wurden. */
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
   * 4fr-Spalte eines `8fr 4fr`-Rasters.
   *
   * GERECHNET, nicht geschaetzt: Tafel = (min(V, 1920) - 2*Rinne - 48) / 3.
   * Bei 1728 px Fenster sind das (1728 - 96 - 48) / 3 = 528 CSS-px = 30,6 vw.
   * Hier stand bis zum 05.09.2026 „438 px, rund 25 vw"; 438 loest die Gleichung
   * nach einem Fenster von rund 1457 px auf — also nach einem Messfenster mit
   * angedockten Entwicklerwerkzeugen. Was daran hing, steht bei `sizes` unten.
   *
   * 1200 ist die Stufe, die den Sprung 960 -> 1440 schliesst. Dort landet
   * JEDER doppelt dichte Schirm (1056 Geraetepixel bei 1728, 1163 bei 2560):
   * vorher fiel er auf 1440 und trug 364 KB, jetzt auf 1200 und traegt 159 KB.
   */
  heroPortrait: [640, 960, 1200, 1440],
  /*
   * Derselbe Anmeldesaal, auf 16:9 zugeschnitten — fuer den gestapelten
   * Entwurf unter 1023 px, wo der Rahmen selbst 16:9 ist.
   *
   * Ohne diese Rolle laedt ein Telefon die Hochkant-Fassung und `object-fit:
   * cover` wirft 58 % davon weg. Der Zuschnitt passiert jetzt beim Ableiten
   * (`Role.aspect` in `derive_landing_images.py`), also einmal statt bei jedem
   * Abruf: 1280 x 720 statt 1440 x 1929, gemessen 78 KB statt 364 KB.
   */
  heroWide: [640, 960, 1280],
} as const;

export type LandingImageRole = keyof typeof LANDING_IMAGE_WIDTHS;

/**
 * Welcher Stamm in welchen Rollen abgeleitet wurde — die Spiegelung von
 * `_SOURCES` in `derive_landing_images.py`.
 *
 * WARUM ES DIESE TABELLE GIBT. `landingSrcset(stem: string, role)` nahm jede
 * Zeichenkette an, also auch jedes Paar, fuer das nie eine Datei geschrieben
 * wurde. Ein halbfertiger Umbau — `(LANDING_HERO_STEM, 'heroPortrait')` oder
 * `(ATLAS_HERO_STEM, 'hero')` — war typrein und lieferte drei
 * `srcset`-Kandidaten plus einen Rueckfall, die alle 404 sind. `<picture>`
 * waehlt nur nach `type` und `media` und versucht bei einem Fehlschlag KEINE
 * andere Quelle; das Ergebnis ist ein leerer Rahmen, den `alt=""` auch noch um
 * die Bruchbild-Anzeige bringt, ohne einen Weg nach Sentry.
 *
 * Das ist die Hausregel `widening-to-string-is-a-cast`: ein `string`, wo eine
 * Vereinigung hingehoert, schaltet die Typpruefung an genau der Stelle ab, an
 * der sie helfen koennte.
 */
export const LANDING_IMAGE_SETS = {
  'hero-bureau': ['hero'],
  'hero-intake-hall': ['heroPortrait', 'heroWide'],
  'system-01-forge': ['panel', 'thumb'],
  'system-02-epochs': ['panel', 'thumb'],
  'system-03-dungeons': ['panel', 'thumb'],
  'system-04-drift': ['panel', 'thumb'],
  'system-05-substrate': ['panel', 'thumb'],
  'system-06-terminal': ['panel', 'thumb'],
} as const satisfies Record<string, readonly LandingImageRole[]>;

/** Ein Stamm, wie `derive_landing_images.py` ihn schreibt. */
export type LandingImageStem = keyof typeof LANDING_IMAGE_SETS;

/** Die Rollen, die es fuer genau diesen Stamm gibt. */
export type LandingRoleOf<S extends LandingImageStem> = (typeof LANDING_IMAGE_SETS)[S][number];

export const LANDING_HERO_STEM = 'hero-bureau';

/**
 * Der Held der Atlas-Frontseite: der Anmeldesaal.
 *
 * Ein EIGENER Stamm, nicht `hero-bureau`. Beide Frontseiten teilten sich bis
 * hierher denselben, und das ging nur gut, solange beide quer waren. Der
 * Atlas-Rahmen ist 3:4 mit `object-fit: cover` — ein Querformat wird darin auf
 * einen schmalen Mittelstreifen beschnitten. Das Bild hier ist 1792 x 2400
 * (0,747), also genau der Zuschnitt des Rahmens.
 *
 * Unter 1023 px kippt der Rahmen auf 16:9. Dafuer gibt es die Rolle
 * `heroWide` — sonst passiert dem Hochformat dort genau das, was dem
 * Querformat oben passiert waere, nur andersherum.
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
export function landingImageUrl<S extends LandingImageStem>(
  stem: S,
  role: LandingRoleOf<S>,
  width: number,
  format: 'avif' | 'webp',
): string {
  return `${BASE}/${stem}-${role}-${width}.${format}`;
}

/** Der `srcset`-Wert fuer eine Rolle und ein Format. */
export function landingSrcset<S extends LandingImageStem>(
  stem: S,
  role: LandingRoleOf<S>,
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
 *
 * `Math.max` und nicht `widths[widths.length - 1]`. Der Unterschied ist nur
 * dann keiner, wenn jede Leiter aufsteigend sortiert ist — und die
 * Python-Tabelle, aus der diese Zahlen kommen, ist durchweg ABSTEIGEND
 * sortiert. Die natuerliche Richtung beim Abgleich ist Python -> TypeScript;
 * ein `(1440, 960, 640)`, das als `[1440, 960, 640]` hier landet, haette
 * stillschweigend die 640er WebP als `<img src>` fuer einen 1440er Rahmen
 * gesetzt. `tsc` bliebe gruen (es ist weiter ein Zahlen-Tupel), `srcset`
 * bliebe vollstaendig, und nichts waere sichtbar kaputt.
 */
export function landingFallbackUrl<S extends LandingImageStem>(
  stem: S,
  role: LandingRoleOf<S>,
): string {
  return landingImageUrl(stem, role, Math.max(...LANDING_IMAGE_WIDTHS[role]), 'webp');
}

/** Das `sizes`-Attribut je Rolle - was die Seite an dieser Stelle wirklich anzeigt. */
export const LANDING_IMAGE_SIZES: Record<LandingImageRole, string> = {
  hero: '100vw',
  // Der Systemabschnitt stapelt unter 1024 px; dann ist die Tafel so breit
  // wie der Inhalt, darueber steht sie fest bei 640 px.
  panel: '(max-width: 1024px) 100vw, 640px',
  thumb: '(max-width: 1024px) 16vw, 100px',
  /*
   * Ueber 1023 px steht die Tafel in der 4fr-Spalte: gerechnet 528 CSS-px bei
   * 1728 px Fenster, also 30,6 vw. Darunter greift `heroWide` und diese Zeile
   * gar nicht mehr — deshalb steht hier kein `100vw`-Zweig mehr.
   *
   * Hier stand bis zum 05.09.2026 „26vw" mit der Begruendung, 30 vw sei zu
   * grosszuegig und koste Bytes. Die Rechnung war umgekehrt richtig: 26 vw
   * deklariert bei 1728 px genau 899 Geraetepixel, gebraucht werden 1056, also
   * nimmt der Browser die naechstkleinere Stufe und rechnet sie hoch — auf
   * genau dem Geraet, an dem die Zahl eingestellt wurde, und fuer eine
   * Federzeichnung, deren eigener Kommentar sagt, dass sie jeden
   * Kompressionsfehler zeigt. Die Bytes holt jetzt die 1200er Stufe zurueck,
   * nicht ein zu kleines `sizes`.
   *
   * WARUM HIER EINE FENSTER-BEDINGUNG STEHT UND EINE CONTAINER-ABFRAGE GEMEINT
   * IST. `sizes` kennt keine Container-Form; die Umschaltung des Entwurfs ist
   * aber `@container (max-width: 1023px)` gegen den Wirt. Beide stimmen nur
   * ueberein, solange der Wirt so breit ist wie das Fenster. Das ist heute so
   * (die Frontseite ist die einzige Verwendung) und faellt in dem Moment
   * auseinander, in dem die Komponente in einer Vorschau, einer eingebetteten
   * Ansicht oder einer geteilten Spalte steht. Wer sie dort einsetzt, muss
   * diese Zeile mitnehmen.
   */
  heroPortrait: '30vw',
  // Unter 1023 px ist der Rahmen so breit wie das Blatt.
  heroWide: '100vw',
};
