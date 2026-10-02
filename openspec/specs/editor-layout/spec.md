# editor-layout Specification

## Purpose
TBD - created by archiving change add-soft-wrap. Update Purpose after archive.
## Requirements
### Requirement: Long lines wrap
The editor SHALL wrap every line longer than its width onto further visual lines, including a single unbroken 2,000-character token such as a long URL. Fenced code and tables SHALL wrap like prose. The editor SHALL NOT show a horizontal scrollbar at any window size at or above the minimum.

#### Scenario: Long token at the minimum window size
- **WHEN** the window is at its minimum size and the document contains a 2,000-character token with no spaces
- **THEN** the token wraps onto several visual lines and there is no horizontal scrollbar

#### Scenario: Wrapping is on
- **WHEN** an editor is created
- **THEN** its content element carries CodeMirror's `cm-lineWrapping` class

### Requirement: One font size and line height
The editor's font size and line height SHALL be set once, in one rule, from the CSS custom properties `--editor-font-size` and `--editor-line-height`. The editor module SHALL declare their defaults, `16px` and `1.6`, and the rule SHALL override CodeMirror's base theme.

#### Scenario: Changing the line height
- **WHEN** a stylesheet sets `--editor-line-height` to `2` on the editor
- **THEN** every visual line takes the new height together

### Requirement: Highlight styles never change line geometry
No highlight style SHALL set `font-size`, `line-height`, `vertical-align`, or vertical `padding`, `margin` or `border`, including through the `padding`, `margin` or `border` shorthands. Highlight styles SHALL use only colour, weight, italics, decoration, font family, background, and horizontal padding.

#### Scenario: Checking the Markdown styles
- **WHEN** the Markdown theme's rules are read
- **THEN** none of them sets a forbidden property

### Requirement: Visual lines have one height
Every visual line SHALL have one height, with no jitter and no overlap. In the layout fixture, rendered at a fixed narrow width:
- every visual line SHALL have the same height;
- typing a Markdown construct or moving the cursor SHALL NOT change any visual line's height;
- no inline element SHALL extend outside its visual line;
- the scroller's content SHALL be no wider than the scroller.

The layout fixture SHALL be the dialect fixture, plus a line of emoji and CJK text, plus a 2,000-character unbroken token.

#### Scenario: Layout check in the gate
- **WHEN** `npm test` runs the layout check in headless Chromium
- **THEN** it reports no violations

#### Scenario: Layout check on WebKitGTK
- **WHEN** a developer runs `await window.quiroDev.checkLayout()` in a dev build on Linux
- **THEN** it returns an empty list

#### Scenario: A style that breaks the rule
- **WHEN** a style gives `md-heading-1` a larger font size
- **THEN** the layout check reports a line-height violation

### Requirement: The layout check is available in dev builds
Dev builds SHALL expose the layout check as `window.quiroDev.checkLayout()`, which resolves to the list of violations. It SHALL build its own hidden editor and remove it when done, leaving the document in the window's editor unchanged.

#### Scenario: Running the check
- **WHEN** a developer runs `await window.quiroDev.checkLayout()` with text in the editor
- **THEN** the result is a list, and the editor's text and cursor are unchanged

