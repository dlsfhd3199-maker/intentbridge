import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { analyzeMigration } from './deployment-migration.mjs';
import { scanSecrets } from './deployment-secrets.mjs';

const repository='dlsfhd3199-maker/intentbridge';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024}).toString();
const securityModels=/\b(?:User|Session|Account|VerificationToken|Invitation|AdvertiserMember|Membership)\b/;
const coreAuth=/^(?:auth\.ts|proxy\.ts|middleware\.ts|types\/auth\.ts|lib\/(?:password|auth-diagnostics|security-headers)\.ts|lib\/server\/(?:auth-trace|legacy-email-adapter|page-access|request-protection|rate-limit)\.ts|scripts\/(?:create-admin|initialize-password)\.ts|app\/api\/auth\/.*)$/;
const coreAuthorization=/^(?:lib\/(?:permissions|route-permissions|runtime-scope)\.ts|lib\/server\/(?:authorization|admin-repository)\.ts|context\/user-role-context\.tsx|app\/api\/admin\/(?:users|advertisers)\/.*)$/;
const infrastructure=/^(?:\.github\/|\.cloudtype\/|Dockerfile(?:\..*)?$|\.dockerignore$|AGENTS\.md$|AUTO_DEPLOYMENT\.md$|CLOUDTYPE_DEPLOYMENT\.md$|scripts\/deployment-|package(?:-lock)?\.json$|next\.config\.|playwright\.config\.|eslint|tsconfig|postcss|instrumentation\.ts$)/;
const environment=/^(?:\.env|lib\/server\/(?:env|database)\.ts$|lib\/ga4\/config\.ts$|scripts\/check-env\.ts$)/;

// A content signal is a reason to review, never proof that arbitrary code is secure.
export function classify(input, {secretFindings=[], checks={}}={}) {
  const changes=input.map(c=>typeof c==='string'?{path:c}:c);
  const reasons=[], migrations=[];
  const review=(category,path,detail)=>reasons.push({category,path,detail});
  let blocked=secretFindings.length>0||Object.values(checks).some(v=>v!==true);
  for(const c of changes){
    const {path}=c, changed=(c.added??'')+'\n'+(c.removed??'');
    const signatureChanged=re=>JSON.stringify((c.before??'').match(re)??[])!==JSON.stringify((c.after??'').match(re)??[]);
    if(coreAuth.test(path)) review('AUTHENTICATION',path,'Core authentication / guard');
    else if(coreAuthorization.test(path)||!/^tests\//.test(path)&&/(?:^|\/)[^/]*(?:permission|authorization|tenant|membership)[^/]*\.[cm]?[jt]sx?$/.test(path)) review('AUTHORIZATION_TENANT',path,'Permission / membership boundary');
    else if(environment.test(path)) review('SECRET_ENVIRONMENT',path,'Environment structure');
    else if(infrastructure.test(path)) review('DEPLOYMENT_INFRASTRUCTURE',path,'Deployment / build / Git rules');
    if(/^tests\//.test(path)&&/(?:security|permission|agency-roles|auth|deployment|foundation)/.test(path))review('DEPLOYMENT_INFRASTRUCTURE',path,'Security gate regression coverage');
    if(!/^(?:tests|reference|spec)\//.test(path)&&!/\.md$/.test(path)){
      if(/process\.env|\b(?:DATABASE_URL|AUTH_SECRET|RESEND_API_KEY)\b/.test(changed)) review('SECRET_ENVIRONMENT',path,'Environment reference changed');
      if(signatureChanged(/\b(?:signIn|signOut|hashPassword|verifyPassword|createSession|deleteSession)\s*\([^;]*?\)|\b(?:sessionToken|passwordHash)\s*[:=][^,;}]+/g)) review('AUTHENTICATION',path,'Authentication behavior changed');
      if(signatureChanged(/\b(?:canAccessAdvertiser|canAccessRoute|roleFromDatabase)\s*\([^;]*?\)|\.advertiserMember\s*\.\w+|\.members\s*\.\w+|\brole\s*(?:===?|!==?)\s*["'][^"']+["']/g)) review('AUTHORIZATION_TENANT',path,'Role / membership behavior changed');
      // Newly added protected APIs may use the existing guards. Removing/changing them needs review.
      if(c.before&&signatureChanged(/\b(?:requireUser|requireRole|requirePermission|requireAdvertiserAccess|requirePage|sameOrigin|can|AccessError)\s*\([^;]*?\)|(?:advertiserId|userId)\s*:[^,;}]+/g)) review('AUTHORIZATION_TENANT',path,'Guard or tenant scope edited');
      if(/\.(?:deleteMany|updateMany)\s*\(|\b(?:TRUNCATE|DROP TABLE|DROP COLUMN|DELETE FROM)\b|(?:migrate|db)\s+(?:reset|push.*--force-reset)/i.test(changed)) review('DESTRUCTIVE_DATABASE',path,'Bulk deletion / reset signal');
    }
    if(/(?:^|\/)migrations\/.*\/migration\.sql$/.test(path)){
      const parsed=analyzeMigration(c.after);
      const analysis=c.status==='A'||parsed.state==='BLOCKED'?parsed:{state:'UNKNOWN',reason:'Existing migration edited, removed, or SQL unavailable'};
      migrations.push({path,...analysis});
      if(analysis.state==='BLOCKED') blocked=true;
      if(analysis.state!=='NON_DESTRUCTIVE') review('DESTRUCTIVE_DATABASE',path,analysis.reason);
      if(securityModels.test((c.before??'')+'\n'+(c.after??''))) review('AUTHORIZATION_TENANT',path,'Authentication / membership table migration');
    }else if(/^prisma\//.test(path)){
      if(/schema\.prisma$/.test(path)){
        const old=c.before??'',next=c.after??'';
        const blocks=s=>[...s.matchAll(/\b(model|enum|datasource|generator)\s+(\w+)\s*\{([^]*?)\}/g)].map(m=>({kind:m[1],name:m[2],body:m[3]}));
        const a=blocks(old), b=blocks(next);
        if([...a,...b].some(m=>securityModels.test(m.name)&&a.find(x=>x.name===m.name)?.body!==b.find(x=>x.name===m.name)?.body))review('AUTHORIZATION_TENANT',path,'Security schema changed');
        if(a.filter(x=>['datasource','generator'].includes(x.kind)).map(x=>x.body).join()!==b.filter(x=>['datasource','generator'].includes(x.kind)).map(x=>x.body).join())review('SECRET_ENVIRONMENT',path,'Database / client configuration changed');
        for(const model of a.filter(x=>x.kind==='model'&&!securityModels.test(x.name))){
          const target=b.find(x=>x.kind==='model'&&x.name===model.name);
          const lines=v=>v.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('//'));
          if(!target||lines(model.body).some(l=>!lines(target.body).includes(l))||lines(target.body).filter(l=>!lines(model.body).includes(l)).some(l=>!/^\w+\s+\w+\?(?:\s|$)|^@@index\(/.test(l)))review('DESTRUCTIVE_DATABASE',path,'Existing model removed/altered or non-null field added');
        }
        const sql=changes.filter(x=>/migration\.sql$/.test(x.path));
        if(!old||!next||!sql.length||sql.some(x=>x.status!=='A'||analyzeMigration(x.after).state!=='NON_DESTRUCTIVE'))review('DESTRUCTIVE_DATABASE',path,'Schema change without verified additive migration');
      }else review('DESTRUCTIVE_DATABASE',path,'Unanalyzed Prisma configuration');
    }
  }
  const decision=blocked?'BLOCKED':reasons.length?'MANUAL_REVIEW':'AUTO';
  return {decision,reasons,secretFindings,migrations,migration:changes.some(c=>/^prisma\//.test(c.path)),deploy:changes.some(c=>!(/\.md$|^reference\/|^spec\//i.test(c.path))),risk:decision==='AUTO'?(changes.some(c=>/^(lib|features|data|app\/api)\//.test(c.path))?'MEDIUM':'LOW'):'HIGH'};
}
export function changedPaths(base,head,cwd='.'){
  if(![base,head].every(v=>/^[a-f0-9]{40}$/.test(v??'')))throw Error('Invalid commit');
  git(cwd,'merge-base','--is-ancestor',base,head);
  return git(cwd,'diff','--no-renames','--name-only','-z',base,head).split('\0').filter(Boolean);
}
export function changedContent(base,head,cwd='.'){
  return changedPaths(base,head,cwd).map(path=>{
    const read=ref=>{try{return git(cwd,'show',`${ref}:${path}`)}catch{return null}};
    const before=read(base),after=read(head);
    const lines=git(cwd,'diff','--no-ext-diff','--no-renames','--unified=0',base,head,'--',path).split('\n');
    return {path,before,after,status:before===null?'A':after===null?'D':'M',added:lines.filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1)).join('\n'),removed:lines.filter(l=>l.startsWith('-')&&!l.startsWith('---')).map(l=>l.slice(1)).join('\n')};
  });
}
export function scanHistory(base,head,cwd='.'){
  changedPaths(base,head,cwd);
  const findings=[];
  // Inspect every introduced commit, including intermediate secrets later removed and merge results.
  for(const commit of git(cwd,'rev-list',`${base}..${head}`).trim().split('\n').filter(Boolean)){
    const parents=git(cwd,'show','-s','--format=%P',commit).trim().split(' ').filter(Boolean);
    if(!parents.length){
      for(const path of git(cwd,'ls-tree','-r','--name-only','-z',commit).split('\0').filter(Boolean))findings.push(...scanSecrets(path,git(cwd,'show',`${commit}:${path}`)).map(f=>({...f,commit})));
    }
    for(const parent of parents){
      const paths=git(cwd,'diff','--no-renames','--name-only','--diff-filter=ACM','-z',parent,commit).split('\0').filter(Boolean);
      for(const path of paths) findings.push(...scanSecrets(path,git(cwd,'show',`${commit}:${path}`)).map(f=>({...f,commit})));
    }
  }
  return findings;
}
export function deploymentAllowed(result,{reviewedSha,sha,manualRun=false}={}){
  return result.decision!=='BLOCKED'&&(result.decision==='AUTO'||manualRun&&/^[a-f0-9]{40}$/.test(sha??'')&&reviewedSha===sha);
}
export function verifyRepository(cwd='.',name=repository){
  if(name!==repository)throw Error('Unexpected repository');
  for(const args of [['remote','get-url','--all','origin'],['remote','get-url','--push','--all','origin']]){
    if(!git(cwd,...args).trim().split('\n').every(url=>/^(?:https:\/\/github\.com\/|git@github\.com:)dlsfhd3199-maker\/intentbridge(?:\.git)?$/.test(url)))throw Error('Unexpected origin');
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    verifyRepository('.',process.env.GITHUB_REPOSITORY);
    const base=process.env.BASELINE_SHA,sha=process.env.GITHUB_SHA;
    const result=classify(changedContent(base,sha),{secretFindings:scanHistory(base,sha)});
    const allowed=deploymentAllowed(result,{reviewedSha:process.env.REVIEWED_SHA,sha,manualRun:process.env.MANUAL_RUN==='true'});
    const lines=[`Policy: ${result.decision} (${result.risk})`,...result.reasons.map(r=>`${r.category}: ${r.path} — ${r.detail}`),...result.secretFindings.map(f=>`BLOCKED: ${f.category} in ${f.path} (value withheld)`),...result.migrations.map(m=>`Migration: ${m.state} — ${m.path}`),...(result.migration?['DB migration detection retained. This workflow does not execute Staging migrations; prepare compatible DB changes separately.']:[]),`Deployment review: ${allowed?'passed':result.decision==='BLOCKED'?'BLOCKED; approval cannot override':'required; manually dispatch with reviewed_sha'}`];
    console.log(lines.join('\n'));
    if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n\n')+'\n');
    if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`decision=${result.decision}\ndeploy=${allowed&&(result.deploy||process.env.MANUAL_RUN==='true')}\nallowed=${allowed}\n`);
    if(!allowed)process.exitCode=1;
  }catch{
    console.error('Policy: BLOCKED. Verify repository, baseline ancestry and readable Git history. Values intentionally withheld.');process.exitCode=1;
  }
}
