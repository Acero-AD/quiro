# Quiro

Quiro is a distraction-free Markdown editor for Linux and Windows. The Markdown text on disk is always the source of truth. The editor only changes how that text looks, never what it contains.

## Language

### Markdown

**Dialect**:
The Markdown syntax Quiro recognises: CommonMark plus the GitHub-flavoured extensions (tables, task lists, strikethrough, autolinks) plus **Front matter**. Anything outside it is plain text.
_Avoid_: flavour, Markdown variant, GFM (on its own)

**Front matter**:
A YAML metadata block at the very start of a document, delimited by `---` lines, that belongs to the document but is not part of its Markdown body.
_Avoid_: header, metadata block, YAML header

**Syntax marker**:
A punctuation character that belongs to Markdown syntax rather than to the content it marks up, such as the `#` of a heading, the `*` around emphasis, a code fence's backticks, a quote's `>` or a task's `[ ]`.
_Avoid_: markup, marker (on its own), syntax characters, tokens

### Editing

**Document**:
The Markdown text being edited in a window. A window holds one document at a time.
_Avoid_: buffer, content, text (when meaning the whole document)

**File**:
A document's copy on disk. An **untitled document** has no file until it is saved.
_Avoid_: document (when meaning what is on disk)

**Untitled document**:
A document that has no file: the one Quiro starts with when it is given no file, or one created with New. Save As gives it a file.
_Avoid_: new document, unsaved document, scratch

**Modified**:
Said of a document whose text differs from the text it had when last opened or saved, ignoring its **line ending** and BOM. Undoing back to that text makes it unmodified again. An **untitled document** is modified when it isn't empty.
_Avoid_: dirty, unsaved, changed

**Outside change**:
A change to a document's file made by anything other than Quiro since Quiro last read or wrote it.
_Avoid_: external change, disk change

**Recovery copy**:
A copy of a **modified** document's text that Quiro keeps outside the document's file, so that the text survives if the session ends before the user has chosen whether to save it.
_Avoid_: backup, emergency save, autosave, hot exit, swap file

**Document version**:
A number that identifies one state of a document. Every change and every load gives the document a new version, and a version is never reused while Quiro runs.
_Avoid_: revision, generation, change count

**Line**:
The text between two line breaks in the document, as it is stored on disk. The cursor line is the line that contains the cursor.
_Avoid_: paragraph (when meaning a line), logical line, row

**Line ending**:
The line break a document's file uses: LF, CRLF or CR. A document has one line ending, and saving writes it after every line. A file with **mixed line endings** uses more than one; saving gives it the one it uses most.
_Avoid_: EOL, newline (when meaning the sequence), line terminator

**Visual line**:
One row of text as it appears on screen. A line longer than the editor's width wraps into several visual lines, and every visual line has the same height.
_Avoid_: display line, wrapped line, screen line, line (when meaning a visual line)

**Undo step**:
The unit of editing that one undo reverses: a burst of edits made in quick succession, or one **composed input** sequence.
_Avoid_: history entry, change, edit (when meaning the undo unit)

**Composed input**:
Characters typed in several keystrokes and inserted as one sequence: an accent from a dead key, a compose sequence, or a word from an input method.
_Avoid_: IME input (when meaning all three), composition, dead-key input

### App

**Window state**:
The window geometry Quiro remembers between runs: size, whether it was maximized, and position on platforms that let an app place its own window. It is remembered by Quiro, not chosen by the user.
_Avoid_: window settings, window preferences, **Setting**

**Setting**:
A user-chosen preference that changes Quiro's behaviour or appearance.
_Avoid_: preference, option, config (when meaning one choice)

**Notice**:
A message Quiro shows while the document stays editable, sometimes with actions to choose from. Several notices can show at once.
_Avoid_: banner, toast, alert

**Prompt**:
A question Quiro asks that must be answered before anything else can be done in the window, such as Save / Discard / Cancel. A file chooser is not a prompt.
_Avoid_: dialog (when meaning a question), modal, confirm

**Recent list**:
The files Quiro remembers having worked on lately, kept between runs, so that one can be reopened. Like **Window state**, it is remembered by Quiro, not chosen by the user.
_Avoid_: history, recent files, MRU
