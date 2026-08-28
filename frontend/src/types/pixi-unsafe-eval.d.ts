/**
 * Ambient declaration for Pixi's eval-free polyfill entry point.
 *
 * `pixi.js@8` ships `lib/unsafe-eval/init.d.ts` but its package `exports` map
 * declares only `import`/`require` for the `./unsafe-eval` subpath — no `types`
 * condition. Under `moduleResolution: bundler` TypeScript therefore refuses the
 * specifier (TS7016) even though the runtime module resolves fine.
 *
 * The module is imported purely for its side effect: on load it swaps Pixi's
 * `new Function()`-based shader/UBO/uniform sync generators for interpreted
 * polyfills, which is what lets the renderer boot under a CSP without
 * `unsafe-eval` (see DungeonCombatFx._initPixi). It exports nothing we call, so
 * an untyped module declaration is the whole contract — not a shortcut around
 * one. Remove this file once upstream adds the `types` condition.
 */
declare module 'pixi.js/unsafe-eval';
