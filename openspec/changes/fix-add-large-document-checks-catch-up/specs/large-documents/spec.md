## ADDED Requirements

### Requirement: Typing keeps background parsing progress
A document change SHALL NOT discard parsing work that was done before it. When background parsing of the generated document is interrupted by a keystroke after every slice, the parse SHALL still reach the end of the document, given about twenty times the work of one full parse in total.

#### Scenario: Gate test
- **WHEN** `npm test` alternates slices of background parsing, each a fifth of a full parse's time, with a one-character insertion at the end of the generated document
- **THEN** the syntax tree covers the whole document within 100 rounds

## MODIFIED Requirements

### Requirement: Large documents meet the budget on WebKitGTK
The editor SHALL meet these budgets on WebKitGTK. On the developer's Linux machine, in a dev build on WebKitGTK, with the generated document loaded through `window.quiroDev.loadLargeFixture()` and the Web Inspector closed while typing:
- load-to-first-paint SHALL be under 1 s;
- in steady state, the keystroke processing time p95 SHALL be under 16 ms when typing at the start, the middle and the end of the document. Steady state means background parsing has stopped near the cursor: 2 s of idle time at the start and the middle, and at the end, the moment parsing has reached the end of the document;
- in catch-up (typing right after a jump to the end, while parsing catches up), no keystroke SHALL take over 150 ms, and parsing SHALL reach the end of the document within 5 s of the jump.

This is a manual check, recorded with the CPU and WebKitGTK version.

#### Scenario: Steady state
- **WHEN** the developer loads the fixture, waits 2 s, and types about 100 keys at the start, then the middle, reading `typingStats()` after each; and then presses Ctrl+End, waits without typing until parsing has reached the end, and types about 100 keys there
- **THEN** each p95 is under 16 ms

#### Scenario: Catch-up
- **WHEN** the developer loads the fixture, presses Ctrl+End at once, and types about 100 keys
- **THEN** `typingStats()` reports a maximum of 150 ms or less, and parsing reached the end within 5 s of the jump
