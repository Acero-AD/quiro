## ADDED Requirements

### Requirement: A keystroke reuses the unchanged tree whole
Once the whole generated document is parsed, re-parsing after a one-character change SHALL reuse the unchanged balanced chunks of the previous syntax tree as they are. The parse SHALL NOT re-add and rebalance every top-level block of the document, so that a keystroke's parsing cost doesn't grow with the document's size.

#### Scenario: Gate test
- **WHEN** `npm test` fully parses the generated document in an editor state, inserts one character at its end, and completes the parse again
- **THEN** the new tree contains the old tree's first top-level chunk as the same object

### Requirement: The incremental tree matches a fresh parse
After any sequence of edits, the syntax tree that the editor maintains incrementally SHALL contain the same nodes, with the same names and ranges, as a fresh parse of the same text.

#### Scenario: Seeded edits
- **WHEN** `npm test` applies a seeded sequence of insertions and deletions to a document made of copies of the dialect fixture, completing the parse after each edit
- **THEN** after every edit, the tree's node listing equals the listing of a fresh parse
