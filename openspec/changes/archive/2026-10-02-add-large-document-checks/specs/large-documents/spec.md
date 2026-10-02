## ADDED Requirements

### Requirement: Seeded large-document generator
The repository SHALL contain a generator that builds the large document from a numeric seed: exactly 50,000 lines, between 4 and 6 MB, using every construct of the dialect (front matter, headings, emphasis, strong, strikethrough, inline code, fenced code, links, lists, task items, quotes and tables). The same seed SHALL always produce identical text. No large Markdown file SHALL be checked in.

#### Scenario: Same seed
- **WHEN** the generator runs twice with the same seed
- **THEN** both runs return identical text

#### Scenario: Size and content
- **WHEN** the generator runs with the default seed
- **THEN** the text has exactly 50,000 lines, between 4 and 6 MB, and contains every construct listed above

### Requirement: Loading a large document stays cheap
Under jsdom, `load()` of the generated document into an editor SHALL return in under 250 ms. The budget covers only the `load` call, not generating the text.

#### Scenario: Gate test
- **WHEN** `npm test` loads the generated document into a new editor
- **THEN** the `load` call returns in under 250 ms

### Requirement: Dev-only timing tools
Dev builds SHALL expose two more functions on `window.quiroDev`:
- `loadLargeFixture()` loads the generated document into the window's editor and logs the time from calling `load` to the first paint that shows the top of the document;
- `typingStats()` prints and resets the median, p95 and maximum keystroke processing time since the last reset, and the time parsing took to reach the end of the document after the cursor last jumped to the end.

Keystroke processing time SHALL be measured from the key event's timestamp until the editor has applied the change, including any wait behind a parse slice but not the wait for the next screen refresh. The production bundle SHALL contain neither function.

#### Scenario: Loading the fixture in dev
- **WHEN** a developer runs `window.quiroDev.loadLargeFixture()` in a dev build
- **THEN** the editor shows the generated document from its first line, and the console shows the load-to-first-paint time in milliseconds

#### Scenario: Typing statistics
- **WHEN** after loading the fixture the developer types about 100 keys and runs `window.quiroDev.typingStats()`
- **THEN** the console shows the count, median, p95 and maximum in milliseconds, and the next call reports only keys typed after it

### Requirement: Large documents meet the budget on WebKitGTK
The editor SHALL meet these budgets on WebKitGTK. On the developer's Linux machine, in a dev build on WebKitGTK, with the generated document loaded through `window.quiroDev.loadLargeFixture()`:
- load-to-first-paint SHALL be under 1 s;
- in steady state (the document left idle for 2 s, so background parsing has stopped), the keystroke processing time p95 SHALL be under 16 ms when typing at the start, the middle and the end of the document;
- in catch-up (typing right after a jump to the end, while parsing catches up), no keystroke SHALL take over 150 ms, and parsing SHALL reach the end of the document within 5 s of the jump.

This is a manual check, recorded with the CPU and WebKitGTK version.

#### Scenario: Steady state
- **WHEN** the developer loads the fixture, waits 2 s, and types about 100 keys at the start, then the middle, then the end, reading `typingStats()` after each
- **THEN** each p95 is under 16 ms

#### Scenario: Catch-up
- **WHEN** the developer loads the fixture, presses Ctrl+End at once, and types about 100 keys
- **THEN** `typingStats()` reports a maximum of 150 ms or less, and parsing reached the end within 5 s of the jump
