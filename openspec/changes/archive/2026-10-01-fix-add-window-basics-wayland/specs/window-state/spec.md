## MODIFIED Requirements

### Requirement: Window state is remembered
When the window is closed, Quiro SHALL save its window state:
- the logical size of the window in its normal, unmaximized state;
- on Windows and X11 only, whether it was maximized, and its normal position.

On Wayland the compositor owns the window's placement and maximized state. There, Quiro SHALL NOT save a position, SHALL save `maximized: false`, and SHALL remember the size from every resize while the window isn't minimized, whatever maximized state the toolkit reports.

#### Scenario: Closing a normal window
- **WHEN** the user closes a 1200×800 window that isn't maximized
- **THEN** the saved window state holds 1200×800 logical pixels and `maximized: false`

#### Scenario: Closing a maximized window on Windows or X11
- **WHEN** the user closes a window on Windows or X11 that was 1200×800 before being maximized
- **THEN** the saved window state holds 1200×800 and `maximized: true`

#### Scenario: Closing on Wayland
- **WHEN** the user closes the window on a Wayland session
- **THEN** the saved window state holds no position and `maximized: false`

#### Scenario: Resizing a floating window on Wayland
- **WHEN** the user resizes a floating Quiro window on a Wayland session to 1200×800 and closes it, even though the toolkit reports the window as maximized
- **THEN** the saved window state holds 1200×800 logical pixels and `maximized: false`

### Requirement: Window state is restored within the screen
On start, Quiro SHALL apply the saved window state as follows:
- it SHALL clamp the size to the work area of the monitor it restores onto, or to that whole monitor where the platform doesn't report a work area (Wayland);
- on Windows and X11 it SHALL reapply the maximized flag, and on Wayland it SHALL NOT maximize the window;
- on Windows and X11 it SHALL restore the position, shifting the window so it fits inside that monitor's work area;
- if the saved position lies outside every current monitor, it SHALL centre the window instead.

#### Scenario: Restoring a size larger than the screen
- **WHEN** the saved size is 2500×1600 and the monitor's work area is 1920×1040 at scale 1
- **THEN** the restored size is at most 1920×1040 logical pixels

#### Scenario: Restoring a size larger than the screen on Wayland
- **WHEN** the saved size is 2500×1600 on a Wayland session, and the platform reports the 1920×1080 monitor at scale 1 with no separate work area
- **THEN** the restored size is at most 1920×1080 logical pixels

#### Scenario: Restoring onto a disconnected monitor
- **WHEN** the saved position lies outside every current monitor's work area on Windows or X11
- **THEN** the window is centred instead

#### Scenario: Restoring a maximized window on Windows or X11
- **WHEN** the saved window state has `maximized: true` on Windows or X11
- **THEN** the window is maximized after it's shown

#### Scenario: Restoring on Wayland
- **WHEN** Quiro starts on a Wayland session with a saved window state, including one that holds `maximized: true`
- **THEN** Quiro requests the saved size, never sets or requests a position, and doesn't maximize the window
