## ADDED Requirements

### Requirement: Navigation stays on the app's page
The webview SHALL refuse every navigation to a URL outside the app's own origin, in dev and release builds, and SHALL do so silently. The app's origin is `http://localhost:1420` under `tauri dev`, and otherwise Tauri's custom-protocol origin: `tauri://localhost` on Linux and `http://tauri.localhost` on Windows.

#### Scenario: Link click
- **WHEN** the page navigates to `https://example.com/`
- **THEN** the navigation is refused and the editor stays on screen with its document unchanged

#### Scenario: Local file
- **WHEN** the page navigates to a `file:` or `data:` URL
- **THEN** the navigation is refused

#### Scenario: The app's own page
- **WHEN** the release build loads `tauri://localhost/` on Linux
- **THEN** the navigation is allowed

### Requirement: Dropped files are ignored
Dropping a file or a link onto the window SHALL leave the document unchanged and SHALL NOT navigate. `tauri.conf.json` SHALL set `dragDropEnabled: true` explicitly on the main window.

#### Scenario: File dropped onto the text
- **WHEN** the user drops a file from the file manager onto the editor's text
- **THEN** the document is unchanged and the window still shows the editor

#### Scenario: Link dropped onto empty space
- **WHEN** the user drags a link from a browser onto empty space below the text
- **THEN** the document is unchanged and the webview doesn't navigate

### Requirement: No context menu in release builds
In release builds, right-clicking anywhere in the window SHALL show no menu. Dev builds SHALL keep the engine's context menu, so its Inspect Element stays available.

#### Scenario: Right-click in a release build
- **WHEN** the user right-clicks over the text or over empty space in a release build
- **THEN** no menu appears

#### Scenario: Right-click in a dev build
- **WHEN** the user right-clicks in `npm run tauri dev`
- **THEN** the engine's menu appears with Inspect Element

### Requirement: Browser shortcuts do nothing
The webview SHALL cancel the default action of these keys:
- reload: F5, Ctrl+R, Ctrl+Shift+R, Ctrl+F5 and Shift+F5;
- print: Ctrl+P;
- find: Ctrl+F, F3, Shift+F3, Ctrl+G and Ctrl+Shift+G;
- history: Alt+ArrowLeft, Alt+ArrowRight, BrowserBack and BrowserForward;
- others: Ctrl+J, F7 and Ctrl+U;
- zoom: Ctrl+Minus, Ctrl+Plus, Ctrl+= and Ctrl+0.

In release builds only, it SHALL also cancel F12, Ctrl+Shift+I, Ctrl+Shift+J and Ctrl+Shift+C. It SHALL only cancel the default action, never stop the event, so the editor's own bindings for these keys still run. It SHALL leave alone keys pressed during composition, Esc, and editing keys.

#### Scenario: Reload key
- **WHEN** the user presses Ctrl+R
- **THEN** the key's default action is cancelled and the page doesn't reload

#### Scenario: Editor binding on a cancelled key
- **WHEN** the user presses Alt+ArrowRight in the editor
- **THEN** the editor still runs its own binding for the key, and the browser's back/forward action is cancelled

#### Scenario: Devtools key in dev and release
- **WHEN** the user presses F12
- **THEN** its default action is cancelled in a release build and left alone in a dev build

#### Scenario: Key during composition
- **WHEN** a key from the list is pressed while an input method is composing
- **THEN** the guard leaves the event untouched

#### Scenario: Editing keys
- **WHEN** the user presses Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+X, Ctrl+C, Ctrl+V, Ctrl+A, an arrow key, Home or End
- **THEN** the guard leaves the event untouched

### Requirement: No zoom
The page SHALL NOT zoom by keyboard, Ctrl+wheel or touchpad pinch, and the mouse side buttons SHALL NOT navigate. `tauri.conf.json` SHALL set `zoomHotkeysEnabled: false` explicitly on the main window.

#### Scenario: Ctrl+wheel
- **WHEN** the user holds Ctrl and turns the mouse wheel over the editor
- **THEN** the page doesn't zoom

### Requirement: No devtools in release builds
Release builds SHALL offer no way to open devtools. `src-tauri/Cargo.toml` SHALL NOT enable Tauri's `devtools` feature.

#### Scenario: Release build
- **WHEN** the user right-clicks or presses F12 or Ctrl+Shift+I in a release build
- **THEN** no devtools open
