# CodeMirror stays inside the editor module

Quiro's editor is built on CodeMirror 6, but only `src/editor/` may import `@codemirror/*` or `@lezer/*`. A Biome `noRestrictedImports` rule fails the gate if any other file does. The rest of the app, and later the plugin host, reach the editor only through `src/editor/index.ts`, which speaks in Quiro's terms: document text, offsets, edits, versions and events. Live preview, settings and parse-based features such as the outline are built inside the module, or exposed as small queries such as `headings()`. The CodeMirror view, its state, its extensions and the Lezer tree never cross the interface. We chose this over exposing the view so later phases could reach in directly: that would have been faster at first, but it would spread CodeMirror knowledge across every phase. Examples are undo isolation, clearing history by replacing the state, the front-matter wrapper around the Markdown tree, and position mapping. It would also make the editor impossible to change without touching every caller.

## Consequences

- A feature that needs CodeMirror internals is written inside `src/editor/`, even when it belongs to a later phase (for example Phase 3's decorations).
- Callers that need parse information get a purpose-built query, added by the goal that needs it, never raw tree access.
- Replacing or upgrading CodeMirror only touches `src/editor/`.
