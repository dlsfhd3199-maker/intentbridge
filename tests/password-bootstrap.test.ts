import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname,basename} from "node:path";
import {spawnSync} from "node:child_process";
import {PrismaClient} from "@prisma/client";
import {verifyPassword} from "../lib/password";
test("기존 관리자/계정의 일회성 비밀번호 설정은 상태·Membership을 보존하고 덮어쓰기를 거부한다",async()=>{
 const root=resolve(tmpdir()),dir=mkdtempSync(join(root,"intentbridge-bootstrap-"));
 const env={...process.env,DATABASE_URL:"file:"+join(dir,"test.db").replaceAll("\\","/"),RUST_LOG:"info",INITIAL_ADMIN_EMAIL:"existing@example.invalid",INITIAL_ADMIN_PASSWORD:"Initial-test-password-123!",AUTH_PASSWORD_EMAIL:"disabled@example.invalid",AUTH_INITIAL_PASSWORD:"Other-test-password-123!"};
 const run=(args:string[])=>spawnSync(process.execPath,args,{env,encoding:"utf8",timeout:60000});const cli=(path:string)=>run(["node_modules/tsx/dist/cli.mjs",path]);const db=new PrismaClient({datasourceUrl:env.DATABASE_URL});
 try{
  assert.equal(run(["node_modules/prisma/build/index.js","migrate","deploy"]).status,0);
  const admin=await db.user.create({data:{email:env.INITIAL_ADMIN_EMAIL,status:"ACTIVE",role:"ADMIN"}});
  const user=await db.user.create({data:{email:env.AUTH_PASSWORD_EMAIL,status:"DISABLED",role:"ADVERTISER"}});
  const advertiser=await db.advertiser.create({data:{name:"Existing workspace",mockData:{}}});await db.advertiserMember.create({data:{userId:user.id,advertiserId:advertiser.id}});
  await db.session.create({data:{userId:admin.id,sessionToken:"old-session-test-hash",expires:new Date(Date.now()+10000)}});
  assert.equal(cli("scripts/create-admin.ts").status,0);assert.equal(await db.user.count(),2);assert.equal(await db.session.count({where:{userId:admin.id}}),0);
  const active=await db.user.findUniqueOrThrow({where:{id:admin.id}});assert.equal(await verifyPassword(active.passwordHash,env.INITIAL_ADMIN_PASSWORD),true);assert.equal(cli("scripts/create-admin.ts").status,1);
  assert.equal(cli("scripts/initialize-password.ts").status,0);const disabled=await db.user.findUniqueOrThrow({where:{id:user.id}});assert.equal(disabled.status,"DISABLED");assert.equal(disabled.role,"ADVERTISER");assert.equal(await db.advertiserMember.count({where:{userId:user.id}}),1);assert.equal(await verifyPassword(disabled.passwordHash,env.AUTH_INITIAL_PASSWORD),true);assert.equal(cli("scripts/initialize-password.ts").status,1);
  const audit=JSON.stringify(await db.auditLog.findMany());assert.ok(!audit.includes(active.passwordHash!));assert.ok(!audit.includes(env.INITIAL_ADMIN_PASSWORD));assert.ok(!audit.includes(disabled.passwordHash!));
 }finally{await db.$disconnect();assert.equal(dirname(resolve(dir)),root);assert.ok(basename(dir).startsWith("intentbridge-bootstrap-"));rmSync(dir,{recursive:true,force:true});}
});
