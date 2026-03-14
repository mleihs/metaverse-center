#!/usr/bin/env node

/**
 * Generate docs/INDEX.md and docs/llms.txt from YAML frontmatter.
 *
 * Usage: node scripts/generate-docs-index.mjs
 * Requires: npm install gray-matter (or run via npx)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '..', 'docs');

// Simple YAML frontmatter parser (avoids gray-matter dependency)
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const meta = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) {
      let value = m[2].trim();
      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim());
      }
      meta[m[1]] = value;
    }
  }
  return meta;
}

// Recursively find all .md files
function findMarkdownFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && entry !== 'screenshots') {
      files.push(...findMarkdownFiles(full, base));
    } else if (entry.endsWith('.md') && entry !== 'INDEX.md') {
      files.push(relative(base, full));
    }
  }
  return files.sort();
}

// Group docs by type
const TYPE_ORDER = ['spec', 'reference', 'guide', 'explanation', 'analysis', 'audit', 'other'];
const TYPE_LABELS = {
  spec: 'Specifications',
  reference: 'References',
  guide: 'Guides',
  explanation: 'Explanations',
  analysis: 'Analysis',
  audit: 'Audits',
  other: 'Other',
};

function generateIndex(docs) {
  const lines = [
    '---',
    'title: "Documentation Index"',
    'id: doc-index',
    'lang: en',
    'type: reference',
    'status: active',
    'tags: [index, catalog, documentation]',
    '---',
    '',
    '# Documentation Index',
    '',
  ];

  const grouped = {};
  const adrs = [];
  const archived = [];

  for (const doc of docs) {
    if (doc.path.startsWith('adr/')) {
      if (doc.path !== 'adr/README.md') adrs.push(doc);
      continue;
    }
    if (doc.meta.status === 'legacy' || doc.path.startsWith('archive/')) {
      archived.push(doc);
      continue;
    }
    const type = doc.meta.type || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(doc);
  }

  const totalDocs = docs.filter(d => !d.path.startsWith('adr/') && d.path !== 'llms.txt').length;
  lines.push(`> Auto-generated from frontmatter. ${totalDocs} documents, ${Object.keys(grouped).length} categories + ${adrs.length} ADRs.`);
  lines.push('');

  for (const type of TYPE_ORDER) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    lines.push(`## ${TYPE_LABELS[type]} (${items.length})`);
    lines.push('');
    lines.push('| Document | Version | Date | Lang | Status |');
    lines.push('|----------|---------|------|------|--------|');
    for (const doc of items) {
      const m = doc.meta;
      lines.push(`| [${m.title || doc.path}](${doc.path}) | ${m.version || '—'} | ${m.date || '—'} | ${m.lang || '—'} | ${m.status || '—'} |`);
    }
    lines.push('');
  }

  if (adrs.length > 0) {
    lines.push(`## Architecture Decision Records (${adrs.length})`);
    lines.push('');
    lines.push('| ADR | Decision |');
    lines.push('|-----|----------|');
    for (const doc of adrs) {
      lines.push(`| [${doc.meta.title || doc.path}](${doc.path}) | ${doc.meta.title?.replace(/^ADR-\d+:\s*/, '') || '—'} |`);
    }
    lines.push('');
  }

  if (archived.length > 0) {
    lines.push(`## Archive (${archived.length})`);
    lines.push('');
    lines.push('| Document | Version | Lang | Status |');
    lines.push('|----------|---------|------|--------|');
    for (const doc of archived) {
      const m = doc.meta;
      lines.push(`| [${m.title || doc.path}](${doc.path}) | ${m.version || '—'} | ${m.lang || '—'} | ${m.status || '—'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateLlmsTxt(docs) {
  const lines = [
    '# metaverse.center',
    '',
    '> Multiplayer worldbuilding platform with AI-driven simulations and competitive PvP epochs.',
    '> 60+ database tables, ~65 PostgreSQL functions, 310+ API endpoints, 150+ web components.',
    '> Stack: FastAPI + Lit 3 + Supabase + OpenRouter. Bilingual EN/DE.',
    '',
  ];

  const grouped = {};
  for (const doc of docs) {
    if (doc.path.startsWith('adr/') && doc.path !== 'adr/README.md') {
      if (!grouped.adr) grouped.adr = [];
      grouped.adr.push(doc);
      continue;
    }
    if (doc.path === 'llms.txt' || doc.path === 'adr/README.md') continue;
    const type = doc.meta.type || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(doc);
  }

  const sections = [
    ['spec', 'Specifications'],
    ['reference', 'References'],
    ['guide', 'Guides'],
    ['explanation', 'Explanations'],
    ['analysis', 'Analysis'],
    ['audit', 'Audits'],
    ['other', 'Other'],
    ['adr', 'Architecture Decision Records'],
  ];

  for (const [type, label] of sections) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;
    lines.push(`## ${label}`);
    for (const doc of items) {
      const title = doc.meta.title || doc.path;
      lines.push(`- [${title}](${doc.path})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Main
const files = findMarkdownFiles(DOCS_DIR);
const docs = [];

for (const file of files) {
  if (file === 'llms.txt') continue;
  const content = readFileSync(join(DOCS_DIR, file), 'utf-8');
  const meta = parseFrontmatter(content);
  if (meta) {
    docs.push({ path: file, meta });
  }
}

console.log(`Found ${docs.length} documents with frontmatter.`);

const indexContent = generateIndex(docs);
writeFileSync(join(DOCS_DIR, 'INDEX.md'), indexContent);
console.log('Generated docs/INDEX.md');

const llmsContent = generateLlmsTxt(docs);
writeFileSync(join(DOCS_DIR, 'llms.txt'), llmsContent);
console.log('Generated docs/llms.txt');
