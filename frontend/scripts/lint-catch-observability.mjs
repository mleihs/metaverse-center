#!/usr/bin/env node
/**
 * lint-catch-observability.mjs — Rule 3 of the error-observability contract.
 *
 * Rules 1+2 (lint-no-empty-catch.sh) reject catch blocks WITHOUT a binding.
 * The 2026-07-12 deep audit found ~50 sites that pass those rules by binding
 * `err` — and then never observing it: `catch (err) { console.error(err); }`
 * evades a binding-only check while still leaving Sentry blind.
 *
 * This checker parses every `catch (ident) { ... }` block and every
 * Promise-chain `.catch((ident) => ...)` handler body and requires at least
 * one of:
 *   - a `captureError(` call (the SentryService contract), or
 *   - a `throw` (re-raising is observation-by-delegation), or
 *   - a `Sentry.captureException(` call (SentryService internals).
 *
 * Body extraction is balanced-brace/paren matching that is string- and
 * comment-aware — a `}` inside a template literal does not end the block.
 *
 * Allowlisted files:
 *   - services/SentryService.ts — IS the capture service.
 *
 * Usage: node scripts/lint-catch-observability.mjs   (from frontend/)
 * Exit: 0 = pass, 1 = violations.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(FRONTEND_ROOT, 'src');
const ALLOWLIST = new Set(['src/services/SentryService.ts']);
const OBSERVED = /\bcaptureError\s*\(|\bthrow\b|\bSentry\.captureException\s*\(/;

/** Recursively collect .ts files under dir. */
function tsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * Scan source, yielding [index, char] for code only — comments and string
 * literal CONTENTS are skipped so brace matching cannot be derailed.
 */
function* codeChars(src, start = 0) {
  let i = start;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      yield [i, c];
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) break;
        // template interpolation contents still count as code
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1;
          yield [i, src[i]]; i++;
          yield [i, src[i]]; i++;
          while (i < n && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            if (depth > 0) yield [i, src[i]];
            i++;
          }
          continue;
        }
        i++;
      }
      if (i < n) yield [i, src[i]];
      i++;
    } else {
      yield [i, c];
      i++;
    }
  }
}

/** Extract the balanced region starting at src[openIdx] (a '{' or '('). */
function balancedEnd(src, openIdx) {
  const open = src[openIdx];
  const close = open === '{' ? '}' : ')';
  let depth = 0;
  for (const [i, c] of codeChars(src, openIdx)) {
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

const violations = [];

for (const file of tsFiles(ROOT)) {
  const rel = relative(FRONTEND_ROOT, file).replaceAll('\\', '/');
  if (ALLOWLIST.has(rel)) continue;
  const src = readFileSync(file, 'utf8');

  // A) try/catch blocks WITH a binding: catch (err) { ... }
  const catchRe = /\bcatch\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{/g;
  for (let m; (m = catchRe.exec(src)); ) {
    const openIdx = m.index + m[0].length - 1;
    const end = balancedEnd(src, openIdx);
    if (end === -1) continue;
    const body = src.slice(openIdx + 1, end);
    if (!OBSERVED.test(body)) {
      violations.push(`${rel}:${lineOf(src, m.index)}: catch binds the error but never observes it`);
    }
  }

  // B) Promise-chain handlers: .catch((err) => body)
  const pcatchRe = /\.catch\s*\(\s*(?:async\s*)?\(\s*[A-Za-z_$][\w$]*(?:\s*:\s*[^)]+)?\s*\)\s*=>\s*/g;
  for (let m; (m = pcatchRe.exec(src)); ) {
    const bodyStart = m.index + m[0].length;
    let body;
    if (src[bodyStart] === '{') {
      const end = balancedEnd(src, bodyStart);
      if (end === -1) continue;
      body = src.slice(bodyStart + 1, end);
    } else {
      // expression body: ends at the paren that closes .catch(
      const openParen = src.indexOf('(', m.index);
      const end = balancedEnd(src, openParen);
      if (end === -1) continue;
      body = src.slice(bodyStart, end);
    }
    if (!OBSERVED.test(body)) {
      violations.push(`${rel}:${lineOf(src, m.index)}: .catch() binds the rejection but never observes it`);
    }
  }
}

if (violations.length > 0) {
  console.error('ERROR: catch blocks must observe the error (captureError | throw):\n');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} violation(s).`);
  console.error("Fix: captureError(err, { source: 'ClassName.methodName' }) — see CLAUDE.md > Error Observability.");
  process.exit(1);
}

console.log('PASS: every bound catch observes its error (captureError | throw).');
