// Deliberately limited SQL allowlist, not a general SQL parser. Unknown syntax needs review.
const id = '(?:"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)';
const type = '(?:TEXT|BOOLEAN|INTEGER|INT|BIGINT|SMALLINT|SERIAL|BIGSERIAL|REAL|DOUBLE PRECISION|JSONB?|UUID|DATE|TIMESTAMP(?:\\(\\d+\\))?(?: WITHOUT TIME ZONE)?|VARCHAR\\(\\d+\\)|DECIMAL\\(\\d+,\\s*\\d+\\))';
const matches = (pattern, sql) => new RegExp(`^${pattern}$`, 'i').test(sql);
function definitions(body) {
  let depth = 0, start = 0; const parts = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    if (body[i] === ')') depth--;
    if (depth < 0) return [];
    if (body[i] === ',' && depth === 0) { parts.push(body.slice(start, i).trim()); start = i + 1; }
  }
  if (depth) return [];
  return [...parts, body.slice(start).trim()];
}
export function analyzeMigration(sql) {
  if (typeof sql !== 'string') return {state:'UNKNOWN', reason:'SQL unavailable'};
  // Only ordinary, closed comments; reject dollar quoting, strings, nested comments and escapes.
  const cleaned = sql.replace(/\/\*[^]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ').trim();
  const destructive = /\b(DROP|TRUNCATE|DELETE|UPDATE|RENAME)\b/i.test(cleaned);
  if (/['$\\]|\/\*|\*\//.test(cleaned)) return {state:destructive?'BLOCKED':'UNKNOWN', reason:'Unsupported SQL syntax'};
  const statements = cleaned.split(';').map(s=>s.trim()).filter(Boolean);
  if (!statements.length) return {state:'UNKNOWN', reason:'Empty SQL'};
  let unknown = false, destructiveKnown = false;
  for (const s of statements) {
    if (/^(BEGIN|COMMIT)$/i.test(s)) continue;
    if (matches(`ALTER TABLE ${id} ADD COLUMN ${id} (?!SERIAL\\b|BIGSERIAL\\b)${type}(?: NULL)?`, s)) continue;
    if (matches(`CREATE INDEX ${id} ON ${id} \\(${id}(?:,\\s*${id})*\\)`, s)) continue;
    const table = s.match(new RegExp(`^CREATE TABLE ${id} \\(([^]*)\\)$`, 'i'));
    if (table) {
      const parts = definitions(table[1]);
      if (parts.length && parts.every(p=>matches(`${id} ${type}(?: NOT NULL| NULL)?(?: PRIMARY KEY| UNIQUE)?`,p)||matches(`(?:CONSTRAINT ${id} )?PRIMARY KEY \\(${id}(?:,\\s*${id})*\\)`,p))) continue;
    }
    if (matches(`ALTER TABLE ${id} DROP COLUMN ${id}(?: CASCADE| RESTRICT)?`,s)||matches(`DROP TABLE ${id}(?: CASCADE| RESTRICT)?`,s)||matches(`TRUNCATE(?: TABLE)? ${id}`,s)||matches(`DELETE FROM ${id}`,s)) { destructiveKnown=true; continue; }
    if (matches(`ALTER TABLE ${id} RENAME(?: COLUMN ${id})? TO ${id}`,s)||matches(`UPDATE ${id} SET ${id} = (?:NULL|\\d+)`,s)) { destructiveKnown=true; continue; }
    unknown = true;
  }
  if (unknown && destructive) return {state:'BLOCKED', reason:'Unanalyzed SQL contains destructive operation'};
  if (destructiveKnown) return {state:'DESTRUCTIVE', reason:'Destructive SQL requires review'};
  if (unknown) return {state:'UNKNOWN', reason:'Outside additive SQL allowlist (including NOT NULL / rename / DML)'};
  return {state:'NON_DESTRUCTIVE', reason:'Only new tables, nullable columns or ordinary indexes'};
}
