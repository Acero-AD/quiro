## ADDED Requirements

### Requirement: CodeMirror stays inside the editor module
`npm run lint` SHALL fail when any linted file outside `src/editor/` imports a module whose name starts with `@codemirror/` or `@lezer/`. Files under `src/editor/` MAY import them.

#### Scenario: Import outside the editor module
- **WHEN** `src/main.ts` imports anything from `@codemirror/view`
- **THEN** `npm run lint` fails with a message saying that only `src/editor/` may use CodeMirror

#### Scenario: Import inside the editor module
- **WHEN** a file under `src/editor/` imports from `@codemirror/view`
- **THEN** `npm run lint` passes
