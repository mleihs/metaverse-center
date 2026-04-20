/**
 * CodeMirror 6 JSON editor — thin Lit-friendly host for the hybrid draft
 * editor. Wraps:
 *
 *   - `basicSetup` (line numbers, bracket matching, undo, search, lint UI,
 *     autocompletion UI, fold gutter)
 *   - `jsonSchema(schema)` from codemirror-json-schema (bundles JSON
 *     language + schema-driven lint + completion + hover)
 *   - A brutalist theme built against design tokens (no raw colors)
 *   - Optional readonly mode
 *   - An `onChange` hook that fires on every user edit
 *
 * Usage (inside a Lit component's firstUpdated / updated):
 *
 *   const host = this.shadowRoot!.querySelector('.editor__host') as HTMLElement;
 *   const editor = mountJsonEditor(host, {
 *     initialDoc: '{"id": "sb_01"}',
 *     schema: getSchemaForResource('banter'),
 *     onChange: doc => this._current = doc,
 *     readonly: this._readOnly,
 *     rootNode: this.shadowRoot!,
 *   });
 *
 *   // Later: editor.setDoc(newJsonString) on entry switch.
 *   // On disconnectedCallback: editor.destroy()
 */

import { lintGutter } from '@codemirror/lint';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { jsonSchema } from 'codemirror-json-schema';
import type { JSONSchema7 } from 'json-schema';

export interface MountJsonEditorOptions {
  /** Initial document text. Defaults to empty string. */
  initialDoc?: string;
  /** JSON Schema 7 to drive lint / completion / hover. Omit for schemaless. */
  schema?: JSONSchema7;
  /** Fires after every user edit with the full serialized doc. */
  onChange?: (doc: string) => void;
  /** When true, editor is non-editable and styled dim. Default false. */
  readonly?: boolean;
  /**
   * Shadow root that owns the mount container. Needed for correct focus
   * tracking + tooltip positioning when CodeMirror is placed inside a
   * component's shadow DOM.
   */
  rootNode?: ShadowRoot;
}

export interface JsonEditorHandle {
  /** The raw CodeMirror view — exposed for advanced callers. */
  view: EditorView;
  /** Replace the entire doc contents (used when switching entries). */
  setDoc(value: string): void;
  /** Current doc as a string. */
  getDoc(): string;
  /** Flip readonly after mount without rebuilding. */
  setReadonly(readonly: boolean): void;
  /** Dispose the view and detach from DOM. Idempotent. */
  destroy(): void;
}

/**
 * Brutalist theme. All colors resolve via CSS custom properties, so the
 * editor re-themes automatically when the user switches between the 10
 * design presets. No raw hex escapes lint-color-tokens.sh.
 */
const brutalistTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--color-text-primary)',
      backgroundColor: 'var(--color-surface-sunken)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 'var(--text-sm)',
      border: '1px solid var(--color-border)',
      height: '100%',
    },
    '&.cm-focused': {
      outline: 'none',
      borderColor: 'var(--_accent, var(--color-primary))',
      boxShadow:
        '0 0 0 2px var(--_accent-dim, color-mix(in srgb, var(--color-primary) 40%, transparent))',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, monospace)',
      lineHeight: '1.55',
    },
    '.cm-content': {
      caretColor: 'var(--_accent, var(--color-primary))',
      padding: 'var(--space-2) 0',
    },
    '.cm-line': { padding: '0 var(--space-3)' },
    '.cm-gutters': {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text-muted)',
      borderRight: '1px solid var(--color-border-light)',
      fontFamily: 'var(--font-mono, monospace)',
    },
    '.cm-activeLineGutter, .cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--_accent, var(--color-primary)) 6%, transparent)',
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor:
        'color-mix(in srgb, var(--_accent, var(--color-primary)) 25%, transparent) !important',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--_accent, var(--color-primary))',
    },
    '.cm-matchingBracket': {
      outline:
        '1px solid color-mix(in srgb, var(--_accent, var(--color-primary)) 60%, transparent)',
      backgroundColor: 'transparent',
    },
    /* Lint markers in the gutter. */
    '.cm-lint-marker-error': { color: 'var(--color-danger)' },
    '.cm-lint-marker-warning': { color: 'var(--color-warning)' },
    /* Inline squiggle underline — CM6 uses background-image gradients. */
    '.cm-diagnostic-error': {
      borderLeft: '3px solid var(--color-danger)',
      backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
    },
    '.cm-diagnostic-warning': {
      borderLeft: '3px solid var(--color-warning)',
      backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--color-surface-raised)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text-primary)',
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 'var(--text-xs)',
      maxWidth: '420px',
    },
    '.cm-tooltip .cm-completionLabel': {
      color: 'var(--color-text-primary)',
    },
    '.cm-tooltip .cm-completionDetail': {
      color: 'var(--color-text-muted)',
      fontStyle: 'italic',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'color-mix(in srgb, var(--_accent, var(--color-primary)) 25%, transparent)',
      color: 'var(--color-text-primary)',
    },
    /* Read-only mode visuals. */
    '&.cm-readonly': {
      backgroundColor: 'color-mix(in srgb, var(--color-surface-sunken) 70%, transparent)',
      color: 'var(--color-text-secondary)',
    },
    '&.cm-readonly .cm-content': { caretColor: 'transparent' },
  },
  { dark: true },
);

/** Syntax highlighting for JSON is already provided by `jsonSchema()`.
 * We still want JSON tokens to look distinct from prose; CodeMirror's
 * default highlight style fills that in. No extra work needed. */

export function mountJsonEditor(
  container: HTMLElement,
  options: MountJsonEditorOptions = {},
): JsonEditorHandle {
  const { initialDoc = '', schema, onChange, readonly = false, rootNode } = options;

  // Readonly lives in a compartment so we can toggle without rebuilding.
  const readonlyCompartment = new Compartment();

  const extensions: Extension[] = [
    basicSetup,
    brutalistTheme,
    lintGutter(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    }),
    readonlyCompartment.of(readonlyExtensions(readonly)),
  ];
  if (schema) {
    // jsonSchema() bundles lang-json + schema-driven lint + completion +
    // hover — a single call covers every schema-aware feature.
    extensions.push(jsonSchema(schema));
  }

  const state = EditorState.create({ doc: initialDoc, extensions });
  const view = new EditorView({
    state,
    parent: container,
    root: rootNode,
  });

  return {
    view,
    getDoc: () => view.state.doc.toString(),
    setDoc: (value) => {
      if (view.state.doc.toString() === value) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    },
    setReadonly: (next) => {
      view.dispatch({
        effects: readonlyCompartment.reconfigure(readonlyExtensions(next)),
      });
      const dom = view.dom;
      if (next) dom.classList.add('cm-readonly');
      else dom.classList.remove('cm-readonly');
    },
    destroy: () => view.destroy(),
  };
}

function readonlyExtensions(readonly: boolean): Extension {
  if (!readonly) return [];
  return [EditorState.readOnly.of(true), EditorView.editable.of(false)];
}
