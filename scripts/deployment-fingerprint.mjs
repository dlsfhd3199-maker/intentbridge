import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Only runtime/build inputs; identical in a checkout and Docker's filtered context.
export const inputs = ['app', 'components', 'context', 'data', 'features', 'lib', 'mock', 'types', 'prisma', 'public', 'scripts', 'Dockerfile', '.dockerignore', 'instrumentation.ts', 'auth.ts', 'proxy.ts', 'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'postcss.config.js'];
export function fingerprint(root = '.') {
  const files = [];
  function visit(relative) {
    if (!existsSync(join(root, relative))) return;
    if (relative === 'public/__deployment.json' || /\.(db|sqlite|sqlite3)(-|$)|\.md$|\.log$/i.test(relative)) return;
    const entries = readdirSync(join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile() && !/\.(db|sqlite|sqlite3)(-|$)|\.md$|\.log$/i.test(name) && name !== 'public/__deployment.json') files.push(name);
    }
  }
  for (const input of inputs) {
    if (!existsSync(join(root, input))) continue;
    if (input.includes('.') || input === 'Dockerfile') files.push(input); else visit(input);
  }
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    const buffer = readFileSync(join(root, file));
    const content = /\.(json|[cm]?[jt]sx?|css|prisma|sql|toml|svg|html)$/.test(file) || ['Dockerfile', '.dockerignore'].includes(file) ? Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n')) : buffer;
    hash.update(`${file}\0${content.length}\0`).update(content);
  }
  return hash.digest('hex');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const revision = fingerprint();
  if (process.argv.includes('--write')) {
    mkdirSync('public', { recursive: true });
    writeFileSync('public/__deployment.json', JSON.stringify({ revision }));
  } else console.log(revision);
}
