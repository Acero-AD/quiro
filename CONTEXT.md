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
A document's copy on disk. A new document has no file until it is saved.
_Avoid_: document (when meaning what is on disk)

**Modified**:
Said of a document whose text differs from its file's contents as last opened or saved. Undoing back to the saved text makes it unmodified again.
_Avoid_: dirty, unsaved, changed

**Document version**:
A number that identifies one state of a document. Every change and every load gives the document a new version, and a version is never reused while Quiro runs.
_Avoid_: revision, generation, change count

**Line**:
The text between two line breaks in the document, as it is stored on disk. The cursor line is the line that contains the cursor.
_Avoid_: paragraph (when meaning a line), logical line, row

**Visual line**:
One row of text as it appears on screen. A line longer than the editor's width wraps into several visual lines, and every visual line has the same height.
_Avoid_: display line, wrapped line, screen line, line (when meaning a visual line)

**Undo step**:
The unit of editing that one undo reverses: a burst of edits made in quick succession, or one composed character sequence.
_Avoid_: history entry, change, edit (when meaning the undo unit)

### App

**Window state**:
The window geometry Quiro remembers between runs: size, whether it was maximized, and position on platforms that let an app place its own window. It is remembered by Quiro, not chosen by the user.
_Avoid_: window settings, window preferences, **Setting**

**Setting**:
A user-chosen preference that changes Quiro's behaviour or appearance.
_Avoid_: preference, option, config (when meaning one choice)
