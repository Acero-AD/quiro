# colour-scheme Specification

## Purpose
TBD - created by archiving change add-dark-colour-scheme. Update Purpose after archive.
## Requirements
### Requirement: The editor follows the system colour scheme
The editor SHALL use its dark colours when the webview reports `prefers-color-scheme: dark`, and its light colours otherwise. When the webview offers no way to query the colour scheme, the editor SHALL use its light colours and still start. The app SHALL NOT need to call anything for the editor to follow the scheme.

#### Scenario: Dark system
- **WHEN** the webview reports `prefers-color-scheme: dark` and the editor is created
- **THEN** the editor uses CodeMirror's dark base theme and the dark Markdown colours

#### Scenario: Light system
- **WHEN** the webview doesn't report `prefers-color-scheme: dark` and the editor is created
- **THEN** the editor uses CodeMirror's light base theme and the light Markdown colours

#### Scenario: No colour-scheme query
- **WHEN** `window.matchMedia` doesn't exist and the editor is created
- **THEN** the editor starts, and uses its light colours

### Requirement: The scheme switches while running
When the webview reports a change of colour scheme, the editor SHALL switch to the matching colours without reloading. The switch SHALL NOT change the document's text, the selection or the undo history. Loading a document SHALL keep the current scheme.

#### Scenario: Switching to dark with edits made
- **WHEN** the user has typed into a document and the webview reports a switch from light to dark
- **THEN** the editor uses its dark colours, and the text, the selection and the number of undo steps are unchanged

#### Scenario: Loading in dark
- **WHEN** the editor is dark and a document is loaded
- **THEN** the editor is still dark

#### Scenario: Destroyed editor
- **WHEN** the editor has been destroyed
- **THEN** a later colour-scheme change doesn't reach it

### Requirement: Every Markdown colour has a dark value
Every `--md-…` custom property that the editor module declares SHALL have a dark value. In dark mode, the dark value SHALL be the property's value on the editor, so the Markdown styles keep taking every colour from `var(--md-…)`.

#### Scenario: Heading in dark mode
- **WHEN** the editor is dark and the document contains `# Title`
- **THEN** `Title`'s computed colour is the dark value of `--md-heading`

### Requirement: Dark colours are readable on the dark background
Against the dark page background, `#2f2f2f` from `src/styles.css`, the WCAG 2 contrast ratio of each dark value SHALL be:
- at least 4.5:1 for the text colours: `--md-heading`, `--md-link`, `--md-quote`, `--md-table`, `--md-list-marker`, `--md-task-marker` and `--md-quote-marker`;
- at least 3:1 for the dimmed colours, `--md-syntax-marker`, `--md-url` and `--md-front-matter`, and at most half of the dark body text's own ratio, so they still look dimmed.

#### Scenario: Heading contrast
- **WHEN** the editor is dark
- **THEN** the dark `--md-heading` has a contrast of at least 4.5:1 against `#2f2f2f`

#### Scenario: Syntax markers stay dimmed
- **WHEN** the editor is dark
- **THEN** the dark `--md-syntax-marker` has a contrast of at least 3:1 against `#2f2f2f`, and at most half of the body text's

### Requirement: The cursor and the selection are visible in dark mode
In dark mode, the cursor SHALL be drawn in CodeMirror's dark cursor colour. The selection background SHALL be a custom property, `--editor-selection`, whose contrast with the dark page background is at least 1.5:1. The dark body text on it SHALL have a contrast of at least 4.5:1. This SHALL hold whether or not the editor has focus.

#### Scenario: Selecting text in dark mode
- **WHEN** the editor is dark and the user selects a word
- **THEN** the selection background is the dark `--editor-selection`, and the word stays readable on it

### Requirement: Light mode is unchanged
In light mode, every `--md-…` property SHALL keep the value it had before dark mode existed, and the editor SHALL use CodeMirror's light base theme.

#### Scenario: Light system after this change
- **WHEN** the webview doesn't report `prefers-color-scheme: dark`
- **THEN** `--md-heading` on the editor is `#1f4f8f`, as before

