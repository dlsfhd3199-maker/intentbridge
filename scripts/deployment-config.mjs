import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fingerprint } from './deployment-fingerprint.mjs';

export const secretNames = ['DATABASE_URL', 'AUTH_SECRET', 'AUTH_URL', 'RESEND_API_KEY', 'AUTH_EMAIL_FROM', 'INITIAL_ADMIN_EMAIL', 'INITIAL_ADMIN_PASSWORD'];
export function prepare(env) {
  // Target the existing service only. GitHub's staging environment is separate from Cloudtype's main stage.
  if (!env.CLOUDTYPE_TOKEN) throw new Error('CLOUDTYPE_TOKEN is missing');
  if (env.CLOUDTYPE_PROJECT !== 'progressmedia/intentbridge') throw new Error('CLOUDTYPE_PROJECT must target the existing project');
  if (env.CLOUDTYPE_STAGE !== 'main') throw new Error('CLOUDTYPE_STAGE must target the existing main stage');
  let url;
  try { url = new URL(env.STAGING_URL); } catch { throw new Error('STAGING_URL must be an HTTPS origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('STAGING_URL must be an HTTPS origin');
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || env.GITHUB_REPOSITORY !== 'dlsfhd3199-maker/intentbridge') throw new Error('Unexpected repository or commit');
  return {
    name: 'intentbridge',
    app: 'dockerfile',
    options: {
      ports: '3000', dockerfile: 'Dockerfile', healthz: '/api/health',
      env: [
        ...Object.entries({ APP_ENV: 'staging', NODE_ENV: 'production', PORT: '3000', GA4_DATA_MODE: 'mock', RATE_LIMIT_STORE: 'database' }).map(([name, value]) => ({ name, value })),
        // Cloudtype resolves these stage-scoped references. Never fetch or copy secret values into CI.
        ...secretNames.map(name => ({ name, secret: name })),
      ],
    },
    context: { git: { url: `git@github.com:${env.GITHUB_REPOSITORY}.git`, ref: env.GITHUB_SHA } },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = prepare(process.env);
    mkdirSync('.validation', { recursive: true });
    writeFileSync('.validation/cloudtype-staging.json', JSON.stringify(config));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `revision=${fingerprint()}\n`);
    console.log('Existing intentbridge service template validated; runtime secrets stay in Cloudtype main.');
  } catch (error) {
    // Only fixed validation messages are permitted; unexpected filesystem errors may contain paths/data.
    const safe = new Set(['CLOUDTYPE_TOKEN is missing', 'CLOUDTYPE_PROJECT must target the existing project', 'CLOUDTYPE_STAGE must target the existing main stage', 'STAGING_URL must be an HTTPS origin', 'Unexpected repository or commit']);
    console.error(safe.has(error?.message) ? error.message : 'Deployment configuration preparation failed. Check AUTO_DEPLOYMENT.md.');
    process.exitCode = 1;
  }
}
