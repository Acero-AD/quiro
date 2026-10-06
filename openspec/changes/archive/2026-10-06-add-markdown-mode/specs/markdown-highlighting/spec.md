## ADDED Requirements

### Requirement: Markdown dialect
The editor SHALL parse the document as CommonMark with the GitHub-flavoured extensions (tables, task lists, strikethrough with two tildes, and autolinks), plus YAML front matter at the very start of the document. It SHALL NOT recognise subscript, superscript or emoji syntax.

#### Scenario: Single tilde
- **WHEN** the document contains `~x~`
- **THEN** it is plain text, with no subscript or strikethrough

#### Scenario: Emoji shortcode
- **WHEN** the document contains `:smile:`
- **THEN** it is plain text, with no emoji node

#### Scenario: Strikethrough
- **WHEN** the document contains `~~gone~~`
- **THEN** `gone` is strikethrough

#### Scenario: Front matter
- **WHEN** the document starts with `---`, a line `title: Notes` and `---`
- **THEN** those three lines are front matter, not a horizontal rule and a heading

### Requirement: A distinct class per construct
Each of these constructs SHALL carry its own class in the editor's DOM:

| Construct | Class |
| --- | --- |
| heading, per level | `md-heading-1` to `md-heading-6` |
| emphasis | `md-emphasis` |
| strong | `md-strong` |
| strikethrough | `md-strikethrough` |
| inline code | `md-code` |
| fenced code | `md-code-block` |
| link text | `md-link` |
| URL | `md-url` |
| list marker | `md-list-marker` |
| blockquote | `md-quote` |
| table | `md-table` |
| task marker | `md-task-marker` |
| front matter | `md-front-matter` |
| syntax marker | `md-syntax-marker` |

#### Scenario: Second-level heading
- **WHEN** the document contains `## Section`
- **THEN** that heading carries `md-heading-2` and not `md-heading-1`

#### Scenario: Fenced code
- **WHEN** the document contains a fenced code block
- **THEN** its lines carry `md-code-block`, and inline code elsewhere carries `md-code`

### Requirement: Syntax markers share one class
Every **syntax marker** SHALL carry `md-syntax-marker`, and all syntax markers SHALL share one dimmed style. Syntax markers include the `#` of a heading, the `*` or `_` around emphasis and strong, the `~~` of strikethrough, the backticks of inline and fenced code, a link's brackets and parentheses, a table's delimiters, a quote's `>`, a list's marker and a task's `[ ]`. List, quote and task markers MAY also carry their own class, whose colour overrides the dimmed style.

#### Scenario: Heading marker
- **WHEN** the document contains `# Title`
- **THEN** the `#` carries `md-syntax-marker` and `Title` doesn't

### Requirement: Headings keep the body size
No heading class SHALL change the font size. Headings SHALL be distinguished by weight and colour only.

#### Scenario: Heading line
- **WHEN** a line is a first-level heading
- **THEN** no rule for `md-heading-1` sets `font-size`

### Requirement: Colours come from CSS custom properties
Every colour and background colour in the Markdown styles SHALL be a `var(--md-…)` reference to a CSS custom property, whose default value the editor module declares.

#### Scenario: Redefining a colour
- **WHEN** a stylesheet redefines `--md-heading` on the editor
- **THEN** headings take the new colour without reconfiguring the editor

### Requirement: The language adds no editing behaviour
Attaching the Markdown language SHALL NOT change Phase 1's editing set. Enter SHALL NOT continue list or quote markup. Pasting a URL over a selection SHALL insert the URL as plain text. The editor SHALL NOT offer HTML tag completion.

#### Scenario: Enter after a list item
- **WHEN** the cursor is at the end of `- item` and the user presses Enter
- **THEN** the new line doesn't start with `- `

#### Scenario: Pasting a URL over a selection
- **WHEN** `word` is selected and the user pastes `https://example.com`
- **THEN** the selection is replaced by `https://example.com`, not by a Markdown link

### Requirement: The dialect fixture's parse tree is pinned
The repository SHALL contain a Markdown fixture that uses every construct of the dialect: front matter, headings of levels 1 to 6, emphasis, strong, strikethrough, inline code, fenced code, a link with a URL, an autolink, bullet and ordered lists, a task list, a blockquote and a table. A test SHALL compare every node's name and range in the fixture's parse tree with a checked-in listing.

#### Scenario: Parser change
- **WHEN** a dependency update changes any node's name or range in the fixture's tree
- **THEN** `npm test` fails and prints the complete new listing
