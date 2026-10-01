# editor Specification

## Purpose
TBD - created by archiving change add-editor. Update Purpose after archive.
## Requirements
### Requirement: The editor fills the window
On start, the window SHALL show a single editor that fills the whole window, with no other app UI, and the editor SHALL have keyboard focus. The editor SHALL keep filling the window at every size at or above the minimum window size, and resizing the window SHALL NOT change the document's text.

#### Scenario: App start
- **WHEN** Quiro starts
- **THEN** the window shows only the editor, filling the window, with the cursor in it and ready for typing

#### Scenario: Resizing
- **WHEN** the user types some text and then resizes the window, down to the minimum size and back
- **THEN** the editor fills the window at every size and the text is unchanged

### Requirement: Editor module interface
The editor module SHALL be reached only through `src/editor/index.ts`. It SHALL export `createEditor(parent: HTMLElement)`, which takes no other arguments, mounts an editor inside `parent`, and returns an object with these methods:
- `load(fileText: string)` replaces the document;
- `text(): string` returns the document;
- `focus()` gives the editor keyboard focus;
- `destroy()` removes the editor from `parent`.

No CodeMirror or Lezer type SHALL appear in the module's exported types.

#### Scenario: New editor
- **WHEN** `createEditor(parent)` is called
- **THEN** an editor appears inside `parent` and `text()` returns `""`

#### Scenario: Destroying the editor
- **WHEN** `destroy()` is called
- **THEN** the editor's elements are removed from `parent`

### Requirement: Loading a document
`load(fileText)` SHALL replace the document with `fileText`, with these differences:
- a leading UTF-8 BOM (U+FEFF) is removed;
- every line break (`\r\n`, `\r` or `\n`) is stored as `\n`.

`load` SHALL clear the undo history and put the cursor at the start of the document. `text()` SHALL return the document with `\n` line breaks and no BOM.

#### Scenario: BOM and CRLF
- **WHEN** `load("﻿# Title\r\n\r\nText\r\n")` is called
- **THEN** `text()` returns `"# Title\n\nText\n"`

#### Scenario: No line break
- **WHEN** `load("one line")` is called
- **THEN** `text()` returns `"one line"`

#### Scenario: Undo right after load
- **WHEN** a document is edited, then `load` is called with new text, then the user presses Ctrl+Z
- **THEN** the document still equals the loaded text

### Requirement: Phase 1 editing set
The editor SHALL provide CodeMirror's default keymap except Ctrl+/: cursor movement, word jumps, Home and End, Shift-selection, Backspace and Delete, Enter and select all. It SHALL also provide undo history, a drawn cursor and selection, and visible placeholders for invisible control characters. It SHALL NOT show line numbers or offer autocompletion.

#### Scenario: Typing and selecting
- **WHEN** the user types a sentence, moves by words with Ctrl+Arrow and selects with Shift+Arrow
- **THEN** the text appears as typed and the selection is drawn by the editor

#### Scenario: Control character
- **WHEN** the document contains a U+0007 character
- **THEN** the editor shows a visible placeholder for it

### Requirement: Paste inserts plain text
Pasting SHALL insert the clipboard's plain text, even when the clipboard also holds HTML.

#### Scenario: Clipboard with HTML and plain text
- **WHEN** a paste event carries `text/html` `<b>RICH</b>` and `text/plain` `plain`
- **THEN** the editor inserts `plain`

### Requirement: Undo and redo keys
Ctrl+Z SHALL undo. Ctrl+Shift+Z and Ctrl+Y SHALL both redo, on Linux and on Windows.

#### Scenario: Undo
- **WHEN** the user types and presses Ctrl+Z
- **THEN** the typed text is removed

#### Scenario: Redo with Ctrl+Shift+Z on Windows
- **WHEN** on Windows the user undoes an edit and presses Ctrl+Shift+Z
- **THEN** the edit is restored

#### Scenario: Redo with Ctrl+Y on Linux
- **WHEN** on Linux the user undoes an edit and presses Ctrl+Y
- **THEN** the edit is restored

### Requirement: Undo steps
One undo SHALL reverse one undo step: a burst of adjacent edits made less than 500 ms apart, or one composed input sequence. The editor SHALL keep at least 100 undo steps.

#### Scenario: A burst of typing
- **WHEN** the user types five characters, each less than 500 ms after the last, and presses Ctrl+Z once
- **THEN** all five characters are removed

#### Scenario: Separate edits
- **WHEN** two edits are made 600 ms apart and the user presses Ctrl+Z once
- **THEN** only the second edit is removed

#### Scenario: One hundred steps
- **WHEN** 100 separate undo steps are made and then undone one by one
- **THEN** each undo restores the text before its step, and the last one restores the starting text

#### Scenario: Composed input
- **WHEN** a composed input sequence inserts its characters and the user presses Ctrl+Z
- **THEN** the whole composed sequence is removed in one step

### Requirement: Keys reserved for the app
The editor SHALL NOT bind Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+, (comma), Ctrl+Shift+P or Ctrl+/. These keys belong to app-level shortcuts that later goals add outside the editor module.

#### Scenario: Reserved key in the editor
- **WHEN** the editor has focus and the user presses Ctrl+S
- **THEN** the editor neither changes the document nor cancels the key event

### Requirement: Composed input
A dead-key accent, a compose sequence and an input-method word SHALL each insert the composed characters. This is verified by a manual check on WebKitGTK, and on Windows later.

#### Scenario: Dead key
- **WHEN** with a dead-key layout the user types the acute dead key and then `e`
- **THEN** the editor inserts `é`

#### Scenario: Input method
- **WHEN** the user composes a word with an input method and commits it
- **THEN** the editor inserts the committed word, and one undo removes all of it

