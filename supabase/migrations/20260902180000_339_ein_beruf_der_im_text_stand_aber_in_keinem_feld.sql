-- 339 — Ein Beruf, der im Text stand, aber in keinem Feld
--
-- Auf der Übersichtsseite einer Welt zeigt jede Agentenkarte unter dem
-- Namensschild den Beruf. Bei Velgarien war dort nichts — ein leerer Streifen
-- von 52 px unter jedem der neun Namen, während die Gebäudekarten daneben
-- Zustand und Bauart trugen. Am Bildschirm gemessen (02.09.2026):
--
--     Doktor Fenn   primary_profession = NULL   primary_profession_de = NULL
--
-- Es war also kein Darstellungsfehler. Die Spalten gibt es seit der Forge,
-- Velgarien wurde vorher von Hand gebaut, und niemand hat sie je gefüllt.
--
-- DER GRÖSSERE BEFUND, den diese Migration NICHT behebt
--
--     agents (deleted_at is null)                       258
--     davon ohne primary_profession                     156
--     davon ohne primary_profession_de                  171
--     Welten insgesamt                                   41
--     Welten mit mindestens einer Lücke                  25
--
-- Über die Hälfte aller Agenten auf der Plattform hat keinen Beruf auf der
-- Akte. Das ist ein Nachtrag für einen eigenen Lauf: jeder dieser Agenten hat
-- `character` und `background` auf der Akte, der Beruf lässt sich also aus dem
-- ABLEITEN, was schon dasteht — er muss nicht erfunden werden. Genau das ist
-- hier für die neun von Velgarien von Hand geschehen; für 156 gehört es in die
-- Erzeugungsstrecke, nicht in eine Migration.
--
-- HERKUNFT JEDER EINZELNEN ANGABE
--
-- Keine Zuschreibung ist geraten. Jede steht so oder fast so im eigenen
-- `character`- oder `background`-Text des Agenten:
--
--   Fenn         "Perfektionierung des Regierungssystems", "rationale Ordnung",
--                Unvorhersehbarkeit "durch algorithmische" Verfahren ersetzt.
--                Nicht-binär — die deutsche Fassung nimmt deshalb eine
--                Rollenbezeichnung statt eines geschlechtsgebundenen Substantivs.
--   Voss         "Akademie für Ressourcenlogistik", "algorithmisches
--                Rationierungsmodell", "als junge Analystin".
--   Wolf         "General" im Namen; Militär, Aufstieg, Zwangsrekrutierung.
--   Mueller      "dem Bureau für Unmögliche Geographie zugewiesen",
--                "katalogisiert interdimensionale Anomalien".
--   Kray         "Karrieristin im Propagandaministerium".
--   Steinfeld    "disziplinierte Medienschaffende"; Vater Tontechniker beim
--                Staatsrundfunk; sah "die Rohaufnahmen" eines Staatsempfangs.
--   Cornelius    "Pater", "füllt die Kathedrale des Lichts", "studierte Theologie".
--   Irma         "Schwester"; verteilt abends "warme Mahlzeiten an die Obdachlosen".
--   Harken       "die kalte Präzision eines Verwaltungsapparats"; Ordnung als
--                Naturgesetz, Vater mittlerer Archivbeamter.
--
-- Basisspalte englisch, `_de` deutsch — die Konvention der Lokalfelder
-- (`t(agent, 'primary_profession')` wählt `_de`, sobald die Oberfläche deutsch
-- steht, und fällt sonst auf die Basis zurück).
--
-- IDEMPOTENT UND ENG GEFASST: nur Velgarien, nur wo das Feld leer ist. Ein
-- Beruf, den jemand später von Hand korrigiert, wird von einem zweiten Lauf
-- nicht wieder überschrieben. Auf einer frischen CI-Datenbank gibt es Velgarien
-- nicht; dann trifft die Anweisung null Zeilen und ist folgenlos.

WITH beruf(name, en, de) AS (
  VALUES
    ('Doktor Fenn',        'Systems Architect, State Rationalisation', 'Leitung Ordnungsarchitektur'),
    ('Elena Voss',         'Resource Allocation Analyst',              'Analystin für Ressourcenlenkung'),
    ('General Aldric Wolf','General, Armed Forces',                    'General der Streitkräfte'),
    ('Inspektor Mueller',  'Inspector, Bureau of Impossible Geography','Inspektor im Bureau für Unmögliche Geographie'),
    ('Lena Kray',          'Propaganda Ministry Official',             'Funktionärin im Propagandaministerium'),
    ('Mira Steinfeld',     'State Broadcast Picture Editor',           'Bildredakteurin beim Staatsrundfunk'),
    ('Pater Cornelius',    'Priest, Cathedral of Light',               'Pater an der Kathedrale des Lichts'),
    ('Schwester Irma',     'Lay Sister, Almsgiving',                   'Schwester in der Armenspeisung'),
    ('Viktor Harken',      'Administrative Overseer',                  'Verwaltungsaufseher')
)
UPDATE agents a
SET primary_profession    = COALESCE(a.primary_profession,    b.en),
    primary_profession_de = COALESCE(a.primary_profession_de,  b.de),
    updated_at            = now()
FROM beruf b, simulations s
WHERE s.id = a.simulation_id
  AND s.slug = 'velgarien'
  AND a.deleted_at IS NULL
  AND a.name = b.name
  AND (a.primary_profession IS NULL OR a.primary_profession_de IS NULL);
