/**
 * A stray backtick inside a css`…` template silently ends it.
 *
 * Lit component styles are tagged template literals. A backtick anywhere inside
 * one — INCLUDING inside a CSS comment — terminates the template, and every
 * line after it is parsed as JavaScript. The most natural way to name a CSS
 * property in a comment is exactly the thing that breaks the file:
 *
 *     .a { color: red }
 *     -- `transform` in a keyframe does not compose --   <- ends the template
 *
 * The failure is silent and total. `biome check --write` does not error on it;
 * it reformats the entire styles block into JavaScript expressions
 * ("font - family;", "line - height;") and reports success, corrupting hundreds
 * of lines in a single pass. Two sessions hit this on one afternoon, one of
 * them twice, and both first misdiagnosed it as a stray non-ASCII character —
 * Vite's parse error points at the line AFTER the comment, so the trail is
 * cold. Hence a gate rather than care.
 *
 * Only backticks are rejected. `${...}` interpolation is legal and used in
 * several components, so it is left alone.
 *
 * Invoked by lint-no-backtick-in-css.sh (which anchors the working directory).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every .ts file under a directory, recursively. */
function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) collect(path, out);
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

/**
 * Stray backticks inside css`…` regions of one source file.
 *
 * Walks the text once. On `css\``, scans forward tracking block and line
 * comments; a backtick found INSIDE a comment is a violation, a backtick found
 * outside one closes the template. Reporting the comment case specifically is
 * what makes the message actionable: an author who wrote it meant a quotation
 * mark, not a delimiter.
 */
function findViolations(text) {
  const violations = [];
  const lineOf = (index) => text.slice(0, index).split('\n').length;

  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('css`', i);
    if (start === -1) break;

    let j = start + 4;
    let inBlockComment = false;
    let inLineComment = false;

    while (j < text.length) {
      const two = text.slice(j, j + 2);
      if (!inBlockComment && !inLineComment && two === '/*') {
        inBlockComment = true;
        j += 2;
        continue;
      }
      if (inBlockComment && two === '*/') {
        inBlockComment = false;
        j += 2;
        continue;
      }
      if (!inBlockComment && !inLineComment && two === '//') {
        inLineComment = true;
        j += 2;
        continue;
      }
      if (inLineComment && text[j] === '\n') {
        inLineComment = false;
        j += 1;
        continue;
      }
      if (text[j] === '`') {
        if (inBlockComment || inLineComment) {
          violations.push({
            line: lineOf(j),
            text: text.split('\n')[lineOf(j) - 1].trim(),
          });
          // Keep scanning: one comment often carries several.
          j += 1;
          continue;
        }
        break; // The template's real closing delimiter.
      }
      j += 1;
    }
    i = j + 1;
  }
  return violations;
}

const files = collect('src');
const found = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('css`')) continue;
  for (const v of findViolations(text)) found.push({ file, ...v });
}

// One comment often carries several backticks; the line is the useful unit.
const unique = [...new Map(found.map((v) => [`${v.file}:${v.line}`, v])).values()];

if (unique.length > 0) {
  console.error('ERROR: stray backtick inside a css template literal.');
  console.error('A backtick ENDS the template; everything after it parses as JavaScript.');
  console.error('');
  for (const v of unique) console.error(`  ${v.file}:${v.line}: ${v.text}`);
  console.error('');
  console.error('Fix: drop the backticks. Name the property in plain words or in');
  console.error('double quotes - "transform in a keyframe", "mix-blend-mode: overlay".');
  console.error('');
  console.error('Beware: `biome check --write` does NOT error on this. It silently');
  console.error("reformats the whole styles block into JavaScript ('font - family;').");
  process.exit(1);
}

console.log(`PASS: no stray backticks inside css template literals (${files.length} files).`);
