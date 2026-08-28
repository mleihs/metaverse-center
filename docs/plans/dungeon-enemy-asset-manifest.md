# Gegner-Assets — Manifest und Nacharbeits-Liste

**42 von 42 Kreaturen erzeugt.** Die Rohdateien liegen im Projekt unter
`assets/dungeon-enemies/raw/<id>.jpeg` — **ungetrackt** (141 MB, siehe `.gitignore`).
Die freigestellten Assets liegen als `assets/dungeon-enemies/<id>.avif` und sind
**im Repo** (3,5 MB gesamt); das ist auch, was der Ingest nach Supabase Storage laedt.

Die Tabelle unten dokumentiert, aus welcher Gemini-Rohdatei jede Kreatur stammt. Die
Zuordnung wurde per MD5-Abgleich erzeugt, nicht aus dem Gedaechtnis — die
Gemini-Exporte heissen alle `Gemini_Generated_Image_<zufall>` und tragen ihre
Identitaet nicht selbst. Sie ist damit rekonstruierbar, falls ein Original noch
gebraucht wird.

Prompts: `dungeon-enemy-image-prompts.md` · Freisteller: `scripts/key_dungeon_enemy_art.py`
· Ingest: `scripts/ingest_dungeon_enemy_art.py`

**Angeschlossen seit 2026-08-28** (Rollout-Phase 3a, siehe
`graphical-dungeon-rollout.md`). Jeder Gegner trägt in seiner `enemies.yaml` ein
`image_path`; die Kette YAML → Validator → Seed-Migration → DTO → Szene steht.
Publiziert wird **nicht** der 1024-px-Master, sondern eine daraus abgeleitete
384-px-Rendition (`{id}-384.avif`, zusammen 893 KB statt 3543 KB): das
Gegner-Band zeichnet eine Kreatur höchstens 112 CSS-px hoch, bei DPR 3 also 336
Gerätepixel. Der Master bleibt im Repo als Archiv und als Quelle für jede
spätere Oberfläche, die mehr Auflösung braucht.

## Zuordnung

| Gegner-id | Rohdatei | Sätt. | Hell. |
|---|---|---:|---:|
| `awakening_consciousness_leech` | `Gemini_Generated_Image_flyh52flyh52flyh.jpeg` | 0.8× | 0.8× |
| `awakening_deja_vu_phantom` | `Gemini_Generated_Image_obi1o3obi1o3obi1.jpeg` | 0.8× | 0.6× |
| `awakening_echo_fragment` | `Gemini_Generated_Image_f0m61xf0m61xf0m6.jpeg` | 0.7× | 0.8× |
| `awakening_repressed_sentinel` | `Gemini_Generated_Image_skkcy2skkcy2skkc.jpeg` | 0.8× | 0.7× |
| `awakening_the_repressed` | `Gemini_Generated_Image_cp1wwacp1wwacp1w.jpeg` | 0.7× | 0.7× |
| `deluge_pressure_surge` | `Gemini_Generated_Image_afdcaiafdcaiafdc.jpeg` | 0.7× | 0.9× |
| `deluge_riptide_tendril` | `Gemini_Generated_Image_sds292sds292sds2.jpeg` | 1.3× | 0.7× |
| `deluge_silt_revenant` | `Gemini_Generated_Image_6kfitb6kfitb6kfi.jpeg` | 1.1× | 0.7× |
| `deluge_the_current` | `Gemini_Generated_Image_mf85o0mf85o0mf85.jpeg` | 0.9× | 0.8× |
| `deluge_undertow_warden` | `Gemini_Generated_Image_bztd93bztd93bztd.jpeg` | 0.9× | 0.7× |
| `entropy_dissolution_swarm` | `Gemini_Generated_Image_7wv50n7wv50n7wv5.jpeg` | 0.5× | 1.2× |
| `entropy_fade_echo` | `Gemini_Generated_Image_ep649yep649yep64.jpeg` | 0.6× | 1.5× |
| `entropy_rust_phantom` | `Gemini_Generated_Image_6bjnc26bjnc26bjn.jpeg` | 0.8× | 1.5× |
| `entropy_warden` | `Gemini_Generated_Image_p14u2kp14u2kp14u.jpeg` | 0.6× | 1.3× |
| `mother_host_warden` | `Gemini_Generated_Image_dgfguzdgfguzdgfg.jpeg` | 1.1× | 0.7× |
| `mother_living_altar` | `Gemini_Generated_Image_blxfo2blxfo2blxf.jpeg` | 1.3× | 0.9× |
| `mother_nutrient_weaver` | `Gemini_Generated_Image_zcx009zcx009zcx0.jpeg` | 1.2× | 1.0× |
| `mother_spore_matron` | `Gemini_Generated_Image_wyu3zmwyu3zmwyu3.jpeg` | 1.1× | 1.1× |
| `mother_tether_vine` | `Gemini_Generated_Image_pfnsegpfnsegpfns.jpeg` | 1.3× | 0.8× |
| `overthrow_faction_informer` | `Gemini_Generated_Image_tei8s6tei8s6tei8.jpeg` | 0.9× | 0.8× |
| `overthrow_grand_inquisitor` | `Gemini_Generated_Image_7kx9n07kx9n07kx9.jpeg` | 1.0× | 0.8× |
| `overthrow_propaganda_agent` | `Gemini_Generated_Image_syuiilsyuiilsyui.jpeg` | 1.0× | 0.8× |
| `overthrow_regime_enforcer` | `Gemini_Generated_Image_m56dt2m56dt2m56d.jpeg` | 0.8× | 0.8× |
| `overthrow_the_pretender` | `Gemini_Generated_Image_u0im3uu0im3uu0im.jpeg` | 0.9× | 0.8× |
| `prometheus_alloy_sentinel` | `Gemini_Generated_Image_g3j202g3j202g3j2 (1).jpeg` | 0.5× | 0.5× |
| `prometheus_automaton_shard` | `Gemini_Generated_Image_531y53531y53531y.jpeg` | 0.9× | 0.4× |
| `prometheus_crucible_drake` | `Gemini_Generated_Image_hwau7ehwau7ehwau.jpeg` | 1.1× | 0.6× |
| `prometheus_forge_wraith` | `Gemini_Generated_Image_uh9mo0uh9mo0uh9m.jpeg` | 0.8× | 0.6× |
| `prometheus_slag_golem` | `Gemini_Generated_Image_rysb1srysb1srysb.jpeg` | 0.6× | 0.5× |
| `prometheus_spark_wisp` | `Gemini_Generated_Image_44v4ur44v4ur44v4.jpeg` | 1.5× | 0.5× |
| `prometheus_the_prototype` | `Gemini_Generated_Image_71zhiq71zhiq71zh.jpeg` | 0.8× | 0.5× |
| `prometheus_workshop_guardian` | `Gemini_Generated_Image_hluvilhluvilhluv.jpeg` | 0.8× | 0.5× |
| `shadow_echo_violence` | `Gemini_Generated_Image_nv78rjnv78rjnv78.jpeg` | 1.2× | 0.9× |
| `shadow_paranoia_shade` | `Gemini_Generated_Image_aeolviaeolviaeol.jpeg` | 1.1× | 0.9× |
| `shadow_remnant` | `Gemini_Generated_Image_g8ivxg8ivxg8ivxg.jpeg` | 1.0× | 0.8× |
| `shadow_tendril` | `Gemini_Generated_Image_fxcgg7fxcgg7fxcg.jpeg` | 1.2× | 0.9× |
| `shadow_wisp` | `Gemini_Generated_Image_h9w1vyh9w1vyh9w1.jpeg` | 1.2× | 0.9× |
| `tower_crown_keeper` | `Gemini_Generated_Image_yb3kf5yb3kf5yb3k.jpeg` | 0.9× | 1.0× |
| `tower_debt_shade` | `Gemini_Generated_Image_ck42l6ck42l6ck42.jpeg` | 1.0× | 1.0× |
| `tower_foundation_worm` | `Gemini_Generated_Image_f9lyunf9lyunf9ly.jpeg` | 1.0× | 1.1× |
| `tower_remnant_commerce` | `Gemini_Generated_Image_5pd17f5pd17f5pd1.jpeg` | 0.9× | 1.0× |
| `tower_tremor_broker` | `Gemini_Generated_Image_2gf78a2gf78a2gf7.jpeg` | 0.6× | 1.4× |

Sättigung und Helligkeit als Vielfaches des Referenzmittels (Shadow+Tower: 28.1% / 31.4%).

## Nacharbeit — später, nicht blockierend

Alle 42 sind einsatzfähig. Die folgenden Punkte sind bekannte Abweichungen, die bewusst
stehen gelassen wurden.

### Kosmetisch, in Szenengröße unsichtbar
Bei ~76 px Breite im Gegner-Band ist davon nichts zu erkennen.

| id | Befund |
|---|---|
| `prometheus_crucible_drake` | gestempelte Pseudo-Schrift auf dem Tonkörper |
| `overthrow_propaganda_agent` | kleine Glyphen auf Schulter und Oberschenkel |
| `overthrow_regime_enforcer` | kleine Glyphen auf den Panzerplatten |
| `prometheus_automaton_shard` | Glyphen auf den Platten |

**Ursache:** Die „no text"-Regel verliert gegen Objektklassen, die Schrift mitbringen
(gebrannter Ton, Panzerplatten). Nur bei einer Neuerzeugung mit ausdrücklichem
„the surface is unmarked and unstamped" zu beheben.

### Messtechnische Ausreißer
Vor Einführung der jeweiligen Anker entstanden. Einzeln unauffällig, im Gruppenvergleich
etwas heller bzw. gesättigter als die übrigen.

| id | Befund | Grund |
|---|---|---|
| `prometheus_spark_wisp` | Sättigung 1,5× | Motiv besteht fast nur aus Glut; Helligkeit 0,5× und Glanz 0,06 % zeigen, dass nichts leuchtet — Kennzahl irreführend, **kein Handlungsbedarf** |
| `tower_tremor_broker` | Helligkeit 1,4× | vor dem Helligkeitsanker erzeugt |
| `entropy_warden` | Helligkeit 1,3× | vor dem Helligkeitsanker erzeugt |
| `tower_foundation_worm` | Helligkeit 1,1× | Grenzwert, unkritisch |

**Wenn nachgezogen wird:** die betroffenen Prompts stehen im Promptblatt bereits mit
Helligkeitsanker im jeweiligen Stilblock — einfach unverändert erneut laufen lassen,
ohne Referenzbild.

### Nicht nacharbeiten
`awakening_consciousness_leech` hat mit 11,1 % die weichste Kante aller finalen Assets
(Rest-Magenta 0,037). Das liegt unter der Warnschwelle 0,12 und ist auf dem Szenengrund
unsichtbar.

## Neu erzeugte Bilder einsortieren

```bash
cp <neue-datei>.jpeg assets/dungeon-enemies/raw/<gegner-id>.jpeg
.venv/bin/python scripts/key_dungeon_enemy_art.py assets/dungeon-enemies/raw assets/dungeon-enemies
```
Zur Sichtkontrolle vorher `--check` anhaengen — das schreibt PNG-Proofs auf den
Szenengrund `#0a0a0a` statt AVIFs.

## Ins Spiel bringen

Ein ersetztes Bild braucht nur den Upload — der Pfad in der YAML aendert sich
nicht:

```bash
.venv/bin/python scripts/ingest_dungeon_enemy_art.py --dry-run   # Groessen pruefen
.venv/bin/python scripts/ingest_dungeon_enemy_art.py             # lokal
.venv/bin/python scripts/ingest_dungeon_enemy_art.py --production
```

Das Skript liest jedes Ziel aus dem Content-Pack, nie aus dem Verzeichnis, und
liest nach dem Upload jedes Objekt zurueck. Ein **neuer** Gegner braucht
zusaetzlich die Zeile `image_path: dungeon-enemies/<id>-384.avif` in seiner
`enemies.yaml` und danach:

```bash
.venv/bin/python scripts/validate_content_packs.py --strict
.venv/bin/python -m backend.services.content_packs.generate_migration \
    --output supabase/migrations/{stamp}_{N}_dungeon_content_from_packs.sql
```

⚠ Niemals direkt in die DB schreiben — die Seed-Migration ist TRUNCATE +
re-insert (A1.5).
