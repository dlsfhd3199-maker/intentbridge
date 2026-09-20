// Findings contain locations/categories only. Never include matched values or raw git errors.
export function scanSecrets(path, text) {
  const found = [];
  if (/(^|\/)(?:\.env(?:\..*)?|credentials|secrets)(?:\/|$)|\.(?:pem|key|p12|pfx|db|sqlite|dump)$/i.test(path) && !/\.env\.example$/.test(path)) found.push({path, category:'SECRET_FILE'});
  const rules = [
    ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['PROVIDER_TOKEN', /(?:gh[pousr]_|github_pat_|sk_live_|sk-proj-|AKIA|AIza|xox[baprs]-)[A-Za-z0-9_-]{16,}/],
    ['DATABASE_CREDENTIAL', /(?:postgres(?:ql)?|mysql):\/\/[^\s:@]+:[^\s@]+@/],
    ['RESEND_TOKEN', /\bre_[A-Za-z0-9]{24,}\b/],
  ];
  text.split('\n').forEach((line,i)=>{
    for (const [category, re] of rules) if (re.test(line)) found.push({path,line:i+1,category});
    for (const m of line.matchAll(/(?:AUTH_SECRET|API_KEY|ACCESS_TOKEN|CLOUDTYPE_TOKEN|(?:INITIAL_ADMIN_)?PASSWORD)\s*[:=]\s*['"]([^'"]+)['"]/gi)) {
      if (m[1].length>=8 && !/^(?:fixture-only|test-only|placeholder|change-me|your[-_]|example|\$\{|<)/i.test(m[1])) found.push({path,line:i+1,category:'CREDENTIAL_LITERAL'});
    }
    for (const m of line.matchAll(/['"]([A-Za-z0-9+/=_-]{40,})['"]/g)) {
      const value=m[1], counts={}; for (const c of value) counts[c]=(counts[c]||0)+1;
      const entropy=Object.values(counts).reduce((sum,n)=>sum-n/value.length*Math.log2(n/value.length),0);
      if (entropy>4.7) found.push({path,line:i+1,category:'OPAQUE_SECRET_CANDIDATE'});
    }
  });
  return found;
}
