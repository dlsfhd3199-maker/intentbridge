import {test,expect,loginAs,saved} from "./fixtures";
import {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
const db=new PrismaClient({datasourceUrl:"file:./browser-test.db"});const headers={Origin:"http://localhost:3100"};
test.afterAll(()=>db.$disconnect());
test("MANAGER 승인·복수 배정·Dashboard·N:N·IDOR·운영 쓰기·연결 최소 권한",async({page,browser})=>{
 const suffix=crypto.randomUUID(),email=suffix+"@manager.invalid";const manager=await db.user.create({data:{email,name:"담당 마케터",status:"PENDING",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!)}});
 const a=await db.advertiser.findUniqueOrThrow({where:{id:"brand-a"}});const other=await db.advertiser.create({data:{name:"미배정 비공개 브랜드",mockData:a.mockData!}});
 const second=await db.user.create({data:{email:suffix+"@manager2.invalid",status:"ACTIVE",role:"MANAGER",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!),members:{create:[{advertiserId:"brand-a",role:"MANAGER"},{advertiserId:other.id,role:"MANAGER"}]}}});
 const context=await browser.newContext({baseURL:"http://localhost:3100"}),marketer=await context.newPage();
 try{
  await page.goto("/settings");await page.getByRole("button",{name:"승인 대기",exact:true}).click();await page.getByRole("row").filter({hasText:email}).getByRole("button",{name:"승인 및 광고주 연결"}).click();const modal=page.getByRole("dialog");await modal.getByLabel("승인 역할").selectOption("MANAGER");await modal.getByLabel("브랜드 A",{exact:true}).check();await modal.getByLabel("브랜드 B",{exact:true}).check();await modal.getByRole("button",{name:"승인 및 연결",exact:true}).click();await expect(modal).not.toBeVisible();
  expect((await db.user.findUniqueOrThrow({where:{id:manager.id}})).role).toBe("MANAGER");expect(await db.advertiserMember.count({where:{userId:manager.id}})).toBe(2);expect(await db.advertiserMember.count({where:{advertiserId:"brand-a",role:"MANAGER"}})).toBe(2);
  await marketer.goto("http://localhost:3100/login");await loginAs(marketer,email);await expect(marketer.getByTestId("manager-dashboard")).toBeVisible();expect(await marketer.getByLabel("광고주 워크스페이스").locator("option").count()).toBe(2);
  const boot=await(await marketer.request.get("http://localhost:3100/api/bootstrap")).json();expect(boot.fixtures.advertisers.map((x:{id:string})=>x.id).sort()).toEqual(["brand-a","brand-b"]);expect(JSON.stringify(boot)).not.toContain(other.name);
  const summaries=await(await marketer.request.get("http://localhost:3100/api/workspace-summaries")).json();expect(summaries).toHaveLength(2);expect(summaries.every((x:{dashboard:{advertiser:{id:string}}})=>["brand-a","brand-b"].includes(x.dashboard.advertiser.id))).toBe(true);await expect(marketer.getByTestId("manager-dashboard").locator(".ux-kpis strong").first()).toHaveText("2");
  await marketer.getByLabel("광고주 워크스페이스").selectOption("brand-b");await expect(marketer.locator(".brand-context")).toContainText("브랜드 B");
  for(const route of ["/funnel","/performance","/campaigns","/operations","/reports","/connections"]){const response=await marketer.goto("http://localhost:3100"+route+"?advertiser=brand-b");expect(response?.status()).toBe(200);}
  await marketer.getByRole("button",{name:"Google Analytics 4",exact:true}).click();await expect(marketer.getByRole("button",{name:"연결 테스트",exact:true})).toHaveCount(0);await expect(marketer.getByRole("heading",{name:"App Settings",exact:true})).toHaveCount(0);
  for(const route of ["/settings","/advertisers","/funnel?advertiser="+other.id,"/operations?advertiser="+other.id])expect((await marketer.goto("http://localhost:3100"+route))?.status()).toBe(403);
  for(const route of ["/api/admin/users","/api/admin/advertisers","/api/admin/audit","/api/admin/workspace-summaries","/api/workspace-documents","/api/workspaces/"+other.id,"/api/ga4?advertiser="+other.id,"/api/workspace-summary?advertiser="+other.id])expect((await marketer.request.get("http://localhost:3100"+route)).status()).toBe(403);
  expect((await marketer.request.get("http://localhost:3100/api/workspaces/brand-a/connection")).status()).toBe(200);expect(await(await marketer.request.get("http://localhost:3100/api/workspaces/brand-a/connection")).text()).not.toContain("propertyId");
  expect((await marketer.request.patch("http://localhost:3100/api/workspaces/brand-a/connection",{headers,data:{dataMode:"real"}})).status()).toBe(403);expect((await marketer.request.post("http://localhost:3100/api/ga4?advertiser=brand-a",{headers})).status()).toBe(403);
  expect((await marketer.request.put("http://localhost:3100/api/workspace-data",{headers,data:{key:"intentbridge:simulation-library:v1:brand-a",revision:0,payload:[]}})).status()).toBe(200);
  expect((await marketer.request.put("http://localhost:3100/api/workspace-data",{headers,data:{key:"intentbridge:simulation-library:v1:"+other.id,revision:0,payload:[]}})).status()).toBe(403);
  await marketer.goto("http://localhost:3100/campaigns?advertiser=brand-b");await marketer.getByLabel("실행안 이름",{exact:true}).fill("마케터 운영 검증");await marketer.getByRole("button",{name:"실행안 저장",exact:true}).click();await saved(marketer);expect(await db.campaign.count({where:{advertiserId:"brand-b"}})).toBe(1);
  await page.getByRole("button",{name:"내부 마케터",exact:true}).click();await expect(page.getByRole("row").filter({hasText:email})).toContainText("2개 광고주");
 }finally{await context.close();await db.user.deleteMany({where:{id:{in:[manager.id,second.id]}}});await db.advertiser.delete({where:{id:other.id}});}
});
test("배정 제거·역할 변경은 세션을 즉시 취소하고 SUPER_ADMIN을 보호한다",async({page,browser})=>{
 const email=crypto.randomUUID()+"@revoke.invalid",user=await db.user.create({data:{email,name:"변경 마케터",role:"MANAGER",status:"ACTIVE",passwordHash:await hashPassword(process.env.TEST_LOGIN_PASSWORD!),members:{create:[{advertiserId:"brand-a",role:"MANAGER"},{advertiserId:"brand-b",role:"MANAGER"}]}}});
 const context=await browser.newContext({baseURL:"http://localhost:3100"}),worker=await context.newPage();
 try{
  await worker.goto("http://localhost:3100/login");await loginAs(worker,email);
  await page.goto("/settings");await page.getByRole("button",{name:"내부 마케터",exact:true}).click();await page.getByRole("row").filter({hasText:email}).getByRole("button",{name:"연결·권한 수정"}).click();await page.getByRole("button",{name:"브랜드 B 배정 제거",exact:true}).click();await page.getByRole("button",{name:"사용자 변경 저장",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"사용자 정보가 저장"})).toBeVisible();expect((await worker.request.get("http://localhost:3100/api/bootstrap")).status()).toBe(401);
  await loginAs(worker,email);expect((await worker.request.get("http://localhost:3100/api/workspaces/brand-b")).status()).toBe(403);
  expect((await page.request.patch("/api/admin/users",{headers,data:{id:user.id,name:user.name,role:"ADVERTISER",status:"ACTIVE",advertiserIds:["brand-a"]}})).status()).toBe(200);expect((await worker.request.get("http://localhost:3100/api/bootstrap")).status()).toBe(401);await loginAs(worker,email);expect((await worker.goto("http://localhost:3100/operations"))?.status()).toBe(403);
  expect((await page.request.patch("/api/admin/users",{headers,data:{id:"dev-admin",name:"Admin",role:"MANAGER",status:"ACTIVE",advertiserIds:["brand-a"]}})).status()).toBe(409);expect((await page.request.patch("/api/admin/users",{headers,data:{id:"dev-admin",action:"disable"}})).status()).toBe(409);
  const audit=await db.auditLog.findMany({where:{resource:user.id}});for(const action of ["manager.unassigned","role.changed","workspace.access.changed"])expect(audit.some(a=>a.action===action&&a.actorUserId==="dev-admin")).toBe(true);expect(audit.filter(a=>a.action==="manager.unassigned").every(a=>!!a.advertiserId)).toBe(true);
 }finally{await context.close();await db.user.delete({where:{id:user.id}});}
});
