# AGENTS.md

## Agent skills

### Issue tracker

Issues live as GitHub issues in `Acero-AD/quiro`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using their default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- harness:rules:start -->
## Harness rules (unattended agent runs)

- Read `openspec/changes/<change>/` in full before implementing. Never implement before a task exists in `tasks.md`.
- A task is one `## N.` section of `tasks.md`; its checkboxes are the task's checklist. Implement the whole checklist of the task you were given, and nothing from other sections. Report through the required structured result, naming that section's task id.
- Your session may be resumed with gate failures, review findings or unmet checklist items. Address each one against the current files; do not assume earlier edits or earlier evidence still hold.
- Do not edit completion checkboxes in `tasks.md`. Report `ready_for_verification` when the implementation is ready; only the harness controller accepts tasks after its gate and a checklist review pass, and then checks the whole section.
- You may optionally run `harness check` (or `harness check test`, `lint`, or `typecheck`) before reporting. These sandboxed self-checks are not evidence; the controller gate runs independently and alone decides verification.
- Do not stage or commit changes. The controller creates evidence-bound checkpoints after acceptance.
- If the task needs work beyond the spec, stop and report `needs_human` with reason `scope`.
- Never modify, skip or delete existing tests to make a check pass. Add or update tests for the behavior you change.
- If a decision is not covered by `design.md`, or a change touches auth, secrets, crypto, access control, SQL, migrations or infrastructure, stop and report `needs_human` with the matching reason: `ambiguity`, `scope`, `architecture`, `destructive`, `security`.
- Never touch `.env`, `secrets/`, production URLs, or run destructive git, database or infrastructure commands. Do not push branches or open pull requests; the operator publishes accepted work.
- When proposing an OpenSpec change, size each `tasks.md` section so one worker session can implement it, and write every checkbox as an outcome a reviewer can verify from the files and gate results. Every checkbox must sit under a `## N.` heading.
- When proposing an OpenSpec change from harness research, read it with `harness research <topic> --show`. Base requirements and `design.md` decisions on its findings and cite their source ids. Record its unresolved questions in `design.md` as open questions; do not answer them yourself.
- Prototypes are for learning and validation, not for following. If `.harness/prototypes.json` exists or a task links a `prototype/*` asset, read it to understand intended behaviour, then implement from the spec and `design.md`. Do not copy its files, structure or naming, and do not mark a task done because the prototype already behaves that way.
<!-- harness:rules:end -->
