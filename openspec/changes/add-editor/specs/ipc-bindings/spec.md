## REMOVED Requirements

### Requirement: The window shows Rust's reply
**Reason**: G-101 requires the window to show a single editor with no other app UI, so the page no longer displays Rust's reply to `ping`.
**Migration**: The `ping` command, the `src/ping.ts` client, `src/ping.test.ts` and the bindings drift test all stay as the tested IPC reference example ("Ping reference command" is unchanged). Nothing calls `ping` at runtime. A later goal that needs IPC calls its own command through `src/bindings.ts`.
