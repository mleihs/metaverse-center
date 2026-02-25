#!/usr/bin/env python3
"""Clean pg_dump output for Supabase production import.

Handles 5 known incompatibilities between pg_dump output and hosted Supabase:
1. Removes \\restrict / \\unrestrict psql meta-commands
2. Removes SET configuration statements
3. Strips pg_dump comments (-- ) but preserves data starting with ---
4. Replaces DISABLE TRIGGER ALL → DISABLE TRIGGER USER
5. Collapses multi-line INSERT strings to single-line with E-string syntax

Usage:
    python3.13 scripts/export_for_production.py input.sql output.sql

The input should be generated with:
    docker exec supabase_db_velgarien-rebuild pg_dump -U postgres \\
      --data-only --schema=public --no-owner --no-privileges \\
      --inserts --rows-per-insert=1 \\
      --exclude-table=supabase_migrations.schema_migrations \\
      postgres > input.sql
"""

import re
import sys
from pathlib import Path


def clean_for_production(input_path: str, output_path: str) -> dict[str, int]:
    """Transform pg_dump SQL for hosted Supabase compatibility.

    Returns a dict of transformation counts for reporting.
    """
    input_text = Path(input_path).read_text(encoding="utf-8")
    lines = input_text.splitlines()

    stats = {
        "meta_commands_removed": 0,
        "set_statements_removed": 0,
        "comments_removed": 0,
        "trigger_statements_fixed": 0,
        "multiline_inserts_collapsed": 0,
        "total_lines_in": len(lines),
    }

    # Pass 1: Line-level transformations
    cleaned_lines: list[str] = []
    for line in lines:
        # 1. Remove psql meta-commands
        if line.startswith("\\restrict") or line.startswith("\\unrestrict"):
            stats["meta_commands_removed"] += 1
            continue

        # 2. Remove SET configuration statements
        if re.match(r"^SET\s+", line):
            stats["set_statements_removed"] += 1
            continue

        # 3. Strip pg_dump comments, but preserve data lines starting with ---
        # pg_dump comments are "-- " (dash-dash-space) or bare "--" (empty comment)
        # Data lines like '--- END EVENTS ---' inside strings start with ---
        if line == "--" or re.match(r"^-- [A-Z]", line):
            stats["comments_removed"] += 1
            continue

        # Also strip pg_dump section headers like "-- Data for Name: agents; ..."
        if re.match(r"^-- (Data for|Name:|Type:|Schema:|Owner:)", line):
            stats["comments_removed"] += 1
            continue

        # 4. Replace DISABLE/ENABLE TRIGGER ALL → USER
        if "DISABLE TRIGGER ALL" in line:
            line = line.replace("DISABLE TRIGGER ALL", "DISABLE TRIGGER USER")
            stats["trigger_statements_fixed"] += 1
        elif "ENABLE TRIGGER ALL" in line:
            line = line.replace("ENABLE TRIGGER ALL", "ENABLE TRIGGER USER")
            stats["trigger_statements_fixed"] += 1

        cleaned_lines.append(line)

    # Pass 2: Collapse multi-line INSERT strings
    # pg_dump with --inserts can produce multi-line string values when the data
    # contains newlines (e.g., prompt templates). These break the Supabase CLI
    # statement parser. We collapse them into single-line E-strings.
    output_lines: list[str] = []
    i = 0
    while i < len(cleaned_lines):
        line = cleaned_lines[i]

        if line.startswith("INSERT INTO") and not line.rstrip().endswith(";"):
            # This INSERT spans multiple lines — collect all lines until ;
            parts = [line]
            i += 1
            while i < len(cleaned_lines):
                parts.append(cleaned_lines[i])
                if cleaned_lines[i].rstrip().endswith(";"):
                    i += 1
                    break
                i += 1

            # Join into single line, replacing real newlines within string
            # literals with \n escape sequences
            collapsed = _collapse_multiline_insert(parts)
            output_lines.append(collapsed)
            stats["multiline_inserts_collapsed"] += 1
        else:
            output_lines.append(line)
            i += 1

    stats["total_lines_out"] = len(output_lines)

    # Write output
    output_text = "\n".join(output_lines) + "\n"
    Path(output_path).write_text(output_text, encoding="utf-8")

    return stats


def _collapse_multiline_insert(parts: list[str]) -> str:
    """Collapse a multi-line INSERT statement into a single line.

    Replaces embedded newlines within string literals with \\n escape
    sequences and converts affected strings to PostgreSQL E-string syntax.
    """
    # Join all parts with newline (preserving the original line breaks)
    full = "\n".join(parts)

    # Strategy: walk through the statement character by character,
    # tracking whether we're inside a string literal. When we encounter
    # a newline inside a string literal, replace it with \n.
    result: list[str] = []
    in_string = False
    has_embedded_newlines = False
    string_start_idx = -1
    i = 0

    while i < len(full):
        char = full[i]

        if char == "'" and not in_string:
            in_string = True
            string_start_idx = len(result)
            result.append(char)
        elif char == "'" and in_string:
            # Check for escaped quote ('')
            if i + 1 < len(full) and full[i + 1] == "'":
                result.append("''")
                i += 2
                continue
            else:
                in_string = False
                # If this string had embedded newlines, convert to E-string
                if has_embedded_newlines:
                    result[string_start_idx] = "E'"
                    has_embedded_newlines = False
                result.append(char)
        elif char == "\n" and in_string:
            result.append("\\n")
            has_embedded_newlines = True
        elif char == "\n" and not in_string:
            # Newline outside string — just skip (collapse to single line)
            pass
        else:
            result.append(char)

        i += 1

    return "".join(result)


def main() -> None:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.sql> <output.sql>")
        print()
        print("Clean pg_dump output for Supabase production import.")
        print("See 19_DEPLOYMENT_INFRASTRUCTURE.md for full documentation.")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not Path(input_path).exists():
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    stats = clean_for_production(input_path, output_path)

    print(f"Cleaned {stats['total_lines_in']} lines → {stats['total_lines_out']} lines")
    print(f"  Meta-commands removed:      {stats['meta_commands_removed']}")
    print(f"  SET statements removed:     {stats['set_statements_removed']}")
    print(f"  Comments removed:           {stats['comments_removed']}")
    print(f"  Trigger statements fixed:   {stats['trigger_statements_fixed']}")
    print(f"  Multi-line INSERTs collapsed: {stats['multiline_inserts_collapsed']}")
    print(f"\nOutput written to: {output_path}")


if __name__ == "__main__":
    main()
