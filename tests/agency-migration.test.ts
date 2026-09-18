import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname,basename} from "node:path";
import {spawnSync} from "node:child_process";
import {PrismaClient} from "@prisma/client";

test("ADMIN 역할 migration SQL은 계정·비밀번호·Session·N:N Membership을 보존한다",async()=>{
 const root=resolve(tmpdir()),dir=mkdtempSync(join(root,"intentbridge-role-migration-"));
 const databaseUrl="file:"+join(dir,"test.db").replaceAll("\\","/");
 const db=new PrismaClient({datasourceUrl:databaseUrl});
 try{
  const result=spawnSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:{...process.env,DATABASE_URL:databaseUrl,RUST_LOG:"info"},encoding:"utf8",timeout:60000});
  assert.equal(result.status,0);
  const a=await db.advertiser.create({data:{name:"A",mockData:{}}}),b=await db.advertiser.create({data:{name:"B",mockData:{}}});
  const admin=await db.user.create({data:{email:"admin@migration.invalid",role:"ADMIN",status:"ACTIVE",passwordHash:"preserved-hash",members:{create:[{advertiserId:a.id,role:"ADMIN"},{advertiserId:b.id,role:"ADMIN"}]}}});
  await db.user.create({data:{email:"viewer@migration.invalid",role:"ADVERTISER",status:"ACTIVE",members:{create:{advertiserId:a.id}}}});
  await db.session.create({data:{userId:admin.id,sessionToken:"preserved-session",expires:new Date(Date.now()+60000)}});
  const users=await db.user.findMany({orderBy:{id:"asc"}}),members=await db.advertiserMember.findMany({orderBy:[{userId:"asc"},{advertiserId:"asc"}]}),sessions=await db.session.findMany();
  const path="202609180002_agency_roles/migration.sql",sql=readFileSync("prisma/migrations/"+path,"utf8");
  assert.equal(sql,readFileSync("prisma/postgresql/migrations/"+path,"utf8"));
  for(const statement of sql.replace(/--[^\n]*/g,"").split(";").filter(s=>s.trim()))await db.$executeRawUnsafe(statement);
  assert.deepEqual(await db.user.findMany({orderBy:{id:"asc"}}),users.map(u=>({...u,role:u.role==="ADMIN"?"SUPER_ADMIN":u.role})));
  assert.deepEqual(await db.advertiserMember.findMany({orderBy:[{userId:"asc"},{advertiserId:"asc"}]}),members.map(m=>({...m,role:m.role==="ADMIN"?"SUPER_ADMIN":m.role})));
  assert.deepEqual(await db.session.findMany(),sessions);
 }finally{await db.$disconnect();assert.equal(dirname(resolve(dir)),root);assert.ok(basename(dir).startsWith("intentbridge-role-migration-"));rmSync(dir,{recursive:true,force:true});}
});
