import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname,basename} from "node:path";
import {spawnSync} from "node:child_process";
import {safeAuthError,emailLoginDecision,emailLoginAllowed} from "../lib/auth-diagnostics";
import {authFailure,authOperation} from "../lib/server/auth-trace";
import {withRequest} from "../lib/server/request-context";
import {sendLoginEmail} from "../lib/server/email";

test("인증 원인은 폐쇄된 분류만 보존하고 중첩 Auth.js/Prisma 오류의 비밀값을 버린다",()=>{
 const secret="private@example.invalid?token=DO_NOT_LOG";
 const error=Object.assign(new Error(secret),{type:"AdapterError",cause:{err:Object.assign(new Error(secret),{name:"PrismaClientKnownRequestError",code:"P2021",meta:{secret}})}});
 assert.equal(safeAuthError({name:"PrismaClientInitializationError",errorCode:"P1001"}).databaseCode,"P1001");
 assert.deepEqual(safeAuthError(error),{category:"AdapterError",causeName:"PrismaClientKnownRequestError",databaseCode:"P2021"});
 assert.ok(!JSON.stringify(safeAuthError({type:secret,name:secret,cause:{err:{name:secret,code:secret}}})).includes(secret));
 assert.equal(safeAuthError(Object.assign(new Error(secret),{type:"AccessDenied"})).category,"AccessDenied");
});
test("기존 ACTIVE / 유효 INVITED 정책을 유지하고 미등록·DISABLED·만료/수락 초대를 거부한다",()=>{
 const now=new Date(),future=new Date(now.getTime()+10000),past=new Date(now.getTime()-10000);
 for(const [user,allowed] of [[null,false],[{status:"ACTIVE",invitations:[]},true],[{status:"DISABLED",invitations:[]},false],[{status:"INVITED",invitations:[]},false],[{status:"INVITED",invitations:[{expiresAt:future,acceptedAt:null}]},true],[{status:"INVITED",invitations:[{expiresAt:past,acceptedAt:null}]},false],[{status:"INVITED",invitations:[{expiresAt:future,acceptedAt:past}]},false]] as const){assert.equal(emailLoginAllowed(emailLoginDecision(user?{...user,invitations:[...user.invitations]}:null,now)),allowed);}
});
test("메일 실패와 동시 토큰 실패의 로그는 requestId·stage·HTTP 상태만 안전하게 보존한다",async()=>{
 const lines:string[]=[];const write=process.stdout.write;const fetcher=globalThis.fetch;const level=process.env.LOG_LEVEL;process.env.LOG_LEVEL="info";
 process.stdout.write=((chunk:unknown)=>{lines.push(String(chunk));return true;}) as typeof write;
 globalThis.fetch=async()=>new Response("PRIVATE_PROVIDER_RESPONSE",{status:503});
 try{await withRequest(new Request("http://localhost"),async()=>{
  await assert.rejects(sendLoginEmail({identifier:"private@example.invalid",url:"https://example.invalid/?token=PRIVATE_TOKEN",provider:{apiKey:"PRIVATE_KEY"}}));
  await assert.rejects(authOperation("token.create",async()=>{throw Object.assign(new Error("PRIVATE_DB_PASSWORD"),{name:"PrismaClientKnownRequestError",code:"P2021"});}));
  authFailure("auth.failed","email.send",Object.assign(new Error("PRIVATE_CAUSE"),{type:"EmailSignInError"}));return new Response();
 });}finally{process.stdout.write=write;globalThis.fetch=fetcher;if(level===undefined)delete process.env.LOG_LEVEL;else process.env.LOG_LEVEL=level;}
 const records=lines.map(line=>JSON.parse(line));assert.ok(records.some(r=>r.event==="auth.email.send.started"));assert.ok(records.some(r=>r.event==="auth.email.send.failed"&&r.status===503));assert.ok(records.some(r=>r.authStage==="token.create"&&r.databaseCode==="P2021"));assert.equal(new Set(records.map(r=>r.requestId)).size,1);assert.ok(records[0].requestId);assert.doesNotMatch(lines.join(""),/PRIVATE_|private@|token=/);
});
test("빈 로컬 DB 진단 → 기존 명시적 관리자 생성 → 재실행 거부 (외부 DB 미접속)",()=>{
 const temporaryRoot=resolve(tmpdir());const directory=mkdtempSync(join(temporaryRoot,"intentbridge-auth-"));
 const env={...process.env,RUST_LOG:"info",DATABASE_URL:"file:"+join(directory,"auth.db").replaceAll("\\","/"),INITIAL_ADMIN_PASSWORD:"Isolated-test-password-123!",INITIAL_ADMIN_EMAIL:"first-admin@example.invalid",AUTH_DIAGNOSTIC_EMAIL:"first-admin@example.invalid"};
 const run=(args:string[])=>spawnSync(process.execPath,args,{cwd:process.cwd(),env,encoding:"utf8",timeout:60000});
 const cli=(file:string)=>run(["node_modules/tsx/dist/cli.mjs",file]);
 try{
  const migration=run(["node_modules/prisma/build/index.js","migrate","deploy","--schema",resolve("prisma/schema.prisma")]);assert.equal(migration.status,0,migration.stderr);
  let result=cli("scripts/diagnose-auth.ts");assert.equal(result.status,0);let diagnosis=JSON.parse(result.stdout.trim().split("\n").at(-1)!);assert.equal(diagnosis.counts.users,0);assert.equal(diagnosis.target.reason,"user_not_registered");
  assert.equal(cli("scripts/create-admin.ts").status,0);
  result=cli("scripts/diagnose-auth.ts");diagnosis=JSON.parse(result.stdout.trim().split("\n").at(-1)!);assert.equal(diagnosis.counts.activeAdmins,1);assert.equal(diagnosis.target.allowed,true);assert.ok(!result.stdout.includes(env.INITIAL_ADMIN_EMAIL));
  assert.equal(cli("scripts/create-admin.ts").status,1);
 }finally{assert.equal(dirname(resolve(directory)),temporaryRoot);assert.ok(basename(directory).startsWith("intentbridge-auth-"));rmSync(directory,{recursive:true,force:true});}
});
