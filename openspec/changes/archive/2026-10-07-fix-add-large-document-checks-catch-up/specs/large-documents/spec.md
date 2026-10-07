## ADDED Requirements

### Requirement: The parser reports its progress
A document change SHALL NOT discard parsing work done before it. CodeMirror keeps a running parse's work up to the position the parser reports, so the editor's language parser SHALL report its real position while it parses: it SHALL NOT be wrapped in a nested parse that reports 0 until an outer pass ends.

#### Scenario: Gate test
- **WHEN** `npm test` starts a parse of the generated document with the editor's language parser and advances it 1,000 steps, then 1,000 more
- **THEN** the reported parse position is above 0 after the first 1,000 steps, and higher after the next 1,000

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
