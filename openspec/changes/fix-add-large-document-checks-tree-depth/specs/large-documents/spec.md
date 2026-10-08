## ADDED Requirements

### Requirement: Writing in one place keeps the tree shallow
When content is added repeatedly at the same place in a document, at its start, in the middle or at its end, the syntax tree that the editor maintains incrementally SHALL stay about as deep as a fresh parse of the same text. Reusing parts of the previous tree SHALL NOT add a level for every few edits.

#### Scenario: Gate test
- **WHEN** `npm test` adds 300 paragraphs one at a time to an empty editor state, at the start, in the middle or at the end, completing the parse after each
- **THEN** in each case the tree is at most 5 levels deeper than a fresh parse of the final text

## MODIFIED Requirements

### Requirement: A keystroke reuses the unchanged tree whole
Once the whole generated document is parsed, re-parsing after a one-character change SHALL reuse the unchanged balanced chunks of the previous syntax tree as they are. The parse SHALL NOT re-add and rebalance every top-level block of the document, so that a keystroke's parsing cost doesn't grow with the document's size.

#### Scenario: Gate test
- **WHEN** `npm test` fully parses the generated document in an editor state, inserts one character at its end, and completes the parse again
- **THEN** at least 90% of the old tree's balanced chunks are in the new tree as the same objects
