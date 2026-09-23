# Absorbed source: portabledesktop

The Go source under `internal/pd/desktop` and `internal/pd/runtime` is
absorbed (copied, with import paths rewritten to this module) from the
`pd/internal/desktop` and `pd/internal/runtime` packages of:

- Project: https://github.com/coder/portabledesktop
- License: MIT (see `LICENSE` in this directory)
- Upstream revision absorbed: `6d29d49a2f268ca7fab93826878bf9ea8dda015d`
  (2026-04-01)

`coder/portabledesktop` is a standalone MIT-licensed project, distinct from
the AGPLv3-licensed `coder/coder` monorepo. No source was taken from
`coder/coder` or from any AGPL-licensed codebase.

Only the desktop-orchestration packages needed to start/stop an Xvnc-backed
X11 session (`desktop.Start`/`desktop.Kill`) and resolve runtime binaries
(`runtime.ResolveRuntimeBinary`, `runtime.ValidateRuntimeDir`,
`runtime.ResolveRuntimeData`) were absorbed. The CLI (`pd/internal/cli`),
noVNC viewer bundle (`pd/viewer`), and embedded-runtime packaging
(`pd/internal/runtime/unpack.go`, `embed_runtime.go`) were intentionally left
out — this component drives `desktop.Start`/`desktop.Kill` directly as a Go
library rather than shelling out to the `portabledesktop` CLI, and always
supplies an external runtime directory via `PORTABLEDESKTOP_RUNTIME_DIR`
(never an embedded one).

Local adaptations from upstream:

- Import path `github.com/coder/portabledesktop/pd/internal/runtime` rewritten
  to `github.com/autonomy-cloud/openagents-workstation/internal/pd/runtime`.
- No other logic changes.
