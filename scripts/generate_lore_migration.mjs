#!/usr/bin/env node
/**
 * One-time script: Generate SQL migration for hardcoded lore content.
 * Reads the TS lore files + XLIFF translations, outputs INSERT statements.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const frontendSrc = join(root, 'frontend', 'src');

// Simulation IDs (deterministic, safe to hardcode per CLAUDE.md)
const SIMULATIONS = [
  { id: '10000000-0000-0000-0000-000000000001', slug: 'velgarien', file: 'velgarien-lore.ts' },
  { id: '20000000-0000-0000-0000-000000000001', slug: 'the-gaslit-reach', file: 'gaslit-reach-lore.ts' },
  { id: '30000000-0000-0000-0000-000000000001', slug: 'station-null', file: 'station-null-lore.ts' },
  { id: '40000000-0000-0000-0000-000000000001', slug: 'speranza', file: 'speranza-lore.ts' },
  { id: '50000000-0000-0000-0000-000000000001', slug: 'cite-des-dames', file: 'cite-des-dames-lore.ts' },
  { id: '60000000-0000-0000-0000-000000000001', slug: 'spengbabs-grease-pit', file: 'spengbab-lore.ts' },
];

// Load XLIFF translations into a map: normalized_english -> german
function loadXliffTranslations() {
  const xliffPath = join(frontendSrc, 'locales', 'xliff', 'de.xlf');
  const content = readFileSync(xliffPath, 'utf-8');
  const map = new Map();

  // Parse source/target pairs
  const tuRegex = /<trans-unit[^>]*>\s*<source>([\s\S]*?)<\/source>\s*<target>([\s\S]*?)<\/target>/g;
  let match;
  while ((match = tuRegex.exec(content)) !== null) {
    let source = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#10;/g, '\n');
    let target = match[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#10;/g, '\n');
    const key = normalizeForLookup(source);
    map.set(key, target);
  }

  return map;
}

function normalizeForLookup(str) {
  // Normalize whitespace for reliable matching
  return str.replace(/\s+/g, ' ').trim();
}

// Parse a lore TS file and extract sections
function parseLoreFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const sections = [];

  // Match each section object { id: '...', ... }
  const sectionRegex = /\{\s*id:\s*'([^']+)'/g;
  let sMatch;
  while ((sMatch = sectionRegex.exec(content)) !== null) {
    const id = sMatch[1];
    const startPos = sMatch.index;

    // Find the end of this section object (matching closing brace)
    let braceCount = 0;
    let endPos = startPos;
    for (let i = startPos; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endPos = i + 1;
          break;
        }
      }
    }

    const sectionStr = content.substring(startPos, endPos);
    const section = { id };

    // Extract fields wrapped in msg() calls
    const extractMsg = (fieldName) => {
      // Try msg(`...`) with backticks (multiline content)
      const btRegex = new RegExp(fieldName + ":\\s*msg\\(`([\\s\\S]*?)`\\)", 's');
      let m = btRegex.exec(sectionStr);
      if (m) return m[1];

      // Try msg('...') with single quotes (handles escaped quotes)
      const sqRegex = new RegExp(fieldName + ":\\s*msg\\(\n?\\s*'([\\s\\S]*?)'(?:,\n)?\\s*\\)");
      m = sqRegex.exec(sectionStr);
      if (m) return m[1].replace(/\\'/g, "'");

      // Try multi-line msg('...\n  ...\n')
      const mlRegex = new RegExp(fieldName + ":\\s*msg\\(\n?\\s*'([\\s\\S]*?)',?\n?\\s*\\)");
      m = mlRegex.exec(sectionStr);
      if (m) return m[1].replace(/\\'/g, "'");

      return null;
    };

    // Extract simple string field (not wrapped in msg)
    const extractSimple = (fieldName) => {
      const regex = new RegExp(fieldName + ":\\s*'([^']*)'");
      const m = regex.exec(sectionStr);
      return m ? m[1] : null;
    };

    section.chapter = extractMsg('chapter') || '';
    section.arcanum = extractSimple('arcanum') || '';
    section.title = extractMsg('title') || '';
    section.epigraph = extractMsg('epigraph') || '';
    section.body = extractMsg('body') || '';
    section.imageSlug = extractSimple('imageSlug') || null;
    section.imageCaption = extractMsg('imageCaption') || null;

    sections.push(section);
  }

  return sections;
}

// Lookup German translation
function getDeTranslation(enText, xliffMap) {
  if (!enText) return null;
  const key = normalizeForLookup(enText);
  return xliffMap.get(key) || null;
}

function escSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "E'" + str.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n') + "'";
}

// Main
const xliffMap = loadXliffTranslations();
console.log(`Loaded ${xliffMap.size} XLIFF translation pairs`);

const allInserts = [];
let totalMatched = 0;
let totalMissed = 0;

for (const sim of SIMULATIONS) {
  const filePath = join(frontendSrc, 'components', 'lore', 'content', sim.file);
  console.log(`\nParsing ${sim.file}...`);
  const sections = parseLoreFile(filePath);
  console.log(`  Found ${sections.length} sections`);

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];

    // Lookup German translations
    const titleDe = getDeTranslation(s.title, xliffMap);
    const epigraphDe = getDeTranslation(s.epigraph, xliffMap);
    const bodyDe = getDeTranslation(s.body, xliffMap);
    const imageCaptionDe = s.imageCaption ? getDeTranslation(s.imageCaption, xliffMap) : null;

    const matched = [titleDe, bodyDe].filter(Boolean).length;
    totalMatched += matched;
    if (!titleDe) {
      console.log(`  MISS title: "${s.title.substring(0, 60)}..."`);
      totalMissed++;
    }
    if (!bodyDe) {
      console.log(`  MISS body for: "${s.id}"`);
      totalMissed++;
    }

    const insert = `INSERT INTO simulation_lore (simulation_id, sort_order, chapter, arcanum, title, epigraph, body, image_slug, image_caption, title_de, epigraph_de, body_de, image_caption_de)
VALUES (
  '${sim.id}',
  ${i},
  ${escSQL(s.chapter)},
  ${escSQL(s.arcanum)},
  ${escSQL(s.title)},
  ${escSQL(s.epigraph)},
  ${escSQL(s.body)},
  ${escSQL(s.imageSlug)},
  ${escSQL(s.imageCaption)},
  ${escSQL(titleDe)},
  ${escSQL(epigraphDe)},
  ${escSQL(bodyDe)},
  ${escSQL(imageCaptionDe)}
);`;
    allInserts.push(insert);
  }
}

console.log(`\nTranslation stats: ${totalMatched} matched, ${totalMissed} missed`);

// Epoch clone population
const epochCloneSQL = `
-- Also populate lore for epoch clones (game instances)
INSERT INTO simulation_lore (simulation_id, sort_order, chapter, arcanum, title, epigraph, body, image_slug, image_caption, title_de, epigraph_de, body_de, image_caption_de)
SELECT gi.id, sl.sort_order, sl.chapter, sl.arcanum, sl.title, sl.epigraph, sl.body, sl.image_slug, sl.image_caption, sl.title_de, sl.epigraph_de, sl.body_de, sl.image_caption_de
FROM simulation_lore sl
JOIN simulations t ON t.id = sl.simulation_id AND t.simulation_type = 'template'
JOIN simulations gi ON gi.source_template_id = t.id AND gi.simulation_type = 'game_instance'
WHERE NOT EXISTS (
  SELECT 1 FROM simulation_lore existing
  WHERE existing.simulation_id = gi.id
);`;

const migration = `-- Migration: Migrate hardcoded lore content to simulation_lore table
-- This is a one-time data migration for the 6 canonical simulations.
-- English content extracted from frontend/src/components/lore/content/*.ts
-- German translations extracted from frontend/src/locales/xliff/de.xlf

BEGIN;

-- Clear any existing lore for these simulations (idempotent)
DELETE FROM simulation_lore WHERE simulation_id IN (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001'
);

${allInserts.join('\n\n')}

${epochCloneSQL}

COMMIT;
`;

const outPath = join(root, 'supabase', 'migrations', '20260306400000_062_migrate_hardcoded_lore.sql');
writeFileSync(outPath, migration, 'utf-8');
console.log(`\nMigration written to: ${outPath}`);
console.log(`Total sections: ${allInserts.length}`);
