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

test('minimal variables generate only the existing service with Cloudtype secret references', () => {
  const env = { CLOUDTYPE_TOKEN: 'fixture-only', CLOUDTYPE_PROJECT: 'progressmedia/intentbridge', CLOUDTYPE_STAGE: 'main', STAGING_URL: 'https://staging.example.invalid', GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'dlsfhd3199-maker/intentbridge' };
  const config = prepare(env);
  assert.equal(config.name, 'intentbridge');
  assert.equal(config.app, 'dockerfile');
  assert.equal(config.context.git.ref, env.GITHUB_SHA);
  assert.equal(config.context.git.url, 'git@github.com:dlsfhd3199-maker/intentbridge.git');
  assert.equal(config.options.ports, '3000');
  assert.equal(config.options.dockerfile, 'Dockerfile');
  assert.equal(config.options.healthz, '/api/health');
  const variables = new Map(config.options.env.map(item => [item.name, item]));
  for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'AUTH_URL', 'RESEND_API_KEY', 'AUTH_EMAIL_FROM', 'INITIAL_ADMIN_EMAIL', 'INITIAL_ADMIN_PASSWORD']) {
    assert.deepEqual(variables.get(name), {name, secret: name});
  }
  assert.equal(variables.size, 12);
  assert.equal(variables.get('APP_ENV').value, 'staging');
  assert.equal(variables.get('GA4_DATA_MODE').value, 'mock');
  assert.equal(variables.get('RATE_LIMIT_STORE').value, 'database');
  assert.equal(JSON.stringify(config).includes(env.CLOUDTYPE_TOKEN), false);
  assert.equal(Object.hasOwn(config, 'resources'), false);
  for (const change of [{CLOUDTYPE_STAGE:'production'}, {CLOUDTYPE_STAGE:'staging'}, {CLOUDTYPE_PROJECT:'other/intentbridge'}, {CLOUDTYPE_TOKEN:''}, {STAGING_URL:'https://staging.example.invalid/api/health'}, {STAGING_URL:'http://staging.example.invalid'}, {STAGING_URL:'https://user:password@example.invalid'}, {GITHUB_SHA:'main'}]) assert.throws(() => prepare({...env, ...change}));
  // Obsolete inputs and accidental runtime secrets are neither consumed nor copied.
  assert.deepEqual(prepare({...env, SERVICE_JSON:'invalid', CLOUDTYPE_ENDPOINT:'invalid', DATABASE_URL:'must-not-copy', INITIAL_ADMIN_PASSWORD:'must-not-copy'}), config);
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
  assert.equal(text.includes('CLOUDTYPE_ENDPOINT'), false);
  assert.equal(text.includes('CLOUDTYPE_SERVICE_JSON'), false);
  const deployAction = workflow.jobs.deploy.steps.find(step => step.name === 'Deploy (official Cloudtype action)');
  assert.equal(Object.hasOwn(deployAction.with, 'endpoint'), false);
  assert.equal(deployAction.with.allstages, 'false');
  assert.equal(/run:.*(?:migrate|db:seed|db:admin)/.test(text), false);
  assert.equal(workflow.jobs.deploy.steps.at(-1).name, 'Record last healthy deployment');
  assert.ok(Object.hasOwn(yaml.parse(readFileSync('.github/workflows/browser-e2e.yml', 'utf8')).on, 'workflow_dispatch'));
});
