#!/usr/bin/env node
// sot-guard — source-of-truth + country-isolation guard. Runs as a pre-push git hook AND in CI.
// It stops a machine (any tailscale node) from (a) pushing a project's code to the WRONG repo
// (a competing copy), or (b) crossing country boundaries in a country-scoped repo.
//
// It reads a `.sot.json` at the repo root (installed by apply-governance.sh from the manifest):
//   { "project": "prepmaster-gh", "canonical_repo": "owner/prepmaster-gh",
//     "country_scope": ["gh"], "deploy_branch": "main",
//     "deploy_country_env": "PREPMASTER_DEPLOYMENT_COUNTRY", "deploy_country_value": "GH",
//     "isolation": "repo-per-country" }
//
// Checks (fail = non-zero exit, with a clear message):
//  1. IDENTITY: `git remote get-url origin` must resolve to canonical_repo. Prevents pushing
//     this project's source into a different/forked repo (competing source of truth).
//  2. COUNTRY-LOCK: for a single-country repo, no CHANGED deploy/env/CI file may set the
//     deploy_country_env to a value outside country_scope, and no changed deploy/CI file may
//     name another country's deploy host/prefix. Migrations (schema-agnostic FOREACH) are
//     EXEMPT — they legitimately reference every schema, so they are never scanned.
//
// Usage: node sot-guard.mjs            (scans staged+committed-not-pushed vs upstream)
//        node sot-guard.mjs --all      (scans the whole tree, for CI on a fresh checkout)

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const fail = (msg) => { console.error(`\n✖ sot-guard: ${msg}\n`); process.exit(1); };
const ok = (msg) => console.log(`✓ sot-guard: ${msg}`);

if (!fs.existsSync('.sot.json')) { console.log('sot-guard: no .sot.json at repo root — skipping (run apply-governance.sh to install)'); process.exit(0); }
const sot = JSON.parse(fs.readFileSync('.sot.json', 'utf8'));
const scanAll = process.argv.includes('--all');

// ---- 1. IDENTITY -----------------------------------------------------------------------------
const origin = sh('git remote get-url origin');
if (sot.canonical_repo) {
  const norm = (u) => u.replace(/^git@github\.com:/, '').replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').toLowerCase();
  if (origin && norm(origin) !== sot.canonical_repo.toLowerCase()) {
    fail(`IDENTITY: origin is "${norm(origin)}" but this project's canonical repo is "${sot.canonical_repo}". `
      + `You are about to push into a NON-canonical repo (a competing source of truth). Push to the canonical repo instead.`);
  }
  ok(`identity: origin == canonical ${sot.canonical_repo}`);
}

// ---- 2. COUNTRY-LOCK -------------------------------------------------------------------------
const scope = Array.isArray(sot.country_scope) ? sot.country_scope.map((c) => c.toLowerCase()) : null;
if (!scope || sot.isolation === 'app-level-multi-tenant') {
  ok(`country-lock: not a single-country repo (scope=${JSON.stringify(sot.country_scope)}) — skipped`);
  process.exit(0);
}

// Which files to scan. Default (pre-push): changed vs upstream. `--all`: whole tree (manual audit).
// `--base <ref>`: changed vs an explicit ref (CI passes the push before-SHA / PR base) so the guard
// only checks NEW changes and never retroactively fails a repo on grandfathered content.
const baseIdx = process.argv.indexOf('--base');
const baseRef = baseIdx >= 0 ? process.argv[baseIdx + 1] : null;
let files = [];
if (scanAll) {
  files = sh('git ls-files').split('\n').filter(Boolean);
} else if (baseRef && !/^0{7,}$/.test(baseRef)) { // skip the all-zeros SHA (branch-create push)
  files = sh(`git diff --name-only ${baseRef}...HEAD`).split('\n').filter(Boolean);
} else if (baseRef) {
  // first push of a new branch (no before-SHA) — nothing to diff against; guard new changes only
  files = sh('git diff --name-only HEAD~1...HEAD 2>/dev/null').split('\n').filter(Boolean);
} else {
  const upstream = sh('git rev-parse --abbrev-ref --symbolic-full-name @{u}') || 'origin/' + (sot.deploy_branch || 'main');
  const range = upstream ? `${upstream}...HEAD` : 'HEAD';
  files = sh(`git diff --name-only ${range}`).split('\n').filter(Boolean);
  const staged = sh('git diff --cached --name-only').split('\n').filter(Boolean);
  files = [...new Set([...files, ...staged])];
}

// only deploy/env/CI/config files carry country targeting; migrations & app source are exempt
const RELEVANT = /(\.env|env\.|\.ya?ml|\.json|deploy|ecosystem\.config|\.github\/workflows|nginx|pm2|Dockerfile|\.sh)$|(^|\/)(deploy|infra|scripts)\//i;
const EXEMPT = /(^|\/)(migrations?|node_modules|dist|build|\.next|_archive)(\/|$)/i;
const ALL_CC = ['gh', 'ng', 'za', 'zw', 'ke', 'rw', 'tz', 'ug', 'ci', 'sn'];
const others = ALL_CC.filter((c) => !scope.includes(c));

const violations = [];
for (const f of files) {
  if (!fs.existsSync(f) || EXEMPT.test(f) || !RELEVANT.test(f)) continue;
  let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch { continue; }
  // 2a. explicit deploy-country env set to a foreign country
  if (sot.deploy_country_env && sot.deploy_country_value) {
    const re = new RegExp(`${sot.deploy_country_env}\\s*[=:]\\s*["']?([A-Za-z]{2})`, 'g');
    let m; while ((m = re.exec(txt))) {
      const v = m[1].toLowerCase();
      if (v !== sot.deploy_country_value.toLowerCase() && !scope.includes(v)) {
        violations.push(`${f}: ${sot.deploy_country_env}=${m[1]} — foreign country in a ${scope.join('/')} repo`);
      }
    }
  }
  // 2b. foreign country schema/prefix tokens in deploy/CI config (e.g. prepmaster_ng in a gh deploy file)
  for (const cc of others) {
    for (const tok of [`prepmaster_${cc}`, `-${cc}.prepmaster`, `_${cc}_deploy`, `DEPLOYMENT_COUNTRY=${cc.toUpperCase()}`]) {
      if (txt.includes(tok)) violations.push(`${f}: contains "${tok}" — foreign-country target in a ${scope.join('/')} repo`);
    }
  }
}

if (violations.length) {
  fail(`COUNTRY-LOCK: this repo is scoped to [${scope.join(', ')}] but changed deploy/config files target another country:\n  - `
    + violations.slice(0, 20).join('\n  - ')
    + `\n\nCross-country changes are forbidden. Put ${scope.join('/')}-only config here; other countries live in their own repos.`);
}
ok(`country-lock: no foreign-country deploy/config in ${files.length} changed file(s) (scope [${scope.join(', ')}])`);
