## Why

The Linux check of `add-large-document-checks` failed ([`verification.md`](../2026-10-02-add-large-document-checks/verification.md)). After a jump to the end of the 50,000-line document, typing slowed down and parsing took 19,926 ms to reach the end (limit 5,000). One keystroke took 151 ms (limit 150). With nobody typing, the same parse finished in 3,519 ms.

The cause is in how the editor's language is built. Typing throws away the background parsing done since the last finished parse:
- on every document change, CodeMirror saves the running parse up to the position the parser reports;
- a nested parse (`parseMixed`) reports position 0 until its outer parse is done;
- Quiro's Markdown parse is nested twice:
  - `markdown()` from `@codemirror/lang-markdown` always wraps it for HTML and code;
  - `yamlFrontmatter` from `@codemirror/lang-yaml` wraps the whole document again. Its outer pass over the 5 MB document takes 53 to 65 ms by itself.

Section 1 of this change removed the inner wrapper. CI then failed: the outer wrapper still loses the parse whenever its pass can't finish within CodeMirror's 20 ms per keystroke. That happens on CI runners, and on any machine about twice as slow as the developer's. Section 2 removes the outer wrapper too.

## What Changes

- **The editor builds its Markdown language without `markdown()`** (section 1): `commonmarkLanguage`'s parser, configured with GFM and Quiro's tags, as a plain `Language`.
- **Front matter is recognised by the Markdown parser itself** (section 2), through a small block parser, instead of by `yamlFrontmatter`. The whole document is then one Markdown parse with no nesting, which always reports its real position.
  - It recognises exactly what `yamlFrontmatter` recognised today: an exact `---` first line, closed by the next exact `---` line, or running to the end of the document if there is none.
  - The front matter's YAML is no longer parsed into its own subtree. Nothing styled it.
- **What `markdown()` brought and Quiro loses, none of it used today:**
  - the nested HTML parse;
  - lang-html's support extensions;
  - a fold service for headings.
- **The pinned dialect listing changes in its front-matter block only:**
  - one `Document` instead of two;
  - `Frontmatter` with `DashLine`, `FrontmatterContent` and `DashLine` children instead of YAML nodes.

  Every other node and range is unchanged.
- **The gate test counts parse steps instead of timing them.** It checks that the editor's parser reports progress as it works. Today's language reports 0 after 3,000 steps; the new one reports about 750,000 characters. The timed test from section 1 depended on the runner's speed, and is replaced.
- **The manual check is corrected:**
  - the Web Inspector stays closed while typing;
  - steady state at the end is measured only after parsing has reached the end.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `large-documents`:
  - new requirement "The parser reports its progress", checked in the gate;
  - "Large documents meet the budget on WebKitGTK": steady state at the end waits for the parse, and the inspector stays closed while typing. The thresholds don't change.

## Impact

- **Operator prerequisites:** none. `@codemirror/lang-yaml` becomes unused but stays installed. Removing it is a separate cleanup.
- **Code:** `src/editor/language.ts` and a new `src/editor/front-matter.ts`. `markdownMode()` keeps its signature. The class names, styles and front-matter line decoration don't change.
- **Tests:**
  - a new jsdom file for front-matter edge cases;
  - `src/editor/parse-progress.test.ts`, added by section 1, is rewritten;
  - `src/editor/fixtures/dialect.tree.txt` is regenerated;
  - no other test file changes.
- **Later goals:** tree walkers in Phase 3 and Phase 6 see one `Document`. G-307 can't wrap the parser in `parseMixed` without failing the new gate test; see `design.md`.
- **Manual check:** the `add-large-document-checks` Linux items run again with the corrected method. Their results go in this change's `verification.md`.
