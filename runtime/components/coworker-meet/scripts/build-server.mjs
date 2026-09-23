#!/usr/bin/env node
// Builds the embedded OpenAgents/LiveKit server binary for the *current*
// platform from the sibling `agents` monorepo checkout and drops it into
// bin/<platform>-<arch>/openagents-server, where embeddedServer.ts expects
// it. Run once per platform you want to ship the "just works" zero-config
// mode for (darwin-arm64, darwin-x64, linux-x64, win32-x64, ...).
//
// This assumes the autonomy-cloud layout where `agents` is checked out as a
// sibling of this extension's repo. Point AGENTS_REPO at a different path
// if yours lives elsewhere.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const extensionRoot = path.resolve(import.meta.dirname, '..');
const agentsRepo =
  process.env.AGENTS_REPO ?? path.resolve(extensionRoot, '..', 'agents');
const serverSrc = path.join(
  agentsRepo,
  'runtime',
  'components',
  'openagents-server',
);

if (!existsSync(serverSrc)) {
  console.error(
    `Could not find openagents-server source at ${serverSrc}.\n` +
      'Set AGENTS_REPO to point at your autonomy-cloud/agents checkout.',
  );
  process.exit(1);
}

const platform = process.platform; // darwin | linux | win32
const arch = process.arch; // arm64 | x64
const outDir = path.join(extensionRoot, 'bin', `${platform}-${arch}`);
const outBinary = path.join(
  outDir,
  platform === 'win32' ? 'openagents-server.exe' : 'openagents-server',
);

mkdirSync(outDir, { recursive: true });

const tmpOut = path.join(os.tmpdir(), `openagents-server-${Date.now()}`);
console.log(`Building embedded server from ${serverSrc} ...`);
execFileSync('go', ['build', '-o', tmpOut, './cmd/server'], {
  cwd: serverSrc,
  stdio: 'inherit',
  env: { ...process.env, GOFLAGS: '-mod=mod' },
});

copyFileSync(tmpOut, outBinary);
chmodSync(outBinary, 0o755);
console.log(`Wrote ${outBinary}`);
