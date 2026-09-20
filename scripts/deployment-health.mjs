import { pathToFileURL } from 'node:url';
export async function checkHealth(origin, revision, { fetcher = fetch, attempts = 90, interval = 10000, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !/^[a-f0-9]{64}$/.test(revision)) throw new Error('Invalid staging origin or revision');
  for (let i = 0; i < attempts; i++) {
    try {
      const options = { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Cache-Control': 'no-cache' } };
      const marker = await fetcher(new URL(`/__deployment.json?check=${Date.now()}-${i}`, url), options);
      if (marker.status === 200 && (await marker.json()).revision === revision) {
        const health = await fetcher(new URL('/api/health', url), { ...options, signal: AbortSignal.timeout(5000) });
        if (health.status === 200 && (await health.json()).status === 'ok') return;
      }
    } catch { /* Never log response bodies, headers, credentials, or error objects. */ }
    if (i + 1 < attempts) await sleep(interval);
  }
  throw new Error('Staging health timed out: expected build revision and HTTP 200 were not confirmed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkHealth(process.env.STAGING_URL, process.env.EXPECTED_REVISION).then(() => console.log('Health passed: expected build revision, /api/health HTTP 200, status ok.')).catch(() => { console.error('Health failed: new build not healthy within timeout. Check Cloudtype build/runtime logs.'); process.exitCode = 1; });
}
