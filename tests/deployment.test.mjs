import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { classify, changedPaths } from '../scripts/deployment-policy.mjs';
import { fingerprint } from '../scripts/deployment-fingerprint.mjs';
import { checkHealth } from '../scripts/deployment-health.mjs';
import { prepare } from '../scripts/deployment-config.mjs';

test('policy catches migration deletion/rename, security and write APIs; docs do not deploy', () => {
  for (const path of ['prisma/migrations/old/migration.sql', 'prisma/postgresql/schema.prisma', 'auth.ts', 'lib/server/api.ts', 'app/api/campaigns/route.ts', '.github/workflows/cloudtype-staging.yml', '.env.example']) assert.equal(classify([path]).high, true, path);
  assert.equal(classify(['app/product-ui.css']).risk, 'LOW');
  assert.equal(classify(['features/campaigns/campaign-studio.tsx']).risk, 'MEDIUM');
  assert.equal(classify(['AUTO_DEPLOYMENT.md']).deploy, false);
});

test('last deployed baseline retains a blocked migration across later UI commits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'intentbridge-policy-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' }).toString().trim();
  try {
    git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
    writeFileSync(join(dir, 'initial'), 'baseline'); git('add', '.'); git('commit', '-m', 'baseline'); const base = git('rev-parse', 'HEAD');
    mkdirSync(join(dir, 'prisma')); writeFileSync(join(dir, 'prisma/schema.prisma'), 'change'); git('add', '.'); git('commit', '-m', 'migration');
    writeFileSync(join(dir, 'ui.css'), 'body{}'); git('add', '.'); git('commit', '-m', 'ui'); const head = git('rev-parse', 'HEAD');
    assert.equal(classify(changedPaths(base, head, dir)).migration, true);
    assert.throws(() => changedPaths('', head, dir));
    assert.throws(() => changedPaths(head, base, dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('fingerprint ignores generated marker and local DB, normalizes CRLF, detects code changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'intentbridge-fingerprint-'));
  try {
    mkdirSync(join(dir, 'app')); mkdirSync(join(dir, 'public')); mkdirSync(join(dir, 'prisma'));
    writeFileSync(join(dir, 'app/page.tsx'), 'one\r\n'); const first = fingerprint(dir);
    writeFileSync(join(dir, 'app/page.tsx'), 'one\n');
    writeFileSync(join(dir, 'public/__deployment.json'), 'old marker'); writeFileSync(join(dir, 'prisma/test.db'), 'local database');
    assert.equal(fingerprint(dir), first);
    writeFileSync(join(dir, 'app/page.tsx'), 'two\n'); assert.notEqual(fingerprint(dir), first);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const revision = 'a'.repeat(64);
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
test('health waits through old build, then checks HTTP 200 and status ok', async () => {
  let calls = 0;
  await checkHealth('https://staging.example.invalid', revision, { attempts: 3, interval: 0, fetcher: async url => {
    calls++;
    return url.pathname === '/api/health' ? response({ status: 'ok' }) : response({ revision: calls === 1 ? 'old' : revision });
  }});
  assert.equal(calls, 3);
});
test('health fails for old revision, HTTP failure, malformed body and network failure', async () => {
  for (const fetcher of [async () => response({ revision: 'old' }), async () => response({}, 503), async () => new Response('bad JSON'), async () => { throw new Error('sensitive remote error'); }, async url => url.pathname === '/api/health' ? response({ status: 'bad' }) : response({ revision })]) {
    await assert.rejects(checkHealth('https://staging.example.invalid', revision, { fetcher, attempts: 1 }), /timed out/);
  }
  await assert.rejects(checkHealth('http://staging.example.invalid', revision), /Invalid/);
});

test('service preparation preserves Cloudtype secret references and pins tested commit', () => {
  const env = { CLOUDTYPE_TOKEN: 'fixture-only', CLOUDTYPE_PROJECT: 'space/intentbridge', CLOUDTYPE_STAGE: 'staging', CLOUDTYPE_ENDPOINT: 'https://app.example.invalid/api', STAGING_URL: 'https://staging.example.invalid', GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'dlsfhd3199-maker/intentbridge', SERVICE_JSON: JSON.stringify({ name: 'intentbridge', app: 'dockerfile', options: { ports: 3000, env: [{ name: 'APP_ENV', value: 'staging' }, { name: 'GA4_DATA_MODE', value: 'mock' }, { name: 'DATABASE_URL', value: 'IB_STAGING_DATABASE_URL' }, { name: 'AUTH_SECRET', value: 'IB_STAGING_AUTH_SECRET' }, { name: 'AUTH_URL', value: 'https://staging.example.invalid' }] } }) };
  const config = prepare(env);
  assert.equal(config.context.git.ref, env.GITHUB_SHA);
  assert.equal(config.context.git.url, 'git@github.com:dlsfhd3199-maker/intentbridge.git');
  assert.equal(config.options.ports, 3000);
  assert.throws(() => prepare({ ...env, CLOUDTYPE_STAGE: 'production' }));
  assert.throws(() => prepare({ ...env, SERVICE_JSON: env.SERVICE_JSON.replace('IB_STAGING_DATABASE_URL', 'postgresql://literal') }));
  assert.throws(() => prepare({ ...env, SERVICE_JSON: env.SERVICE_JSON.replace('mock', 'live') }));
});

test('workflow YAML gates deployment, serializes runs, permits main/manual and does not run migrations', () => {
  const require = createRequire(import.meta.url);
  const yaml = require('yaml');
  const text = readFileSync('.github/workflows/cloudtype-staging.yml', 'utf8');
  const workflow = yaml.parse(text);
  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.ok(workflow.on.workflow_dispatch);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.deepEqual(workflow.jobs.deploy.needs, ['policy', 'quality']);
  const commands = workflow.jobs.quality.steps.filter(s => s.run).map(s => s.run);
  assert.deepEqual(commands, ['npm ci', 'npm run db:generate', 'npm run typecheck', 'npm run lint', 'node --test tests/deployment.test.mjs', 'npm test', 'npm run build']);
  assert.equal(text.includes('continue-on-error'), false);
  assert.equal(/run:.*(?:migrate|db:seed|db:admin)/.test(text), false);
  assert.equal(workflow.jobs.deploy.steps.at(-1).name, 'Record last healthy deployment');
  assert.ok(Object.hasOwn(yaml.parse(readFileSync('.github/workflows/browser-e2e.yml', 'utf8')).on, 'workflow_dispatch'));
});
