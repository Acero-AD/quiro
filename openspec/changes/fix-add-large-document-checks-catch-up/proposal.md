## Why

The Linux check of `add-large-document-checks` failed ([`verification.md`](../2026-10-02-add-large-document-checks/verification.md)). After a jump to the end of the 50,000-line document, typing slowed down and parsing took 19,926 ms to reach the end (limit 5,000). One keystroke took 151 ms (limit 150). With nobody typing, the same parse finished in 3,519 ms.

The cause is in how the editor's language is built. Every keystroke throws away all the background parsing done since the last finished parse:
- `markdown()` from `@codemirror/lang-markdown` always wraps the Markdown parser in a nested parse, `parseMixed`, for HTML and code;
- `yamlFrontmatter` from `@codemirror/lang-yaml` wraps that again, so the Markdown body is itself a nested parse;
- a nested parse reports its position as 0 while its outer parse runs. On every document change, CodeMirror saves the partial parse at the reported position, so it saves nothing.

A trace with real CodeMirror state on the generated document shows the saved parse stuck at 3,000 characters across 60 rounds of background parsing and keystrokes.

## What Changes

- **The editor builds its Markdown language without `markdown()`:** `commonmarkLanguage`'s parser, configured with GFM and Quiro's tags, as a plain `Language`, still wrapped by `yamlFrontmatter`. The Markdown parse inside the wrapper then reports its real position, so typing keeps the background parse's progress.
  - In a simulation of CodeMirror's scheduling, parsing reached the end in 3.5 s even with someone typing all the way through. Today it never finishes while typing.
  - The pinned dialect parse tree doesn't change.
- **What `markdown()` brought and Quiro loses, none of it used today:**
  - the nested HTML parse, so raw HTML gets no HTML subtree; it stays as Markdown's own HTML nodes, unstyled as before;
  - lang-html's support extensions;
  - a fold service for headings. Quiro has no folding.
- **A gate test catches the loss:** background parsing of the generated document, interrupted by a keystroke after each slice, must still reach the end.
- **The manual check is corrected:**
  - the Web Inspector stays closed while typing, because it inflated the first run's figures about fivefold;
  - steady state at the end is measured only after parsing has reached the end. CodeMirror doesn't parse that far until the view moves there, so "idle for 2 s" wasn't a steady state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `large-documents`:
  - new requirement "Typing keeps background parsing progress", checked in the gate;
  - "Large documents meet the budget on WebKitGTK": steady state at the end is measured after parsing reaches the end, and the inspector stays closed while typing. The thresholds don't change.

## Impact

- **Operator prerequisites:** none. No dependency changes: `@codemirror/lang-markdown` still provides `commonmarkLanguage`, and `@codemirror/lang-yaml` still provides `yamlFrontmatter`.
- **Code:** `src/editor/language.ts` only. `markdownMode()` keeps its signature.
- **Tests:** one new jsdom test file. Existing test files and `src/editor/fixtures/dialect.tree.txt` are unchanged.
- **Later goals:** G-307 (code highlighting in fences) will need a nested parse of the Markdown body. Under `yamlFrontmatter`, that would bring the loss back, and the new gate test will fail. See `design.md`.
- **Manual check:** the `add-large-document-checks` Linux items run again with the corrected method. Their results go in this change's `verification.md`.
