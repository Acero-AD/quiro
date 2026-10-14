# Rust owns the file, and the webview never names a path

Quiro splits a document's state where the document meets its file. The webview's editor module owns the document: its text, whether it is modified, and its line ending and BOM. The Rust core owns the file: its path, the bytes last read or written, the file watcher and the file dialogs. The webview asks Rust to open, save or save as, and gets back text and a display name. It may show paths, but no command accepts one from it. A file reaches Rust only from a native dialog, the command line, or a list entry picked by id.

We chose this over Tauri's `plugin-fs` and `plugin-dialog` JavaScript APIs, and over commands of our own that take a path. Quiro's own commands bypass Tauri's permission checks, so a command that writes to a given path would let any script in the webview write anywhere the user can. That includes Phase 3's rendered Markdown and Phase 6's plugins. Keeping the file side in Rust also gives later plugins one place to extend file handling. It puts the watcher next to the bytes it compares against to tell Quiro's own saves from outside changes. And it keeps all IPC in the typed bindings, which the plugins' JavaScript would bypass.

## Consequences

- The frontend uses neither `plugin-fs` nor the dialog plugin's file pickers. File choosers run from Rust.
- **Rust is the source of truth for which file is open.** When the webview starts, including after a reload, it asks Rust what to show, rather than telling Rust.
- **Every open goes through a single pending open in Rust,** which the webview commits or abandons. Paths from the command line, a second launch and the Recent list all arrive this way.
- **Text crosses IPC only on open, save and reload,** as a string, and Rust checks that it is UTF-8.
- **New ways to choose a file are added in Rust,** such as drag and drop or a plugin that opens files. They never pass a path from the webview.
- **Every file transition lives in one Rust module:** opening, saving, Save As and New. That module is where later plugins hook in.
