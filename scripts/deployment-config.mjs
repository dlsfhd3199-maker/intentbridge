import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fingerprint } from './deployment-fingerprint.mjs';

export function prepare(env) {
  if (!env.CLOUDTYPE_TOKEN || !/^@?[a-zA-Z0-9_-]+\/intentbridge$/.test(env.CLOUDTYPE_PROJECT || '') || !/^[a-zA-Z0-9_-]+$/.test(env.CLOUDTYPE_STAGE || '') || /^(prod|production)$/i.test(env.CLOUDTYPE_STAGE)) throw new Error('Missing staging configuration');
  for (const name of ['CLOUDTYPE_ENDPOINT', 'STAGING_URL']) {
    const url = new URL(env[name]);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid HTTPS configuration');
  }
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '') || env.GITHUB_REPOSITORY !== 'dlsfhd3199-maker/intentbridge') throw new Error('Unexpected repository');
  const config = JSON.parse(env.SERVICE_JSON);
  if (config.name !== 'intentbridge' || config.app !== 'dockerfile' || !Array.isArray(config.options?.env)) throw new Error('Export the existing Dockerfile service configuration');
  const variables = new Map(config.options.env.map(item => [item.name, item.value]));
  for (const [name, value] of variables) {
    if (/(SECRET|TOKEN|PASSWORD|DATABASE_URL|API_KEY|AUTH_RESEND_KEY|INITIAL_ADMIN_EMAIL)/i.test(name) && !/^IB_STAGING_[A-Z0-9_]+$/.test(value)) throw new Error('Use Cloudtype project secret names, never literal secrets');
  }
  if (variables.get('APP_ENV') !== 'staging' || variables.get('GA4_DATA_MODE') !== 'mock') throw new Error('Staging and mock modes are required');
  // Secret values must be Cloudtype project secret references, copied from the service export.
  // Their syntax belongs to Cloudtype and is not interpreted here.
  for (const name of ['DATABASE_URL', 'AUTH_SECRET', 'AUTH_URL']) if (!variables.get(name)) throw new Error('Missing runtime environment reference');
  config.context = { ...config.context, git: { url: `git@github.com:${env.GITHUB_REPOSITORY}.git`, ref: env.GITHUB_SHA } };
  return config;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = prepare(process.env);
    mkdirSync('.validation', { recursive: true });
    writeFileSync('.validation/cloudtype-staging.json', JSON.stringify(config));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `revision=${fingerprint()}\n`);
    console.log('Staging configuration validated; deploying the tested commit.');
  } catch {
    console.error('Invalid staging configuration. Check AUTO_DEPLOYMENT.md; values are intentionally not logged.');
    process.exitCode = 1;
  }
}
