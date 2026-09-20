import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { classify, changedPaths, changedContent, scanHistory, deploymentAllowed, verifyRepository } from '../scripts/deployment-policy.mjs';
import { analyzeMigration } from '../scripts/deployment-migration.mjs';
import { scanSecrets } from '../scripts/deployment-secrets.mjs';
import { fingerprint } from '../scripts/deployment-fingerprint.mjs';
import { checkHealth } from '../scripts/deployment-health.mjs';
import { prepare } from '../scripts/deployment-config.mjs';

test('policy narrows review to migration uncertainty, security, env and infrastructure', () => {
  for (const path of ['prisma/migrations/old/migration.sql', 'prisma/postgresql/schema.prisma', 'auth.ts', '.github/workflows/cloudtype-staging.yml', '.env.example']) assert.equal(classify([path]).decision, 'MANUAL_REVIEW', path);
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
  assert.deepEqual(prepare({...env, SERVICE_JSON:'invalid', CLOUDTYPE_ENDPOINT:'invalid', DATABASE_URL:'fixture-only-not-copied', INITIAL_ADMIN_PASSWORD:'fixture-only-not-copied'}), config);
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
  assert.deepEqual(commands.slice(0,9), ['npm ci', 'npm run db:generate', 'npm run typecheck', 'npm run lint', 'node --test tests/deployment.test.mjs', 'npm test', 'npm run build', 'npx playwright install --with-deps chromium', 'npm run test:ui']);
  assert.ok(workflow.jobs.policy.steps.some(s=>s.run==='node scripts/deployment-policy.mjs'));
  assert.equal(workflow.jobs.quality.steps.at(-1).if,'failure()');
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

for(const [label,path] of Object.entries({UI:'app/product-ui.css',PublicWebsite:'features/public/product-preview.tsx',PublicRoute:'app/about/page.tsx',ReadAPI:'app/api/reports/route.ts',CreateUpdateAPI:'app/api/workspaces/[id]/platform/route.ts',DemoConnector:'lib/connectors/mock.ts',ReportExport:'lib/executive-export.ts',BusinessLogic:'lib/campaign-forecast.ts',Notification:'features/platform/platform-toolbar.tsx'}))test(`${label} is AUTO, not gated by API/lib location`,()=>assert.equal(classify([path]).decision,'AUTO'));
for(const path of ['auth.ts','lib/password.ts','lib/permissions.ts','lib/tenant-isolation.ts','proxy.ts','.env.example','Dockerfile','.github/workflows/cloudtype-staging.yml','AGENTS.md','scripts/deployment-policy.mjs'])test(`${path} requires manual review`,()=>assert.equal(classify([path]).decision,'MANUAL_REVIEW'));
const migration=(sql,status='A')=>({path:'prisma/postgresql/migrations/20990101_test/migration.sql',after:sql,status});
test('new tables, nullable columns and indexes are analyzed, with closed allowlist',()=>{
 for(const sql of ['ALTER TABLE "Campaign" ADD COLUMN "note" TEXT;', 'CREATE INDEX "campaign_name" ON "Campaign" ("name");','CREATE TABLE "NewMetric" ("id" SERIAL NOT NULL, "value" INTEGER, CONSTRAINT "new_pk" PRIMARY KEY ("id"));','-- explanation\nBEGIN; ALTER TABLE "Campaign" ADD COLUMN "note" VARCHAR(100) NULL; COMMIT;']){
  assert.equal(analyzeMigration(sql).state,'NON_DESTRUCTIVE',sql);assert.equal(classify([migration(sql)]).decision,'AUTO');
 }
 for(const sql of ['ALTER TABLE "Campaign" ADD COLUMN "note" TEXT NOT NULL;', 'CREATE UNIQUE INDEX "x" ON "Campaign" ("name");','SELECT unknown_function();','', '/* unfinished'])assert.equal(classify([migration(sql)]).decision,'MANUAL_REVIEW');
 for(const sql of ['ALTER TABLE "Campaign" DROP COLUMN "name";', 'DROP TABLE "Campaign";', 'TRUNCATE "Campaign";', 'DELETE FROM "Campaign";', 'ALTER TABLE "Campaign" RENAME COLUMN "name" TO "title";', 'UPDATE "Campaign" SET "budget" = 0;'])assert.equal(classify([migration(sql)]).decision,'MANUAL_REVIEW',sql);
 for(const sql of ['SELECT unsafe(); DROP TABLE "Campaign";', 'DO $$ BEGIN DROP TABLE "Campaign"; END $$;'])assert.equal(classify([migration(sql)]).decision,'BLOCKED');
 assert.equal(classify([migration('CREATE TABLE "NewMetric" ("id" INTEGER);','M')]).decision,'MANUAL_REVIEW');
 assert.equal(classify([migration('ALTER TABLE "User" ADD COLUMN "note" TEXT;')]).decision,'MANUAL_REVIEW');
});
test('schema additions need additive SQL; removed/required fields and membership are reviewed',()=>{
 const before='model Campaign {\n id String\n}\n',sql=migration('ALTER TABLE "Campaign" ADD COLUMN "note" TEXT;');
 const schema={path:'prisma/postgresql/schema.prisma',before,after:'model Campaign {\n id String\n note String?\n}\n'};
 assert.equal(classify([schema,sql]).decision,'AUTO');
 assert.equal(classify([schema]).decision,'MANUAL_REVIEW');
 assert.equal(classify([{...schema,after:'model Campaign {\n note String?\n}\n'},sql]).decision,'MANUAL_REVIEW');
 assert.equal(classify([{...schema,after:'model Campaign {\n id String\n note String\n}\n'},sql]).decision,'MANUAL_REVIEW');
 assert.equal(classify([{...schema,before:'model User {\n id String\n}',after:'model User {\n id String\n note String?\n}'},sql]).decision,'MANUAL_REVIEW');
});
test('tenant-safe API edits keep guard signatures; edits removing scope require review',()=>{
 const before='const {advertiser}=await requireAdvertiserAccess(id); await db.campaign.create({data:{name:"old",advertiserId:advertiser.id}});';
 const after=before.replace('"old"','"new"');
 const safe={path:'app/api/campaigns/route.ts',before,after,removed:before,added:after};
 assert.equal(classify([safe]).decision,'AUTO');
 assert.equal(classify([{...safe,after:after.replace('await requireAdvertiserAccess(id)','{}')}]).decision,'MANUAL_REVIEW');
 assert.equal(classify([{...safe,after:after.replace('advertiserId:advertiser.id','advertiserId:input.id')}]).decision,'MANUAL_REVIEW');
 assert.equal(classify([{path:'lib/store.ts',added:'db.campaign.deleteMany({});'}]).decision,'MANUAL_REVIEW');
});
test('secret detection redacts values; failures and BLOCKED cannot be approved',()=>{
 const secret='gh'+'p_'+'x'.repeat(36),findings=scanSecrets('src/file.ts',`const value="${secret}"`);
 assert.equal(findings.length,1);assert.ok(!JSON.stringify(findings).includes(secret));
 for(const text of ['-----BEGIN '+'PRIVATE KEY-----','const DATABASE_URL="postgresql'+ '://user:password@db.invalid/db"','const AUTH_SECRET="'+'RandomActualSecret0123456789'+'"'])assert.ok(scanSecrets('file.ts',text).length);
 assert.ok(scanSecrets('.env','').length);
 assert.equal(scanSecrets('.env.example','AUTH_SECRET=\nDATABASE_URL=\n').length,0);
 const sha='a'.repeat(40);
 for(const result of [classify(['app/page.tsx'],{secretFindings:findings}),classify([],{checks:{unit:false}}),classify([],{checks:{tenantIsolation:false}}),classify([],{checks:{build:false}})]){
  assert.equal(result.decision,'BLOCKED');assert.equal(deploymentAllowed(result,{sha,reviewedSha:sha,manualRun:true}),false);
 }
 const manual=classify(['auth.ts']);assert.equal(deploymentAllowed(manual,{sha,reviewedSha:sha}),false);assert.equal(deploymentAllowed(manual,{sha,reviewedSha:'b'.repeat(40),manualRun:true}),false);assert.equal(deploymentAllowed(manual,{sha,reviewedSha:sha,manualRun:true}),true);
 assert.equal(deploymentAllowed(classify(['app/page.tsx'])),true);
});
test('history scan blocks a secret removed by a later commit; wrong origin and rewritten history blocked',()=>{
 const dir=mkdtempSync(join(tmpdir(),'intentbridge-policy-history-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'}).toString().trim();
 try{
  git('init');git('config','user.email','test@example.invalid');git('config','user.name','Test');
  git('remote','add','origin','https://github.com/dlsfhd3199-maker/intentbridge.git');verifyRepository(dir);
  writeFileSync(join(dir,'file.ts'),'baseline');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
  writeFileSync(join(dir,'file.ts'),'const key="gh'+'p_'+'x'.repeat(36)+'"');git('add','.');git('commit','-m','unsafe');
  writeFileSync(join(dir,'file.ts'),'safe now');git('add','.');git('commit','-m','remove');const head=git('rev-parse','HEAD');
  assert.equal(changedContent(base,head,dir)[0].before,'baseline');assert.equal(scanHistory(base,head,dir).length,1);
  assert.throws(()=>changedPaths(head,base,dir));
  git('remote','set-url','origin','https://github.com/other/repo.git');assert.throws(()=>verifyRepository(dir));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('CLI AUTO/manual/BLOCKED decisions enforce reviewed_sha and safe outputs end to end',()=>{
 const dir=mkdtempSync(join(tmpdir(),'intentbridge-policy-cli-')),cli=resolve('scripts/deployment-policy.mjs');
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'}).toString().trim();
 try{
  git('init');git('config','user.email','test@example.invalid');git('config','user.name','Test');git('remote','add','origin','https://github.com/dlsfhd3199-maker/intentbridge.git');
  writeFileSync(join(dir,'base'),'base');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
  const output=join(dir,'out'),summary=join(dir,'summary');
  const run=(sha,manual=false)=>{writeFileSync(output,'');return spawnSync(process.execPath,[cli],{cwd:dir,encoding:'utf8',env:{...process.env,GITHUB_REPOSITORY:'dlsfhd3199-maker/intentbridge',BASELINE_SHA:base,GITHUB_SHA:sha,REVIEWED_SHA:manual?sha:'',MANUAL_RUN:String(manual),GITHUB_OUTPUT:output,GITHUB_STEP_SUMMARY:summary}})};
  mkdirSync(join(dir,'app'));writeFileSync(join(dir,'app/page.tsx'),'public page');git('add','app');git('commit','-m','page');let head=git('rev-parse','HEAD');
  assert.equal(run(head).status,0);assert.match(readFileSync(output,'utf8'),/decision=AUTO\ndeploy=true/);
  writeFileSync(join(dir,'auth.ts'),'auth change');git('add','auth.ts');git('commit','-m','auth');head=git('rev-parse','HEAD');assert.equal(run(head).status,1);assert.match(readFileSync(output,'utf8'),/deploy=false/);assert.equal(run(head,true).status,0);
  writeFileSync(join(dir,'.env'),'fixture-only');git('add','.env');git('commit','-m','unsafe file');head=git('rev-parse','HEAD');const denied=run(head,true);assert.equal(denied.status,1);assert.match(readFileSync(output,'utf8'),/decision=BLOCKED\ndeploy=false/);assert.ok(!denied.stdout.includes('fixture-only'));
 }finally{rmSync(dir,{recursive:true,force:true});}
 assert.equal(analyzeMigration('ALTER TABLE "Campaign" ADD COLUMN "n" SERIAL;').state,'UNKNOWN');
});
