# Security Notes

This fork is an agent plugin. Treat its prompts, skills, commands, and hooks as
trusted code because hosts may execute the hooks and inject the instructions into
agent system context.

## Install Policy

- Install from a pinned tag or commit, not a moving branch.
- Current trusted ref: `v4.6.0-snipki.1`.
- Review changes to `hooks/`, `skills/`, `commands/`, and plugin manifests before
  updating the trusted ref.

## Runtime Boundaries

Lifecycle hooks are intentionally limited to local config/state reads and writes.
They must not add network access, subprocess execution, package installation, or
secret handling.

The test suite includes a security-surface check that blocks obvious drift in the
runtime files. Keep that test small and update it only when the trust boundary
intentionally changes.
