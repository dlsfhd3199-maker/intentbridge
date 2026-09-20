import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function classify(paths) {
  const migration = paths.some(p => /^prisma\//.test(p));
  // Server code is conservatively reviewed: path classification cannot prove read-only behavior.
  const high = migration || paths.some(p => /^(auth\.ts$|proxy\.ts$|instrumentation\.ts$|lib\/|app\/api\/|app\/.*(?:auth|login|signup|register)|scripts\/|\.github\/|\.cloudtype\/|Dockerfile|\.dockerignore|package(?:-lock)?\.json$|next\.config\.|.*(?:permission|tenant|secret|security)|\.env)/i.test(p));
  const deploy = paths.some(p => !/\.md$|^reference\/|^spec\//i.test(p));
  return { migration, high, deploy, risk: high ? 'HIGH' : paths.some(p => /^(data|features|types)\//.test(p)) ? 'MEDIUM' : 'LOW' };
}
export function changedPaths(base, head, cwd = '.') {
  if (![base, head].every(v => /^[a-f0-9]{40}$/.test(v))) throw new Error('A full baseline and target commit SHA are required.');
  execFileSync('git', ['merge-base', '--is-ancestor', base, head], { cwd, stdio: 'pipe' });
  // --no-renames catches both ends of moves. The baseline is last successful deployment, not previous push.
  return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, head], { cwd }).toString().split('\0').filter(Boolean);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = classify(changedPaths(process.env.BASELINE_SHA, process.env.GITHUB_SHA));
    const reviewed = process.env.REVIEWED_SHA === process.env.GITHUB_SHA;
    const allowed = !result.high || reviewed;
    const lines = [`Risk: ${result.risk}`, ...(result.migration ? ['DATABASE MIGRATION DETECTED — Staging Migration Required. No migration is run by this workflow.'] : []), `Deployment review: ${allowed ? 'passed' : 'required; dispatch with reviewed_sha after review / DB preparation'}`];
    console.log(lines.join('\n'));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n\n') + '\n');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${result.deploy || process.env.MANUAL_RUN === 'true'}\nallowed=${allowed}\n`);
    if (!allowed) process.exitCode = 1;
  } catch {
    console.error('Deployment blocked: missing/invalid baseline or rewritten history. Verify the deployed commit and set STAGING_BASELINE_SHA for initial setup.');
    process.exitCode = 1;
  }
}
